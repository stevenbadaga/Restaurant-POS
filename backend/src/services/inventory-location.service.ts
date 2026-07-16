import { z } from 'zod';
import { prisma } from '../database';
import { Prisma } from '@prisma/client';
import { createAuditLog } from './audit.service';
import type { PrismaClient } from '@prisma/client';

type TxClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

export const locationSchema = z.object({
  name: z.string().min(1).max(100),
  code: z.string().min(1).max(20).transform(s => s.toUpperCase()),
  description: z.string().optional(),
  locationType: z.string().optional(),
  isDefault: z.boolean().optional(),
});

export const locationUpdateSchema = locationSchema.partial();

export async function getLocations(restaurantId: string, filters: { search?: string; isActive?: boolean } = {}) {
  const where: Prisma.StockLocationWhereInput = { restaurantId };

  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: 'insensitive' } },
      { code: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  if (filters.isActive !== undefined) {
    where.isActive = filters.isActive;
  }

  const locations = await prisma.stockLocation.findMany({
    where,
    orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    include: {
      _count: { select: { inventoryBalances: true } },
    },
  });

  return locations;
}

export async function getLocationById(restaurantId: string, id: string) {
  const location = await prisma.stockLocation.findFirst({
    where: { id, restaurantId },
    include: {
      _count: { select: { inventoryBalances: true, stockReceipts: true } },
    },
  });

  return location;
}

export async function createLocation(restaurantId: string, data: z.infer<typeof locationSchema>, userId: string, ipAddress?: string) {
  const location = await prisma.$transaction(async (tx) => {
    // If setting as default, unset other defaults
    if (data.isDefault) {
      await tx.stockLocation.updateMany({
        where: { restaurantId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const created = await tx.stockLocation.create({
      data: {
        restaurantId,
        name: data.name,
        code: data.code,
        description: data.description,
        locationType: data.locationType,
        isDefault: data.isDefault || false,
      },
    });

    return created;
  });

  await createAuditLog({
    restaurantId,
    userId,
    action: 'STOCK_LOCATION_CREATED',
    entityType: 'StockLocation',
    entityId: location.id,
    description: `Stock location "${location.name}" created`,
    ipAddress,
  });

  return location;
}

export async function updateLocation(restaurantId: string, id: string, data: z.infer<typeof locationUpdateSchema>, userId: string, ipAddress?: string) {
  const existing = await prisma.stockLocation.findFirst({ where: { id, restaurantId } });
  if (!existing) return null;

  const location = await prisma.$transaction(async (tx) => {
    // If setting as default, unset other defaults
    if (data.isDefault) {
      await tx.stockLocation.updateMany({
        where: { restaurantId, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    const updated = await tx.stockLocation.update({
      where: { id },
      data: {
        name: data.name,
        code: data.code,
        description: data.description,
        locationType: data.locationType,
        isDefault: data.isDefault,
      },
    });

    return updated;
  });

  await createAuditLog({
    restaurantId,
    userId,
    action: 'STOCK_LOCATION_UPDATED',
    entityType: 'StockLocation',
    entityId: location.id,
    description: `Stock location "${location.name}" updated`,
    metadata: { previousName: existing.name },
    ipAddress,
  });

  return location;
}

export async function updateLocationStatus(restaurantId: string, id: string, isActive: boolean, userId: string, ipAddress?: string) {
  const existing = await prisma.stockLocation.findFirst({ where: { id, restaurantId } });
  if (!existing) return null;

  const location = await prisma.stockLocation.update({
    where: { id },
    data: { isActive },
  });

  await createAuditLog({
    restaurantId,
    userId,
    action: isActive ? 'STOCK_LOCATION_ACTIVATED' : 'STOCK_LOCATION_DEACTIVATED',
    entityType: 'StockLocation',
    entityId: location.id,
    description: `Stock location "${location.name}" ${isActive ? 'activated' : 'deactivated'}`,
    ipAddress,
  });

  return location;
}

export async function setDefaultLocation(restaurantId: string, id: string, userId: string, ipAddress?: string) {
  const existing = await prisma.stockLocation.findFirst({ where: { id, restaurantId } });
  if (!existing) return null;

  await prisma.$transaction(async (tx) => {
    await tx.stockLocation.updateMany({
      where: { restaurantId, isDefault: true },
      data: { isDefault: false },
    });

    await tx.stockLocation.update({
      where: { id },
      data: { isDefault: true },
    });
  });

  await createAuditLog({
    restaurantId,
    userId,
    action: 'DEFAULT_LOCATION_CHANGED',
    entityType: 'StockLocation',
    entityId: id,
    description: `"${existing.name}" set as default stock location`,
    ipAddress,
  });

  return { ...existing, isDefault: true };
}

export async function ensureDefaultLocation(restaurantId: string, userId?: string) {
  const existingLocation = await prisma.stockLocation.findFirst({
    where: { restaurantId },
  });

  if (existingLocation) return existingLocation;

  return prisma.stockLocation.create({
    data: {
      restaurantId,
      name: 'Main Store',
      code: 'MAIN',
      description: 'Default stock location',
      isDefault: true,
    },
  });
}
