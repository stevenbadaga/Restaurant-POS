import { prisma } from '../database';

type SequenceType = 'ORDER' | 'STOCK_RECEIPT' | 'PAYMENT' | 'RECEIPT' | 'CREDIT_NOTE' | 'CASHIER_SESSION' | 'CUSTOMER' | 'RESERVATION' | 'WAITING_LIST' | 'LOYALTY_TRANSACTION' | 'TIP' | 'TIP_POOL';

/**
 * Generate the next sequential document number for a given type.
 * Format: PREFIX-YYYYMMDD-NNNN
 * Uses the restaurant's timezone for the business date.
 * Concurrency-safe through database transaction.
 */
export async function generateSequenceNumber(
  restaurantId: string,
  sequenceType: SequenceType,
  prefix: string,
  timezone: string = 'UTC'
): Promise<string> {
  const now = new Date();
  const businessDateStr = getDateInTimezone(now, timezone);

  // Use a Prisma transaction for concurrency safety
  const result = await prisma.$transaction(async (tx) => {
    // Check if a sequence record exists for today
    const existingSequence = await tx.documentSequence.findUnique({
      where: {
        restaurantId_sequenceType_businessDate: {
          restaurantId,
          sequenceType,
          businessDate: businessDateStr,
        },
      },
    });

    if (existingSequence) {
      // Increment existing sequence
      const nextValue = existingSequence.currentValue + 1;
      await tx.documentSequence.update({
        where: { id: existingSequence.id },
        data: { currentValue: nextValue },
      });
      return nextValue;
    }

    // Create new sequence starting from 1
    await tx.documentSequence.create({
      data: {
        restaurantId,
        sequenceType,
        businessDate: businessDateStr,
        currentValue: 1,
      },
    });
    return 1;
  });

  // Format: PREFIX-YYYYMMDD-NNNN
  const paddedNumber = String(result).padStart(4, '0');
  return `${prefix}-${businessDateStr}-${paddedNumber}`;
}

function getDateInTimezone(date: Date, timezone: string): string {
  try {
    const options: Intl.DateTimeFormatOptions = {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    };
    const formatter = new Intl.DateTimeFormat('en-CA', options); // en-CA gives YYYY-MM-DD
    return formatter.format(date).replace(/-/g, '');
  } catch {
    // Fallback to UTC if timezone is invalid
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  }
}
