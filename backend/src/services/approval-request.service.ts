import type { ApprovalRequestType, Prisma } from '@prisma/client';
import { prisma } from '../database';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../types';
import { createAuditLog } from './audit.service';
import { createBulkNotification, createNotification, emitNotifications, getUsersByRole } from './notification.service';
import { issueRefund, voidPayment } from './payment.service';
import { stockMovementService } from './index';
import { correctAttendance } from './shift.service';

interface CreateApprovalRequestInput {
  restaurantId: string;
  requestType: ApprovalRequestType;
  title: string;
  description?: string;
  entityType?: string;
  entityId?: string;
  payload: Prisma.InputJsonValue;
  requestedById: string;
  ipAddress?: string;
  userAgent?: string;
}

export async function createApprovalRequest(input: CreateApprovalRequestInput) {
  const existing = await prisma.approvalRequest.findFirst({
    where: {
      restaurantId: input.restaurantId,
      requestType: input.requestType,
      entityType: input.entityType,
      entityId: input.entityId,
      status: 'PENDING',
    },
  });

  if (existing) {
    throw new ConflictError('A pending approval request already exists for this item');
  }

  const request = await prisma.approvalRequest.create({
    data: {
      restaurantId: input.restaurantId,
      requestType: input.requestType,
      title: input.title,
      description: input.description || null,
      entityType: input.entityType || null,
      entityId: input.entityId || null,
      payload: input.payload,
      requestedById: input.requestedById,
    },
    include: approvalInclude,
  });

  await notifyManagers(request.restaurantId, request.id, request.title, request.description || undefined, input.requestedById);

  await createAuditLog({
    restaurantId: input.restaurantId,
    userId: input.requestedById,
    action: 'APPROVAL_REQUEST_CREATED',
    entityType: 'ApprovalRequest',
    entityId: request.id,
    description: request.title,
    metadata: {
      requestType: request.requestType,
      targetEntityType: request.entityType,
      targetEntityId: request.entityId,
    },
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  });

  return request;
}

export async function listApprovalRequests(
  restaurantId: string,
  filters: { status?: string; requestType?: string; page?: number; limit?: number } = {}
) {
  const page = filters.page || 1;
  const limit = Math.min(filters.limit || 50, 100);
  const where: any = { restaurantId };
  if (filters.status) where.status = filters.status;
  if (filters.requestType) where.requestType = filters.requestType;

  const [requests, total] = await Promise.all([
    prisma.approvalRequest.findMany({
      where,
      include: approvalInclude,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.approvalRequest.count({ where }),
  ]);

  return { requests, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function approveApprovalRequest(
  requestId: string,
  restaurantId: string,
  reviewerId: string,
  note?: string,
  ipAddress?: string,
  userAgent?: string
) {
  const request = await prisma.approvalRequest.findFirst({ where: { id: requestId, restaurantId } });
  if (!request) throw new NotFoundError('Approval request not found');
  if (request.status !== 'PENDING') throw new ConflictError(`Request has already been ${request.status.toLowerCase()}`);
  if (request.requestedById === reviewerId) throw new ForbiddenError('You cannot approve your own request');

  const claimed = await prisma.approvalRequest.updateMany({
    where: { id: requestId, restaurantId, status: 'PENDING' },
    data: { status: 'APPROVED', reviewedById: reviewerId, reviewedAt: new Date(), decisionNote: note || null },
  });
  if (claimed.count === 0) throw new ConflictError('Request has already been decided');

  try {
    await executeApprovedRequest(request, reviewerId, ipAddress, userAgent);
  } catch (error) {
    await prisma.approvalRequest.update({
      where: { id: requestId },
      data: { status: 'PENDING', reviewedById: null, reviewedAt: null, decisionNote: `Approval execution failed: ${error instanceof Error ? error.message : 'Unknown error'}` },
    });
    throw error;
  }

  const updated = await prisma.approvalRequest.findUniqueOrThrow({ where: { id: requestId }, include: approvalInclude });
  await notifyRequester(updated.requestedById, updated.restaurantId, updated.id, 'Approval request approved', updated.title);

  await createAuditLog({
    restaurantId,
    userId: reviewerId,
    action: 'APPROVAL_REQUEST_APPROVED',
    entityType: 'ApprovalRequest',
    entityId: requestId,
    description: updated.title,
    metadata: { requestType: updated.requestType, note },
    ipAddress,
    userAgent,
  });

  return updated;
}

export async function rejectApprovalRequest(
  requestId: string,
  restaurantId: string,
  reviewerId: string,
  reason: string,
  ipAddress?: string,
  userAgent?: string
) {
  const result = await prisma.approvalRequest.updateMany({
    where: { id: requestId, restaurantId, status: 'PENDING' },
    data: {
      status: 'REJECTED',
      reviewedById: reviewerId,
      reviewedAt: new Date(),
      rejectionReason: reason,
    },
  });
  if (result.count === 0) {
    const existing = await prisma.approvalRequest.findFirst({ where: { id: requestId, restaurantId } });
    if (!existing) throw new NotFoundError('Approval request not found');
    throw new ConflictError(`Request has already been ${existing.status.toLowerCase()}`);
  }

  const updated = await prisma.approvalRequest.findUniqueOrThrow({ where: { id: requestId }, include: approvalInclude });
  await notifyRequester(updated.requestedById, updated.restaurantId, updated.id, 'Approval request rejected', `${updated.title}: ${reason}`);

  await createAuditLog({
    restaurantId,
    userId: reviewerId,
    action: 'APPROVAL_REQUEST_REJECTED',
    entityType: 'ApprovalRequest',
    entityId: requestId,
    description: updated.title,
    metadata: { requestType: updated.requestType, reason },
    ipAddress,
    userAgent,
  });

  return updated;
}

async function executeApprovedRequest(request: any, reviewerId: string, ipAddress?: string, userAgent?: string) {
  const payload = request.payload as any;
  if (request.requestType === 'PAYMENT_VOID') {
    await voidPayment(payload.paymentId, payload.reason, reviewerId, request.restaurantId, ipAddress, userAgent);
    return;
  }

  if (request.requestType === 'REFUND') {
    await issueRefund(
      payload.paymentId,
      payload.amount,
      payload.method,
      payload.reason,
      reviewerId,
      request.restaurantId,
      payload.referenceNumber,
      payload.notes,
      payload.idempotencyKey,
      ipAddress,
      userAgent
    );
    return;
  }

  if (request.requestType === 'STOCK_ADJUSTMENT') {
    await stockMovementService.createAdjustment(request.restaurantId, payload, reviewerId, ['ADMIN', 'MANAGER'], ipAddress);
    return;
  }

  if (request.requestType === 'ATTENDANCE_CORRECTION') {
    await correctAttendance(payload.assignmentId, request.restaurantId, payload.correctionData, reviewerId, ipAddress, userAgent);
  }
}

async function notifyManagers(restaurantId: string, requestId: string, title: string, message?: string, requestedById?: string) {
  const userIds = (await getUsersByRole(restaurantId, ['ADMIN', 'MANAGER'])).filter((id) => id !== requestedById);
  if (userIds.length === 0) return;
  const notifications = await createBulkNotification({
    restaurantId,
    userIds,
    type: 'APPROVAL_NEEDED',
    title,
    message,
    entityType: 'approval_request',
    entityId: requestId,
  });
  await emitNotifications(notifications);
}

async function notifyRequester(userId: string, restaurantId: string, requestId: string, title: string, message?: string) {
  const notification = await createNotification({
    restaurantId,
    userId,
    type: 'SYSTEM',
    title,
    message,
    entityType: 'approval_request',
    entityId: requestId,
  });
  if (notification) await emitNotifications([notification]);
}

const approvalInclude = {
  requestedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
  reviewedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
};
