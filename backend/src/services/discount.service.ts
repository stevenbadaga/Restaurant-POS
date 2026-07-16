import { toDecimal, roundMoney } from './calculation.service';
import { Decimal, type Decimal as DecimalType } from '@prisma/client/runtime/library';

// ==========================================
// ALLOCATE ORDER-LEVEL DISCOUNT
// ==========================================

/**
 * Allocates an order-level discount proportionally across eligible line items.
 * Uses DecimalType-safe calculations with rounding remainder assigned to the last item.
 */
export function allocateDiscountToItems(
  items: { id: string; lineSubtotal: DecimalType | number }[],
  totalDiscount: DecimalType
): { itemId: string; allocatedAmount: DecimalType }[] {
  if (items.length === 0) return [];
  if (items.length === 1) return [{ itemId: items[0].id, allocatedAmount: totalDiscount }];

  const totalSubtotal = items.reduce(
    (sum, item) => sum.plus(toDecimal(item.lineSubtotal)),
    new Decimal(0)
  );

  if (totalSubtotal.isZero()) {
    return items.map((item) => ({ itemId: item.id, allocatedAmount: new Decimal(0) }));
  }

  const allocations: { itemId: string; allocatedAmount: DecimalType }[] = [];
  let allocatedSoFar = new Decimal(0);

  for (let i = 0; i < items.length; i++) {
    if (i === items.length - 1) {
      // Last item gets the remainder to ensure total matches
      const remainder = totalDiscount.minus(allocatedSoFar);
      allocations.push({ itemId: items[i].id, allocatedAmount: remainder });
    } else {
      const proportion = toDecimal(items[i].lineSubtotal).div(totalSubtotal);
      const allocation = roundMoney(totalDiscount.mul(proportion));
      allocations.push({ itemId: items[i].id, allocatedAmount: allocation });
      allocatedSoFar = allocatedSoFar.plus(allocation);
    }
  }

  return allocations;
}

// ==========================================
// RECALCULATE ORDER TOTALS WITH DISCOUNTS
// ==========================================

interface OrderTotalsParams {
  items: {
    id: string;
    unitPrice: DecimalType;
    quantity: number;
    taxRate: DecimalType;
    lineDiscountAmount?: DecimalType;
  }[];
  existingDiscounts: DecimalType;
  pricesIncludeTax: boolean;
  serviceChargeRate: DecimalType;
}

export async function calculateOrderTotals(
  params: OrderTotalsParams
): Promise<{
  subtotal: DecimalType;
  totalBeforeDiscount: DecimalType;
  discountAmount: DecimalType;
  taxAmount: DecimalType;
  serviceCharge: DecimalType;
  totalAmount: DecimalType;
  itemTotals: { id: string; lineSubtotal: DecimalType; lineDiscountAmount: DecimalType; lineTaxAmount: DecimalType; lineTotal: DecimalType }[];
}> {
  const { items, existingDiscounts, pricesIncludeTax, serviceChargeRate } = params;

  // Calculate base subtotal (before discounts)
  const totalBeforeDiscount = items.reduce(
    (sum, item) => sum.plus(toDecimal(item.unitPrice).mul(item.quantity)),
    new Decimal(0)
  );

  // Calculate item-level totals with discounts
  const itemTotals = items.map((item) => {
    const lineBase = toDecimal(item.unitPrice).mul(item.quantity);
    const lineDiscount = item.lineDiscountAmount || new Decimal(0);
    const lineAfterDiscount = Decimal.max(0, lineBase.minus(lineDiscount));

    let lineSubtotal: DecimalType;
    let lineTaxAmount: DecimalType;

    if (pricesIncludeTax) {
      // Price includes tax: extract tax from the remainder
      const taxRate = toDecimal(item.taxRate).div(100);
      lineSubtotal = lineAfterDiscount.div(taxRate.plus(1));
      lineTaxAmount = lineAfterDiscount.minus(lineSubtotal);
    } else {
      // Tax added on top
      lineSubtotal = lineAfterDiscount;
      lineTaxAmount = lineSubtotal.mul(toDecimal(item.taxRate).div(100));
    }

    return {
      id: item.id,
      lineSubtotal: roundMoney(lineSubtotal),
      lineDiscountAmount: roundMoney(lineDiscount),
      lineTaxAmount: roundMoney(lineTaxAmount),
      lineTotal: roundMoney(lineAfterDiscount.plus(lineTaxAmount)),
    };
  });

  const subtotal = itemTotals.reduce((sum, item) => sum.plus(item.lineSubtotal), new Decimal(0));
  const taxAmount = itemTotals.reduce((sum, item) => sum.plus(item.lineTaxAmount), new Decimal(0));
  const discountAmount = items.reduce(
    (sum, item, i) => sum.plus(itemTotals[i].lineDiscountAmount),
    new Decimal(0)
  ).plus(existingDiscounts);

  const serviceCharge = roundMoney(subtotal.mul(toDecimal(serviceChargeRate).div(100)));
  const totalAmount = roundMoney(subtotal.plus(taxAmount).plus(serviceCharge));

  return {
    subtotal,
    totalBeforeDiscount,
    discountAmount,
    taxAmount,
    serviceCharge,
    totalAmount,
    itemTotals,
  };
}

