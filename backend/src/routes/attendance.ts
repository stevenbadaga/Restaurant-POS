import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../database';
import { requireAuth, requireRole } from '../middleware/auth';
import * as shiftService from '../services/shift.service';
import { BadRequestError, NotFoundError } from '../types';

const router = Router();
router.use(requireAuth);

// ==========================================
// EMPLOYEE SELF-SERVICE
// ==========================================

// GET /api/attendance/me
router.get('/me', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { dateFrom, dateTo } = req.query;
    const records = await shiftService.getMyAttendance(
      req.user!.id,
      req.user!.restaurantId,
      dateFrom as string,
      dateTo as string
    );
    res.json({ success: true, data: records });
  } catch (error) { next(error); }
});

// GET /api/attendance/current
router.get('/current', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = await shiftService.getMyCurrentStatus(req.user!.id, req.user!.restaurantId);
    res.json({ success: true, data: status });
  } catch (error) { next(error); }
});

// POST /api/attendance/clock-in
router.post('/clock-in', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await shiftService.clockIn(
      req.user!.id,
      req.user!.restaurantId,
      req.ip,
      req.headers['user-agent']
    );
    res.json({ success: true, message: 'Clocked in successfully', data: result });
  } catch (error) { next(error); }
});

// POST /api/attendance/break/start
router.post('/break/start', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { note } = req.body || {};
    const result = await shiftService.startBreak(
      req.user!.id,
      req.user!.restaurantId,
      note,
      req.ip,
      req.headers['user-agent']
    );
    res.json({ success: true, message: 'Break started', data: result });
  } catch (error) { next(error); }
});

// POST /api/attendance/break/end
router.post('/break/end', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await shiftService.endBreak(
      req.user!.id,
      req.user!.restaurantId,
      req.ip,
      req.headers['user-agent']
    );
    res.json({ success: true, message: 'Break ended', data: result });
  } catch (error) { next(error); }
});

// POST /api/attendance/clock-out
router.post('/clock-out', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await shiftService.clockOut(
      req.user!.id,
      req.user!.restaurantId,
      req.ip,
      req.headers['user-agent']
    );
    res.json({ success: true, message: 'Clocked out', data: result });
  } catch (error) { next(error); }
});

// ==========================================
// MANAGER ENDPOINTS
// ==========================================

// GET /api/attendance
router.get('/', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      dateFrom, dateTo, userId, assignedRole,
      status, late, missingClockOut, overtime,
      page, limit
    } = req.query;

    const result = await shiftService.listAttendance(req.user!.restaurantId, {
      dateFrom: dateFrom as string,
      dateTo: dateTo as string,
      userId: userId as string,
      assignedRole: assignedRole as string,
      status: status as string,
      late: late === 'true',
      missingClockOut: missingClockOut === 'true',
      overtime: overtime === 'true',
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });

    res.json({ success: true, ...result });
  } catch (error) { next(error); }
});

// GET /api/attendance/:assignmentId
router.get('/:assignmentId', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const assignment = await prisma.shiftAssignment.findFirst({
      where: { id: req.params.assignmentId, restaurantId: req.user!.restaurantId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
        workShift: { select: { nameSnapshot: true, businessDate: true } },
        employeeBreaks: { orderBy: { startedAt: 'asc' } },
        attendanceEvents: { orderBy: { eventAt: 'asc' } },
      },
    });
    if (!assignment) throw new NotFoundError('Attendance record not found');
    res.json({ success: true, data: assignment });
  } catch (error) { next(error); }
});

// POST /api/attendance/:assignmentId/clock-in
router.post('/:assignmentId/clock-in', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { scheduledStartAt, note } = req.body || {};
    const result = await shiftService.managerClockIn(
      req.params.assignmentId,
      req.user!.restaurantId,
      req.user!.id,
      scheduledStartAt,
      note,
      req.ip,
      req.headers['user-agent']
    );
    res.json({ success: true, message: 'Manager clock-in completed', data: result });
  } catch (error) { next(error); }
});

// POST /api/attendance/:assignmentId/clock-out
router.post('/:assignmentId/clock-out', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { clockedOutAt, note } = req.body || {};
    const result = await shiftService.managerClockOut(
      req.params.assignmentId,
      req.user!.restaurantId,
      req.user!.id,
      clockedOutAt,
      note,
      req.ip,
      req.headers['user-agent']
    );
    res.json({ success: true, message: 'Manager clock-out completed', data: result });
  } catch (error) { next(error); }
});

// POST /api/attendance/:assignmentId/correct
router.post('/:assignmentId/correct', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      clockedInAt: z.string().optional(),
      clockedOutAt: z.string().optional(),
      totalBreakMinutes: z.number().int().min(0).optional(),
      reason: z.string().min(1, 'Reason is required'),
    });

    const parsed = schema.parse(req.body);
    const result = await shiftService.correctAttendance(
      req.params.assignmentId,
      req.user!.restaurantId,
      parsed,
      req.user!.id,
      req.ip,
      req.headers['user-agent']
    );
    res.json({ success: true, message: 'Attendance corrected', data: result });
  } catch (error) {
    if (error instanceof z.ZodError) next(new BadRequestError(error.errors[0].message));
    else next(error);
  }
});

// POST /api/attendance/:assignmentId/mark-absent
router.post('/:assignmentId/mark-absent', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { reason } = z.object({ reason: z.string().min(1) }).parse(req.body);
    const result = await shiftService.markAssignmentAbsent(
      req.params.assignmentId,
      req.user!.restaurantId,
      reason,
      req.user!.id,
      req.ip,
      req.headers['user-agent']
    );
    res.json({ success: true, message: 'Marked absent', data: result });
  } catch (error) {
    if (error instanceof z.ZodError) next(new BadRequestError(error.errors[0].message));
    else next(error);
  }
});

// POST /api/attendance/:assignmentId/excuse
router.post('/:assignmentId/excuse', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { reason } = z.object({ reason: z.string().min(1) }).parse(req.body);
    const result = await shiftService.excuseAbsence(
      req.params.assignmentId,
      req.user!.restaurantId,
      reason,
      req.user!.id,
      req.ip,
      req.headers['user-agent']
    );
    res.json({ success: true, message: 'Absence excused', data: result });
  } catch (error) {
    if (error instanceof z.ZodError) next(new BadRequestError(error.errors[0].message));
    else next(error);
  }
});

export default router;
