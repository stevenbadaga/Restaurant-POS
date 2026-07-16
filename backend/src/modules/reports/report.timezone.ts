/**
 * Report timezone and business-day utilities.
 * All report date grouping and filtering uses restaurant timezone.
 */
import { prisma } from '../../database/prisma';

/**
 * Get the current date string (YYYY-MM-DD) in the given timezone.
 */
export function getDateInTimezone(date: Date, timezone: string): string {
  try {
    const options: Intl.DateTimeFormatOptions = {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    };
    const formatter = new Intl.DateTimeFormat('en-CA', options); // en-CA gives YYYY-MM-DD
    return formatter.format(date);
  } catch {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

/**
 * Get the business date for a given timestamp in the restaurant timezone.
 * Business day starts at businessDayStartTime (e.g., "04:00").
 * A payment at 02:00 belongs to the previous business day if start time is 04:00.
 */
export function getBusinessDate(
  date: Date,
  timezone: string,
  businessDayStartTime: string = '00:00'
): string {
  const [startHour, startMinute] = businessDayStartTime.split(':').map(Number);

  // Get the date in restaurant timezone
  const dateStr = getDateInTimezone(date, timezone);
  const [year, month, day] = dateStr.split('-').map(Number);

  // Create date in restaurant timezone
  const localDate = new Date(dateStr + 'T' + businessDayStartTime + ':00.000');

  // Get the actual date components in the target timezone
  const options: Intl.DateTimeFormatOptions = {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  };
  const fmt = new Intl.DateTimeFormat('en-CA', options);

  // Check if the current time is before the business day start time
  const currentDateStr = getDateInTimezone(date, timezone);
  const currentDate = new Date(currentDateStr + 'T' + businessDayStartTime + ':00.000');

  // If we're comparing times, we need to compare the time of day
  const timeStr = date.toLocaleTimeString('en-GB', { timeZone: timezone, hour: '2-digit', minute: '2-digit' });
  const [currentHour, currentMinute] = timeStr.split(':').map(Number);

  const currentTotalMinutes = currentHour * 60 + currentMinute;
  const startTotalMinutes = startHour * 60 + startMinute;

  // If current time is before the business day start, it belongs to the previous business day
  if (currentTotalMinutes < startTotalMinutes) {
    // Subtract one day
    const yesterday = new Date(date);
    yesterday.setDate(yesterday.getDate() - 1);
    return getDateInTimezone(yesterday, timezone).replace(/-/g, '');
  }

  return dateStr.replace(/-/g, '');
}

/**
 * Get start and end of a business day range.
 */
export function getBusinessDayRange(
  businessDate: string,
  timezone: string,
  businessDayStartTime: string = '00:00'
): { start: Date; end: Date } {
  const [year, month, day] = businessDate.match(/(\d{4})(\d{2})(\d{2})/)!.slice(1).map(Number);

  const startDateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${businessDayStartTime}:00.000`;
  const start = new Date(startDateStr);

  // End is the start of the next business day
  const endDate = new Date(start);
  endDate.setDate(endDate.getDate() + 1);
  const end = endDate;

  return { start, end };
}

/**
 * Get the restaurant's timezone from settings (or fallback).
 */
export async function getRestaurantTimezone(
  restaurantId: string
): Promise<{ timezone: string; businessDayStartTime: string }> {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: {
      timezone: true,
      settings: { select: { businessDayStartTime: true } },
    },
  });

  return {
    timezone: restaurant?.timezone ?? 'UTC',
    businessDayStartTime: restaurant?.settings?.businessDayStartTime ?? '00:00',
  };
}

/**
 * Build date filters for report queries using restaurant timezone.
 * Converts restaurant-local date range to UTC timestamps for database queries.
 */
export async function buildDateFilters(
  restaurantId: string,
  dateFrom?: string,
  dateTo?: string,
  preset?: string
): Promise<{ dateFrom: Date | undefined; dateTo: Date | undefined }> {
  const { timezone, businessDayStartTime } = await getRestaurantTimezone(restaurantId);

  let from: Date | undefined;
  let to: Date | undefined;

  if (preset && preset !== 'custom') {
    const now = new Date();
    const todayStr = getDateInTimezone(now, timezone);
    const today = new Date(todayStr + 'T' + businessDayStartTime + ':00.000');

    switch (preset) {
      case 'today': {
        from = today;
        to = new Date(today.getTime() + 24 * 60 * 60 * 1000);
        break;
      }
      case 'yesterday': {
        const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
        from = yesterday;
        to = today;
        break;
      }
      case 'this_week': {
        const dayOfWeek = now.toLocaleDateString('en-US', { timeZone: timezone, weekday: 'short' });
        const daysFromMonday: Record<string, number> = {
          'Mon': 0, 'Tue': 1, 'Wed': 2, 'Thu': 3, 'Fri': 4, 'Sat': 5, 'Sun': 6,
        };
        const offset = daysFromMonday[dayOfWeek] ?? 0;
        from = new Date(today.getTime() - offset * 24 * 60 * 60 * 1000);
        to = new Date(from.getTime() + 7 * 24 * 60 * 60 * 1000);
        break;
      }
      case 'last_week': {
        const dayOfWeek = now.toLocaleDateString('en-US', { timeZone: timezone, weekday: 'short' });
        const daysFromMonday: Record<string, number> = {
          'Mon': 0, 'Tue': 1, 'Wed': 2, 'Thu': 3, 'Fri': 4, 'Sat': 5, 'Sun': 6,
        };
        const offset = daysFromMonday[dayOfWeek] ?? 0;
        const thisWeekStart = new Date(today.getTime() - offset * 24 * 60 * 60 * 1000);
        from = new Date(thisWeekStart.getTime() - 7 * 24 * 60 * 60 * 1000);
        to = thisWeekStart;
        break;
      }
      case 'this_month': {
        const monthStr = now.toLocaleDateString('en-US', { timeZone: timezone, month: '2-digit', year: 'numeric' });
        const [m, y] = monthStr.split('/');
        from = new Date(`${y}-${m}-01T${businessDayStartTime}:00.000`);
        to = new Date(from.getTime() + 32 * 24 * 60 * 60 * 1000); // Safe overshoot
        break;
      }
      case 'last_month': {
        const monthStr = now.toLocaleDateString('en-US', { timeZone: timezone, month: '2-digit', year: 'numeric' });
        const [m, y] = monthStr.split('/');
        const thisMonthStart = new Date(`${y}-${m}-01T${businessDayStartTime}:00.000`);
        from = new Date(thisMonthStart.getTime() - 28 * 24 * 60 * 60 * 1000);
        to = thisMonthStart;
        break;
      }
      case 'last_7_days': {
        from = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        to = new Date(today.getTime() + 24 * 60 * 60 * 1000);
        break;
      }
      case 'last_30_days': {
        from = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
        to = new Date(today.getTime() + 24 * 60 * 60 * 1000);
        break;
      }
      case 'this_year': {
        const yearStr = now.toLocaleDateString('en-US', { timeZone: timezone, year: 'numeric' });
        from = new Date(`${yearStr}-01-01T${businessDayStartTime}:00.000`);
        to = new Date(today.getTime() + 24 * 60 * 60 * 1000);
        break;
      }
    }
  } else if (dateFrom || dateTo) {
    if (dateFrom) {
      from = new Date(dateFrom + 'T' + businessDayStartTime + ':00.000');
    }
    if (dateTo) {
      to = new Date(dateTo + 'T23:59:59.999');
    }
  }

  return { dateFrom: from, dateTo: to };
}
