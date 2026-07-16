import { Server as SocketIOServer } from 'socket.io';

export const initializeSocketHandlers = (io: SocketIOServer): void => {
  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    socket.on('join-restaurant', (restaurantId: string) => {
      socket.join(`restaurant:${restaurantId}`);
    });

    socket.on('join-user', (userId: string) => {
      socket.join(`user:${userId}`);
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });
};

// Helper functions for emitting events
export const emitPaymentEvent = (io: SocketIOServer, restaurantId: string, event: string, data: any): void => {
  io.to(`restaurant:${restaurantId}`).emit(event, data);
};

export const emitUserEvent = (io: SocketIOServer, userId: string, event: string, data: any): void => {
  io.to(`user:${userId}`).emit(event, data);
};

// Payment events
export const emitPaymentRequested = (io: SocketIOServer, restaurantId: string, data: any): void => {
  emitPaymentEvent(io, restaurantId, 'payment:requested', data);
};

export const emitPaymentRecorded = (io: SocketIOServer, restaurantId: string, data: any): void => {
  emitPaymentEvent(io, restaurantId, 'payment:recorded', data);
};

export const emitPaymentUpdated = (io: SocketIOServer, restaurantId: string, data: any): void => {
  emitPaymentEvent(io, restaurantId, 'payment:updated', data);
};

export const emitPaymentVoided = (io: SocketIOServer, restaurantId: string, data: any): void => {
  emitPaymentEvent(io, restaurantId, 'payment:voided', data);
};

export const emitPaymentRefunded = (io: SocketIOServer, restaurantId: string, data: any): void => {
  emitPaymentEvent(io, restaurantId, 'payment:refunded', data);
};

export const emitOrderPaymentStatusUpdated = (io: SocketIOServer, restaurantId: string, data: any): void => {
  emitPaymentEvent(io, restaurantId, 'order:payment-status-updated', data);
};

export const emitOrderClosed = (io: SocketIOServer, restaurantId: string, data: any): void => {
  emitPaymentEvent(io, restaurantId, 'order:closed', data);
};

export const emitReceiptIssued = (io: SocketIOServer, restaurantId: string, data: any): void => {
  emitPaymentEvent(io, restaurantId, 'receipt:issued', data);
};

export const emitReceiptVoided = (io: SocketIOServer, restaurantId: string, data: any): void => {
  emitPaymentEvent(io, restaurantId, 'receipt:voided', data);
};

export const emitTableReleased = (io: SocketIOServer, restaurantId: string, data: any): void => {
  emitPaymentEvent(io, restaurantId, 'table:released', data);
};

// ==========================================
// Phase 7: Shift & Attendance Events
// ==========================================

export const emitShiftPublished = (io: SocketIOServer, restaurantId: string, data: any): void => {
  emitPaymentEvent(io, restaurantId, 'shift:published', data);
};

export const emitShiftOpened = (io: SocketIOServer, restaurantId: string, data: any): void => {
  emitPaymentEvent(io, restaurantId, 'shift:opened', data);
};

export const emitShiftClosing = (io: SocketIOServer, restaurantId: string, data: any): void => {
  emitPaymentEvent(io, restaurantId, 'shift:closing', data);
};

export const emitShiftClosed = (io: SocketIOServer, restaurantId: string, data: any): void => {
  emitPaymentEvent(io, restaurantId, 'shift:closed', data);
};

export const emitShiftAssignmentUpdated = (io: SocketIOServer, restaurantId: string, userId: string, data: any): void => {
  emitPaymentEvent(io, restaurantId, 'shift:assignment-updated', data);
  emitUserEvent(io, userId, 'shift:assignment-updated', data);
};

export const emitAttendanceClockedIn = (io: SocketIOServer, restaurantId: string, userId: string, data: any): void => {
  emitPaymentEvent(io, restaurantId, 'attendance:clocked-in', data);
  emitUserEvent(io, userId, 'attendance:clocked-in', data);
};

export const emitAttendanceBreakStarted = (io: SocketIOServer, restaurantId: string, userId: string, data: any): void => {
  emitPaymentEvent(io, restaurantId, 'attendance:break-started', data);
  emitUserEvent(io, userId, 'attendance:break-started', data);
};

export const emitAttendanceBreakEnded = (io: SocketIOServer, restaurantId: string, userId: string, data: any): void => {
  emitPaymentEvent(io, restaurantId, 'attendance:break-ended', data);
  emitUserEvent(io, userId, 'attendance:break-ended', data);
};

export const emitAttendanceClockedOut = (io: SocketIOServer, restaurantId: string, userId: string, data: any): void => {
  emitPaymentEvent(io, restaurantId, 'attendance:clocked-out', data);
  emitUserEvent(io, userId, 'attendance:clocked-out', data);
};

export const emitAttendanceCorrected = (io: SocketIOServer, restaurantId: string, data: any): void => {
  emitPaymentEvent(io, restaurantId, 'attendance:corrected', data);
};

// Cashier session events
export const emitCashierSessionOpened = (io: SocketIOServer, restaurantId: string, data: any): void => {
  emitPaymentEvent(io, restaurantId, 'cashier-session:opened', data);
};

export const emitCashierSessionUpdated = (io: SocketIOServer, restaurantId: string, data: any): void => {
  emitPaymentEvent(io, restaurantId, 'cashier-session:updated', data);
};

export const emitCashierSessionClosing = (io: SocketIOServer, restaurantId: string, data: any): void => {
  emitPaymentEvent(io, restaurantId, 'cashier-session:closing', data);
};

export const emitCashierSessionPendingApproval = (io: SocketIOServer, restaurantId: string, data: any): void => {
  emitPaymentEvent(io, restaurantId, 'cashier-session:pending-approval', data);
};

export const emitCashierSessionClosed = (io: SocketIOServer, restaurantId: string, data: any): void => {
  emitPaymentEvent(io, restaurantId, 'cashier-session:closed', data);
};

export const emitCashDrawerMovementCreated = (io: SocketIOServer, restaurantId: string, data: any): void => {
  emitPaymentEvent(io, restaurantId, 'cash-drawer:movement-created', data);
};

export const emitCashVarianceDetected = (io: SocketIOServer, restaurantId: string, data: any): void => {
  emitPaymentEvent(io, restaurantId, 'cash-drawer:variance-detected', data);
};

// Handover events
export const emitHandoverSubmitted = (io: SocketIOServer, restaurantId: string, data: any): void => {
  emitPaymentEvent(io, restaurantId, 'handover:submitted', data);
};

export const emitHandoverAcknowledged = (io: SocketIOServer, restaurantId: string, data: any): void => {
  emitPaymentEvent(io, restaurantId, 'handover:acknowledged', data);
};

// ==========================================
// Phase 8: Customer, Reservation, Loyalty & Promotion Events
// ==========================================

export const emitCustomerCreated = (io: SocketIOServer, restaurantId: string, data: any): void => {
  emitPaymentEvent(io, restaurantId, 'customer:created', data);
};

export const emitCustomerUpdated = (io: SocketIOServer, restaurantId: string, data: any): void => {
  emitPaymentEvent(io, restaurantId, 'customer:updated', data);
};

export const emitReservationCreated = (io: SocketIOServer, restaurantId: string, data: any): void => {
  emitPaymentEvent(io, restaurantId, 'reservation:created', data);
};

export const emitReservationUpdated = (io: SocketIOServer, restaurantId: string, data: any): void => {
  emitPaymentEvent(io, restaurantId, 'reservation:updated', data);
};

export const emitReservationConfirmed = (io: SocketIOServer, restaurantId: string, data: any): void => {
  emitPaymentEvent(io, restaurantId, 'reservation:confirmed', data);
};

export const emitReservationCheckedIn = (io: SocketIOServer, restaurantId: string, data: any): void => {
  emitPaymentEvent(io, restaurantId, 'reservation:checked-in', data);
};

export const emitReservationSeated = (io: SocketIOServer, restaurantId: string, data: any): void => {
  emitPaymentEvent(io, restaurantId, 'reservation:seated', data);
};

export const emitReservationCancelled = (io: SocketIOServer, restaurantId: string, data: any): void => {
  emitPaymentEvent(io, restaurantId, 'reservation:cancelled', data);
};

export const emitReservationNoShow = (io: SocketIOServer, restaurantId: string, data: any): void => {
  emitPaymentEvent(io, restaurantId, 'reservation:no-show', data);
};

export const emitWaitingListCreated = (io: SocketIOServer, restaurantId: string, data: any): void => {
  emitPaymentEvent(io, restaurantId, 'waiting-list:created', data);
};

export const emitWaitingListUpdated = (io: SocketIOServer, restaurantId: string, data: any): void => {
  emitPaymentEvent(io, restaurantId, 'waiting-list:updated', data);
};

export const emitWaitingListNotified = (io: SocketIOServer, restaurantId: string, data: any): void => {
  emitPaymentEvent(io, restaurantId, 'waiting-list:notified', data);
};

export const emitWaitingListSeated = (io: SocketIOServer, restaurantId: string, data: any): void => {
  emitPaymentEvent(io, restaurantId, 'waiting-list:seated', data);
};

export const emitLoyaltyUpdated = (io: SocketIOServer, restaurantId: string, userId: string, data: any): void => {
  emitPaymentEvent(io, restaurantId, 'loyalty:updated', data);
  emitUserEvent(io, userId, 'loyalty:updated', data);
};

export const emitLoyaltyTransactionCreated = (io: SocketIOServer, restaurantId: string, userId: string, data: any): void => {
  emitPaymentEvent(io, restaurantId, 'loyalty:transaction-created', data);
  emitUserEvent(io, userId, 'loyalty:transaction-created', data);
};

export const emitPromotionUpdated = (io: SocketIOServer, restaurantId: string, data: any): void => {
  emitPaymentEvent(io, restaurantId, 'promotion:updated', data);
};

export const emitOrderDiscountUpdated = (io: SocketIOServer, restaurantId: string, data: any): void => {
  emitPaymentEvent(io, restaurantId, 'order:discount-updated', data);
};

export const emitDiscountRequestCreated = (io: SocketIOServer, restaurantId: string, data: any): void => {
  emitPaymentEvent(io, restaurantId, 'discount-request:created', data);
};

export const emitDiscountRequestResolved = (io: SocketIOServer, restaurantId: string, data: any): void => {
  emitPaymentEvent(io, restaurantId, 'discount-request:resolved', data);
};

export const emitTableReservationUpdated = (io: SocketIOServer, restaurantId: string, data: any): void => {
  emitPaymentEvent(io, restaurantId, 'table:reservation-updated', data);
};
