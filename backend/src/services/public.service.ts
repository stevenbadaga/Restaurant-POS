import { prisma } from '../database/prisma';

// ─── Types ───────────────────────────────────────────────

export interface PublicRestaurantInfo {
  id: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  heroImageUrl: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  mapUrl: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  xUrl: string | null;
  whatsAppNumber: string | null;
  currency: string;
  timezone: string;
  isOpen: boolean;
  currentStatus: 'open' | 'closed' | 'paused';
  openingHoursSummary: OpeningHoursSummary[];
}

export interface OpeningHoursSummary {
  dayOfWeek: string;
  isClosed: boolean;
  periods: { openTime: string; closeTime: string }[];
}

export interface PublicMenuItem {
  id: string;
  name: string;
  code: string;
  description: string | null;
  publicDescription: string | null;
  categoryName: string | null;
  categorySlug: string | null;
  itemType: string;
  price: string;
  imageUrl: string | null;
  publicImageUrl: string | null;
  isAvailable: boolean;
  preparationTimeMinutes: number | null;
  dietaryLabels: string | null;
  allergenInformation: string | null;
  isFeatured: boolean;
  publicSortOrder: number;
  displayOrder: number;
  promotionBadge: string | null;
}

export interface PublicMenuCategory {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  displayOrder: number;
  items: PublicMenuItem[];
}

export interface PublicPromotion {
  id: string;
  name: string;
  publicDescription: string | null;
  bannerImageUrl: string | null;
  code: string | null;
  type: string;
  scope: string;
  percentageValue: string | null;
  fixedAmountValue: string | null;
  startAt: string;
  endAt: string;
  minimumOrderSubtotal: string | null;
  isActive: boolean;
}

export interface OrderOption {
  pickupEnabled: boolean;
  deliveryEnabled: boolean;
  dineInQrOrderingEnabled: boolean;
  allowGuestCheckout: boolean;
  minimumOrderAmount: number;
  pickupPreparationMinutes: number;
  deliveryPreparationMinutes: number;
  publicMinimumOrderAmount: string;
}

export interface ReservationOption {
  enabled: boolean;
  maxPartySize: number | null;
  minLeadMinutes: number;
  maxDaysAhead: number;
  requireDiningArea: boolean;
  allowTableSelection: boolean;
}

export interface OpeningHourPeriod {
  openTime: string;
  closeTime: string;
}

export interface DayOpeningHours {
  dayOfWeek: string;
  periods: OpeningHourPeriod[];
  isClosed: boolean;
  supportsPickup: boolean;
  supportsDelivery: boolean;
  supportsReservations: boolean;
}

export interface DeliveryZoneInfo {
  id: string;
  name: string;
  description: string | null;
  minimumOrderAmount: string;
  deliveryFee: string;
  estimatedDeliveryMinutes: number;
}

// ─── Helpers ─────────────────────────────────────────────

function getDayName(day: number): string {
  const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  return days[day];
}

function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

// ─── Restaurant Resolution ───────────────────────────────

export async function resolveActiveRestaurant(): Promise<{ id: string; timezone: string } | null> {
  // For single-restaurant deployment, get the first active restaurant with public website enabled
  const restaurant = await prisma.restaurant.findFirst({
    where: {
      isActive: true,
      settings: { publicWebsiteEnabled: true },
    },
    select: { id: true, timezone: true },
  });
  return restaurant;
}

// ─── Public Restaurant Info ──────────────────────────────

export async function getPublicRestaurantInfo(timezone?: string): Promise<PublicRestaurantInfo | null> {
  const restaurant = await prisma.restaurant.findFirst({
    where: {
      isActive: true,
      settings: { publicWebsiteEnabled: true },
    },
    include: {
      settings: true,
      openingHours: {
        include: { periods: true },
        orderBy: { dayOfWeek: 'asc' },
      },
    },
  });

  if (!restaurant || !restaurant.settings || restaurant.settings.publicPauseOrdering) {
    return null;
  }

  const now = new Date();
  const currentDayName = getDayName(now.getUTCDay());
  const currentMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();

  // Check special hours first
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const specialHour = await prisma.restaurantSpecialHour.findFirst({
    where: {
      restaurantId: restaurant.id,
      date: { gte: todayStart, lte: todayEnd },
    },
  });

  let isOpen = false;
  let currentStatus: 'open' | 'closed' | 'paused' = 'closed';

  if (restaurant.settings.publicPauseOrdering) {
    currentStatus = 'paused';
  } else if (specialHour?.isClosed) {
    currentStatus = 'closed';
  } else if (specialHour) {
    const openMin = specialHour.openTime ? parseTimeToMinutes(specialHour.openTime) : 0;
    const closeMin = specialHour.closeTime ? parseTimeToMinutes(specialHour.closeTime) : 24 * 60;
    isOpen = currentMinutes >= openMin && currentMinutes < closeMin;
    currentStatus = isOpen ? 'open' : 'closed';
  } else {
    const todayHours = restaurant.openingHours.find(
      (h) => h.dayOfWeek === currentDayName,
    );
    if (todayHours && !todayHours.isClosed) {
      isOpen = todayHours.periods.some((p) => {
        const openMin = parseTimeToMinutes(p.openTime);
        const closeMin = parseTimeToMinutes(p.closeTime);
        return currentMinutes >= openMin && currentMinutes < closeMin;
      });
      currentStatus = isOpen ? 'open' : 'closed';
    }
  }

  const openingHoursSummary: OpeningHoursSummary[] = restaurant.openingHours.map((oh) => ({
    dayOfWeek: oh.dayOfWeek,
    isClosed: oh.isClosed,
    periods: oh.periods.map((p) => ({
      openTime: p.openTime,
      closeTime: p.closeTime,
    })),
  }));

  return {
    id: restaurant.id,
    name: restaurant.name,
    description: restaurant.settings.publicRestaurantDescription,
    logoUrl: restaurant.settings.publicLogoUrl || restaurant.logoUrl,
    heroImageUrl: restaurant.settings.publicHeroImageUrl,
    phone: restaurant.settings.publicContactPhone || restaurant.phone,
    email: restaurant.settings.publicContactEmail || restaurant.email,
    address: restaurant.settings.publicAddress || restaurant.address,
    mapUrl: restaurant.settings.publicMapUrl,
    facebookUrl: restaurant.settings.publicFacebookUrl,
    instagramUrl: restaurant.settings.publicInstagramUrl,
    xUrl: restaurant.settings.publicXUrl,
    whatsAppNumber: restaurant.settings.publicWhatsAppNumber,
    currency: restaurant.currency,
    timezone: restaurant.timezone,
    isOpen,
    currentStatus,
    openingHoursSummary,
  };
}

// ─── Opening Hours ───────────────────────────────────────

export async function getPublicOpeningHours(): Promise<DayOpeningHours[] | null> {
  const restaurant = await resolveActiveRestaurant();
  if (!restaurant) return null;

  const nowD = new Date();
  const todayStartD = new Date(nowD.getFullYear(), nowD.getMonth(), nowD.getDate());
  const todayEndD = new Date(nowD.getFullYear(), nowD.getMonth(), nowD.getDate(), 23, 59, 59, 999);

  const yesterday = new Date(todayStartD.getTime() - 86400000);
  const nextWeek = new Date(todayEndD.getTime() + 7 * 86400000);
  const [openingHours, specialHours] = await Promise.all([
    prisma.restaurantOpeningHour.findMany({
      where: { restaurantId: restaurant.id },
      include: { periods: true },
      orderBy: { dayOfWeek: 'asc' },
    }),
    prisma.restaurantSpecialHour.findMany({
      where: {
        restaurantId: restaurant.id,
        date: { gte: yesterday, lte: nextWeek },
      },
    }),
  ]);

  const result: DayOpeningHours[] = openingHours.map((oh) => {
    // Check if there's a special hour overriding this day
    const special = specialHours.find((sh) => {
      const shDay = sh.date.getUTCDay();
      return getDayName(shDay) === oh.dayOfWeek;
    });

    if (special) {
      return {
        dayOfWeek: oh.dayOfWeek,
        periods: special.isClosed ? [] : [{
          openTime: special.openTime || '00:00',
          closeTime: special.closeTime || '23:59',
        }],
        isClosed: special.isClosed,
        supportsPickup: oh.supportsPickup,
        supportsDelivery: oh.supportsDelivery,
        supportsReservations: oh.supportsReservations,
      };
    }

    return {
      dayOfWeek: oh.dayOfWeek,
      periods: oh.periods.map((p) => ({
        openTime: p.openTime,
        closeTime: p.closeTime,
      })),
      isClosed: oh.isClosed,
      supportsPickup: oh.supportsPickup,
      supportsDelivery: oh.supportsDelivery,
      supportsReservations: oh.supportsReservations,
    };
  });

  return result;
}

// ─── Public Menu ─────────────────────────────────────────

export async function getPublicMenu(): Promise<PublicMenuCategory[] | null> {
  const restaurant = await resolveActiveRestaurant();
  if (!restaurant) return null;

  const now = new Date();
  const currentDayName = getDayName(now.getUTCDay());
  const currentMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();

  const categories = await prisma.menuCategory.findMany({
    where: {
      restaurantId: restaurant.id,
      isActive: true,
      items: {
        some: {
          isActive: true,
          isPubliclyVisible: true,
          isAvailable: true,
        },
      },
    },
    include: {
      items: {
        where: {
          isActive: true,
          isPubliclyVisible: true,
          isAvailable: true,
        },
        include: {
          availabilitySchedules: {
            where: { isActive: true },
          },
        },
        orderBy: [{ publicSortOrder: 'asc' }, { displayOrder: 'asc' }, { name: 'asc' }],
      },
    },
    orderBy: { displayOrder: 'asc' },
  });

  const result: PublicMenuCategory[] = [];

  for (const category of categories) {
    const items: PublicMenuItem[] = [];

    for (const item of category.items) {
      // Check availability schedule
      if (item.availabilitySchedules.length > 0) {
        const isScheduled = item.availabilitySchedules.some((s) => {
          if (s.dayOfWeek !== currentDayName) return false;
          const start = parseTimeToMinutes(s.startTime);
          const end = parseTimeToMinutes(s.endTime);
          return currentMinutes >= start && currentMinutes < end;
        });
        if (!isScheduled) continue; // Skip item if outside its schedule
      }

      items.push({
        id: item.id,
        name: item.name,
        code: item.code,
        description: item.description,
        publicDescription: item.publicDescription,
        categoryName: category.name,
        categorySlug: category.name.toLowerCase().replace(/\s+/g, '-'),
        itemType: item.itemType,
        price: item.price.toString(),
        imageUrl: item.imageUrl,
        publicImageUrl: item.publicImageUrl,
        isAvailable: item.isAvailable,
        preparationTimeMinutes: item.preparationTimeMinutes,
        dietaryLabels: item.dietaryLabels,
        allergenInformation: item.allergenInformation,
        isFeatured: item.isFeatured,
        publicSortOrder: item.publicSortOrder,
        displayOrder: item.displayOrder,
        promotionBadge: null, // Will be filled by promotion resolver
      });
    }

    if (items.length > 0) {
      result.push({
        id: category.id,
        name: category.name,
        description: category.description,
        imageUrl: category.imageUrl,
        displayOrder: category.displayOrder,
        items,
      });
    }
  }

  // Attach promotion badges to eligible items
  const activePromotions = await prisma.promotion.findMany({
    where: {
      restaurantId: restaurant.id,
      status: 'ACTIVE',
      isActive: true,
      publiclyVisible: true,
      startAt: { lte: now },
      endAt: { gte: now },
    },
    include: {
      menuItems: true,
      menuCategories: true,
    },
  });

  for (const category of result) {
    for (const item of category.items) {
      const matchingPromo = activePromotions.find((p) => {
        if (p.promotionScope === 'MENU_ITEM') {
          return p.menuItems.some((mi) => mi.menuItemId === item.id);
        }
        if (p.promotionScope === 'MENU_CATEGORY') {
          return p.menuCategories.some((mc) => mc.menuCategoryId === category.id);
        }
        return false;
      });
      if (matchingPromo) {
        const badge =
          matchingPromo.promotionType === 'PERCENTAGE_DISCOUNT'
            ? `${matchingPromo.percentageValue}% OFF`
            : matchingPromo.promotionType === 'FIXED_AMOUNT_DISCOUNT'
              ? `${matchingPromo.fixedAmountValue} OFF`
              : 'PROMO';
        item.promotionBadge = badge;
      }
    }
  }

  return result;
}

export async function getPublicMenuCategories(): Promise<{ id: string; name: string; description: string | null; imageUrl: string | null; displayOrder: number; itemCount: number }[] | null> {
  const restaurant = await resolveActiveRestaurant();
  if (!restaurant) return null;

  const categories = await prisma.menuCategory.findMany({
    where: {
      restaurantId: restaurant.id,
      isActive: true,
      items: {
        some: {
          isActive: true,
          isPubliclyVisible: true,
          isAvailable: true,
        },
      },
    },
    include: {
      _count: {
        select: {
          items: {
            where: {
              isActive: true,
              isPubliclyVisible: true,
              isAvailable: true,
            },
          },
        },
      },
    },
    orderBy: { displayOrder: 'asc' },
  });

  return categories.map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    imageUrl: c.imageUrl,
    displayOrder: c.displayOrder,
    itemCount: c._count.items,
  }));
}

export async function getPublicMenuItem(publicSlug: string): Promise<PublicMenuItem | null> {
  const restaurant = await resolveActiveRestaurant();
  if (!restaurant) return null;

  const item = await prisma.menuItem.findFirst({
    where: {
      restaurantId: restaurant.id,
      code: publicSlug,
      isActive: true,
      isPubliclyVisible: true,
    },
    include: {
      category: true,
    },
  });

  if (!item) return null;

  return {
    id: item.id,
    name: item.name,
    code: item.code,
    description: item.description,
    publicDescription: item.publicDescription,
    categoryName: item.category?.name ?? null,
    categorySlug: item.category?.name.toLowerCase().replace(/\s+/g, '-') ?? null,
    itemType: item.itemType,
    price: item.price.toString(),
    imageUrl: item.imageUrl,
    publicImageUrl: item.publicImageUrl,
    isAvailable: item.isAvailable,
    preparationTimeMinutes: item.preparationTimeMinutes,
    dietaryLabels: item.dietaryLabels,
    allergenInformation: item.allergenInformation,
    isFeatured: item.isFeatured,
    publicSortOrder: item.publicSortOrder,
    displayOrder: item.displayOrder,
    promotionBadge: null,
  };
}

// ─── Public Promotions ──────────────────────────────────

export async function getPublicPromotions(): Promise<PublicPromotion[] | null> {
  const restaurant = await resolveActiveRestaurant();
  if (!restaurant) return null;

  const now = new Date();
  const promotions = await prisma.promotion.findMany({
    where: {
      restaurantId: restaurant.id,
      publiclyVisible: true,
      isActive: true,
      status: 'ACTIVE',
      startAt: { lte: now },
      endAt: { gte: now },
    },
    orderBy: { priority: 'desc' },
  });

  return promotions.map((p) => ({
    id: p.id,
    name: p.name,
    publicDescription: p.publicDescription,
    bannerImageUrl: p.publicBannerImageUrl,
    code: p.code,
    type: p.promotionType,
    scope: p.promotionScope,
    percentageValue: p.percentageValue?.toString() ?? null,
    fixedAmountValue: p.fixedAmountValue?.toString() ?? null,
    startAt: p.startAt.toISOString(),
    endAt: p.endAt.toISOString(),
    minimumOrderSubtotal: p.minimumOrderSubtotal?.toString() ?? null,
    isActive: p.isActive,
  }));
}

// ─── Order Options ───────────────────────────────────────

export async function getPublicOrderOptions(): Promise<OrderOption | null> {
  const restaurant = await resolveActiveRestaurant();
  if (!restaurant) return null;

  const settings = await prisma.restaurantSettings.findUnique({
    where: { restaurantId: restaurant.id },
  });

  if (!settings) return null;

  return {
    pickupEnabled: settings.pickupEnabled,
    deliveryEnabled: settings.deliveryEnabled,
    dineInQrOrderingEnabled: settings.dineInQrOrderingEnabled,
    allowGuestCheckout: settings.allowGuestCheckout,
    minimumOrderAmount: Number(settings.publicMinimumOrderAmount),
    pickupPreparationMinutes: settings.pickupPreparationMinutes,
    deliveryPreparationMinutes: settings.deliveryPreparationMinutes,
    publicMinimumOrderAmount: settings.publicMinimumOrderAmount.toString(),
  };
}

// ─── Reservation Options ─────────────────────────────────

export async function getPublicReservationOptions(): Promise<ReservationOption | null> {
  const restaurant = await resolveActiveRestaurant();
  if (!restaurant) return null;

  const settings = await prisma.restaurantSettings.findUnique({
    where: { restaurantId: restaurant.id },
  });

  if (!settings || !settings.publicReservationsEnabled) {
    return {
      enabled: false,
      maxPartySize: null,
      minLeadMinutes: 60,
      maxDaysAhead: 90,
      requireDiningArea: false,
      allowTableSelection: false,
    };
  }

  return {
    enabled: true,
    maxPartySize: settings.publicReservationMaximumPartySize,
    minLeadMinutes: settings.publicReservationMinimumLeadMinutes,
    maxDaysAhead: settings.publicReservationMaximumDaysAhead,
    requireDiningArea: settings.publicReservationRequireDiningArea,
    allowTableSelection: settings.publicReservationAllowTableSelection,
  };
}

// ─── Delivery Zones ──────────────────────────────────────

export async function getDeliveryZones(): Promise<DeliveryZoneInfo[] | null> {
  const restaurant = await resolveActiveRestaurant();
  if (!restaurant) return null;

  const zones = await prisma.deliveryZone.findMany({
    where: {
      restaurantId: restaurant.id,
      isActive: true,
    },
    orderBy: { name: 'asc' },
  });

  return zones.map((z) => ({
    id: z.id,
    name: z.name,
    description: z.description,
    minimumOrderAmount: z.minimumOrderAmount.toString(),
    deliveryFee: z.deliveryFee.toString(),
    estimatedDeliveryMinutes: z.estimatedDeliveryMinutes,
  }));
}

// ─── Availability Check ──────────────────────────────────

export async function checkOpeningHours(
  restaurantId: string,
  orderType: string,
  requestedTime?: Date,
): Promise<{ isOpen: boolean; message: string }> {
  const settings = await prisma.restaurantSettings.findUnique({
    where: { restaurantId },
  });

  if (!settings) {
    return { isOpen: false, message: 'Restaurant settings not found.' };
  }

  if (settings.publicPauseOrdering) {
    return {
      isOpen: false,
      message: settings.publicPauseOrderingReason || 'Online ordering is currently paused.',
    };
  }

  if (!settings.publicOrderingEnabled) {
    return { isOpen: false, message: 'Online ordering is not enabled.' };
  }

  const now = new Date();
  const checkTime = requestedTime || now;
  const dayName = getDayName(checkTime.getUTCDay());
  const minutes = checkTime.getUTCHours() * 60 + checkTime.getUTCMinutes();

  // Check special hours
  const dayStart = new Date(checkTime.getFullYear(), checkTime.getMonth(), checkTime.getDate());
  const dayEnd = new Date(checkTime.getFullYear(), checkTime.getMonth(), checkTime.getDate(), 23, 59, 59, 999);
  const specialHour = await prisma.restaurantSpecialHour.findFirst({
    where: {
      restaurantId,
      date: { gte: dayStart, lte: dayEnd },
    },
  });

  if (specialHour?.isClosed) {
    return { isOpen: false, message: 'The restaurant is closed on this date.' };
  }

  if (specialHour) {
    const openMin = specialHour.openTime ? parseTimeToMinutes(specialHour.openTime) : 0;
    const closeMin = specialHour.closeTime ? parseTimeToMinutes(specialHour.closeTime) : 24 * 60;
    const isOpen = minutes >= openMin && minutes < closeMin;
    return {
      isOpen,
      message: isOpen ? 'Open' : 'Closed for this time.',
    };
  }

  // Check regular hours
  const dayHours = await prisma.restaurantOpeningHour.findUnique({
    where: {
      restaurantId_dayOfWeek: { restaurantId, dayOfWeek: dayName as any },
    },
    include: { periods: true },
  });

  if (!dayHours || dayHours.isClosed) {
    return { isOpen: false, message: 'The restaurant is closed on this day.' };
  }

  // Check service-specific availability
  if (orderType === 'PICKUP' && !dayHours.supportsPickup) {
    return { isOpen: false, message: 'Pickup is not available on this day.' };
  }
  if (orderType === 'DELIVERY' && !dayHours.supportsDelivery) {
    return { isOpen: false, message: 'Delivery is not available on this day.' };
  }

  const isOpen = dayHours.periods.some((p) => {
    const openMin = parseTimeToMinutes(p.openTime);
    const closeMin = parseTimeToMinutes(p.closeTime);
    return minutes >= openMin && minutes < closeMin;
  });

  return {
    isOpen,
    message: isOpen ? 'Open' : 'Closed for this time.',
  };
}
