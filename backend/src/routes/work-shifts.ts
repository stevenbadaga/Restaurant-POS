import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../database';
import { requireAuth, requireRole } from '../middleware/auth';
import * as shiftService from '../services/shift.service';
import { BadRequestError } from '../types';

const router = Router();
router.use(requireAuth);

const createShiftSchema = z.object({
  shiftTemplateId: z.string().optional(),
  name: z.string().min(1, 'Name is required'),
  code: z.string().min(1, 'Code is required'),
  businessDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  scheduledStartAt: z.string().min(1, 'Start time is required'),
  scheduledEndAt: z.string().min(1, 'End time is required'),
  notes: z.string().optional(),
  assignments: z.array(z.object({
    userId: z.string(),
    assignedRoleName: z.string(),
    scheduledStartAt: z.string().optional(),
    scheduledEndAt: z.string().optional(),
  })).optional(),
});

const assignmentSchema = z.object({
  userId: z.string(),
  assignedRoleName: z.string(),
  scheduledStartAt: z.string().optional(),
  scheduledEndAt: z.string().optional(),
});

// GET /api/shifts
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      businessDate, dateFrom, dateTo, status, templateId,
      userId, assignedRole, page, limit, sortBy, sortOrder
    } = req.query;

    const result = await shiftService.listWorkShifts(req.user!.restaurantId, {
      businessDate: businessDate as string,
      dateFrom: dateFrom as string,
      dateTo: dateTo as string,
      status: status as string,
      templateId: templateId as string,
      userId: userId as string,
      assignedRole: assignedRole as string,
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      sortBy: sortBy as string,
      sortOrder: sortOrder as string,
    });

    res.json({ success: true, ...result });
  } catch (error) { next(error); }
});

// GET /api/shifts/current
router.get('/current', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shift = await shiftService.getCurrentShift(req.user!.restaurantId);
    res.json({ success: true, data: shift || null });
  } catch (error) { next(error); }
});

// GET /api/shifts/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shift = await shiftService.getWorkShiftDetail(req.params.id, req.user!.restaurantId);
    res.json({ success: true, data: shift });
  } catch (error) { next(error); }
});

// POST /api/shifts
router.post('/', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = createShiftSchema.parse(req.body);
    const result = await shiftService.createWorkShift(
      req.user!.restaurantId,
      parsed,
      req.user!.id,
      req.ip,
      req.headers['user-agent']
    );
    res.status(201).json({ success: true, message: 'Shift created', data: result });
  } catch (error) {
    if (error instanceof z.ZodError) next(new BadRequestError(error.errors[0].message));
    else next(error);
  }
});

// PATCH /api/shifts/:id
router.patch('/:id', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = createShiftSchema.partial().parse(req.body);
    const updateData: any = {
      shiftTemplateId: parsed.shiftTemplateId,
      name: parsed.name,
      code: parsed.code,
      businessDate: parsed.businessDate,
      notes: parsed.notes,
      scheduledStartAt: parsed.scheduledStartAt ? new Date(parsed.scheduledStartAt) : undefined,
      scheduledEndAt: parsed.scheduledEndAt ? new Date(parsed.scheduledEndAt) : undefined,
    };
    // Remove undefined fields
    Object.keys(updateData).forEach((key) => updateData[key] === undefined && delete updateData[key]);
    
    const result = await prisma.workShift.update({
      where: { id: req.params.id },
      data: updateData,
    });
    res.json({ success: true, message: 'Shift updated', data: result });
  } catch (error) {
    if (error instanceof z.ZodError) next(new BadRequestError(error.errors[0].message));
    else next(error);
  }
});

// POST /api/shifts/:id/publish
router.post('/:id/publish', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await shiftService.publishShift(
      req.params.id, req.user!.restaurantId, req.user!.id,
      req.ip, req.headers['user-agent']
    );
    res.json({ success: true, message: 'Shift published', data: result });
  } catch (error) { next(error); }
});

// POST /api/shifts/:id/open
router.post('/:id/open', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await shiftService.openShift(
      req.params.id, req.user!.restaurantId, req.user!.id,
      req.ip, req.headers['user-agent']
    );
    res.json({ success: true, message: 'Shift opened', data: result });
  } catch (error) { next(error); }
});

// POST /api/shifts/:id/begin-closing
router.post('/:id/begin-closing', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await shiftService.beginShiftClosing(
      req.params.id, req.user!.restaurantId, req.user!.id,
      req.ip, req.headers['user-agent']
    );
    res.json({ success: true, message: 'Shift closing started', ...result });
  } catch (error) { next(error); }
});

// POST /api/shifts/:id/close
router.post('/:id/close', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { force } = req.body || {};
    const result = await shiftService.closeShift(
      req.params.id, req.user!.restaurantId, req.user!.id, force,
      req.ip, req.headers['user-agent']
    );
    res.json({ success: true, message: 'Shift closed', data: result });
  } catch (error) { next(error); }
});

// POST /api/shifts/:id/cancel
router.post('/:id/cancel', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { reason } = z.object({ reason: z.string().min(1) }).parse(req.body);
    const result = await shiftService.cancelShift(
      req.params.id, req.user!.restaurantId, reason, req.user!.id,
      req.ip, req.headers['user-agent']
    );
    res.json({ success: true, message: 'Shift cancelled', data: result });
  } catch (error) {
    if (error instanceof z.ZodError) next(new BadRequestError(error.errors[0].message));
    else next(error);
  }
});

// === Assignments ===

// GET /api/shifts/:shiftId/assignments
router.get('/:shiftId/assignments', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shiftId = req.params.shiftId;
    const assignments = await prisma.shiftAssignment.findMany({
      where: { workShiftId: shiftId, restaurantId: req.user!.restaurantId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
      },
      orderBy: { scheduledStartAt: 'asc' },
    });
    res.json({ success: true, data: assignments });
  } catch (error) { next(error); }
});

// POST /api/shifts/:shiftId/assignments
router.post('/:shiftId/assignments', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = assignmentSchema.parse(req.body);
    const result = await shiftService.addShiftAssignment(
      req.params.shiftId, req.user!.restaurantId, parsed.userId, parsed.assignedRoleName,
      parsed.scheduledStartAt, parsed.scheduledEndAt, req.user!.id,
      req.ip, req.headers['user-agent']
    );
    res.status(201).json({ success: true, message: 'Employee assigned', data: result });
  } catch (error) {
    if (error instanceof z.ZodError) next(new BadRequestError(error.errors[0].message));
    else next(error);
  }
});

// PATCH /api/shifts/:shiftId/assignments/:assignmentId
router.patch('/:shiftId/assignments/:assignmentId', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = assignmentSchema.partial().parse(req.body);
    const updateData: any = {};
    if (parsed.assignedRoleName) updateData.assignedRoleName = parsed.assignedRoleName;
    if (parsed.scheduledStartAt) updateData.scheduledStartAt = new Date(parsed.scheduledStartAt);
    if (parsed.scheduledEndAt) updateData.scheduledEndAt = new Date(parsed.scheduledEndAt);

    const updated = await prisma.shiftAssignment.update({
      where: { id: req.params.assignmentId },
      data: updateData,
    });
    res.json({ success: true, message: 'Assignment updated', data: updated });
  } catch (error) {
    if (error instanceof z.ZodError) next(new BadRequestError(error.errors[0].message));
    else next(error);
  }
});

// DELETE /api/shifts/:shiftId/assignments/:assignmentId
router.delete('/:shiftId/assignments/:assignmentId', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await shiftService.removeShiftAssignment(
      req.params.assignmentId, req.user!.restaurantId, req.user!.id,
      req.ip, req.headers['user-agent']
    );
    res.json({ success: true, message: 'Assignment removed' });
  } catch (error) { next(error); }
});

// POST /api/shifts/:shiftId/assignments/:assignmentId/mark-absent
router.post('/:shiftId/assignments/:assignmentId/mark-absent', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { reason } = z.object({ reason: z.string().min(1) }).parse(req.body);
    const result = await shiftService.markAssignmentAbsent(
      req.params.assignmentId, req.user!.restaurantId, reason, req.user!.id,
      req.ip, req.headers['user-agent']
    );
    res.json({ success: true, message: 'Marked absent', data: result });
  } catch (error) {
    if (error instanceof z.ZodError) next(new BadRequestError(error.errors[0].message));
    else next(error);
  }
});

// POST /api/shifts/:shiftId/assignments/:assignmentId/excuse
router.post('/:shiftId/assignments/:assignmentId/excuse', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { reason } = z.object({ reason: z.string().min(1) }).parse(req.body);
    const result = await shiftService.excuseAbsence(
      req.params.assignmentId, req.user!.restaurantId, reason, req.user!.id,
      req.ip, req.headers['user-agent']
    );
    res.json({ success: true, message: 'Absence excused', data: result });
  } catch (error) {
    if (error instanceof z.ZodError) next(new BadRequestError(error.errors[0].message));
    else next(error);
  }
});

export default router;
