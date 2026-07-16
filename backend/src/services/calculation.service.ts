import { Decimal } from '@prisma/client/runtime/library';
import type { Decimal as DecimalType } from '@prisma/client/runtime/library';

/**
 * DecimalType-safe calculation service
 * All monetary and quantity calculations must go through this service
 * to avoid JavaScript floating-point precision issues.
 */

export function toDecimal(value: number | string | DecimalType): DecimalType {
  if (value instanceof Decimal) return value;
  return new Decimal(value);
}

export function calculateLineCost(quantity: number | string | DecimalType, unitCost: number | string | DecimalType): DecimalType {
  return toDecimal(quantity).mul(toDecimal(unitCost));
}

export function calculateOrderSubtotal(items: { quantity: number | string | DecimalType; unitPrice: number | string | DecimalType }[]): DecimalType {
  return items.reduce(
    (sum, item) => sum.plus(toDecimal(item.quantity).mul(toDecimal(item.unitPrice))),
    new Decimal(0)
  );
}

export function calculateTaxAmount(subtotal: number | string | DecimalType, taxRate: number | string | DecimalType, pricesIncludeTax: boolean): DecimalType {
  const subtotalDec = toDecimal(subtotal);
  const rateDec = toDecimal(taxRate).div(100);

  if (pricesIncludeTax) {
    return subtotalDec.minus(subtotalDec.div(toDecimal(1).plus(rateDec)));
  }

  return subtotalDec.mul(rateDec);
}

export function calculateServiceCharge(subtotal: number | string | DecimalType, serviceChargeRate: number | string | DecimalType): DecimalType {
  return toDecimal(subtotal).mul(toDecimal(serviceChargeRate).div(100));
}

export function calculateIngredientRequirement(
  quantityRequired: number | string | DecimalType,
  orderedQuantity: number,
  wastagePercentage: number | string | DecimalType
): DecimalType {
  const base = toDecimal(quantityRequired).mul(orderedQuantity);
  const wastage = base.mul(toDecimal(wastagePercentage).div(100));
  return base.plus(wastage);
}

export function calculateNewAverageCost(
  previousOnHand: number | string | DecimalType,
  previousAverageCost: number | string | DecimalType,
  receivedQuantity: number | string | DecimalType,
  unitCost: number | string | DecimalType
): DecimalType {
  const prevOnHand = toDecimal(previousOnHand);
  const prevAvgCost = toDecimal(previousAverageCost);
  const receivedQty = toDecimal(receivedQuantity);
  const unitCostDec = toDecimal(unitCost);

  if (prevOnHand.isZero() || prevAvgCost.isZero()) {
    return unitCostDec;
  }

  const totalValue = prevOnHand.mul(prevAvgCost).plus(receivedQty.mul(unitCostDec));
  const totalQuantity = prevOnHand.plus(receivedQty);

  if (totalQuantity.isZero()) {
    return new Decimal(0);
  }

  return totalValue.div(totalQuantity);
}

export function roundMoney(value: number | string | DecimalType, decimals: number = 2): DecimalType {
  return toDecimal(value).toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP);
}

export function roundQuantity(value: number | string | DecimalType, decimals: number = 3): DecimalType {
  return toDecimal(value).toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP);
}

export { DecimalType };
