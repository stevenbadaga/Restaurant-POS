import { prisma } from '../database';
import { BadRequestError, NotFoundError } from '../types';
import { createAuditLog } from './audit.service';
import { generateSequenceNumber } from './sequence.service';

// ==========================================
// CUSTOMER GENERATION
// ==========================================

async function generateCustomerNumber(restaurantId: string): Promise<string> {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { timezone: true },
  });
  const seq = await generateSequenceNumber(
    restaurantId,
    'CUSTOMER',
    'CUS',
    restaurant?.timezone ?? 'UTC'
  );
  // seq format: CUS-YYYYMMDD-NNNN; simplify to CUS-NNNNNN
  const parts = seq.split('-');
  const num = parts[parts.length - 1];
  return `CUS-${num}`;
}

// ==========================================
// CREATE CUSTOMER
// ==========================================

interface CreateCustomerInput {
  firstName: string;
  lastName?: string;
  phone?: string;
  email?: string;
  dateOfBirth?: string;
  preferredDiningAreaId?: string;
  preferredTableId?: string;
  dietaryPreferences?: string;
  allergyNotes?: string;
  generalNotes?: string;
  marketingConsent?: boolean;
  marketingConsentSource?: string;
}

export async function createCustomer(
  restaurantId: string,
  userId: string,
  input: CreateCustomerInput,
  ipAddress?: string,
  userAgent?: string
) {
  // Validate at least one identifier
  if (!input.phone && !input.email) {
    throw new BadRequestError('Phone or email is required');
  }

  // Normalize email
  const email = input.email?.trim().toLowerCase();
  const phone = input.phone?.trim();

  // Check duplicate phone within restaurant
  if (phone) {
    const existingPhone = await prisma.customer.findFirst({
      where: { restaurantId, phone },
      select: { id: true, firstName: true, lastName: true, customerNumber: true },
    });
    if (existingPhone) {
      throw new BadRequestError(
        `A customer with this phone already exists: ${existingPhone.firstName} ${existingPhone.lastName || ''} (${existingPhone.customerNumber})`
      );
    }
  }

  // Check duplicate email within restaurant
  if (email) {
    const existingEmail = await prisma.customer.findFirst({
      where: { restaurantId, email },
      select: { id: true, firstName: true, lastName: true, customerNumber: true },
    });
    if (existingEmail) {
      throw new BadRequestError(
        `A customer with this email already exists: ${existingEmail.firstName} ${existingEmail.lastName || ''} (${existingEmail.customerNumber})`
      );
    }
  }

  // Validate preferred dining area and table belong to restaurant
  if (input.preferredDiningAreaId) {
    const area = await prisma.diningArea.findFirst({
      where: { id: input.preferredDiningAreaId, restaurantId },
    });
    if (!area) throw new BadRequestError('Preferred dining area not found');
  }
  if (input.preferredTableId) {
    const table = await prisma.restaurantTable.findFirst({
      where: { id: input.preferredTableId, restaurantId },
    });
    if (!table) throw new BadRequestError('Preferred table not found');
  }

  const customerNumber = await generateCustomerNumber(restaurantId);

  const customer = await prisma.customer.create({
    data: {
      restaurantId,
      customerNumber,
      firstName: input.firstName,
      lastName: input.lastName || null,
      phone,
      email,
      dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null,
      preferredDiningAreaId: input.preferredDiningAreaId || null,
      preferredTableId: input.preferredTableId || null,
      dietaryPreferences: input.dietaryPreferences || null,
      allergyNotes: input.allergyNotes || null,
      generalNotes: input.generalNotes || null,
      marketingConsent: input.marketingConsent || false,
      marketingConsentSource: input.marketingConsentSource as any || null,
      marketingConsentAt: input.marketingConsent ? new Date() : null,
      createdById: userId,
    },
  });

  await createAuditLog({
    restaurantId,
    userId,
    action: 'Customer created',
    entityType: 'Customer',
    entityId: customer.id,
    description: `Customer ${customerNumber}: ${input.firstName} ${input.lastName || ''}`,
    metadata: { customerNumber, hasMarketingConsent: input.marketingConsent },
    ipAddress,
    userAgent,
  });

  return customer;
}

// ==========================================
// UPDATE CUSTOMER
// ==========================================

interface UpdateCustomerInput {
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  dateOfBirth?: string;
  preferredDiningAreaId?: string | null;
  preferredTableId?: string | null;
  dietaryPreferences?: string;
  allergyNotes?: string;
  generalNotes?: string;
}

export async function updateCustomer(
  customerId: string,
  restaurantId: string,
  userId: string,
  input: UpdateCustomerInput,
  ipAddress?: string,
  userAgent?: string
) {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, restaurantId },
  });
  if (!customer) throw new NotFoundError('Customer not found');

  // Check duplicate phone
  if (input.phone) {
    const phone = input.phone.trim();
    const existing = await prisma.customer.findFirst({
      where: { restaurantId, phone },
    });
    if (existing && existing.id !== customerId) {
      throw new BadRequestError(`Phone already belongs to ${existing.firstName} ${existing.lastName || ''}`);
    }
  }

  // Check duplicate email
  if (input.email) {
    const email = input.email.trim().toLowerCase();
    const existing = await prisma.customer.findFirst({
      where: { restaurantId, email },
    });
    if (existing && existing.id !== customerId) {
      throw new BadRequestError(`Email already belongs to ${existing.firstName} ${existing.lastName || ''}`);
    }
  }

  const updated = await prisma.customer.update({
    where: { id: customerId },
    data: {
      ...input,
      dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : undefined,
      preferredDiningAreaId: input.preferredDiningAreaId ?? (input.preferredDiningAreaId === null ? null : undefined),
      preferredTableId: input.preferredTableId ?? (input.preferredTableId === null ? null : undefined),
    },
  });

  await createAuditLog({
    restaurantId,
    userId,
    action: 'Customer updated',
    entityType: 'Customer',
    entityId: customerId,
    description: `Customer ${customer.customerNumber} updated`,
    metadata: { updatedFields: Object.keys(input) },
    ipAddress,
    userAgent,
  });

  return updated;
}

// ==========================================
// MARKETING CONSENT
// ==========================================

export async function setMarketingConsent(
  customerId: string,
  restaurantId: string,
  userId: string,
  consent: boolean,
  source?: string,
  ipAddress?: string,
  userAgent?: string
) {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, restaurantId },
  });
  if (!customer) throw new NotFoundError('Customer not found');

  const updated = await prisma.customer.update({
    where: { id: customerId },
    data: {
      marketingConsent: consent,
      marketingConsentSource: consent ? (source as any || 'STAFF_ENTRY') : undefined,
      marketingConsentAt: consent ? new Date() : null,
      marketingConsentWithdrawnAt: consent ? null : new Date(),
    },
  });

  await createAuditLog({
    restaurantId,
    userId,
    action: consent ? 'Marketing consent recorded' : 'Marketing consent withdrawn',
    entityType: 'Customer',
    entityId: customerId,
    description: `Marketing consent ${consent ? 'given' : 'withdrawn'} for ${customer.customerNumber}`,
    metadata: { customerNumber: customer.customerNumber, consent, source },
    ipAddress,
    userAgent,
  });

  return updated;
}

// ==========================================
// CUSTOMER STATUS
// ==========================================

export async function updateCustomerStatus(
  customerId: string,
  restaurantId: string,
  userId: string,
  status: string,
  reason?: string,
  ipAddress?: string,
  userAgent?: string
) {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, restaurantId },
  });
  if (!customer) throw new NotFoundError('Customer not found');

  const updated = await prisma.customer.update({
    where: { id: customerId },
    data: { status: status as any },
  });

  await createAuditLog({
    restaurantId,
    userId,
    action: `Customer ${status.toLowerCase()}`,
    entityType: 'Customer',
    entityId: customerId,
    description: `Customer ${customer.customerNumber} marked as ${status}${reason ? `: ${reason}` : ''}`,
    metadata: { customerNumber: customer.customerNumber, previousStatus: customer.status, newStatus: status, reason },
    ipAddress,
    userAgent,
  });

  return updated;
}

// ==========================================
// MERGE CUSTOMERS
// ==========================================

export async function mergeCustomers(
  primaryId: string,
  duplicateId: string,
  restaurantId: string,
  userId: string,
  reason: string,
  ipAddress?: string,
  userAgent?: string
) {
  if (primaryId === duplicateId) {
    throw new BadRequestError('Cannot merge a customer with itself');
  }

  const primary = await prisma.customer.findFirst({ where: { id: primaryId, restaurantId } });
  const duplicate = await prisma.customer.findFirst({ where: { id: duplicateId, restaurantId } });
  if (!primary || !duplicate) throw new NotFoundError('Customer not found');

  return await prisma.$transaction(async (tx) => {
    // Transfer orders
    await tx.order.updateMany({
      where: { customerId: duplicateId },
      data: { customerId: primaryId },
    });

    // Transfer reservations
    await tx.reservation.updateMany({
      where: { customerId: duplicateId },
      data: { customerId: primaryId },
    });

    // Transfer notes
    await tx.customerNote.updateMany({
      where: { customerId: duplicateId },
      data: { customerId: primaryId },
    });

    // Handle loyalty account
    const primaryLoyalty = await tx.loyaltyAccount.findUnique({ where: { customerId: primaryId } });
    const dupLoyalty = await tx.loyaltyAccount.findUnique({ where: { customerId: duplicateId } });

    if (primaryLoyalty && dupLoyalty) {
      // Transfer transactions from duplicate to primary
      await tx.loyaltyTransaction.updateMany({
        where: { customerId: duplicateId },
        data: {
          customerId: primaryId,
          loyaltyAccountId: primaryLoyalty.id,
        },
      });
      // Update primary balance with duplicate's balance
      await tx.loyaltyAccount.update({
        where: { id: primaryLoyalty.id },
        data: {
          pointsBalance: primaryLoyalty.pointsBalance + dupLoyalty.pointsBalance,
          lifetimePointsEarned: primaryLoyalty.lifetimePointsEarned + dupLoyalty.lifetimePointsEarned,
          lifetimePointsRedeemed: primaryLoyalty.lifetimePointsRedeemed + dupLoyalty.lifetimePointsRedeemed,
        },
      });
      // Deactivate duplicate account
      await tx.loyaltyAccount.update({
        where: { id: dupLoyalty.id },
        data: { isActive: false },
      });
    } else if (dupLoyalty && !primaryLoyalty) {
      // Move duplicate loyalty to primary
      await tx.loyaltyAccount.update({
        where: { id: dupLoyalty.id },
        data: { customerId: primaryId },
      });
    }

    // Update waiting list entries
    await tx.waitingListEntry.updateMany({
      where: { customerId: duplicateId },
      data: { customerId: primaryId },
    });

    // Update promotion usages
    await tx.promotionUsage.updateMany({
      where: { customerId: duplicateId },
      data: { customerId: primaryId },
    });

    // Update order discounts
    await tx.orderDiscount.updateMany({
      where: { customerId: duplicateId },
      data: { customerId: primaryId },
    });

    // Deactivate duplicate
    await tx.customer.update({
      where: { id: duplicateId },
      data: { status: 'INACTIVE' },
    });

    // Merge stats
    await tx.customer.update({
      where: { id: primaryId },
      data: {
        totalVisits: primary.totalVisits + duplicate.totalVisits,
        firstVisitAt: primary.firstVisitAt || duplicate.firstVisitAt,
        lastVisitAt: primary.lastVisitAt || duplicate.lastVisitAt,
      },
    });

    await createAuditLog({
      restaurantId,
      userId,
      action: 'Customer profiles merged',
      entityType: 'Customer',
      entityId: primaryId,
      description: `Customer ${duplicate.customerNumber} merged into ${primary.customerNumber}: ${reason}`,
      metadata: { primaryCustomerNumber: primary.customerNumber, duplicateCustomerNumber: duplicate.customerNumber, reason },
      ipAddress,
      userAgent,
    });

    return await tx.customer.findUnique({
      where: { id: primaryId },
      include: { loyaltyAccount: true },
    });
  });
}

// ==========================================
// LIST CUSTOMERS
// ==========================================

interface CustomerFilters {
  search?: string;
  status?: string;
  loyaltyMember?: string;
  lastVisitFrom?: string;
  lastVisitTo?: string;
  hasUpcomingReservation?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: string;
}

export async function listCustomers(restaurantId: string, filters: CustomerFilters = {}) {
  const page = filters.page || 1;
  const limit = Math.min(filters.limit || 20, 100);
  const skip = (page - 1) * limit;

  const where: any = { restaurantId };

  if (filters.status) where.status = filters.status;
  if (filters.search) {
    where.OR = [
      { firstName: { contains: filters.search, mode: 'insensitive' } },
      { lastName: { contains: filters.search, mode: 'insensitive' } },
      { phone: { contains: filters.search } },
      { email: { contains: filters.search, mode: 'insensitive' } },
      { customerNumber: { contains: filters.search, mode: 'insensitive' } },
    ];
  }
  if (filters.lastVisitFrom) where.lastVisitAt = { ...where.lastVisitAt, gte: new Date(filters.lastVisitFrom) };
  if (filters.lastVisitTo) where.lastVisitAt = { ...where.lastVisitAt, lte: new Date(filters.lastVisitTo + 'T23:59:59.999Z') };

  let orderBy: any = { createdAt: 'desc' };
  if (filters.sortBy === 'lastVisit') orderBy = { lastVisitAt: filters.sortOrder === 'asc' ? 'asc' : 'desc' };
  if (filters.sortBy === 'name') orderBy = { firstName: filters.sortOrder === 'desc' ? 'desc' : 'asc' };
  if (filters.sortBy === 'status') orderBy = { status: filters.sortOrder === 'desc' ? 'desc' : 'asc' };

  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      include: {
        loyaltyAccount: { select: { pointsBalance: true, isActive: true } },
        _count: { select: { Reservation: true } },
      },
      orderBy,
      skip,
      take: limit,
    }),
    prisma.customer.count({ where }),
  ]);

  // If loyaltyMember filter is needed, handle separately
  let filteredCustomers = customers;
  if (filters.loyaltyMember === 'true') {
    filteredCustomers = customers.filter((c) => c.loyaltyAccount?.isActive);
  } else if (filters.loyaltyMember === 'false') {
    filteredCustomers = customers.filter((c) => !c.loyaltyAccount?.isActive);
  }
  if (filters.hasUpcomingReservation === 'true') {
    filteredCustomers = filteredCustomers.filter((c) => c._count.Reservation > 0);
  }

  return {
    customers: filteredCustomers.map((c) => ({
      id: c.id,
      customerNumber: c.customerNumber,
      firstName: c.firstName,
      lastName: c.lastName,
      phone: c.phone,
      email: c.email,
      status: c.status,
      loyaltyPoints: c.loyaltyAccount?.pointsBalance || 0,
      loyaltyActive: c.loyaltyAccount?.isActive || false,
      totalVisits: c.totalVisits,
      lastVisitAt: c.lastVisitAt,
      createdAt: c.createdAt,
    })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

// ==========================================
// GET CUSTOMER DETAIL
// ==========================================

export async function getCustomerDetail(customerId: string, restaurantId: string) {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, restaurantId },
    include: {
      loyaltyAccount: true,
      preferredDiningArea: { select: { id: true, name: true } },
      preferredTable: { select: { id: true, name: true, code: true } },
      _count: {
        select: {
          Reservation: true,
          notes: true,
          WaitingListEntry: true,
          loyaltyTransactions: true,
        },
      },
    },
  });
  if (!customer) throw new NotFoundError('Customer not found');
  return customer;
}

// ==========================================
// GET CUSTOMER ORDERS
// ==========================================

export async function getCustomerOrders(customerId: string, restaurantId: string, page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where: { customerId, restaurantId },
      include: {
        items: { where: { status: { not: 'CANCELLED' } } },
        payments: { where: { status: 'COMPLETED' }, select: { amount: true, method: true } },
        table: { select: { name: true } },
        waiter: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.order.count({ where: { customerId, restaurantId } }),
  ]);
  return { orders, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

// ==========================================
// GET CUSTOMER RESERVATIONS
// ==========================================

export async function getCustomerReservations(customerId: string, restaurantId: string, page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  const [reservations, total] = await Promise.all([
    prisma.reservation.findMany({
      where: { customerId, restaurantId },
      include: {
        diningArea: { select: { name: true } },
        table: { select: { name: true, code: true } },
      },
      orderBy: { reservationDate: 'desc' },
      skip,
      take: limit,
    }),
    prisma.reservation.count({ where: { customerId, restaurantId } }),
  ]);
  return { reservations, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

// ==========================================
// GET CUSTOMER ACTIVITY TIMELINE
// ==========================================

export async function getCustomerActivity(customerId: string, restaurantId: string, limit = 20) {
  const customer = await prisma.customer.findFirst({ where: { id: customerId, restaurantId } });
  if (!customer) throw new NotFoundError('Customer not found');

  const [orders, reservations, loyaltyTxns, notes] = await Promise.all([
    prisma.order.findMany({ where: { customerId, restaurantId }, orderBy: { createdAt: 'desc' }, take: limit,
      select: { id: true, orderNumber: true, status: true, totalAmount: true, createdAt: true } }),
    prisma.reservation.findMany({ where: { customerId, restaurantId }, orderBy: { createdAt: 'desc' }, take: limit,
      select: { id: true, reservationNumber: true, status: true, startAt: true } }),
    prisma.loyaltyTransaction.findMany({ where: { customerId, restaurantId }, orderBy: { createdAt: 'desc' }, take: limit,
      select: { id: true, transactionType: true, points: true, referenceNumber: true, createdAt: true, reason: true } }),
    prisma.customerNote.findMany({ where: { customerId, restaurantId }, orderBy: { createdAt: 'desc' }, take: limit,
      select: { id: true, note: true, noteType: true, createdAt: true, isImportant: true } }),
  ]);

  return { orders, reservations, loyaltyTxns, notes };
}

// ==========================================
// CUSTOMER NOTES
// ==========================================

export async function createCustomerNote(
  customerId: string,
  restaurantId: string,
  userId: string,
  note: string,
  noteType: string,
  isImportant: boolean,
  ipAddress?: string,
  userAgent?: string
) {
  const customer = await prisma.customer.findFirst({ where: { id: customerId, restaurantId } });
  if (!customer) throw new NotFoundError('Customer not found');

  const created = await prisma.customerNote.create({
    data: {
      restaurantId,
      customerId,
      note,
      noteType: noteType as any,
      isImportant,
      createdById: userId,
    },
  });

  await createAuditLog({
    restaurantId,
    userId,
    action: 'Customer note created',
    entityType: 'CustomerNote',
    entityId: created.id,
    description: `Note added for ${customer.customerNumber}`,
    metadata: { customerNumber: customer.customerNumber, noteType, isImportant },
    ipAddress,
    userAgent,
  });

  return created;
}

export async function updateCustomerNote(
  noteId: string,
  customerId: string,
  restaurantId: string,
  userId: string,
  note: string,
  noteType: string,
  isImportant: boolean,
  ipAddress?: string,
  userAgent?: string
) {
  const existing = await prisma.customerNote.findFirst({
    where: { id: noteId, customerId, restaurantId },
  });
  if (!existing) throw new NotFoundError('Note not found');

  const updated = await prisma.customerNote.update({
    where: { id: noteId },
    data: { note, noteType: noteType as any, isImportant },
  });

  await createAuditLog({
    restaurantId,
    userId,
    action: 'Customer note updated',
    entityType: 'CustomerNote',
    entityId: noteId,
    description: 'Note updated',
    metadata: { customerId, noteType, isImportant },
    ipAddress,
    userAgent,
  });

  return updated;
}

export async function deleteCustomerNote(
  noteId: string,
  customerId: string,
  restaurantId: string,
  userId: string,
  ipAddress?: string,
  userAgent?: string
) {
  const existing = await prisma.customerNote.findFirst({
    where: { id: noteId, customerId, restaurantId },
  });
  if (!existing) throw new NotFoundError('Note not found');

  await prisma.customerNote.delete({ where: { id: noteId } });

  await createAuditLog({
    restaurantId,
    userId,
    action: 'Customer note deleted',
    entityType: 'CustomerNote',
    entityId: noteId,
    description: 'Note deleted',
    metadata: { customerId },
    ipAddress,
    userAgent,
  });
}

export async function listCustomerNotes(customerId: string, restaurantId: string) {
  return await prisma.customerNote.findMany({
    where: { customerId, restaurantId },
    orderBy: [{ isImportant: 'desc' }, { createdAt: 'desc' }],
  });
}

// ==========================================
// VISIT STATISTICS
// ==========================================

export async function updateCustomerVisitStats(customerId: string, restaurantId: string) {
  const now = new Date();
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) return;

  await prisma.customer.update({
    where: { id: customerId },
    data: {
      totalVisits: customer.totalVisits + 1,
      lastVisitAt: now,
      firstVisitAt: customer.firstVisitAt || now,
    },
  });
}
