import { prisma } from '../database';
import { NotFoundError, BadRequestError, ForbiddenError } from '../types';
import { createAuditLog } from './audit.service';
import { getReceiptDetail } from './receipt.service';

// ==========================================
// PRINTER CRUD
// ==========================================

export async function getPrinters(restaurantId: string) {
  return prisma.printer.findMany({
    where: { restaurantId },
    include: {
      kitchenStation: { select: { id: true, name: true } },
      _count: { select: { printJobs: true } },
    },
    orderBy: { displayOrder: 'asc' },
  });
}

export async function getPrinterById(printerId: string, restaurantId: string) {
  const printer = await prisma.printer.findUnique({
    where: { id: printerId },
    include: { kitchenStation: { select: { id: true, name: true } } },
  });

  if (!printer) throw new NotFoundError('Printer not found');
  if (printer.restaurantId !== restaurantId) throw new ForbiddenError('Access denied');

  return printer;
}

export async function createPrinter(data: {
  restaurantId: string;
  name: string;
  description?: string;
  connectionType?: string;
  ipAddress?: string;
  port?: number;
  paperSize?: string;
  isDefault?: boolean;
  autoPrintReceipt?: boolean;
  autoPrintTicket?: boolean;
  kitchenStationId?: string;
  config?: any;
}) {
  // If setting as default, unset other defaults
  if (data.isDefault) {
    await prisma.printer.updateMany({
      where: { restaurantId: data.restaurantId, isDefault: true },
      data: { isDefault: false },
    });
  }

  return prisma.printer.create({
    data: {
      restaurantId: data.restaurantId,
      name: data.name,
      description: data.description,
      connectionType: (data.connectionType as any) || 'BROWSER',
      ipAddress: data.ipAddress,
      port: data.port,
      paperSize: (data.paperSize as any) || 'THERMAL_80MM',
      isDefault: data.isDefault || false,
      autoPrintReceipt: data.autoPrintReceipt || false,
      autoPrintTicket: data.autoPrintTicket || false,
      kitchenStationId: data.kitchenStationId,
      config: data.config || {},
    },
    include: { kitchenStation: { select: { id: true, name: true } } },
  });
}

export async function updatePrinter(
  printerId: string,
  restaurantId: string,
  data: {
    name?: string;
    description?: string;
    connectionType?: string;
    ipAddress?: string;
    port?: number;
    paperSize?: string;
    status?: string;
    isDefault?: boolean;
    autoPrintReceipt?: boolean;
    autoPrintTicket?: boolean;
    kitchenStationId?: string;
    isActive?: boolean;
    config?: any;
  }
) {
  const printer = await prisma.printer.findUnique({ where: { id: printerId } });
  if (!printer) throw new NotFoundError('Printer not found');
  if (printer.restaurantId !== restaurantId) throw new ForbiddenError('Access denied');

  if (data.isDefault) {
    await prisma.printer.updateMany({
      where: { restaurantId, isDefault: true, id: { not: printerId } },
      data: { isDefault: false },
    });
  }

  return prisma.printer.update({
    where: { id: printerId },
    data: data as any,
    include: { kitchenStation: { select: { id: true, name: true } } },
  });
}

export async function deletePrinter(printerId: string, restaurantId: string) {
  const printer = await prisma.printer.findUnique({ where: { id: printerId } });
  if (!printer) throw new NotFoundError('Printer not found');
  if (printer.restaurantId !== restaurantId) throw new ForbiddenError('Access denied');

  await prisma.printer.delete({ where: { id: printerId } });

  await createAuditLog({
    restaurantId,
    userId: 'system',
    action: 'Printer deleted',
    entityType: 'Printer',
    entityId: printerId,
    description: `Printer ${printer.name} deleted`,
  });

  return { success: true };
}

// ==========================================
// PRINT JOBS
// ==========================================

export async function createPrintJob(data: {
  restaurantId: string;
  printerId?: string;
  jobType: string;
  title: string;
  content?: string;
  contentType?: string;
  copies?: number;
  paperSize?: string;
  entityType?: string;
  entityId?: string;
  orderId?: string;
  ticketId?: string;
  receiptId?: string;
  requestedById: string;
}) {
  return prisma.printJob.create({
    data: {
      restaurantId: data.restaurantId,
      printerId: data.printerId,
      jobType: data.jobType as any,
      title: data.title,
      content: data.content,
      contentType: data.contentType || 'text/html',
      copies: data.copies || 1,
      paperSize: (data.paperSize as any) || 'THERMAL_80MM',
      entityType: data.entityType,
      entityId: data.entityId,
      orderId: data.orderId,
      ticketId: data.ticketId,
      receiptId: data.receiptId,
      requestedById: data.requestedById,
    },
  });
}

export async function getPrintJobs(
  restaurantId: string,
  filters: {
    status?: string;
    jobType?: string;
    orderId?: string;
    ticketId?: string;
    receiptId?: string;
    page?: number;
    limit?: number;
  } = {}
) {
  const page = filters.page || 1;
  const limit = Math.min(filters.limit || 20, 100);
  const skip = (page - 1) * limit;

  const where: any = { restaurantId };

  if (filters.status) where.status = filters.status;
  if (filters.jobType) where.jobType = filters.jobType;
  if (filters.orderId) where.orderId = filters.orderId;
  if (filters.ticketId) where.ticketId = filters.ticketId;
  if (filters.receiptId) where.receiptId = filters.receiptId;

  const [jobs, total] = await Promise.all([
    prisma.printJob.findMany({
      where,
      include: {
        printer: { select: { name: true, connectionType: true } },
        requestedBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.printJob.count({ where }),
  ]);

  return {
    jobs,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function updatePrintJobStatus(
  jobId: string,
  restaurantId: string,
  status: string,
  errorMessage?: string
) {
  const job = await prisma.printJob.findUnique({ where: { id: jobId } });
  if (!job) throw new NotFoundError('Print job not found');
  if (job.restaurantId !== restaurantId) throw new ForbiddenError('Access denied');

  const data: any = { status };

  if (status === 'COMPLETED') data.completedAt = new Date();
  if (status === 'FAILED') {
    data.failedAt = new Date();
    data.errorMessage = errorMessage;
  }

  return prisma.printJob.update({ where: { id: jobId }, data });
}

// ==========================================
// KITCHEN TICKET PRINT CONTENT GENERATION
// ==========================================

export async function generateKitchenTicketHtml(ticketId: string, restaurantId: string): Promise<string> {
  const ticket = await prisma.kitchenTicket.findUnique({
    where: { id: ticketId },
    include: {
      kitchenStation: { select: { name: true } },
      order: {
        select: {
          orderNumber: true,
          orderType: true,
          notes: true,
          submittedAt: true,
          table: { select: { name: true, code: true } },
          waiter: { select: { firstName: true, lastName: true } },
        },
      },
      items: {
        include: {
          orderItem: {
            select: {
              menuItemNameSnapshot: true,
              quantity: true,
              specialInstructions: true,
              unitPrice: true,
            },
          },
        },
      },
    },
  });

  if (!ticket) throw new NotFoundError('Kitchen ticket not found');
  if (ticket.restaurantId !== restaurantId) throw new ForbiddenError('Access denied');

  const isThermal = true; // Kitchen tickets default to thermal

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  @page { size: 80mm auto; margin: 0; }
  body { font-family: 'Courier New', monospace; font-size: 10px; margin: 0; padding: 8px 5px; color: #000; background: #fff; }
  .header { text-align: center; margin-bottom: 6px; }
  .header h2 { font-size: 14px; margin: 0 0 4px; text-transform: uppercase; }
  .station { text-align: center; font-size: 11px; font-weight: bold; margin-bottom: 4px; }
  .divider { border-top: 1px dashed #000; margin: 6px 0; }
  .info { font-size: 9px; margin: 2px 0; }
  .order-info { display: flex; justify-content: space-between; font-size: 9px; }
  table { width: 100%; border-collapse: collapse; margin: 6px 0; font-size: 9px; }
  th { border-bottom: 1px dashed #000; padding: 3px 2px; text-align: left; }
  td { padding: 2px; }
  .qty { text-align: center; width: 30px; }
  .item-name { font-weight: bold; }
  .note { font-style: italic; font-size: 8px; color: #555; padding-left: 10px; }
  .footer { text-align: center; font-size: 8px; margin-top: 6px; }
  .barcode { text-align: center; margin: 4px 0; font-size: 12px; letter-spacing: 2px; }
</style></head><body>
  <div class="header">
    <h2>KITCHEN TICKET</h2>
  </div>
  <div class="station">Station: ${ticket.kitchenStation?.name || 'General'}</div>
  <div class="divider"></div>
  <div class="order-info">
    <span><strong>Order:</strong> #${ticket.order.orderNumber}</span>
    <span><strong>Type:</strong> ${ticket.order.orderType?.replace(/_/g, ' ')}</span>
  </div>
  ${ticket.order.table ? `<div class="info"><strong>Table:</strong> ${ticket.order.table.name} (${ticket.order.table.code})</div>` : ''}
  <div class="info"><strong>Waiter:</strong> ${ticket.order.waiter.firstName} ${ticket.order.waiter.lastName}</div>
  <div class="info"><strong>Time:</strong> ${new Date(ticket.order.submittedAt || new Date()).toLocaleTimeString()}</div>
  ${ticket.order.notes ? `<div class="info"><strong>Order Notes:</strong> ${ticket.order.notes}</div>` : ''}
  <div class="divider"></div>
  <table>
    <thead><tr><th>Qty</th><th>Item</th></tr></thead>
    <tbody>
      ${ticket.items.map(item => `
        <tr>
          <td class="qty">${item.orderItem.quantity}x</td>
          <td class="item-name">${item.orderItem.menuItemNameSnapshot}</td>
        </tr>
        ${item.orderItem.specialInstructions ? `
        <tr><td></td><td class="note">📝 ${item.orderItem.specialInstructions}</td></tr>` : ''}
      `).join('')}
    </tbody>
  </table>
  <div class="divider"></div>
  <div class="footer">
    <div class="barcode">✦ ${ticket.kitchenStation?.name || 'KITCHEN'} ✦</div>
    <p>Please prepare items promptly</p>
  </div>
  <script>window.onload = function() { window.print(); setTimeout(function() { window.close(); }, 500); };</script>
</body></html>`;
}

// ==========================================
// RECEIPT PRINT WITH QR CODE
// ==========================================

export async function generateReceiptPrintHtml(receiptId: string, restaurantId: string, paperSize?: string): Promise<string> {
  const receipt = await getReceiptDetail(receiptId, restaurantId);

  const isThermal = !paperSize || paperSize === 'THERMAL_58MM' || paperSize === 'THERMAL_80MM';
  const maxWidth = paperSize === 'THERMAL_58MM' ? '58mm' : paperSize === 'THERMAL_80MM' ? '80mm' : '210mm';

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  @page { size: ${maxWidth} auto; margin: 0; }
  body { font-family: ${isThermal ? "'Courier New', monospace" : "'Inter', sans-serif"}; font-size: ${isThermal ? '9px' : '11px'}; color: #000; background: #fff; margin: 0; padding: ${isThermal ? '8px 4px' : '20px'}; }
  .header { text-align: center; margin-bottom: 8px; }
  .header h1 { font-size: ${isThermal ? '13px' : '16px'}; margin: 0 0 4px; }
  .header p { margin: 1px 0; font-size: ${isThermal ? '8px' : '10px'}; }
  .reprint-badge { text-align: center; font-weight: bold; font-size: ${isThermal ? '10px' : '12px'}; margin-bottom: 4px; }
  .divider { border-top: 1px dashed #000; margin: 6px 0; }
  .info-row { display: flex; justify-content: space-between; font-size: ${isThermal ? '8px' : '10px'}; margin: 2px 0; }
  table { width: 100%; border-collapse: collapse; margin: 6px 0; font-size: ${isThermal ? '8px' : '10px'}; }
  th { text-align: left; border-bottom: 1px dashed #000; padding: 3px 2px; }
  td { padding: 2px; }
  .text-right { text-align: right; }
  .text-center { text-align: center; }
  .total-row { font-weight: bold; border-top: 1px dashed #000; }
  .footer { text-align: center; margin-top: 8px; font-size: ${isThermal ? '7px' : '9px'}; }
  .qr-section { text-align: center; margin: 8px 0; }
  .qr-placeholder { font-family: monospace; font-size: 11px; letter-spacing: 3px; }
  .payment-breakdown { font-size: ${isThermal ? '8px' : '10px'}; }
</style></head><body>
  ${receipt.reprintCount > 0 ? '<div class="reprint-badge">*** REPRINT (#' + (receipt.reprintCount + 1) + ') ***</div>' : ''}
  <div class="header">
    <h1>${receipt.restaurantNameSnapshot}</h1>
    ${receipt.restaurantAddressSnapshot ? `<p>${receipt.restaurantAddressSnapshot}</p>` : ''}
    ${receipt.restaurantPhoneSnapshot ? `<p>Tel: ${receipt.restaurantPhoneSnapshot}</p>` : ''}
    ${receipt.restaurantEmailSnapshot ? `<p>${receipt.restaurantEmailSnapshot}</p>` : ''}
  </div>
  <div class="divider"></div>
  <div class="info-row"><span><strong>Receipt:</strong> ${receipt.receiptNumber}</span></div>
  <div class="info-row"><span>Date: ${new Date(receipt.issuedAt).toLocaleString()}</span></div>
  <div class="info-row"><span>Order: #${receipt.orderNumberSnapshot}</span><span>${receipt.orderTypeSnapshot?.replace(/_/g, ' ')}</span></div>
  ${receipt.tableNameSnapshot ? `<div class="info-row"><span>Table: ${receipt.tableNameSnapshot} (${receipt.tableCodeSnapshot})</span></div>` : ''}
  ${receipt.waiterNameSnapshot ? `<div class="info-row"><span>Waiter: ${receipt.waiterNameSnapshot}</span></div>` : ''}
  ${receipt.customerNameSnapshot ? `<div class="info-row"><span>Customer: ${receipt.customerNameSnapshot}</span></div>` : ''}
  <div class="divider"></div>
  <table>
    <thead><tr><th>Item</th><th class="text-center">Qty</th><th class="text-right">Price</th><th class="text-right">Total</th></tr></thead>
    <tbody>
      ${receipt.lines.map((line: any) => `
        <tr>
          <td>${line.itemNameSnapshot}</td>
          <td class="text-center">${line.quantity}</td>
          <td class="text-right">${parseFloat(line.unitPrice).toFixed(2)}</td>
          <td class="text-right">${parseFloat(line.lineTotal).toFixed(2)}</td>
        </tr>
        ${line.specialInstructions ? `<tr><td colspan="4" style="font-style:italic;font-size:7px;">  ${line.specialInstructions}</td></tr>` : ''}
      `).join('')}
    </tbody>
  </table>
  <div class="divider"></div>
  <div class="info-row"><span>Subtotal</span><span>${parseFloat(receipt.subtotal).toFixed(2)}</span></div>
  <div class="info-row"><span>Tax</span><span>${parseFloat(receipt.taxAmount).toFixed(2)}</span></div>
  ${parseFloat(receipt.serviceChargeAmount) > 0 ? `<div class="info-row"><span>Service Charge</span><span>${parseFloat(receipt.serviceChargeAmount).toFixed(2)}</span></div>` : ''}
  ${parseFloat(receipt.discountAmount) > 0 ? `<div class="info-row"><span>Discount</span><span>-${parseFloat(receipt.discountAmount).toFixed(2)}</span></div>` : ''}
  ${receipt.tipAmount && parseFloat(receipt.tipAmount) > 0 ? `<div class="info-row"><span>Tip</span><span>${parseFloat(receipt.tipAmount).toFixed(2)}</span></div>` : ''}
  <div class="info-row total-row"><span>Total</span><span>${parseFloat(receipt.totalAmount).toFixed(2)} ${receipt.currency}</span></div>
  <div class="divider"></div>
  <div class="payment-breakdown">
    <p class="text-center"><strong>Payments</strong></p>
    ${receipt.payments.map((p: any) => `
      <div class="info-row"><span>${p.method.replace(/_/g, ' ')}${p.referenceNumber ? ` (${p.referenceNumber})` : ''}</span><span>${parseFloat(p.amount).toFixed(2)}</span></div>
    `).join('')}
    <div class="info-row total-row"><span>Amount Paid</span><span>${parseFloat(receipt.amountPaid).toFixed(2)}</span></div>
    ${parseFloat(receipt.changeAmount) > 0 ? `<div class="info-row"><span>Change</span><span>${parseFloat(receipt.changeAmount).toFixed(2)}</span></div>` : ''}
  </div>
  <div class="qr-section">
    <div class="qr-placeholder">[QR: ${receipt.receiptNumber}]</div>
  </div>
  <div class="divider"></div>
  <div class="footer">
    ${receipt.receiptFooterSnapshot ? `<p>${receipt.receiptFooterSnapshot}</p>` : ''}
    <p>Thank you for dining with us!</p>
    <p>Currency: ${receipt.currency}</p>
  </div>
  ${!isThermal ? `<div class="text-center" style="margin-top:20px"><button onclick="window.print()" style="padding:10px 30px;font-size:16px;cursor:pointer">Print</button></div>` : ''}
  <script>${isThermal ? 'window.onload=function(){window.print();setTimeout(function(){window.close()},500)};' : ''}</script>
</body></html>`;
}
