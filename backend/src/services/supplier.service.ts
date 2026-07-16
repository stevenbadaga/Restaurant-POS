import { z } from 'zod';
import { prisma } from '../database';
import { Prisma } from '@prisma/client';
import { createAuditLog } from './audit.service';

export const supplierSchema = z.object({
  name: z.string().min(1).max(200),
  supplierCode: z.string().min(1).max(50).transform(s => s.toUpperCase()),
  contactPerson: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().optional(),
  notes: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const supplierUpdateSchema = supplierSchema.partial();

export async function getSuppliers(restaurantId: string, filters: { search?: string; isActive?: boolean; page?: number; pageSize?: number } = {}) {
  const where: Prisma.SupplierWhereInput = { restaurantId };
  const page = filters.page || 1;
  const pageSize = filters.pageSize || 20;

  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: 'insensitive' } },
      { supplierCode: { contains: filters.search, mode: 'insensitive' } },
      { contactPerson: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  if (filters.isActive !== undefined) where.isActive = filters.isActive;

  const [suppliers, total] = await Promise.all([
    prisma.supplier.findMany({
      where,
      orderBy: { name: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { _count: { select: { stockReceipts: true } } },
    }),
    prisma.supplier.count({ where }),
  ]);

  return { suppliers, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function getSupplierById(restaurantId: string, id: string) {
  return prisma.supplier.findFirst({
    where: { id, restaurantId },
    include: {
      stockReceipts: {
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
      _count: { select: { stockReceipts: true } },
    },
  });
}

export async function createSupplier(restaurantId: string, data: z.infer<typeof supplierSchema>, userId: string, ipAddress?: string) {
  const supplier = await prisma.supplier.create({
    data: {
      restaurantId,
      name: data.name,
      supplierCode: data.supplierCode,
      contactPerson: data.contactPerson || null,
      phone: data.phone || null,
      email: data.email || null,
      address: data.address || null,
      notes: data.notes || null,
      isActive: data.isActive ?? true,
    },
  });

  await createAuditLog({
    restaurantId, userId,
    action: 'SUPPLIER_CREATED',
    entityType: 'Supplier',
    entityId: supplier.id,
    description: `Supplier "${supplier.name}" created`,
    ipAddress,
  });

  return supplier;
}

export async function updateSupplier(restaurantId: string, id: string, data: z.infer<typeof supplierUpdateSchema>, userId: string, ipAddress?: string) {
  const existing = await prisma.supplier.findFirst({ where: { id, restaurantId } });
  if (!existing) return null;

  const supplier = await prisma.supplier.update({
    where: { id },
    data: {
      name: data.name,
      supplierCode: data.supplierCode,
      contactPerson: data.contactPerson,
      phone: data.phone,
      email: data.email,
      address: data.address,
      notes: data.notes,
      isActive: data.isActive,
    },
  });

  await createAuditLog({
    restaurantId, userId,
    action: 'SUPPLIER_UPDATED',
    entityType: 'Supplier',
    entityId: supplier.id,
    description: `Supplier "${supplier.name}" updated`,
    ipAddress,
  });

  return supplier;
}

export async function updateSupplierStatus(restaurantId: string, id: string, isActive: boolean, userId: string, ipAddress?: string) {
  const existing = await prisma.supplier.findFirst({ where: { id, restaurantId } });
  if (!existing) return null;

  const supplier = await prisma.supplier.update({
    where: { id },
    data: { isActive },
  });

  await createAuditLog({
    restaurantId, userId,
    action: isActive ? 'SUPPLIER_ACTIVATED' : 'SUPPLIER_DEACTIVATED',
    entityType: 'Supplier',
    entityId: supplier.id,
    description: `Supplier "${supplier.name}" ${isActive ? 'activated' : 'deactivated'}`,
    ipAddress,
  });

  return supplier;
}
