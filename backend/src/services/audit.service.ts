import { prisma } from '../database';
import type { Prisma } from '@prisma/client';

type AuditMetadata = Record<string, unknown>;

interface CreateAuditLogParams {
  restaurantId: string;
  userId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  description?: string;
  metadata?: AuditMetadata;
  ipAddress?: string;
  userAgent?: string;
}

export async function createAuditLog(params: CreateAuditLogParams): Promise<void> {
  const data: Prisma.AuditLogCreateInput = {
    restaurant: { connect: { id: params.restaurantId } },
    action: params.action,
    entityType: params.entityType,
    description: params.description,
    metadata: params.metadata as Prisma.InputJsonValue | undefined,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
  };

  if (params.userId) {
    data.user = { connect: { id: params.userId } };
  }

  if (params.entityId) {
    data.entityId = params.entityId;
  }

  try {
    await prisma.auditLog.create({ data });
  } catch (error) {
    // Audit logging should never break the main operation
    console.error('Failed to create audit log:', error);
  }
}
