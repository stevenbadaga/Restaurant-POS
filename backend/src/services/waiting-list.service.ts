import { prisma } from '../database';
import { BadRequestError, NotFoundError } from '../types';
import { createAuditLog } from './audit.service';
import { generateSequenceNumber } from './sequence.service';

// ==========================================
// GENERATE QUEUE NUMBER
// ==========================================

async function generateQueueNumber(restaurantId: string, settings?: any): Promise<string> {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { timezone: true },
  });
  const seq = await generateSequenceNumber(
    restaurantId,
    'WAITING_LIST',
    'W',
    restaurant?.timezone ?? 'UTC'
  );
  // Format: W-001
  const parts = seq.split('-');
  const num = parts[parts.length - 1];
  return `W-${num.padStart(3, '0')}`;
}

// ==========================================
// CREATE ENTRY
// ==========================================

interface CreateWaitingListInput {
  customerId?: string;
  customerName: string;
  phone?: string;
  partySize: number;
  preferredDiningAreaId?: string;
  estimatedWaitMinutes?: number;
  notes?: string;
}

export async function createWaitingListEntry(
  restaurantId: string,
  userId: string,
  input: CreateWaitingListInput,
  settings?: any,
  ipAddress?: string,
  userAgent?: string
) {
  if (input.partySize < 1) throw new BadRequestError('Party size must be at least 1');

  const queueNumber = await generateQueueNumber(restaurantId);
  const estimate = input.estimatedWaitMinutes || settings?.defaultWaitingEstimateMinutes || 20;

  const entry = await prisma.waitingListEntry.create({
    data: {
      restaurantId,
      queueNumber,
      customerId: input.customerId || null,
      customerName: input.customerName,
      phone: input.phone || null,
      partySize: input.partySize,
      preferredDiningAreaId: input.preferredDiningAreaId || null,
      estimatedWaitMinutes: estimate,
      status: 'WAITING',
      notes: input.notes || null,
      createdById: userId,
    },
  });

  await createAuditLog({
    restaurantId,
    userId,
    action: 'Waiting list entry created',
    entityType: 'WaitingListEntry',
    entityId: entry.id,
    description: `${input.customerName} (${input.partySize} guests) added to waiting list as ${queueNumber}`,
    metadata: { queueNumber, partySize: input.partySize, estimatedWaitMinutes: estimate },
    ipAddress,
    userAgent,
  });

  return entry;
}

// ==========================================
// UPDATE ENTRY
// ==========================================

interface UpdateWaitingListInput {
  customerName?: string;
  phone?: string;
  partySize?: number;
  preferredDiningAreaId?: string | null;
  estimatedWaitMinutes?: number;
  notes?: string;
}

export async function updateWaitingListEntry(
  entryId: string,
  restaurantId: string,
  userId: string,
  input: UpdateWaitingListInput,
  ipAddress?: string,
  userAgent?: string
) {
  const entry = await prisma.waitingListEntry.findFirst({
    where: { id: entryId, restaurantId },
  });
  if (!entry) throw new NotFoundError('Waiting list entry not found');
  if (entry.status !== 'WAITING') throw new BadRequestError('Only WAITING entries can be updated');

  const updated = await prisma.waitingListEntry.update({
    where: { id: entryId },
    data: {
      customerName: input.customerName,
      phone: input.phone,
      partySize: input.partySize,
      preferredDiningAreaId: input.preferredDiningAreaId,
      estimatedWaitMinutes: input.estimatedWaitMinutes,
      notes: input.notes,
      updatedById: userId,
    },
  });

  return updated;
}

// ==========================================
// NOTIFY
// ==========================================

export async function notifyWaitingListEntry(
  entryId: string,
  restaurantId: string,
  userId: string,
  ipAddress?: string,
  userAgent?: string
) {
  const entry = await prisma.waitingListEntry.findFirst({
    where: { id: entryId, restaurantId },
  });
  if (!entry) throw new NotFoundError('Waiting list entry not found');
  if (entry.status !== 'WAITING') throw new BadRequestError('Entry is not in WAITING status');

  const updated = await prisma.waitingListEntry.update({
    where: { id: entryId },
    data: { status: 'NOTIFIED', notifiedAt: new Date(), updatedById: userId },
  });

  await createAuditLog({
    restaurantId,
    userId,
    action: 'Waiting list customer notified',
    entityType: 'WaitingListEntry',
    entityId: entryId,
    description: `${entry.customerName} (${entry.queueNumber}) notified`,
    metadata: { queueNumber: entry.queueNumber },
    ipAddress,
    userAgent,
  });

  return updated;
}

// ==========================================
// SEAT
// ==========================================

interface SeatWaitingInput {
  tableId: string;
  createOrder?: boolean;
  waiterId?: string;
  guestCount?: number;
}

export async function seatWaitingListEntry(
  entryId: string,
  restaurantId: string,
  userId: string,
  input: SeatWaitingInput,
  ipAddress?: string,
  userAgent?: string
) {
  const entry = await prisma.waitingListEntry.findFirst({
    where: { id: entryId, restaurantId },
  });
  if (!entry) throw new NotFoundError('Waiting list entry not found');
  if (!['WAITING', 'NOTIFIED'].includes(entry.status)) {
    throw new BadRequestError('Entry must be WAITING or NOTIFIED to be seated');
  }

  // Validate table
  const table = await prisma.restaurantTable.findFirst({
    where: { id: input.tableId, restaurantId, isActive: true, status: { not: 'OUT_OF_SERVICE' } },
  });
  if (!table) throw new BadRequestError('Table not available');
  if (table.capacity < (input.guestCount || entry.partySize)) {
    throw new BadRequestError('Table capacity is insufficient');
  }

  let orderId: string | undefined;

  if (input.createOrder !== false) {
    const order = await prisma.order.create({
      data: {
        restaurantId,
        orderNumber: `WL-${entry.queueNumber}`,
        orderType: 'DINE_IN',
        status: 'DRAFT',
        tableId: input.tableId,
        guestCount: input.guestCount || entry.partySize,
        customerName: entry.customerName,
        customerId: entry.customerId || undefined,
        waiterId: input.waiterId || userId,
        createdById: userId,
      },
    });
    orderId = order.id;
  }

  const updated = await prisma.waitingListEntry.update({
    where: { id: entryId },
    data: {
      status: 'SEATED',
      seatedAt: new Date(),
      tableId: input.tableId,
      orderId,
      updatedById: userId,
    },
  });

  await createAuditLog({
    restaurantId,
    userId,
    action: 'Waiting list customer seated',
    entityType: 'WaitingListEntry',
    entityId: entryId,
    description: `${entry.customerName} (${entry.queueNumber}) seated at table ${table.code || table.name}`,
    metadata: { queueNumber: entry.queueNumber, tableId: input.tableId, orderId },
    ipAddress,
    userAgent,
  });

  return updated;
}

// ==========================================
// MARK LEFT
// ==========================================

export async function markLeft(
  entryId: string,
  restaurantId: string,
  userId: string,
  ipAddress?: string,
  userAgent?: string
) {
  const entry = await prisma.waitingListEntry.findFirst({
    where: { id: entryId, restaurantId },
  });
  if (!entry) throw new NotFoundError('Waiting list entry not found');
  if (entry.status === 'LEFT' || entry.status === 'SEATED') {
    throw new BadRequestError('Entry has already left or been seated');
  }

  const updated = await prisma.waitingListEntry.update({
    where: { id: entryId },
    data: { status: 'LEFT', leftAt: new Date(), updatedById: userId },
  });

  return updated;
}

// ==========================================
// CANCEL
// ==========================================

export async function cancelWaitingListEntry(
  entryId: string,
  restaurantId: string,
  userId: string,
  ipAddress?: string,
  userAgent?: string
) {
  const entry = await prisma.waitingListEntry.findFirst({
    where: { id: entryId, restaurantId },
  });
  if (!entry) throw new NotFoundError('Waiting list entry not found');
  if (['LEFT', 'SEATED', 'CANCELLED'].includes(entry.status)) {
    throw new BadRequestError('Entry cannot be cancelled');
  }

  const updated = await prisma.waitingListEntry.update({
    where: { id: entryId },
    data: { status: 'CANCELLED', cancelledAt: new Date(), updatedById: userId },
  });

  return updated;
}

// ==========================================
// LIST
// ==========================================

interface WaitingListFilters {
  status?: string;
  diningAreaId?: string;
  partySize?: number;
  search?: string;
}

export async function listWaitingList(restaurantId: string, filters: WaitingListFilters = {}) {
  const where: any = { restaurantId };

  if (filters.status) where.status = filters.status;
  else where.status = { in: ['WAITING', 'NOTIFIED'] };
  if (filters.diningAreaId) where.preferredDiningAreaId = filters.diningAreaId;
  if (filters.partySize) where.partySize = filters.partySize;
  if (filters.search) {
    where.OR = [
      { customerName: { contains: filters.search, mode: 'insensitive' } },
      { queueNumber: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  const entries = await prisma.waitingListEntry.findMany({
    where,
    include: {
      customer: { select: { id: true, firstName: true, lastName: true } },
      diningArea: { select: { id: true, name: true } },
    },
    orderBy: [{ status: 'asc' }, { joinedAt: 'asc' }],
  });

  // Calculate current wait time for each entry
  const now = new Date();
  const enriched = entries.map((e) => ({
    ...e,
    waitingDurationMinutes: e.status === 'WAITING' ? Math.floor((now.getTime() - e.joinedAt.getTime()) / 60000) : null,
  }));

  // Count currently waiting
  const waitingCount = entries.filter((e) => e.status === 'WAITING').length;

  return { entries: enriched, waitingCount };
}

// ==========================================
// GET ENTRY
// ==========================================

export async function getWaitingListEntry(entryId: string, restaurantId: string) {
  const entry = await prisma.waitingListEntry.findFirst({
    where: { id: entryId, restaurantId },
    include: {
      customer: { select: { id: true, firstName: true, lastName: true, phone: true } },
      diningArea: { select: { id: true, name: true } },
      table: { select: { id: true, name: true, code: true } },
    },
  });
  if (!entry) throw new NotFoundError('Waiting list entry not found');
  return entry;
}
