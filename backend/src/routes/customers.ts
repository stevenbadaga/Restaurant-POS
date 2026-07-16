import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import * as customerService from '../services/customer.service';
import { BadRequestError } from '../types';

const router = Router();
router.use(requireAuth);

const createCustomerSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  dateOfBirth: z.string().optional(),
  preferredDiningAreaId: z.string().uuid().optional(),
  preferredTableId: z.string().uuid().optional(),
  dietaryPreferences: z.string().optional(),
  allergyNotes: z.string().optional(),
  generalNotes: z.string().optional(),
  marketingConsent: z.boolean().optional(),
  marketingConsentSource: z.enum(['IN_PERSON', 'PHONE', 'EMAIL', 'WEBSITE', 'STAFF_ENTRY', 'OTHER']).optional(),
});

const updateCustomerSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  dateOfBirth: z.string().optional(),
  preferredDiningAreaId: z.string().uuid().nullable().optional(),
  preferredTableId: z.string().uuid().nullable().optional(),
  dietaryPreferences: z.string().optional(),
  allergyNotes: z.string().optional(),
  generalNotes: z.string().optional(),
});

// GET /api/customers
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await customerService.listCustomers(req.user!.restaurantId, {
      search: req.query.search as string,
      status: req.query.status as string,
      loyaltyMember: req.query.loyaltyMember as string,
      lastVisitFrom: req.query.lastVisitFrom as string,
      lastVisitTo: req.query.lastVisitTo as string,
      hasUpcomingReservation: req.query.hasUpcomingReservation as string,
      page: req.query.page ? parseInt(req.query.page as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      sortBy: req.query.sortBy as string,
      sortOrder: req.query.sortOrder as string,
    });
    res.json({ success: true, ...result });
  } catch (error) { next(error); }
});

// GET /api/customers/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const customer = await customerService.getCustomerDetail(req.params.id, req.user!.restaurantId);
    res.json({ success: true, data: customer });
  } catch (error) { next(error); }
});

// POST /api/customers
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = createCustomerSchema.parse(req.body);
    const customer = await customerService.createCustomer(
      req.user!.restaurantId, req.user!.id, parsed, req.ip, req.headers['user-agent']
    );
    res.status(201).json({ success: true, data: customer });
  } catch (error) {
    if (error instanceof z.ZodError) next(new BadRequestError(error.errors[0].message));
    else next(error);
  }
});

// PATCH /api/customers/:id
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = updateCustomerSchema.parse(req.body);
    const customer = await customerService.updateCustomer(
      req.params.id, req.user!.restaurantId, req.user!.id, parsed, req.ip, req.headers['user-agent']
    );
    res.json({ success: true, data: customer });
  } catch (error) {
    if (error instanceof z.ZodError) next(new BadRequestError(error.errors[0].message));
    else next(error);
  }
});

// PATCH /api/customers/:id/status
router.patch('/:id/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({ status: z.enum(['ACTIVE', 'INACTIVE', 'BLOCKED']), reason: z.string().optional() });
    const parsed = schema.parse(req.body);
    const customer = await customerService.updateCustomerStatus(
      req.params.id, req.user!.restaurantId, req.user!.id, parsed.status, parsed.reason, req.ip, req.headers['user-agent']
    );
    res.json({ success: true, data: customer });
  } catch (error) {
    if (error instanceof z.ZodError) next(new BadRequestError(error.errors[0].message));
    else next(error);
  }
});

// POST /api/customers/:id/merge
router.post('/:id/merge', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({ duplicateId: z.string().uuid(), reason: z.string().min(1) });
    const parsed = schema.parse(req.body);
    const result = await customerService.mergeCustomers(
      req.params.id, parsed.duplicateId, req.user!.restaurantId, req.user!.id, parsed.reason, req.ip, req.headers['user-agent']
    );
    res.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof z.ZodError) next(new BadRequestError(error.errors[0].message));
    else next(error);
  }
});

// GET /api/customers/:id/orders
router.get('/:id/orders', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await customerService.getCustomerOrders(
      req.params.id, req.user!.restaurantId,
      req.query.page ? parseInt(req.query.page as string) : undefined,
      req.query.limit ? parseInt(req.query.limit as string) : undefined
    );
    res.json({ success: true, ...result });
  } catch (error) { next(error); }
});

// GET /api/customers/:id/receipts - alias for orders with payments
router.get('/:id/receipts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await customerService.getCustomerOrders(
      req.params.id, req.user!.restaurantId,
      req.query.page ? parseInt(req.query.page as string) : undefined,
      req.query.limit ? parseInt(req.query.limit as string) : undefined
    );
    res.json({ success: true, ...result });
  } catch (error) { next(error); }
});

// GET /api/customers/:id/reservations
router.get('/:id/reservations', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await customerService.getCustomerReservations(
      req.params.id, req.user!.restaurantId,
      req.query.page ? parseInt(req.query.page as string) : undefined,
      req.query.limit ? parseInt(req.query.limit as string) : undefined
    );
    res.json({ success: true, ...result });
  } catch (error) { next(error); }
});

// GET /api/customers/:id/loyalty
router.get('/:id/loyalty', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { getLoyaltyAccount } = await import('../services/loyalty.service');
    const account = await getLoyaltyAccount(req.params.id, req.user!.restaurantId);
    res.json({ success: true, data: account });
  } catch (error) { next(error); }
});

// GET /api/customers/:id/activity
router.get('/:id/activity', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const activity = await customerService.getCustomerActivity(req.params.id, req.user!.restaurantId);
    res.json({ success: true, data: activity });
  } catch (error) { next(error); }
});

// === Customer Notes ===

// GET /api/customers/:customerId/notes
router.get('/:customerId/notes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const notes = await customerService.listCustomerNotes(req.params.customerId, req.user!.restaurantId);
    res.json({ success: true, data: notes });
  } catch (error) { next(error); }
});

// POST /api/customers/:customerId/notes
router.post('/:customerId/notes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      note: z.string().min(1),
      noteType: z.enum(['GENERAL', 'PREFERENCE', 'DIETARY', 'ALLERGY', 'SERVICE', 'WARNING']).default('GENERAL'),
      isImportant: z.boolean().default(false),
    });
    const parsed = schema.parse(req.body);
    const note = await customerService.createCustomerNote(
      req.params.customerId, req.user!.restaurantId, req.user!.id,
      parsed.note, parsed.noteType, parsed.isImportant, req.ip, req.headers['user-agent']
    );
    res.status(201).json({ success: true, data: note });
  } catch (error) {
    if (error instanceof z.ZodError) next(new BadRequestError(error.errors[0].message));
    else next(error);
  }
});

// PATCH /api/customers/:customerId/notes/:noteId
router.patch('/:customerId/notes/:noteId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      note: z.string().min(1),
      noteType: z.enum(['GENERAL', 'PREFERENCE', 'DIETARY', 'ALLERGY', 'SERVICE', 'WARNING']),
      isImportant: z.boolean(),
    });
    const parsed = schema.parse(req.body);
    const note = await customerService.updateCustomerNote(
      req.params.noteId, req.params.customerId, req.user!.restaurantId, req.user!.id,
      parsed.note, parsed.noteType, parsed.isImportant, req.ip, req.headers['user-agent']
    );
    res.json({ success: true, data: note });
  } catch (error) {
    if (error instanceof z.ZodError) next(new BadRequestError(error.errors[0].message));
    else next(error);
  }
});

// DELETE /api/customers/:customerId/notes/:noteId
router.delete('/:customerId/notes/:noteId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await customerService.deleteCustomerNote(
      req.params.noteId, req.params.customerId, req.user!.restaurantId, req.user!.id, req.ip, req.headers['user-agent']
    );
    res.json({ success: true, message: 'Note deleted' });
  } catch (error) { next(error); }
});

export default router;
