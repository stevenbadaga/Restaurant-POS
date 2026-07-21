import crypto from 'crypto';
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
  previousValue?: any;
  newValue?: any;
  severity?: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  ipAddress?: string;
  userAgent?: string;
  requestMethod?: string;
  requestPath?: string;
  correlationId?: string;
}

/**
 * Compute SHA-256 hash for tamper-resistant audit trail.
 * The hash links each log entry to the previous one, forming a chain.
 * Any modification to a past entry would break the chain.
 */
function computeHash(params: {
  id: string;
  restaurantId: string;
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  description?: string | null;
  severity: string;
  previousHash?: string | null;
  createdAt: Date;
}): string {
  const data = [
    params.id,
    params.restaurantId,
    params.userId || '',
    params.action,
    params.entityType,
    params.entityId || '',
    params.description || '',
    params.severity,
    params.previousHash || '',
    params.createdAt.toISOString(),
  ].join('|');

  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Get the hash of the most recent audit log for this restaurant,
 * used as the previousHash for the next entry.
 */
async function getLatestAuditHash(restaurantId: string): Promise<string | null> {
  const latest = await prisma.auditLog.findFirst({
    where: { restaurantId, hash: { not: null as any } },
    orderBy: { createdAt: 'desc' },
    select: { hash: true },
  });
  return latest?.hash || null;
}

export async function createAuditLog(params: CreateAuditLogParams): Promise<void> {
  // Auto-determine severity if not set
  const severity = params.severity || 'INFO';
  const id = crypto.randomUUID();
  const createdAt = new Date();
  const previousHash = await getLatestAuditHash(params.restaurantId);

  const hashInput = {
    id,
    restaurantId: params.restaurantId,
    userId: params.userId,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    description: params.description,
    severity,
    previousHash,
    createdAt,
  };

  const hash = computeHash(hashInput);

  const data: Prisma.AuditLogCreateInput = {
    id,
    restaurant: { connect: { id: params.restaurantId } },
    action: params.action,
    entityType: params.entityType,
    description: params.description,
    severity,
    hash,
    previousHash: previousHash || undefined,
    ...(params.metadata ? { metadata: params.metadata as Prisma.InputJsonValue } : {}),
    previousValue: params.previousValue as Prisma.InputJsonValue | undefined,
    newValue: params.newValue as Prisma.InputJsonValue | undefined,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
    requestMethod: params.requestMethod,
    requestPath: params.requestPath,
    correlationId: params.correlationId,
    createdAt,
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

/**
 * Verify the integrity of the audit trail for a restaurant.
 * Checks that each entry's hash matches its computed hash and
 * that the chain is unbroken (each entry's previousHash matches
 * the previous entry's hash).
 */
export async function verifyAuditTrailIntegrity(
  restaurantId: string,
  fromDate?: Date
): Promise<{ valid: boolean; brokenLinks: number; totalChecked: number }> {
  const where: any = { restaurantId, hash: { not: null } };
  if (fromDate) {
    where.createdAt = { gte: fromDate };
  }

  const entries = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      restaurantId: true,
      userId: true,
      action: true,
      entityType: true,
      entityId: true,
      description: true,
      severity: true,
      hash: true,
      previousHash: true,
      createdAt: true,
    },
  });

  let brokenLinks = 0;
  let previousHash: string | null = null;

  for (const entry of entries) {
    const computed = computeHash({
      id: entry.id,
      restaurantId: entry.restaurantId,
      userId: entry.userId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      description: entry.description,
      severity: entry.severity,
      previousHash,
      createdAt: entry.createdAt,
    });

    if (computed !== entry.hash) {
      brokenLinks++;
    }

    if (entry.previousHash !== previousHash) {
      brokenLinks++;
    }

    previousHash = entry.hash;
  }

  return {
    valid: brokenLinks === 0,
    brokenLinks,
    totalChecked: entries.length,
  };
}

/**
 * Search audit logs with filters and pagination.
 */
export async function searchAuditLogs(
  restaurantId: string,
  filters: {
    action?: string;
    entityType?: string;
    entityId?: string;
    userId?: string;
    severity?: string;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
    sortOrder?: 'asc' | 'desc';
  } = {}
) {
  const page = Math.max(1, filters.page || 1);
  const limit = Math.min(100, Math.max(1, filters.limit || 25));
  const skip = (page - 1) * limit;

  const where: any = { restaurantId };

  if (filters.action) where.action = filters.action;
  if (filters.entityType) where.entityType = filters.entityType;
  if (filters.entityId) where.entityId = filters.entityId;
  if (filters.userId) where.userId = filters.userId;
  if (filters.severity) where.severity = filters.severity;

  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {};
    if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom);
    if (filters.dateTo) where.createdAt.lte = new Date(filters.dateTo + 'T23:59:59.999Z');
  }

  if (filters.search) {
    where.OR = [
      { action: { contains: filters.search, mode: 'insensitive' } },
      { entityType: { contains: filters.search, mode: 'insensitive' } },
      { description: { contains: filters.search, mode: 'insensitive' } },
      { entityId: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { createdAt: filters.sortOrder === 'asc' ? 'asc' : 'desc' },
      skip,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    logs,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

/**
 * Get distinct audit log actions for filter dropdowns.
 */
export async function getAuditActions(restaurantId: string): Promise<string[]> {
  const results = await prisma.auditLog.groupBy({
    by: ['action'],
    where: { restaurantId },
    _count: { action: true },
    orderBy: { _count: { action: 'desc' } },
    take: 50,
  });
  return results.map(r => r.action);
}

/**
 * Get distinct entity types for filter dropdowns.
 */
export async function getAuditEntityTypes(restaurantId: string): Promise<string[]> {
  const results = await prisma.auditLog.groupBy({
    by: ['entityType'],
    where: { restaurantId },
    _count: { entityType: true },
    orderBy: { _count: { entityType: 'desc' } },
    take: 30,
  });
  return results.map(r => r.entityType);
}
