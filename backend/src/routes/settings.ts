import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../database';
import { requireAuth, requireRole } from '../middleware/auth';
import { createAuditLog } from '../services/audit.service';
import { BadRequestError, NotFoundError } from '../types';

const router = Router();
router.use(requireAuth);

// ==========================================
// VALIDATION SCHEMAS
// ==========================================

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

const restaurantProfileSchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),
  email: z.string().email('Invalid email').optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  currency: z.string().min(1).max(10).optional(),
  timezone: z.string().min(1).optional(),
  logoUrl: z.string().optional().nullable(),
});

const businessHoursSchema = z.object({
  dayOfWeek: z.enum(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']),
  isClosed: z.boolean().default(false),
  periods: z.array(z.object({
    openTime: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format (HH:mm)'),
    closeTime: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format (HH:mm)'),
  })).optional().default([]),
});

// ==========================================
// GET /api/settings/operations
// ==========================================
router.get('/operations', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const settings = await prisma.restaurantSettings.findUnique({
      where: { restaurantId: req.user!.restaurantId },
    });
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: req.user!.restaurantId },
      select: { currency: true, timezone: true, name: true, phone: true, email: true, address: true, logoUrl: true },
    });
    if (!settings) throw new NotFoundError('Settings not found');
    
    // Fetch business hours by day
    const openingHours = await prisma.restaurantOpeningHour.findMany({
      where: { restaurantId: req.user!.restaurantId },
      include: { periods: { orderBy: { openTime: 'asc' } } },
      orderBy: { dayOfWeek: 'asc' },
    });

    res.json({
      success: true,
      data: {
        ...settings,
        currency: restaurant?.currency,
        timezone: restaurant?.timezone,
        restaurantName: restaurant?.name,
        restaurantPhone: restaurant?.phone,
        restaurantEmail: restaurant?.email,
        restaurantAddress: restaurant?.address,
        logoUrl: restaurant?.logoUrl,
        businessHours: openingHours,
      },
    });
  } catch (error) { next(error); }
});

// ==========================================
// PATCH /api/settings/operations
// ==========================================
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

// ==========================================
// GET /api/settings/profile
// ==========================================
router.get('/profile', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: req.user!.restaurantId },
      select: {
        id: true, name: true, email: true, phone: true, address: true,
        currency: true, timezone: true, logoUrl: true, publicSlug: true,
      },
    });
    if (!restaurant) throw new NotFoundError('Restaurant not found');
    res.json({ success: true, data: restaurant });
  } catch (error) { next(error); }
});

// ==========================================
// PATCH /api/settings/profile
// ==========================================
router.patch('/profile', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = restaurantProfileSchema.parse(req.body);
    const existing = await prisma.restaurant.findUnique({ where: { id: req.user!.restaurantId } });
    if (!existing) throw new NotFoundError('Restaurant not found');

    // Check email uniqueness if changed
    if (parsed.email && parsed.email !== existing.email) {
      const conflict = await prisma.restaurant.findUnique({ where: { email: parsed.email } });
      if (conflict && conflict.id !== req.user!.restaurantId) {
        throw new BadRequestError('Email already in use by another restaurant');
      }
    }

    const updateData: any = { ...parsed };
    if (parsed.logoUrl === null) updateData.logoUrl = null;

    const updated = await prisma.restaurant.update({
      where: { id: req.user!.restaurantId },
      data: updateData,
    });

    await createAuditLog({
      restaurantId: req.user!.restaurantId,
      userId: req.user!.id,
      action: 'RESTAURANT_PROFILE_UPDATED',
      entityType: 'RESTAURANT',
      description: 'Restaurant profile updated',
      metadata: { updatedFields: Object.keys(parsed) },
    });

    res.json({ success: true, message: 'Profile updated', data: updated });
  } catch (error) {
    if (error instanceof z.ZodError) next(new BadRequestError(error.errors[0].message));
    else next(error);
  }
});

// ==========================================
// GET /api/settings/business-hours
// Returns all business hours grouped by day
// ==========================================
router.get('/business-hours', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const openingHours = await prisma.restaurantOpeningHour.findMany({
      where: { restaurantId: req.user!.restaurantId },
      include: { periods: { orderBy: { openTime: 'asc' } } },
      orderBy: { dayOfWeek: 'asc' },
    });
    res.json({ success: true, data: openingHours });
  } catch (error) { next(error); }
});

// ==========================================
// PUT /api/settings/business-hours — Replace all business hours
// ==========================================
router.put('/business-hours', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const days = z.array(businessHoursSchema).parse(req.body);

    await prisma.$transaction(async (tx) => {
      // Delete all existing opening hours for this restaurant
      await tx.openingHourPeriod.deleteMany({
        where: { restaurantId: req.user!.restaurantId },
      });
      await tx.restaurantOpeningHour.deleteMany({
        where: { restaurantId: req.user!.restaurantId },
      });

      // Create new opening hours for each day
      for (const day of days) {
        const openingHour = await tx.restaurantOpeningHour.create({
          data: {
            restaurantId: req.user!.restaurantId,
            dayOfWeek: day.dayOfWeek as any,
            isClosed: day.isClosed,
            supportsPickup: true,
            supportsDelivery: false,
            supportsReservations: true,
          },
        });

        if (!day.isClosed && day.periods && day.periods.length > 0) {
          for (const period of day.periods) {
            await tx.openingHourPeriod.create({
              data: {
                openingHourId: openingHour.id,
                restaurantId: req.user!.restaurantId,
                openTime: period.openTime,
                closeTime: period.closeTime,
              },
            });
          }
        }
      }
    });

    // Fetch updated data
    const openingHours = await prisma.restaurantOpeningHour.findMany({
      where: { restaurantId: req.user!.restaurantId },
      include: { periods: { orderBy: { openTime: 'asc' } } },
      orderBy: { dayOfWeek: 'asc' },
    });

    await createAuditLog({
      restaurantId: req.user!.restaurantId,
      userId: req.user!.id,
      action: 'BUSINESS_HOURS_UPDATED',
      entityType: 'BUSINESS_HOURS',
      description: 'Business hours updated',
      metadata: { dayCount: days.length },
    });

    res.json({ success: true, message: 'Business hours updated', data: openingHours });
  } catch (error) {
    if (error instanceof z.ZodError) next(new BadRequestError(error.errors[0].message));
    else next(error);
  }
});

// ==========================================
// GET /api/settings/all — Get all settings in one call
// ==========================================
router.get('/all', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [settings, restaurant, openingHours] = await Promise.all([
      prisma.restaurantSettings.findUnique({
        where: { restaurantId: req.user!.restaurantId },
      }),
      prisma.restaurant.findUnique({
        where: { id: req.user!.restaurantId },
        select: {
          id: true, name: true, email: true, phone: true, address: true,
          currency: true, timezone: true, logoUrl: true, publicSlug: true,
        },
      }),
      prisma.restaurantOpeningHour.findMany({
        where: { restaurantId: req.user!.restaurantId },
        include: { periods: { orderBy: { openTime: 'asc' } } },
        orderBy: { dayOfWeek: 'asc' },
      }),
    ]);

    if (!settings) throw new NotFoundError('Settings not found');
    if (!restaurant) throw new NotFoundError('Restaurant not found');

    res.json({
      success: true,
      data: {
        restaurant: {
          id: restaurant.id,
          name: restaurant.name,
          email: restaurant.email,
          phone: restaurant.phone,
          address: restaurant.address,
          currency: restaurant.currency,
          timezone: restaurant.timezone,
          logoUrl: restaurant.logoUrl,
          publicSlug: restaurant.publicSlug,
        },
        settings: {
          ...settings,
        },
        businessHours: openingHours,
      },
    });
  } catch (error) { next(error); }
});

export default router;
