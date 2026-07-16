import { prisma } from '../database/prisma';
import crypto from 'crypto';
import { checkOpeningHours } from './public.service';
import { emitToRestaurant } from '../sockets/emitter';

// ─── Types ───────────────────────────────────────────────

interface CreateOrderInput {
  orderType: 'PICKUP' | 'DELIVERY' | 'DINE_IN';
  customerName: string;
  phone: string;
  email?: string;
  items: Array<{
    menuItemId: string;
    quantity: number;
    instructions?: string;
  }>;
  notes?: string;
  promotionCode?: string;
  // Pickup
  requestedPickupTime?: string;
  // Delivery
  deliveryZoneId?: string;
  deliveryAddress?: {
    addressLine1: string;
    addressLine2?: string;
    neighbourhood?: string;
    city: string;
  };
  deliveryInstructions?: string;
  // Dine-in / QR Table
  tableId?: string;
}

interface CreateReservationInput {
  name: string;
  phone: string;
  email?: string;
  date: string;
  time: string;
  partySize: number;
  occasion?: string;
  specialRequests?: string;
}

// ─── Helpers ─────────────────────────────────────────────

function generatePublicReference(): string {
  const prefix = 'ORD';
  const random = crypto.randomBytes(4).toString('hex').toUpperCase();
  const timestamp = Date.now().toString(36).toUpperCase().slice(-4);
  return `${prefix}-${random}-${timestamp}`;
}

function generateAccessToken(): string {
  return crypto.randomBytes(24).toString('hex');
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function getNextSequence(restaurantId: string): Promise<string> {
  const today = new Date().toISOString().split('T')[0];
  const seq = await prisma.documentSequence.upsert({
    where: {
      restaurantId_sequenceType_businessDate: {
        restaurantId,
        sequenceType: 'PUBLIC_ORDER',
        businessDate: today,
      },
    },
    create: {
      restaurantId,
      sequenceType: 'PUBLIC_ORDER',
      businessDate: today,
      currentValue: 1,
    },
    update: {
      currentValue: { increment: 1 },
    },
  });
  return `PO-${today.replace(/-/g, '')}-${String(seq.currentValue).padStart(4, '0')}`;
}

// Find or create a system user for public orders
async function getSystemUserId(restaurantId: string): Promise<string> {
  // Try to find an existing admin user
  const adminUser = await prisma.user.findFirst({
    where: {
      restaurantId,
      roles: {
        some: {
          role: {
            name: 'ADMIN',
          },
        },
      },
    },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });

  if (adminUser) return adminUser.id;

  // Fallback: get any active user
  const anyUser = await prisma.user.findFirst({
    where: { restaurantId, status: 'ACTIVE' },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });

  if (anyUser) return anyUser.id;

  // Last resort: use the first user in the restaurant
  const firstUser = await prisma.user.findFirst({
    where: { restaurantId },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });

  return firstUser?.id || '';
}

// Auto-assign the best available waiter for a dine-in table order
async function autoAssignWaiter(restaurantId: string, tableId?: string | null): Promise<string> {
  // Find WAITER role users who are ACTIVE AND clocked in today
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const allWaiters = await prisma.user.findMany({
    where: {
      restaurantId,
      status: 'ACTIVE',
      roles: {
        some: {
          role: { name: 'WAITER' },
        },
      },
    },
    select: {
      id: true,
      _count: {
        select: {
          ordersAsWaiter: {
            where: { status: { in: ['SUBMITTED', 'IN_PREPARATION', 'PARTIALLY_READY', 'READY', 'SERVED'] } },
          },
        },
      },
    },
  });

  if (allWaiters.length === 0) {
    return getSystemUserId(restaurantId);
  }

  // Get waiter IDs who are clocked in today
  const clockedInAssignments = await prisma.shiftAssignment.findMany({
    where: {
      restaurantId,
      userId: { in: allWaiters.map(w => w.id) },
      status: 'CLOCKED_IN',
      clockedInAt: { gte: todayStart, lte: todayEnd },
    },
    select: { userId: true },
  });
  const clockedInIds = new Set(clockedInAssignments.map(a => a.userId));

  // Prefer clocked-in waiters, then fall back to any active waiter
  const eligible = allWaiters.filter(w => clockedInIds.has(w.id));
  const candidates = eligible.length > 0 ? eligible : allWaiters;

  // Sort by active order count (ascending) - assign to least busy waiter
  candidates.sort((a, b) => a._count.ordersAsWaiter - b._count.ordersAsWaiter);
  return candidates[0].id;
}

// ─── Restaurant Resolution ───────────────────────────────

export async function resolveActiveRestaurant(): Promise<{ id: string } | null> {
  const restaurant = await prisma.restaurant.findFirst({
    where: {
      isActive: true,
      settings: { publicWebsiteEnabled: true, publicOrderingEnabled: true },
    },
    select: { id: true },
  });
  return restaurant;
}

// ─── Public Order Creation ───────────────────────────────

export async function createPublicOrder(input: CreateOrderInput): Promise<{
  publicReference: string;
  trackingToken: string;
} | { error: string }> {
  // 1. Validate restaurant
  const restaurant = await resolveActiveRestaurant();
  if (!restaurant) return { error: 'Online ordering is not available.' };

  const settings = await prisma.restaurantSettings.findUnique({
    where: { restaurantId: restaurant.id },
  });
  if (!settings || !settings.publicOrderingEnabled || settings.publicPauseOrdering) {
    return { error: settings?.publicPauseOrderingReason || 'Online ordering is not available.' };
  }

  // 2. Validate table for DINE_IN
  let tableId: string | null = null;
  if (input.orderType === 'DINE_IN') {
    if (input.tableId) {
      const table = await prisma.restaurantTable.findFirst({
        where: { id: input.tableId, restaurantId: restaurant.id, isActive: true },
      });
      if (!table) return { error: 'Table not found or unavailable.' };
      tableId = table.id;
    }
  } else {
    // Validate opening hours for pickup/delivery
    const availability = await checkOpeningHours(restaurant.id, input.orderType);
    if (!availability.isOpen) return { error: availability.message };
  }

  // 3. Validate items
  if (!input.items.length) return { error: 'Cart is empty.' };

  const menuItemIds = input.items.map((i) => i.menuItemId);
  const menuItems = await prisma.menuItem.findMany({
    where: {
      id: { in: menuItemIds },
      restaurantId: restaurant.id,
      isActive: true,
      isPubliclyVisible: true,
      isAvailable: true,
    },
  });

  if (menuItems.length !== input.items.length) {
    return { error: 'Some menu items are no longer available.' };
  }

  // 4. Validate delivery zone
  let deliveryFee = 0;
  if (input.orderType === 'DELIVERY') {
    if (!input.deliveryZoneId) return { error: 'Delivery zone is required.' };
    
    const zone = await prisma.deliveryZone.findFirst({
      where: { id: input.deliveryZoneId, restaurantId: restaurant.id, isActive: true },
    });
    if (!zone) return { error: 'Delivery zone not found.' };
    deliveryFee = Number(zone.deliveryFee);

    // Validate minimum order for zone
    const subtotal = input.items.reduce((sum, item) => {
      const menuItem = menuItems.find((m) => m.id === item.menuItemId);
      return sum + Number(menuItem?.price || 0) * item.quantity;
    }, 0);
    if (subtotal < Number(zone.minimumOrderAmount)) {
      return { error: `Minimum order for this zone is ${zone.minimumOrderAmount}.` };
    }
  }

  // 5. Calculate totals (backend authoritative)
  let subtotal = 0;
  const orderItemsData = [];
  for (const item of input.items) {
    const menuItem = menuItems.find((m) => m.id === item.menuItemId)!;
    const lineSubtotal = Number(menuItem.price) * item.quantity;
    const lineTax = lineSubtotal * Number(menuItem.taxRate) / 100;
    subtotal += lineSubtotal;

    // Determine kitchen station
    const stationId = menuItem.kitchenStationId || null;

    orderItemsData.push({
      menuItemId: item.menuItemId,
      kitchenStationId: stationId,
      menuItemNameSnapshot: menuItem.name,
      menuItemCodeSnapshot: menuItem.code,
      itemTypeSnapshot: menuItem.itemType,
      unitPrice: menuItem.price,
      taxRate: menuItem.taxRate,
      quantity: item.quantity,
      lineSubtotal: lineSubtotal,
      lineTaxAmount: lineTax,
      lineTotal: lineSubtotal + lineTax,
      specialInstructions: item.instructions || null,
      requiresPreparation: menuItem.requiresPreparation,
      status: 'DRAFT' as const,
    });
  }

  const taxAmount = orderItemsData.reduce((sum, i) => sum + Number(i.lineTaxAmount), 0);
  const serviceChargeRate = Number(settings.serviceChargeRate || 0);
  const serviceCharge = subtotal * serviceChargeRate / 100;
  const total = subtotal + taxAmount + serviceCharge + deliveryFee;

  // 6. Create order
  const publicReference = generatePublicReference();
  const trackingToken = generateAccessToken();
  const tokenHash = hashToken(trackingToken);
  const orderNumber = await getNextSequence(restaurant.id);
  const isDineIn = input.orderType === 'DINE_IN';

  const order = await prisma.order.create({
    data: {
      restaurantId: restaurant.id,
      orderNumber,
      orderType: isDineIn ? 'DINE_IN' : input.orderType as any,
      status: isDineIn ? 'SUBMITTED' : 'DRAFT',
      paymentStatus: 'UNPAID',
      tableId,
      customerName: input.customerName,
      customerPhone: input.phone,
      customerEmailSnapshot: input.email || null,
      notes: input.notes || null,
      subtotal,
      taxAmount,
      serviceCharge,
      discountAmount: 0,
      totalAmount: total,
      amountPaid: 0,
      amountDue: total,
      totalBeforeDiscount: total,
      createdById: await getSystemUserId(restaurant.id),
      waiterId: isDineIn ? await autoAssignWaiter(restaurant.id, tableId) : await getSystemUserId(restaurant.id),
      // Public fields
      publicReference,
      publicAccessTokenHash: tokenHash,
      publicOrderStatus: isDineIn ? 'RECEIVED' : 'AWAITING_CONFIRMATION',
      publicOrderSource: isDineIn ? 'QR_TABLE' : 'WEBSITE',
      submittedAt: isDineIn ? new Date() : undefined,
      deliveryFee,
      deliveryInstructions: input.deliveryInstructions || null,
      publicOrderNotes: input.notes || null,
      publicPaymentChoice: isDineIn ? 'PAY_AT_CASHIER' : input.orderType === 'DELIVERY' ? 'PAY_ON_DELIVERY' : 'PAY_ON_PICKUP',
      // Delivery fields
      deliveryAddressId: null,
      deliveryAddressSnapshot: input.deliveryAddress ? JSON.parse(JSON.stringify(input.deliveryAddress)) : null,
      deliveryZoneId: input.deliveryZoneId || null,
    },
  });

  // 7. Create order items
  for (const itemData of orderItemsData) {
    await prisma.orderItem.create({
      data: {
        ...itemData,
        orderId: order.id,
      },
    });
  }

  // 8. Handle auto-accept (for pickup/delivery) or submit for dine-in
  if (isDineIn) {
    // Dine-in orders are immediately submitted; update order item statuses too
    await prisma.orderItem.updateMany({
      where: { orderId: order.id },
      data: { status: 'SENT' },
    });

    // Create kitchen tickets
    const stations = [...new Set(orderItemsData.filter((i) => i.kitchenStationId).map((i) => i.kitchenStationId))] as string[];
    for (const stationId of stations) {
      const ticketItems = orderItemsData.filter((i) => i.kitchenStationId === stationId);
      const ticketNumber = `KT-${orderNumber}-${stationId.slice(0, 8)}`;
      const ticket = await prisma.kitchenTicket.create({
        data: {
          restaurantId: restaurant.id,
          orderId: order.id,
          kitchenStationId: stationId,
          ticketNumber,
          status: 'NEW',
        },
      });
      for (const item of ticketItems) {
        const orderItem = await prisma.orderItem.findFirst({
          where: { orderId: order.id, menuItemId: item.menuItemId, menuItemCodeSnapshot: item.menuItemCodeSnapshot },
          orderBy: { createdAt: 'asc' },
        });
        if (orderItem) {
          await prisma.kitchenTicketItem.create({
            data: { kitchenTicketId: ticket.id, orderItemId: orderItem.id },
          });
        }
      }
    }
  } else if (settings.publicOrderAcceptanceMode === 'AUTOMATIC' || settings.publicOrderAutoAccept) {
    // Auto-accept for pickup/delivery
    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: 'SUBMITTED',
        publicOrderStatus: 'ACCEPTED',
        submittedAt: new Date(),
        acceptedAt: new Date(),
      },
    });
  }

  // 9. Emit socket notification for new order
  try {
    const orderWithItems = await prisma.order.findUnique({
      where: { id: order.id },
      include: {
        items: {
          select: { id: true, menuItemNameSnapshot: true, quantity: true, status: true },
        },
        table: { select: { name: true, code: true } },
      },
    });
    if (orderWithItems) {
      emitToRestaurant(restaurant.id, 'order:new', {
        id: orderWithItems.id,
        orderNumber: orderWithItems.orderNumber,
        publicReference: orderWithItems.publicReference,
        orderType: orderWithItems.orderType,
        status: orderWithItems.status,
        publicOrderStatus: orderWithItems.publicOrderStatus,
        customerName: orderWithItems.customerName,
        tableName: orderWithItems.table?.name || null,
        tableCode: orderWithItems.table?.code || null,
        items: orderWithItems.items,
        isPublicOrder: true,
        source: isDineIn ? 'QR_TABLE' : 'WEBSITE',
      });
    }
  } catch { /* non-critical */ }

  return { publicReference, trackingToken };
}

// ─── Track Order ─────────────────────────────────────────

export async function trackOrder(
  reference: string,
  token?: string,
): Promise<Record<string, any> | { error: string }> {
  const order = await prisma.order.findUnique({
    where: { publicReference: reference },
    include: {
      items: {
        select: {
          menuItemNameSnapshot: true,
          quantity: true,
          unitPrice: true,
        },
      },
      restaurant: {
        select: { name: true },
      },
    },
  });

  if (!order) return { error: 'Order not found.' };

  // If token is provided, validate it
  if (token) {
    const tokenHash = hashToken(token);
    if (order.publicAccessTokenHash !== tokenHash) {
      return { error: 'Invalid tracking token.' };
    }
  }

  const publicStatusLabels: Record<string, string> = {
    RECEIVED: 'Received',
    AWAITING_CONFIRMATION: 'Awaiting Confirmation',
    ACCEPTED: 'Accepted',
    PREPARING: 'Being Prepared',
    READY_FOR_PICKUP: 'Ready for Pickup',
    OUT_FOR_DELIVERY: 'Out for Delivery',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled',
    REJECTED: 'Rejected',
  };

  const paymentLabels: Record<string, string> = {
    PAY_ON_PICKUP: 'Pay on Pickup',
    PAY_ON_DELIVERY: 'Pay on Delivery',
    PAY_AT_CASHIER: 'Pay at Cashier',
    MANUAL_MOBILE_MONEY_REFERENCE: 'Mobile Money',
  };

  const paymentStatusLabels: Record<string, string> = {
    UNPAID: 'Unpaid',
    PARTIALLY_PAID: 'Partially Paid',
    PAID: 'Paid',
  };

  return {
    restaurantName: order.restaurant.name,
    publicReference: order.publicReference,
    orderType: order.orderType,
    status: order.publicOrderStatus || 'RECEIVED',
    statusLabel: publicStatusLabels[order.publicOrderStatus || 'RECEIVED'] || 'Received',
    items: order.items.map((i) => ({
      name: i.menuItemNameSnapshot,
      quantity: i.quantity,
      price: i.unitPrice.toString(),
    })),
    total: order.totalAmount.toString(),
    paymentChoice: paymentLabels[order.publicPaymentChoice || 'PAY_ON_PICKUP'] || 'Pay on Pickup',
    paymentStatus: paymentStatusLabels[order.paymentStatus] || 'Unpaid',
    submittedAt: order.submittedAt?.toISOString() || order.createdAt.toISOString(),
    estimatedCompletion: order.acceptedAt
      ? new Date(order.acceptedAt.getTime() + 30 * 60000).toISOString()
      : null,
    pickupSummary: order.orderType === 'PICKUP'
      ? `Pickup at restaurant`
      : null,
    deliverySummary: order.orderType === 'DELIVERY'
      ? `Delivery to ${order.customerName || ''}`
      : null,
    cancellationStatus: null,
  };
}

// ─── Cancel Request ──────────────────────────────────────

export async function requestCancellation(
  reference: string,
  reason: string,
  token?: string,
): Promise<{ message: string } | { error: string }> {
  const order = await prisma.order.findUnique({
    where: { publicReference: reference },
  });

  if (!order) return { error: 'Order not found.' };

  // Validate token if provided
  if (token) {
    const tokenHash = hashToken(token);
    if (order.publicAccessTokenHash !== tokenHash) {
      return { error: 'Invalid tracking token.' };
    }
  }

  // Check if order can be cancelled
  const cancellableStatuses = ['AWAITING_CONFIRMATION', 'ACCEPTED'];
  if (!cancellableStatuses.includes(order.publicOrderStatus || '')) {
    return { error: 'This order cannot be cancelled at this stage.' };
  }

  // Check if cancellation already exists
  const existingRequest = await prisma.publicOrderCancellationRequest.findFirst({
    where: { orderId: order.id, status: 'PENDING' },
  });

  if (existingRequest) {
    return { error: 'A cancellation request is already pending.' };
  }

  await prisma.publicOrderCancellationRequest.create({
    data: {
      restaurantId: order.restaurantId,
      orderId: order.id,
      reason,
      status: 'PENDING',
    },
  });

  return { message: 'Cancellation request submitted. The restaurant will review it shortly.' };
}

// ─── Public Reservation ──────────────────────────────────

export async function createPublicReservation(input: CreateReservationInput): Promise<{
  publicReference: string;
  message: string;
} | { error: string }> {
  const restaurant = await prisma.restaurant.findFirst({
    where: {
      isActive: true,
      settings: { publicWebsiteEnabled: true, publicReservationsEnabled: true },
    },
    include: { settings: true },
  });

  if (!restaurant || !restaurant.settings?.publicReservationsEnabled) {
    return { error: 'Online reservations are not available.' };
  }

  const settings = restaurant.settings;

  // Validate party size
  if (settings.publicReservationMaximumPartySize && input.partySize > settings.publicReservationMaximumPartySize) {
    return { error: `Maximum party size is ${settings.publicReservationMaximumPartySize}.` };
  }

  // Parse date/time
  const dateTimeStr = `${input.date}T${input.time}:00`;
  const requestedAt = new Date(dateTimeStr);

  // Validate lead time
  const minLeadMs = (settings.publicReservationMinimumLeadMinutes || 60) * 60 * 1000;
  if (requestedAt.getTime() - Date.now() < minLeadMs) {
    return { error: 'Reservation must be at least 60 minutes in advance.' };
  }

  // Validate max days ahead
  if (settings.publicReservationMaximumDaysAhead) {
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + settings.publicReservationMaximumDaysAhead);
    if (requestedAt > maxDate) {
      return { error: `Cannot book more than ${settings.publicReservationMaximumDaysAhead} days in advance.` };
    }
  }

  // Validate hours
  const availability = await checkOpeningHours(restaurant.id, '', requestedAt);
  if (!availability.isOpen) {
    return { error: 'The restaurant is closed at the requested time.' };
  }

  // Create reservation
  const ref = `RES-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const expectedEnd = new Date(requestedAt.getTime() + (settings.defaultReservationDurationMinutes || 120) * 60000);

  await prisma.reservation.create({
    data: {
      restaurantId: restaurant.id,
      reservationNumber: ref,
      customerNameSnapshot: input.name,
      customerPhoneSnapshot: input.phone,
      customerEmailSnapshot: input.email || null,
      reservationSource: 'WEBSITE',
      reservationDate: requestedAt,
      startAt: requestedAt,
      expectedEndAt: expectedEnd,
      partySize: input.partySize,
      status: 'PENDING',
      specialRequests: input.specialRequests || null,
      dietaryNotesSnapshot: null,
      occasion: input.occasion || null,
      createdById: await getSystemUserId(restaurant.id),
    },
  });

  return {
    publicReference: ref,
    message: 'Reservation request submitted. We will confirm it shortly.',
  };
}
