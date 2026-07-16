import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../database';
import { requireAuth, requireRole } from '../middleware/auth';
import { createAuditLog } from '../services/audit.service';
import { BadRequestError, NotFoundError } from '../types';

const router = Router();
router.use(requireAuth);

const operationsSchema = z.object({
  defaultTaxRate: z.number().min(0).max(100).optional(),
  serviceChargeRate: z.number().min(0).max(100).optional(),
  pricesIncludeTax: z.boolean().optional(),
  allowNegativeStock: z.boolean().optional(),
  receiptFooter: z.string().optional().nullable(),
  orderNumberPrefix: z.string().max(10).regex(/^[A-Z0-9]+$/).optional(),
  receiptNumberPrefix: z.string().max(10).regex(/^[A-Z0-9]+$/).optional(),
  tableRequiredForDineIn: z.boolean().optional(),
  tableStatusAfterOrderClosure: z.enum(['AVAILABLE', 'CLEANING']).optional(),
  allowPartialPayments: z.boolean().optional(),
  allowSplitPayments: z.boolean().optional(),
  requireReferenceForCard: z.boolean().optional(),
  requireReferenceForMobileMoney: z.boolean().optional(),
  requireReferenceForBankTransfer: z.boolean().optional(),
  allowPaymentBeforeServing: z.boolean().optional(),
  printReceiptAutomatically: z.boolean().optional(),
  receiptPaperSize: z.enum(['THERMAL_58MM', 'THERMAL_80MM', 'A4']).optional(),
  receiptShowCustomerPhone: z.boolean().optional(),
  receiptShowWaiter: z.boolean().optional(),
  receiptShowTaxBreakdown: z.boolean().optional(),
  businessDayStartTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  requireClockInForOperationalActions: z.boolean().optional(),
  requireOpenCashierSessionForCashPayments: z.boolean().optional(),
  allowUnscheduledClockIn: z.boolean().optional(),
  allowEmployeeSelfClockIn: z.boolean().optional(),
  allowEmployeeSelfClockOut: z.boolean().optional(),
  cashVarianceApprovalThreshold: z.number().min(0).optional(),
  cashVarianceWarningThreshold: z.number().min(0).optional(),
  requireManagerApprovalForCashOut: z.boolean().optional(),
  requireManagerApprovalForSafeDrop: z.boolean().optional(),
  requireHandoverBeforeShiftClose: z.boolean().optional(),
  autoCloseOpenBreakOnClockOut: z.boolean().optional(),
  shiftClosingGraceMinutes: z.number().int().min(0).optional(),
  // Phase 8: Loyalty settings
  loyaltyEnabled: z.boolean().optional(),
  pointsPerCurrencyUnit: z.number().min(0).optional(),
  minimumSpendToEarnPoints: z.number().min(0).optional(),
  loyaltyRedemptionEnabled: z.boolean().optional(),
  currencyValuePerPoint: z.number().min(0).optional(),
  minimumPointsToRedeem: z.number().int().min(0).optional(),
  maximumRedemptionPercentage: z.number().min(0).max(100).optional(),
  loyaltyPointsExpiryMonths: z.number().int().min(1).optional().nullable(),
  loyaltyPointsEarnOnDiscountedAmount: z.boolean().optional(),
  loyaltyPointsEarnOnTax: z.boolean().optional(),
  loyaltyPointsEarnOnServiceCharge: z.boolean().optional(),
  // Phase 8: Reservation settings
  reservationsEnabled: z.boolean().optional(),
  defaultReservationDurationMinutes: z.number().int().min(1).optional(),
  reservationArrivalGraceMinutes: z.number().int().min(0).optional(),
  reservationLateHoldingMinutes: z.number().int().min(0).optional(),
  requirePhoneForReservation: z.boolean().optional(),
  requireCustomerProfileForReservation: z.boolean().optional(),
  allowTableOverbooking: z.boolean().optional(),
  allowReservationWithoutTable: z.boolean().optional(),
  reservationReminderMinutes: z.number().int().min(1).optional().nullable(),
  waitingListEnabled: z.boolean().optional(),
  defaultWaitingEstimateMinutes: z.number().int().min(1).optional(),
  // Phase 8: Discount settings
  allowPromotionStacking: z.boolean().optional(),
  allowLoyaltyWithPromotions: z.boolean().optional(),
  allowManualDiscountWithPromotions: z.boolean().optional(),
  maximumTotalDiscountPercentage: z.number().min(0).max(100).optional(),
  requireManagerApprovalForManualDiscount: z.boolean().optional(),
  manualDiscountApprovalThresholdPercentage: z.number().min(0).max(100).optional(),
});

// GET /api/settings/operations
router.get('/operations', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const settings = await prisma.restaurantSettings.findUnique({
      where: { restaurantId: req.user!.restaurantId },
    });
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: req.user!.restaurantId },
      select: { currency: true, timezone: true, name: true },
    });
    if (!settings) throw new NotFoundError('Settings not found');
    res.json({ success: true, data: { ...settings, currency: restaurant?.currency, timezone: restaurant?.timezone, restaurantName: restaurant?.name } });
  } catch (error) { next(error); }
});

// PATCH /api/settings/operations
router.patch('/operations', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = operationsSchema.parse(req.body);
    const existing = await prisma.restaurantSettings.findUnique({ where: { restaurantId: req.user!.restaurantId } });
    if (!existing) throw new NotFoundError('Settings not found');

    const updated = await prisma.restaurantSettings.update({
      where: { restaurantId: req.user!.restaurantId },
      data: parsed,
    });

    await createAuditLog({
      restaurantId: req.user!.restaurantId,
      userId: req.user!.id,
      action: 'SETTINGS_UPDATED',
      entityType: 'RESTAURANT_SETTINGS',
      description: 'Operational settings updated',
      metadata: { updatedFields: Object.keys(parsed) },
    });

    res.json({ success: true, message: 'Settings updated', data: updated });
  } catch (error) {
    if (error instanceof z.ZodError) next(new BadRequestError(error.errors[0].message));
    else next(error);
  }
});

export default router;
