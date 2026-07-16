import { Decimal } from '@prisma/client/runtime/library';
import PDFDocument from 'pdfkit';
import { prisma } from '../database';
import { BadRequestError, NotFoundError, ForbiddenError } from '../types';
import { createAuditLog } from './audit.service';
import { generateSequenceNumber } from './sequence.service';
import { toDecimal, roundMoney } from './calculation.service';

// ==========================================
// RECEIPT GENERATION
// ==========================================

export async function generateReceipt(
  orderId: string,
  userId: string,
  restaurantId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<any> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        where: { status: { not: 'CANCELLED' } },
        orderBy: { createdAt: 'asc' },
      },
      payments: {
        where: { status: 'COMPLETED' },
        orderBy: { createdAt: 'asc' },
      },
      table: { select: { name: true, code: true } },
      waiter: { select: { firstName: true, lastName: true } },
      restaurant: {
        select: {
          name: true,
          email: true,
          phone: true,
          address: true,
          logoUrl: true,
          currency: true,
          timezone: true,
          settings: {
            select: {
              receiptFooter: true,
              receiptShowCustomerPhone: true,
              receiptShowWaiter: true,
              receiptShowTaxBreakdown: true,
            },
          },
        },
      },
    },
  });

  if (!order) throw new NotFoundError('Order not found');
  if (order.restaurantId !== restaurantId) throw new ForbiddenError('Access denied');

  // Check if receipt already exists
  const existing = await prisma.receipt.findFirst({
    where: { orderId, status: 'ISSUED' },
  });

  if (existing) {
    throw new BadRequestError('A receipt has already been issued for this order');
  }

  const currency = order.restaurant.currency;
  const settings = order.restaurant.settings;

  const receiptNumber = await generateSequenceNumber(
    restaurantId,
    'RECEIPT',
    'REC',
    order.restaurant.timezone ?? 'UTC'
  );

  // Calculate totals from order snapshots
  const subtotal = order.items.reduce(
    (sum, item) => sum.plus(toDecimal(item.lineSubtotal)),
    new Decimal(0)
  );
  const totalTax = order.items.reduce(
    (sum, item) => sum.plus(toDecimal(item.lineTaxAmount)),
    new Decimal(0)
  );
  const totalAmount = order.items.reduce(
    (sum, item) => sum.plus(toDecimal(item.lineTotal)),
    new Decimal(0)
  );

  const amountPaid = order.payments
    .filter((p) => p.transactionType === 'PAYMENT')
    .reduce((sum, p) => sum.plus(toDecimal(p.amount)), new Decimal(0));

  const changeAmount = order.payments
    .filter((p) => p.method === 'CASH' && p.transactionType === 'PAYMENT')
    .reduce((sum, p) => sum.plus(toDecimal(p.changeAmount)), new Decimal(0));

  const receipt = await prisma.$transaction(async (tx) => {
    const receipt = await tx.receipt.create({
      data: {
        restaurantId,
        orderId,
        receiptNumber,
        status: 'ISSUED',
        currency,
        restaurantNameSnapshot: order.restaurant.name,
        restaurantEmailSnapshot: order.restaurant.email,
        restaurantPhoneSnapshot: order.restaurant.phone,
        restaurantAddressSnapshot: order.restaurant.address,
        restaurantLogoUrlSnapshot: order.restaurant.logoUrl,
        orderNumberSnapshot: order.orderNumber,
        orderTypeSnapshot: order.orderType,
        tableNameSnapshot: order.table?.name || null,
        tableCodeSnapshot: order.table?.code || null,
        waiterNameSnapshot: settings?.receiptShowWaiter
          ? `${order.waiter.firstName} ${order.waiter.lastName}`
          : '',
        customerNameSnapshot: order.customerName,
        customerPhoneSnapshot: settings?.receiptShowCustomerPhone
          ? order.customerPhone
          : null,
        subtotal: roundMoney(subtotal).toFixed(2),
        taxAmount: roundMoney(totalTax).toFixed(2),
        serviceChargeAmount: order.serviceCharge,
        discountAmount: order.discountAmount,
        totalAmount: roundMoney(totalAmount).toFixed(2),
        amountPaid: roundMoney(amountPaid).toFixed(2),
        changeAmount: roundMoney(changeAmount).toFixed(2),
        receiptFooterSnapshot: settings?.receiptFooter || null,
        issuedById: userId,
        issuedAt: new Date(),
      },
    });

    // Create receipt lines from order items
    for (const item of order.items) {
      await tx.receiptLine.create({
        data: {
          receiptId: receipt.id,
          orderItemId: item.id,
          itemNameSnapshot: item.menuItemNameSnapshot,
          itemCodeSnapshot: item.menuItemCodeSnapshot,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          lineSubtotal: item.lineSubtotal,
          lineTaxAmount: item.lineTaxAmount,
          lineTotal: item.lineTotal,
          specialInstructions: item.specialInstructions,
        },
      });
    }

    // Create receipt payment records
    for (const payment of order.payments) {
      if (payment.transactionType === 'PAYMENT') {
        await tx.receiptPayment.create({
          data: {
            receiptId: receipt.id,
            paymentId: payment.id,
            method: payment.method,
            amount: payment.amount,
            referenceNumber: payment.referenceNumber,
          },
        });
      }
    }

    return receipt;
  });

  await createAuditLog({
    restaurantId,
    userId,
    action: 'Receipt issued',
    entityType: 'Receipt',
    entityId: receipt.id,
    description: `Receipt ${receiptNumber} issued for order ${order.orderNumber}`,
    metadata: {
      receiptNumber,
      orderNumber: order.orderNumber,
      totalAmount: totalAmount.toFixed(2),
    },
    ipAddress,
    userAgent,
  });

  return receipt;
}

// ==========================================
// GET RECEIPT WITH FULL DETAILS
// ==========================================

export async function getReceiptDetail(receiptId: string, restaurantId: string): Promise<any> {
  const receipt = await prisma.receipt.findUnique({
    where: { id: receiptId },
    include: {
      lines: { orderBy: { createdAt: 'asc' } },
      payments: {
        include: { payment: { select: { referenceNumber: true, providerName: true } } },
        orderBy: { createdAt: 'asc' },
      },
      issuedBy: { select: { id: true, firstName: true, lastName: true } },
      voidedBy: { select: { id: true, firstName: true, lastName: true } },
      order: {
        select: {
          orderNumber: true,
          orderType: true,
          customerName: true,
          customerPhone: true,
        },
      },
    },
  });

  if (!receipt) throw new NotFoundError('Receipt not found');
  if (receipt.restaurantId !== restaurantId) throw new ForbiddenError('Access denied');

  return receipt;
}

export async function getReceiptByOrder(orderId: string, restaurantId: string): Promise<any> {
  const receipt = await prisma.receipt.findFirst({
    where: { orderId, status: 'ISSUED' },
    include: {
      lines: { orderBy: { createdAt: 'asc' } },
      payments: {
        include: { payment: { select: { referenceNumber: true, providerName: true } } },
        orderBy: { createdAt: 'asc' },
      },
      issuedBy: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  if (!receipt) throw new NotFoundError('No receipt found for this order');
  if (receipt.restaurantId !== restaurantId) throw new ForbiddenError('Access denied');

  return receipt;
}

// ==========================================
// RECEIPT LIST
// ==========================================

interface ReceiptListFilters {
  search?: string;
  waiterId?: string;
  cashierId?: string;
  tableId?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  paymentMethod?: string;
  page?: number;
  limit?: number;
}

export async function getReceiptList(
  restaurantId: string,
  filters: ReceiptListFilters = {}
): Promise<any> {
  const page = filters.page || 1;
  const limit = Math.min(filters.limit || 20, 100);
  const skip = (page - 1) * limit;

  const where: any = { restaurantId };

  if (filters.status) where.status = filters.status;
  if (filters.cashierId) where.issuedById = filters.cashierId;

  if (filters.dateFrom || filters.dateTo) {
    where.issuedAt = {};
    if (filters.dateFrom) where.issuedAt.gte = new Date(filters.dateFrom);
    if (filters.dateTo) where.issuedAt.lte = new Date(filters.dateTo + 'T23:59:59.999Z');
  }

  if (filters.tableId) {
    where.order = { tableId: filters.tableId };
  }

  if (filters.waiterId) {
    where.order = { ...where.order, waiterId: filters.waiterId };
  }

  if (filters.paymentMethod) {
    where.payments = { some: { method: filters.paymentMethod } };
  }

  if (filters.search) {
    where.OR = [
      { receiptNumber: { contains: filters.search, mode: 'insensitive' } },
      { order: { orderNumber: { contains: filters.search, mode: 'insensitive' } } },
    ];
  }

  const [receipts, total] = await Promise.all([
    prisma.receipt.findMany({
      where,
      include: {
        issuedBy: { select: { id: true, firstName: true, lastName: true } },
        order: {
          select: {
            orderNumber: true,
            orderType: true,
            waiterId: true,
            waiter: { select: { firstName: true, lastName: true } },
            table: { select: { name: true, code: true } },
          },
        },
        payments: {
          select: { method: true, amount: true },
        },
      },
      orderBy: { issuedAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.receipt.count({ where }),
  ]);

  return {
    receipts: receipts.map((r: any) => ({
      id: r.id,
      receiptNumber: r.receiptNumber,
      status: r.status,
      totalAmount: r.totalAmount,
      amountPaid: r.amountPaid,
      changeAmount: r.changeAmount,
      currency: r.currency,
      orderNumber: r.order.orderNumber,
      orderType: r.order.orderType,
      table: r.order.table,
      waiter: r.order.waiter,
      issuedBy: r.issuedBy,
      issuedAt: r.issuedAt,
      reprintCount: r.reprintCount,
      voidedAt: r.voidedAt,
      paymentMethods: r.payments.map((p: any) => p.method),
      methodsSummary: r.payments.reduce((acc: any, p: any) => {
        acc[p.method] = (acc[p.method] || 0) + Number(p.amount);
        return acc;
      }, {}),
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

// ==========================================
// REPRINT
// ==========================================

export async function reprintReceipt(
  receiptId: string,
  userId: string,
  restaurantId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<any> {
  const receipt = await prisma.receipt.findUnique({
    where: { id: receiptId },
  });

  if (!receipt) throw new NotFoundError('Receipt not found');
  if (receipt.restaurantId !== restaurantId) throw new ForbiddenError('Access denied');

  const updated = await prisma.receipt.update({
    where: { id: receiptId },
    data: {
      reprintCount: { increment: 1 },
      lastReprintedAt: new Date(),
    },
  });

  await createAuditLog({
    restaurantId,
    userId,
    action: 'Receipt reprinted',
    entityType: 'Receipt',
    entityId: receiptId,
    description: `Receipt ${receipt.receiptNumber} reprinted (count: ${updated.reprintCount})`,
    metadata: {
      receiptNumber: receipt.receiptNumber,
      reprintCount: updated.reprintCount,
    },
    ipAddress,
    userAgent,
  });

  return { reprintCount: updated.reprintCount, lastReprintedAt: updated.lastReprintedAt };
}

// ==========================================
// VOID RECEIPT
// ==========================================

export async function voidReceipt(
  receiptId: string,
  reason: string,
  userId: string,
  restaurantId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<any> {
  const receipt = await prisma.receipt.findUnique({
    where: { id: receiptId },
  });

  if (!receipt) throw new NotFoundError('Receipt not found');
  if (receipt.restaurantId !== restaurantId) throw new ForbiddenError('Access denied');
  if (receipt.status === 'VOIDED') throw new BadRequestError('Receipt is already voided');

  const updated = await prisma.receipt.update({
    where: { id: receiptId },
    data: {
      status: 'VOIDED',
      voidedAt: new Date(),
      voidedById: userId,
      voidReason: reason,
    },
  });

  await createAuditLog({
    restaurantId,
    userId,
    action: 'Receipt voided',
    entityType: 'Receipt',
    entityId: receiptId,
    description: `Receipt ${receipt.receiptNumber} voided: ${reason}`,
    metadata: {
      receiptNumber: receipt.receiptNumber,
      reason,
    },
    ipAddress,
    userAgent,
  });

  return updated;
}

// ==========================================
// PDF GENERATION
// ==========================================

export async function generateReceiptPdf(
  receiptId: string,
  restaurantId: string,
  paperSize: 'A4' | 'THERMAL_80MM' | 'THERMAL_58MM' = 'THERMAL_80MM'
): Promise<Buffer> {
  const receipt = await prisma.receipt.findUnique({
    where: { id: receiptId },
    include: {
      lines: { orderBy: { createdAt: 'asc' } },
      payments: { orderBy: { createdAt: 'asc' } },
      order: {
        select: {
          orderNumber: true,
          orderType: true,
        },
      },
    },
  });

  if (!receipt) throw new NotFoundError('Receipt not found');
  if (receipt.restaurantId !== restaurantId) throw new ForbiddenError('Access denied');

  // Configure page size
  let pageOptions: any;
  let fontSize: number;
  let headerSize: number;
  let lineHeight: number;

  switch (paperSize) {
    case 'THERMAL_58MM':
      pageOptions = { size: [226, 1000], margin: { top: 15, bottom: 15, left: 8, right: 8 } };
      fontSize = 7;
      headerSize = 9;
      lineHeight = 10;
      break;
    case 'THERMAL_80MM':
      pageOptions = { size: [302, 1000], margin: { top: 20, bottom: 20, left: 12, right: 12 } };
      fontSize = 8;
      headerSize = 11;
      lineHeight = 12;
      break;
    case 'A4':
    default:
      pageOptions = { size: 'A4', margin: { top: 30, bottom: 30, left: 30, right: 30 } };
      fontSize = 10;
      headerSize = 16;
      lineHeight = 16;
      break;
  }

  const doc = new PDFDocument(pageOptions);
  const buffers: Buffer[] = [];

  doc.on('data', (chunk: Buffer) => buffers.push(chunk));

  return new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    // REPRINT watermark
    if (receipt.reprintCount > 0) {
      doc.fontSize(fontSize + 2);
      doc.font('Helvetica-Bold');
      doc.text('*** REPRINT ***', { align: 'center' });
      doc.moveDown(0.5);
    }

    // Restaurant header
    doc.fontSize(headerSize);
    doc.font('Helvetica-Bold');
    doc.text(receipt.restaurantNameSnapshot, { align: 'center' });

    doc.fontSize(fontSize);
    doc.font('Helvetica');
    if (receipt.restaurantAddressSnapshot) {
      doc.text(receipt.restaurantAddressSnapshot, { align: 'center' });
    }
    if (receipt.restaurantPhoneSnapshot) {
      doc.text(`Tel: ${receipt.restaurantPhoneSnapshot}`, { align: 'center' });
    }
    if (receipt.restaurantEmailSnapshot) {
      doc.text(receipt.restaurantEmailSnapshot, { align: 'center' });
    }

    doc.moveDown(0.5);

    // Separator
    drawSeparator(doc, fontSize);

    // Receipt info
    doc.font('Helvetica-Bold');
    doc.text(`Receipt: ${receipt.receiptNumber}`, { align: 'center' });
    doc.font('Helvetica');
    doc.text(`Date: ${formatDate(receipt.issuedAt)}`, { align: 'center' });
    doc.text(`Order: ${receipt.orderNumberSnapshot}`, { align: 'center' });
    doc.text(`Type: ${receipt.orderTypeSnapshot}`, { align: 'center' });

    if (receipt.tableNameSnapshot) {
      doc.text(`Table: ${receipt.tableNameSnapshot} (${receipt.tableCodeSnapshot})`, { align: 'center' });
    }

    if (receipt.waiterNameSnapshot) {
      doc.text(`Waiter: ${receipt.waiterNameSnapshot}`, { align: 'center' });
    }

    if (receipt.customerNameSnapshot) {
      doc.text(`Customer: ${receipt.customerNameSnapshot}`, { align: 'center' });
    }
    if (receipt.customerPhoneSnapshot) {
      doc.text(`Phone: ${receipt.customerPhoneSnapshot}`, { align: 'center' });
    }

    drawSeparator(doc, fontSize);

    // Column headers
    const col1 = doc.x;
    const col2 = doc.x + (pageOptions.size ? pageOptions.size[0] - pageOptions.margin.left - pageOptions.margin.right - 120 : 450);
    const col3 = doc.x + (pageOptions.size ? pageOptions.size[0] - pageOptions.margin.left - pageOptions.margin.right - 60 : 490);
    const col4 = doc.x + (pageOptions.size ? pageOptions.size[0] - pageOptions.margin.left - pageOptions.margin.right - 20 : 520);

    doc.font('Helvetica-Bold');
    doc.text('Item', col1, doc.y, { width: col2 - col1 });
    doc.text('Qty', col2, doc.y, { width: 30, align: 'center' });
    doc.text('Price', col3, doc.y, { width: 40, align: 'right' });
    doc.text('Total', col4, doc.y, { width: 50, align: 'right' });
    doc.moveDown(0.3);

    drawSeparator(doc, fontSize);

    // Line items
    doc.font('Helvetica');
    for (const line of receipt.lines) {
      const lineY = doc.y;

      // Item name
      doc.text(truncateText(line.itemNameSnapshot, 25), col1, lineY, {
        width: col2 - col1,
        lineBreak: false,
      });

      // Quantity
      doc.text(String(line.quantity), col2, lineY, {
        width: 30,
        align: 'center',
        lineBreak: false,
      });

      // Unit price
      doc.text(formatAmount(line.unitPrice, receipt.currency), col3, lineY, {
        width: 40,
        align: 'right',
        lineBreak: false,
      });

      // Line total
      doc.text(formatAmount(line.lineTotal, receipt.currency), col4, lineY, {
        width: 50,
        align: 'right',
        lineBreak: false,
      });

      doc.moveDown(0.5);

      // Special instructions
      if (line.specialInstructions) {
        doc.fontSize(fontSize - 1);
        doc.text(`  ${line.specialInstructions}`, { indent: 5 });
        doc.fontSize(fontSize);
      }
    }

    drawSeparator(doc, fontSize);

    // Totals
    doc.font('Helvetica');
    doc.text('Subtotal', { continued: true });
    doc.text(formatAmount(receipt.subtotal, receipt.currency), { align: 'right' });

    doc.text('Tax', { continued: true });
    doc.text(formatAmount(receipt.taxAmount, receipt.currency), { align: 'right' });

    if (Number(receipt.serviceChargeAmount) > 0) {
      doc.text('Service Charge', { continued: true });
      doc.text(formatAmount(receipt.serviceChargeAmount, receipt.currency), { align: 'right' });
    }

    if (Number(receipt.discountAmount) > 0) {
      doc.text('Discount', { continued: true });
      doc.text(`-${formatAmount(receipt.discountAmount, receipt.currency)}`, { align: 'right' });
    }

    doc.font('Helvetica-Bold');
    doc.text('Total', { continued: true });
    doc.text(formatAmount(receipt.totalAmount, receipt.currency), { align: 'right' });

    drawSeparator(doc, fontSize);

    // Payment breakdown
    doc.font('Helvetica');
    doc.text('Payments:');
    for (const payment of receipt.payments) {
      let paymentText = payment.method.replace(/_/g, ' ');
      if (payment.referenceNumber) {
        paymentText += ` (Ref: ${payment.referenceNumber})`;
      }
      doc.text(paymentText, { continued: true });
      doc.text(formatAmount(payment.amount, receipt.currency), { align: 'right' });
    }

    doc.font('Helvetica-Bold');
    doc.text('Amount Paid', { continued: true });
    doc.text(formatAmount(receipt.amountPaid, receipt.currency), { align: 'right' });

    if (Number(receipt.changeAmount) > 0) {
      doc.font('Helvetica');
      doc.text('Change', { continued: true });
      doc.text(formatAmount(receipt.changeAmount, receipt.currency), { align: 'right' });
    }

    drawSeparator(doc, fontSize);

    // Footer
    doc.font('Helvetica');
    doc.fontSize(fontSize - 1);
    if (receipt.receiptFooterSnapshot) {
      doc.text(receipt.receiptFooterSnapshot, { align: 'center' });
    }
    doc.text(`Thank you for dining with us!`, { align: 'center' });
    doc.text(`Currency: ${receipt.currency}`, { align: 'center' });

    doc.end();
  });
}

// ==========================================
// HELPERS
// ==========================================

function drawSeparator(doc: PDFKit.PDFDocument, fontSize: number): void {
  doc.fontSize(fontSize);
  doc.text('─'.repeat(48), { align: 'center' });
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatAmount(amount: string | number | Decimal, currency: string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : Number(amount);
  return `${num.toFixed(2)} ${currency}`;
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

