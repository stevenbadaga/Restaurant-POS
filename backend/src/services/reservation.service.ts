import { prisma } from '../database';
import { BadRequestError, NotFoundError, ForbiddenError, ConflictError } from '../types';
import { createAuditLog } from './audit.service';
import { generateSequenceNumber } from './sequence.service';
import { updateCustomerVisitStats } from './customer.service';

// ==========================================
// GENERATE RESERVATION NUMBER
// ==========================================

async function generateReservationNumber(restaurantId: string): Promise<string> {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { timezone: true },
  });
  const seq = await generateSequenceNumber(
    restaurantId,
    'RESERVATION',
    'RSV',
    restaurant?.timezone ?? 'UTC'
  );
  return seq;
}

// ==========================================
// VALIDATE TABLE AVAILABILITY
// ==========================================

interface AvailabilityCheck {
  restaurantId: string;
  startAt: Date;
  expectedEndAt: Date;
  tableId: string;
  excludeReservationId?: string;
  allowOverbooking?: boolean;
}

async function checkTableAvailability(check: AvailabilityCheck): Promise<{ available: boolean; conflicts: any[] }> {
  const table = await prisma.restaurantTable.findFirst({
    where: { id: check.tableId, restaurantId: check.restaurantId },
  });
  if (!table) throw new BadRequestError('Table not found');
  if (!table.isActive) throw new BadRequestError('Table is not active');
  if (table.status === 'OUT_OF_SERVICE') throw new BadRequestError('Table is out of service');

  // Check overlapping reservations
  const conflictingReservations = await prisma.reservation.findMany({
    where: {
      restaurantId: check.restaurantId,
      tableId: check.tableId,
      status: { in: ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'SEATED'] },
      id: check.excludeReservationId ? { not: check.excludeReservationId } : undefined,
      AND: [
        { startAt: { lt: check.expectedEndAt } },
        { expectedEndAt: { gt: check.startAt } },
      ],
    },
  });

  // Check active dine-in orders
  const conflictingOrders = await prisma.order.findMany({
    where: {
      restaurantId: check.restaurantId,
      tableId: check.tableId,
      status: { notIn: ['CLOSED', 'CANCELLED', 'DRAFT'] },
    },
  });

  const conflicts = [
    ...conflictingReservations.map((r) => ({
      type: 'reservation' as const,
      id: r.id,
      reservationNumber: r.reservationNumber,
      startAt: r.startAt,
      expectedEndAt: r.expectedEndAt,
      status: r.status,
    })),
    ...conflictingOrders.map((o) => ({
      type: 'order' as const,
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
    })),
  ];

  if (conflicts.length > 0 && !check.allowOverbooking) {
    return { available: false, conflicts };
  }

  return { available: true, conflicts };
}

// ==========================================
// GET AVAILABILITY
// ==========================================

interface AvailabilityQuery {
  restaurantId: string;
  startAt: Date;
  expectedEndAt: Date;
  partySize: number;
  diningAreaId?: string;
}

export async function getTableAvailability(query: AvailabilityQuery) {
  const where: any = {
    restaurantId: query.restaurantId,
    isActive: true,
    status: { notIn: ['OUT_OF_SERVICE'] },
    capacity: { gte: query.partySize },
  };
  if (query.diningAreaId) where.diningAreaId = query.diningAreaId;

  const tables = await prisma.restaurantTable.findMany({ where, orderBy: { name: 'asc' } });

  const results = await Promise.all(
    tables.map(async (table) => {
      const check = await checkTableAvailability({
        restaurantId: query.restaurantId,
        startAt: query.startAt,
        expectedEndAt: query.expectedEndAt,
        tableId: table.id,
      });
      return {
        ...table,
        available: check.available,
        conflicts: check.conflicts,
      };
    })
  );

  return results;
}

// ==========================================
// CREATE RESERVATION
// ==========================================

interface CreateReservationInput {
  customerId?: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  reservationSource: string;
  reservationDate: string;
  startAt: string;
  expectedEndAt?: string;
  partySize: number;
  diningAreaId?: string;
  tableId?: string;
  specialRequests?: string;
  dietaryNotes?: string;
  occasion?: string;
  internalNotes?: string;
  status?: string;
}

export async function createReservation(
  restaurantId: string,
  userId: string,
  input: CreateReservationInput,
  settings?: any,
  ipAddress?: string,
  userAgent?: string
) {
  if (input.partySize < 1) throw new BadRequestError('Party size must be at least 1');

  const startAt = new Date(input.startAt);
  const duration = settings?.defaultReservationDurationMinutes || 120;
  const expectedEndAt = input.expectedEndAt ? new Date(input.expectedEndAt) : new Date(startAt.getTime() + duration * 60000);

  if (expectedEndAt <= startAt) throw new BadRequestError('End time must be after start time');

  // Validate phone requirement
  if (settings?.requirePhoneForReservation && !input.customerPhone && !input.customerId) {
    throw new BadRequestError('Phone number is required for reservations');
  }

  // Validate table if provided
  if (input.tableId) {
    const check = await checkTableAvailability({
      restaurantId,
      startAt,
      expectedEndAt,
      tableId: input.tableId,
      allowOverbooking: settings?.allowTableOverbooking === true,
    });
    if (!check.available && !settings?.allowTableOverbooking) {
      throw new ConflictError('Table is not available at the requested time');
    }
  }

  const reservationNumber = await generateReservationNumber(restaurantId);

  const reservation = await prisma.reservation.create({
    data: {
      restaurantId,
      reservationNumber,
      customerId: input.customerId || null,
      customerNameSnapshot: input.customerName,
      customerPhoneSnapshot: input.customerPhone || null,
      customerEmailSnapshot: input.customerEmail || null,
      reservationSource: input.reservationSource as any,
      reservationDate: new Date(input.reservationDate),
      startAt,
      expectedEndAt,
      partySize: input.partySize,
      diningAreaId: input.diningAreaId || null,
      tableId: input.tableId || null,
      status: (input.status as any) || 'PENDING',
      specialRequests: input.specialRequests || null,
      dietaryNotesSnapshot: input.dietaryNotes || null,
      occasion: input.occasion || null,
      internalNotes: input.internalNotes || null,
      createdById: userId,
    },
  });

  // Create status history
  await prisma.reservationStatusHistory.create({
    data: {
      reservationId: reservation.id,
      newStatus: reservation.status as any,
      changedById: userId,
    },
  });

  await createAuditLog({
    restaurantId,
    userId,
    action: 'Reservation created',
    entityType: 'Reservation',
    entityId: reservation.id,
    description: `Reservation ${reservationNumber} for ${input.customerName} (${input.partySize} guests)`,
    metadata: { reservationNumber, partySize: input.partySize, status: reservation.status },
    ipAddress,
    userAgent,
  });

  return reservation;
}

// ==========================================
// UPDATE RESERVATION
// ==========================================

interface UpdateReservationInput {
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  startAt?: string;
  expectedEndAt?: string;
  partySize?: number;
  diningAreaId?: string | null;
  tableId?: string | null;
  specialRequests?: string;
  dietaryNotes?: string;
  occasion?: string;
  internalNotes?: string;
}

export async function updateReservation(
  reservationId: string,
  restaurantId: string,
  userId: string,
  input: UpdateReservationInput,
  settings?: any,
  ipAddress?: string,
  userAgent?: string
) {
  const reservation = await prisma.reservation.findFirst({
    where: { id: reservationId, restaurantId },
  });
  if (!reservation) throw new NotFoundError('Reservation not found');
  if (reservation.status === 'CANCELLED' || reservation.status === 'COMPLETED' || reservation.status === 'NO_SHOW') {
    throw new BadRequestError('Cannot update a completed, cancelled, or no-show reservation');
  }

  const data: any = {};
  if (input.customerName) data.customerNameSnapshot = input.customerName;
  if (input.customerPhone !== undefined) data.customerPhoneSnapshot = input.customerPhone;
  if (input.customerEmail !== undefined) data.customerEmailSnapshot = input.customerEmail;
  if (input.partySize) data.partySize = input.partySize;
  if (input.diningAreaId !== undefined) data.diningAreaId = input.diningAreaId;
  if (input.specialRequests !== undefined) data.specialRequests = input.specialRequests;
  if (input.dietaryNotes !== undefined) data.dietaryNotesSnapshot = input.dietaryNotes;
  if (input.occasion !== undefined) data.occasion = input.occasion;
  if (input.internalNotes !== undefined) data.internalNotes = input.internalNotes;

  if (input.startAt) {
    data.startAt = new Date(input.startAt);
    const duration = settings?.defaultReservationDurationMinutes || 120;
    data.expectedEndAt = input.expectedEndAt
      ? new Date(input.expectedEndAt)
      : new Date(data.startAt.getTime() + duration * 60000);
  }

  if (input.tableId !== undefined) {
    data.tableId = input.tableId;
    // Revalidate availability
    if (input.tableId) {
      const check = await checkTableAvailability({
        restaurantId,
        startAt: data.startAt || reservation.startAt,
        expectedEndAt: data.expectedEndAt || reservation.expectedEndAt,
        tableId: input.tableId,
        excludeReservationId: reservationId,
        allowOverbooking: settings?.allowTableOverbooking === true,
      });
      if (!check.available && !settings?.allowTableOverbooking) {
        throw new ConflictError('Table is not available at the requested time');
      }
    }
  }

  const updated = await prisma.reservation.update({
    where: { id: reservationId },
    data,
  });

  await createAuditLog({
    restaurantId,
    userId,
    action: 'Reservation updated',
    entityType: 'Reservation',
    entityId: reservationId,
    description: `Reservation ${reservation.reservationNumber} updated`,
    metadata: { reservationNumber: reservation.reservationNumber, updatedFields: Object.keys(input) },
    ipAddress,
    userAgent,
  });

  return updated;
}

// ==========================================
// CONFIRM RESERVATION
// ==========================================

export async function confirmReservation(
  reservationId: string,
  restaurantId: string,
  userId: string,
  settings?: any,
  ipAddress?: string,
  userAgent?: string
) {
  const reservation = await prisma.reservation.findFirst({
    where: { id: reservationId, restaurantId },
  });
  if (!reservation) throw new NotFoundError('Reservation not found');
  if (reservation.status !== 'PENDING') throw new BadRequestError('Only PENDING reservations can be confirmed');

  // Revalidate table if assigned
  if (reservation.tableId) {
    const check = await checkTableAvailability({
      restaurantId,
      startAt: reservation.startAt,
      expectedEndAt: reservation.expectedEndAt,
      tableId: reservation.tableId,
      excludeReservationId: reservationId,
      allowOverbooking: settings?.allowTableOverbooking === true,
    });
    if (!check.available && !settings?.allowTableOverbooking) {
      throw new ConflictError('Table is no longer available');
    }
  }

  // Generate confirmation code
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();

  const [updated] = await Promise.all([
    prisma.reservation.update({
      where: { id: reservationId },
      data: {
        status: 'CONFIRMED',
        confirmedAt: new Date(),
        confirmedById: userId,
        confirmationCode: code,
      },
    }),
    prisma.reservationStatusHistory.create({
      data: {
        reservationId,
        previousStatus: 'PENDING',
        newStatus: 'CONFIRMED',
        changedById: userId,
      },
    }),
  ]);

  await createAuditLog({
    restaurantId,
    userId,
    action: 'Reservation confirmed',
    entityType: 'Reservation',
    entityId: reservationId,
    description: `Reservation ${reservation.reservationNumber} confirmed`,
    metadata: { reservationNumber: reservation.reservationNumber, confirmationCode: code },
    ipAddress,
    userAgent,
  });

  return updated;
}

// ==========================================
// CHECK-IN
// ==========================================

export async function checkInReservation(
  reservationId: string,
  restaurantId: string,
  userId: string,
  reassignTableId?: string,
  ipAddress?: string,
  userAgent?: string
) {
  const reservation = await prisma.reservation.findFirst({
    where: { id: reservationId, restaurantId },
  });
  if (!reservation) throw new NotFoundError('Reservation not found');
  if (!['CONFIRMED', 'PENDING'].includes(reservation.status)) {
    throw new BadRequestError('Only CONFIRMED or PENDING reservations can be checked in');
  }

  const tableId = reassignTableId || reservation.tableId;

  // Validate selected table if reassigned
  if (tableId) {
    const table = await prisma.restaurantTable.findFirst({
      where: { id: tableId, restaurantId },
    });
    if (!table || !table.isActive || table.status === 'OUT_OF_SERVICE') {
      throw new BadRequestError('Selected table is not available');
    }
    if (table.capacity < reservation.partySize) {
      throw new BadRequestError('Table capacity is insufficient for the party size');
    }
  }

  const [updated] = await Promise.all([
    prisma.reservation.update({
      where: { id: reservationId },
      data: {
        status: 'CHECKED_IN',
        checkedInAt: new Date(),
        checkedInById: userId,
        tableId: tableId || null,
      },
    }),
    prisma.reservationStatusHistory.create({
      data: {
        reservationId,
        previousStatus: reservation.status as any,
        newStatus: 'CHECKED_IN',
        changedById: userId,
      },
    }),
  ]);

  await createAuditLog({
    restaurantId,
    userId,
    action: 'Reservation checked in',
    entityType: 'Reservation',
    entityId: reservationId,
    description: `Reservation ${reservation.reservationNumber} checked in`,
    metadata: { reservationNumber: reservation.reservationNumber, tableId },
    ipAddress,
    userAgent,
  });

  return updated;
}

// ==========================================
// SEAT RESERVATION
// ==========================================

interface SeatReservationInput {
  tableId: string;
  createOrder?: boolean;
  waiterId?: string;
  guestCount?: number;
}

export async function seatReservation(
  reservationId: string,
  restaurantId: string,
  userId: string,
  input: SeatReservationInput,
  ipAddress?: string,
  userAgent?: string
) {
  const reservation = await prisma.reservation.findFirst({
    where: { id: reservationId, restaurantId },
    include: { customer: true },
  });
  if (!reservation) throw new NotFoundError('Reservation not found');
  if (reservation.status !== 'CHECKED_IN') {
    throw new BadRequestError('Reservation must be checked in before seating');
  }

  // Validate table
  const table = await prisma.restaurantTable.findFirst({
    where: { id: input.tableId, restaurantId, isActive: true, status: { not: 'OUT_OF_SERVICE' } },
  });
  if (!table) throw new BadRequestError('Table not available');

  // Check no active order already exists
  if (reservation.orderId) {
    const existingOrder = await prisma.order.findUnique({ where: { id: reservation.orderId } });
    if (existingOrder && !['CLOSED', 'CANCELLED'].includes(existingOrder.status)) {
      throw new BadRequestError('Reservation already has an active order');
    }
  }

  let orderId = reservation.orderId;

  if (input.createOrder !== false) {
    // Create draft order
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { timezone: true, settings: true },
    });
    const _orderNumber = await generateSequenceNumber(
      restaurantId, 'STOCK_RECEIPT', restaurant?.settings?.orderNumberPrefix || 'ORD',
      restaurant?.timezone ?? 'UTC'
    );
    // Note: The order number sequence uses STOCK_RECEIPT type; we should use a dedicated ORDER type
    // Using the existing prefix-based approach
    const order = await prisma.order.create({
      data: {
        restaurantId,
        orderNumber: `DRAFT-${reservation.reservationNumber}`,
        orderType: 'DINE_IN',
        status: 'DRAFT',
        tableId: input.tableId,
        guestCount: input.guestCount || reservation.partySize,
        customerName: reservation.customerNameSnapshot,
        customerPhone: reservation.customerPhoneSnapshot,
        customerId: reservation.customerId,
        waiterId: input.waiterId || userId,
        createdById: userId,
      },
    });
    orderId = order.id;

    // Link to reservation
    await prisma.reservation.update({
      where: { id: reservationId },
      data: { orderId },
    });
  }

  const [updated] = await Promise.all([
    prisma.reservation.update({
      where: { id: reservationId },
      data: {
        status: 'SEATED',
        seatedAt: new Date(),
        seatedById: userId,
        tableId: input.tableId,
        orderId,
      },
    }),
    prisma.reservationStatusHistory.create({
      data: {
        reservationId,
        previousStatus: 'CHECKED_IN',
        newStatus: 'SEATED',
        changedById: userId,
      },
    }),
  ]);

  await createAuditLog({
    restaurantId,
    userId,
    action: 'Reservation seated',
    entityType: 'Reservation',
    entityId: reservationId,
    description: `Reservation ${reservation.reservationNumber} seated at table ${table.code || table.name}`,
    metadata: {
      reservationNumber: reservation.reservationNumber,
      tableId: input.tableId,
      orderId,
      createOrder: input.createOrder !== false,
    },
    ipAddress,
    userAgent,
  });

  return updated;
}

// ==========================================
// COMPLETE RESERVATION
// ==========================================

export async function completeReservation(
  reservationId: string,
  restaurantId: string,
  userId: string,
  ipAddress?: string,
  userAgent?: string
) {
  const reservation = await prisma.reservation.findFirst({
    where: { id: reservationId, restaurantId },
  });
  if (!reservation) throw new NotFoundError('Reservation not found');
  if (reservation.status !== 'SEATED') throw new BadRequestError('Only SEATED reservations can be completed');

  const [updated] = await Promise.all([
    prisma.reservation.update({
      where: { id: reservationId },
      data: { status: 'COMPLETED', completedAt: new Date() },
    }),
    prisma.reservationStatusHistory.create({
      data: {
        reservationId,
        previousStatus: 'SEATED',
        newStatus: 'COMPLETED',
        changedById: userId,
      },
    }),
  ]);

  // Update customer visit stats
  if (reservation.customerId) {
    await updateCustomerVisitStats(reservation.customerId, restaurantId).catch(() => {});
  }

  await createAuditLog({
    restaurantId,
    userId,
    action: 'Reservation completed',
    entityType: 'Reservation',
    entityId: reservationId,
    description: `Reservation ${reservation.reservationNumber} completed`,
    metadata: { reservationNumber: reservation.reservationNumber },
    ipAddress,
    userAgent,
  });

  return updated;
}

// ==========================================
// CANCEL RESERVATION
// ==========================================

export async function cancelReservation(
  reservationId: string,
  restaurantId: string,
  userId: string,
  reason: string,
  ipAddress?: string,
  userAgent?: string
) {
  const reservation = await prisma.reservation.findFirst({
    where: { id: reservationId, restaurantId },
  });
  if (!reservation) throw new NotFoundError('Reservation not found');
  if (reservation.status === 'COMPLETED') throw new BadRequestError('Cannot cancel a completed reservation');
  if (reservation.status === 'SEATED') {
    // Check if there's an active order
    if (reservation.orderId) {
      const order = await prisma.order.findUnique({ where: { id: reservation.orderId } });
      if (order && !['CLOSED', 'CANCELLED'].includes(order.status)) {
        throw new BadRequestError('Cannot cancel a seated reservation with an active order. Close or cancel the order first.');
      }
    }
  }

  const [updated] = await Promise.all([
    prisma.reservation.update({
      where: { id: reservationId },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelledById: userId,
        cancellationReason: reason,
      },
    }),
    prisma.reservationStatusHistory.create({
      data: {
        reservationId,
        previousStatus: reservation.status as any,
        newStatus: 'CANCELLED',
        reason,
        changedById: userId,
      },
    }),
  ]);

  await createAuditLog({
    restaurantId,
    userId,
    action: 'Reservation cancelled',
    entityType: 'Reservation',
    entityId: reservationId,
    description: `Reservation ${reservation.reservationNumber} cancelled: ${reason}`,
    metadata: { reservationNumber: reservation.reservationNumber, reason },
    ipAddress,
    userAgent,
  });

  return updated;
}

// ==========================================
// NO-SHOW
// ==========================================

export async function markNoShow(
  reservationId: string,
  restaurantId: string,
  userId: string,
  ipAddress?: string,
  userAgent?: string
) {
  const reservation = await prisma.reservation.findFirst({
    where: { id: reservationId, restaurantId },
  });
  if (!reservation) throw new NotFoundError('Reservation not found');
  if (!['CONFIRMED', 'CHECKED_IN'].includes(reservation.status)) {
    throw new BadRequestError('Only CONFIRMED or CHECKED_IN reservations can be marked no-show');
  }

  const [updated] = await Promise.all([
    prisma.reservation.update({
      where: { id: reservationId },
      data: {
        status: 'NO_SHOW',
        noShowMarkedAt: new Date(),
        noShowMarkedById: userId,
      },
    }),
    prisma.reservationStatusHistory.create({
      data: {
        reservationId,
        previousStatus: reservation.status as any,
        newStatus: 'NO_SHOW',
        changedById: userId,
      },
    }),
  ]);

  await createAuditLog({
    restaurantId,
    userId,
    action: 'Reservation marked no-show',
    entityType: 'Reservation',
    entityId: reservationId,
    description: `Reservation ${reservation.reservationNumber} marked as no-show`,
    metadata: { reservationNumber: reservation.reservationNumber },
    ipAddress,
    userAgent,
  });

  return updated;
}

// ==========================================
// REASSIGN TABLE
// ==========================================

export async function reassignTable(
  reservationId: string,
  restaurantId: string,
  userId: string,
  newTableId: string,
  reason?: string,
  ipAddress?: string,
  userAgent?: string
) {
  const reservation = await prisma.reservation.findFirst({
    where: { id: reservationId, restaurantId },
  });
  if (!reservation) throw new NotFoundError('Reservation not found');
  if (['CANCELLED', 'COMPLETED', 'NO_SHOW'].includes(reservation.status)) {
    throw new BadRequestError('Cannot reassign table for a finished reservation');
  }

  const check = await checkTableAvailability({
    restaurantId,
    startAt: reservation.startAt,
    expectedEndAt: reservation.expectedEndAt,
    tableId: newTableId,
    excludeReservationId: reservationId,
  });
  if (!check.available) {
    throw new ConflictError('Target table is not available');
  }

  const table = await prisma.restaurantTable.findUnique({ where: { id: newTableId } });
  if (table && table.capacity < reservation.partySize) {
    throw new BadRequestError('Target table capacity is insufficient');
  }

  const updated = await prisma.reservation.update({
    where: { id: reservationId },
    data: { tableId: newTableId },
  });

  await createAuditLog({
    restaurantId,
    userId,
    action: 'Reservation table reassigned',
    entityType: 'Reservation',
    entityId: reservationId,
    description: `Reservation ${reservation.reservationNumber} reassigned to table ${table?.code || newTableId}${reason ? `: ${reason}` : ''}`,
    metadata: { reservationNumber: reservation.reservationNumber, previousTableId: reservation.tableId, newTableId, reason },
    ipAddress,
    userAgent,
  });

  return updated;
}

// ==========================================
// LIST RESERVATIONS
// ==========================================

interface ReservationFilters {
  date?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  customerId?: string;
  diningAreaId?: string;
  tableId?: string;
  partySize?: number;
  source?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export async function listReservations(restaurantId: string, filters: ReservationFilters = {}) {
  const page = filters.page || 1;
  const limit = Math.min(filters.limit || 20, 100);
  const skip = (page - 1) * limit;

  const where: any = { restaurantId };

  if (filters.date) {
    const date = new Date(filters.date);
    const next = new Date(date);
    next.setDate(next.getDate() + 1);
    where.reservationDate = { gte: date, lt: next };
  }
  if (filters.dateFrom) where.reservationDate = { ...where.reservationDate, gte: new Date(filters.dateFrom) };
  if (filters.dateTo) where.reservationDate = { ...where.reservationDate, lte: new Date(filters.dateTo + 'T23:59:59.999Z') };
  if (filters.status) where.status = filters.status;
  if (filters.customerId) where.customerId = filters.customerId;
  if (filters.diningAreaId) where.diningAreaId = filters.diningAreaId;
  if (filters.tableId) where.tableId = filters.tableId;
  if (filters.partySize) where.partySize = filters.partySize;
  if (filters.source) where.reservationSource = filters.source;
  if (filters.search) {
    where.OR = [
      { customerNameSnapshot: { contains: filters.search, mode: 'insensitive' } },
      { reservationNumber: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  const [reservations, total] = await Promise.all([
    prisma.reservation.findMany({
      where,
      include: {
        customer: { select: { id: true, firstName: true, lastName: true, phone: true } },
        diningArea: { select: { id: true, name: true } },
        table: { select: { id: true, name: true, code: true, capacity: true } },
        order: { select: { id: true, orderNumber: true, status: true, totalAmount: true } },
      },
      orderBy: [{ reservationDate: 'desc' }, { startAt: 'asc' }],
      skip,
      take: limit,
    }),
    prisma.reservation.count({ where }),
  ]);

  return { reservations, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

// ==========================================
// GET RESERVATION DETAIL
// ==========================================

export async function getReservationDetail(reservationId: string, restaurantId: string) {
  const reservation = await prisma.reservation.findFirst({
    where: { id: reservationId, restaurantId },
    include: {
      customer: { select: { id: true, firstName: true, lastName: true, phone: true, email: true, customerNumber: true } },
      diningArea: { select: { id: true, name: true } },
      table: { select: { id: true, name: true, code: true, capacity: true } },
      order: { select: { id: true, orderNumber: true, status: true, totalAmount: true, amountPaid: true } },
      confirmedBy: { select: { id: true, firstName: true, lastName: true } },
      checkedInBy: { select: { id: true, firstName: true, lastName: true } },
      seatedBy: { select: { id: true, firstName: true, lastName: true } },
      cancelledBy: { select: { id: true, firstName: true, lastName: true } },
      noShowMarkedBy: { select: { id: true, firstName: true, lastName: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true } },
      statusHistory: { orderBy: { changedAt: 'asc' } },
    },
  });
  if (!reservation) throw new NotFoundError('Reservation not found');
  return reservation;
}

// ==========================================
// CALENDAR VIEW
// ==========================================

export async function getReservationCalendar(restaurantId: string, date: string) {
  const startOfDay = new Date(date);
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);

  const reservations = await prisma.reservation.findMany({
    where: {
      restaurantId,
      startAt: { gte: startOfDay, lt: endOfDay },
    },
    include: {
      diningArea: { select: { name: true } },
      table: { select: { name: true, code: true } },
    },
    orderBy: { startAt: 'asc' },
  });

  return reservations;
}
