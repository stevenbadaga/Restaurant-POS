import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../database';
import { requireAuth, requireRole } from '../middleware/auth';
import { BadRequestError } from '../types';
import * as printService from '../services/print.service';
import { createAuditLog } from '../services/audit.service';
import { getSocketIO } from '../sockets/emitter';

const router = Router();
router.use(requireAuth);

// ==========================================
// PRINTER CRUD
// ==========================================

// GET /api/printers - List all printers
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const printers = await printService.getPrinters(req.user!.restaurantId);
    res.json({ success: true, data: printers });
  } catch (error) { next(error); }
});

// GET /api/printers/:id - Get printer detail
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const printer = await printService.getPrinterById(req.params.id, req.user!.restaurantId);
    res.json({ success: true, data: printer });
  } catch (error) { next(error); }
});

// POST /api/printers - Create printer
router.post('/', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      name: z.string().min(1, 'Name is required'),
      description: z.string().optional().nullable(),
      connectionType: z.enum(['USB', 'NETWORK', 'BLUETOOTH', 'BROWSER']).optional(),
      ipAddress: z.string().optional().nullable(),
      port: z.number().int().positive().optional().nullable(),
      paperSize: z.enum(['THERMAL_58MM', 'THERMAL_80MM', 'A4']).optional(),
      isDefault: z.boolean().optional(),
      autoPrintReceipt: z.boolean().optional(),
      autoPrintTicket: z.boolean().optional(),
      kitchenStationId: z.string().uuid().optional().nullable(),
    });

    const parsed = schema.parse(req.body);
    const printer = await printService.createPrinter({
      name: parsed.name,
      restaurantId: req.user!.restaurantId,
      description: parsed.description ?? undefined,
      connectionType: parsed.connectionType,
      ipAddress: parsed.ipAddress ?? undefined,
      port: parsed.port ?? undefined,
      paperSize: parsed.paperSize,
      isDefault: parsed.isDefault,
      autoPrintReceipt: parsed.autoPrintReceipt,
      autoPrintTicket: parsed.autoPrintTicket,
      kitchenStationId: parsed.kitchenStationId ?? undefined,
    });

    await createAuditLog({
      restaurantId: req.user!.restaurantId,
      userId: req.user!.id,
      action: 'Printer created',
      entityType: 'Printer',
      entityId: printer.id,
      description: `Printer ${printer.name} created`,
    });

    res.status(201).json({ success: true, data: printer, message: 'Printer created' });
  } catch (error) {
    if (error instanceof z.ZodError) next(new BadRequestError(error.errors[0].message));
    else next(error);
  }
});

// PUT /api/printers/:id - Update printer
router.put('/:id', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      name: z.string().min(1).optional(),
      description: z.string().optional().nullable(),
      connectionType: z.enum(['USB', 'NETWORK', 'BLUETOOTH', 'BROWSER']).optional(),
      ipAddress: z.string().optional().nullable(),
      port: z.number().int().positive().optional().nullable(),
      paperSize: z.enum(['THERMAL_58MM', 'THERMAL_80MM', 'A4']).optional(),
      status: z.enum(['ONLINE', 'OFFLINE', 'ERROR', 'DISABLED']).optional(),
      isDefault: z.boolean().optional(),
      autoPrintReceipt: z.boolean().optional(),
      autoPrintTicket: z.boolean().optional(),
      kitchenStationId: z.string().uuid().optional().nullable(),
      isActive: z.boolean().optional(),
      config: z.any().optional(),
    });

    const parsed = schema.parse(req.body);
    const updateData: Record<string, any> = {};
    if (parsed.name !== undefined) updateData.name = parsed.name;
    if (parsed.description !== undefined) updateData.description = parsed.description ?? undefined;
    if (parsed.connectionType !== undefined) updateData.connectionType = parsed.connectionType;
    if (parsed.ipAddress !== undefined) updateData.ipAddress = parsed.ipAddress ?? undefined;
    if (parsed.port !== undefined) updateData.port = parsed.port ?? undefined;
    if (parsed.paperSize !== undefined) updateData.paperSize = parsed.paperSize;
    if (parsed.status !== undefined) updateData.status = parsed.status;
    if (parsed.isDefault !== undefined) updateData.isDefault = parsed.isDefault;
    if (parsed.autoPrintReceipt !== undefined) updateData.autoPrintReceipt = parsed.autoPrintReceipt;
    if (parsed.autoPrintTicket !== undefined) updateData.autoPrintTicket = parsed.autoPrintTicket;
    if (parsed.kitchenStationId !== undefined) updateData.kitchenStationId = parsed.kitchenStationId ?? undefined;
    if (parsed.isActive !== undefined) updateData.isActive = parsed.isActive;
    if (parsed.config !== undefined) updateData.config = parsed.config;
    const printer = await printService.updatePrinter(req.params.id, req.user!.restaurantId, updateData);

    res.json({ success: true, data: printer, message: 'Printer updated' });
  } catch (error) {
    if (error instanceof z.ZodError) next(new BadRequestError(error.errors[0].message));
    else next(error);
  }
});

// DELETE /api/printers/:id - Delete printer
router.delete('/:id', requireRole('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await printService.deletePrinter(req.params.id, req.user!.restaurantId);
    res.json({ success: true, message: 'Printer deleted' });
  } catch (error) { next(error); }
});

// ==========================================
// PRINT JOBS
// ==========================================

// GET /api/printers/jobs - List print jobs
router.get('/jobs/list', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await printService.getPrintJobs(req.user!.restaurantId, {
      status: req.query.status as string,
      jobType: req.query.jobType as string,
      orderId: req.query.orderId as string,
      ticketId: req.query.ticketId as string,
      receiptId: req.query.receiptId as string,
      page: req.query.page ? parseInt(req.query.page as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
    });
    res.json({ success: true, data: result });
  } catch (error) { next(error); }
});

// POST /api/printers/print-kitchen-ticket/:ticketId - Print a kitchen ticket
router.post('/print-kitchen-ticket/:ticketId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ticketId = req.params.ticketId;
    const printerId = req.query.printerId as string;

    // Generate the ticket HTML content
    const html = await printService.generateKitchenTicketHtml(ticketId, req.user!.restaurantId);

    // Get ticket info
    const ticket = await prisma.kitchenTicket.findUnique({
      where: { id: ticketId },
      include: { kitchenStation: { select: { name: true } } },
    });

    // Create print job record
    const job = await printService.createPrintJob({
      restaurantId: req.user!.restaurantId,
      printerId: printerId || undefined,
      jobType: 'KITCHEN_TICKET',
      title: `Kitchen Ticket - ${ticket?.kitchenStation?.name || ''}`,
      content: html,
      entityType: 'KitchenTicket',
      entityId: ticketId,
      ticketId,
      requestedById: req.user!.id,
    });

    // Emit socket event for any connected print client
    try {
      const io = getSocketIO();
      io.to(`restaurant:${req.user!.restaurantId}`).emit('print:job-created', {
        jobId: job.id,
        jobType: 'KITCHEN_TICKET',
        content: html,
        printerId,
      });
    } catch { /* socket not critical */ }

    res.json({ success: true, data: { job, html }, message: 'Print job created' });
  } catch (error) { next(error); }
});

// POST /api/printers/print-receipt/:receiptId - Print a receipt
router.post('/print-receipt/:receiptId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const receiptId = req.params.receiptId;
    const paperSize = (req.query.paperSize as string) || 'THERMAL_80MM';
    const printerId = req.query.printerId as string;

    const html = await printService.generateReceiptPrintHtml(receiptId, req.user!.restaurantId, paperSize);

    const job = await printService.createPrintJob({
      restaurantId: req.user!.restaurantId,
      printerId: printerId || undefined,
      jobType: 'RECEIPT',
      title: 'Receipt Print',
      content: html,
      contentType: 'text/html',
      paperSize: paperSize as any,
      entityType: 'Receipt',
      entityId: receiptId,
      receiptId,
      requestedById: req.user!.id,
    });

    try {
      const io = getSocketIO();
      io.to(`restaurant:${req.user!.restaurantId}`).emit('print:job-created', {
        jobId: job.id,
        jobType: 'RECEIPT',
        content: html,
        printerId,
      });
    } catch { /* socket not critical */ }

    res.json({ success: true, data: { job, html }, message: 'Print job created' });
  } catch (error) { next(error); }
});

// POST /api/printers/jobs/:id/status - Update print job status
router.patch('/jobs/:id/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      status: z.enum(['PENDING', 'PRINTING', 'COMPLETED', 'FAILED', 'CANCELLED']),
      errorMessage: z.string().optional(),
    });

    const { status, errorMessage } = schema.parse(req.body);
    const job = await printService.updatePrintJobStatus(req.params.id, req.user!.restaurantId, status, errorMessage);

    res.json({ success: true, data: job, message: `Print job ${status.toLowerCase()}` });
  } catch (error) {
    if (error instanceof z.ZodError) next(new BadRequestError(error.errors[0].message));
    else next(error);
  }
});

export default router;
