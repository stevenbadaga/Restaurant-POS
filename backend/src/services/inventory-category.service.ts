import { z } from 'zod';
import { prisma } from '../database';
import { Prisma } from '@prisma/client';
import { createAuditLog } from './audit.service';

export const categorySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  displayOrder: z.number().int().min(0).optional(),
});

export const categoryUpdateSchema = categorySchema.partial();

export async function getCategories(restaurantId: string, filters: { search?: string; isActive?: boolean } = {}) {
  const where: Prisma.InventoryCategoryWhereInput = { restaurantId };

  if (filters.search) {
    where.name = { contains: filters.search, mode: 'insensitive' };
  }

  if (filters.isActive !== undefined) {
    where.isActive = filters.isActive;
  }

  return prisma.inventoryCategory.findMany({
    where,
    orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    include: {
      _count: { select: { inventoryItems: true } },
    },
  });
}

export async function getCategoryById(restaurantId: string, id: string) {
  return prisma.inventoryCategory.findFirst({
    where: { id, restaurantId },
    include: {
      _count: { select: { inventoryItems: true } },
      inventoryItems: {
        where: { isActive: true },
        select: { id: true, name: true, sku: true, baseUnit: true },
      },
    },
  });
}

export async function createCategory(restaurantId: string, data: z.infer<typeof categorySchema>, userId: string, ipAddress?: string) {
  const category = await prisma.inventoryCategory.create({
    data: {
      restaurantId,
      name: data.name,
      description: data.description,
      displayOrder: data.displayOrder ?? 0,
    },
  });

  await createAuditLog({
    restaurantId, userId,
    action: 'INVENTORY_CATEGORY_CREATED',
    entityType: 'InventoryCategory',
    entityId: category.id,
    description: `Inventory category "${category.name}" created`,
    ipAddress,
  });

  return category;
}

export async function updateCategory(restaurantId: string, id: string, data: z.infer<typeof categoryUpdateSchema>, userId: string, ipAddress?: string) {
  const existing = await prisma.inventoryCategory.findFirst({ where: { id, restaurantId } });
  if (!existing) return null;

  const category = await prisma.inventoryCategory.update({
    where: { id },
    data: {
      name: data.name,
      description: data.description,
      displayOrder: data.displayOrder,
    },
  });

  await createAuditLog({
    restaurantId, userId,
    action: 'INVENTORY_CATEGORY_UPDATED',
    entityType: 'InventoryCategory',
    entityId: category.id,
    description: `Inventory category "${category.name}" updated`,
    metadata: { previousName: existing.name },
    ipAddress,
  });

  return category;
}

export async function updateCategoryStatus(restaurantId: string, id: string, isActive: boolean, userId: string, ipAddress?: string) {
  const existing = await prisma.inventoryCategory.findFirst({ where: { id, restaurantId } });
  if (!existing) return null;

  const category = await prisma.inventoryCategory.update({
    where: { id },
    data: { isActive },
  });

  await createAuditLog({
    restaurantId, userId,
    action: isActive ? 'INVENTORY_CATEGORY_ACTIVATED' : 'INVENTORY_CATEGORY_DEACTIVATED',
    entityType: 'InventoryCategory',
    entityId: category.id,
    description: `Inventory category "${category.name}" ${isActive ? 'activated' : 'deactivated'}`,
    ipAddress,
  });

  return category;
}
