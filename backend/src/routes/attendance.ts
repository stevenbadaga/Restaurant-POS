import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../database';
import { requireAuth, requireRole } from '../middleware/auth';
import * as shiftService from '../services/shift.service';
import { createApprovalRequest } from '../services/approval-request.service';
import { BadRequestError, NotFoundError } from '../types';

const router = Router();
router.use(requireAuth);

router.get('/me', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const records = await shiftService.getMyAttendance(
      req.user!.id,
      req.user!.restaurantId,
      req.query.dateFrom as string,
      req.query.dateTo as string
    );
    res.json({ success: true, data: records });
  } catch (error) { next(error); }
});

router.get('/current', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = await shiftService.getMyCurrentStatus(req.user!.id, req.user!.restaurantId);
    res.json({ success: true, data: status });
  } catch (error) { next(error); }
});

router.post('/clock-in', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await shiftService.clockIn(req.user!.id, req.user!.restaurantId, req.ip, req.headers['user-agent']);
    res.json({ success: true, message: 'Clocked in successfully', data: result });
  } catch (error) { next(error); }
});

router.post('/break/start', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await shiftService.startBreak(req.user!.id, req.user!.restaurantId, req.body?.note, req.ip, req.headers['user-agent']);
    res.json({ success: true, message: 'Break started', data: result });
  } catch (error) { next(error); }
});

router.post('/break/end', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await shiftService.endBreak(req.user!.id, req.user!.restaurantId, req.ip, req.headers['user-agent']);
    res.json({ success: true, message: 'Break ended', data: result });
  } catch (error) { next(error); }
});

router.post('/clock-out', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await shiftService.clockOut(req.user!.id, req.user!.restaurantId, req.ip, req.headers['user-agent']);
    res.json({ success: true, message: 'Clocked out', data: result });
  } catch (error) { next(error); }
});

router.get('/', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await shiftService.listAttendance(req.user!.restaurantId, {
      dateFrom: req.query.dateFrom as string,
      dateTo: req.query.dateTo as string,
      userId: req.query.userId as string,
      assignedRole: req.query.assignedRole as string,
      status: req.query.status as string,
      late: req.query.late === 'true',
      missingClockOut: req.query.missingClockOut === 'true',
      overtime: req.query.overtime === 'true',
      page: req.query.page ? parseInt(req.query.page as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
    });
    res.json({ success: true, ...result });
  } catch (error) { next(error); }
});

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

router.post('/:assignmentId/clock-in', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await shiftService.managerClockIn(
      req.params.assignmentId,
      req.user!.restaurantId,
      req.user!.id,
      req.body?.scheduledStartAt,
      req.body?.note,
      req.ip,
      req.headers['user-agent']
    );
    res.json({ success: true, message: 'Manager clock-in completed', data: result });
  } catch (error) { next(error); }
});

router.post('/:assignmentId/clock-out', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await shiftService.managerClockOut(
      req.params.assignmentId,
      req.user!.restaurantId,
      req.user!.id,
      req.body?.clockedOutAt,
      req.body?.note,
      req.ip,
      req.headers['user-agent']
    );
    res.json({ success: true, message: 'Manager clock-out completed', data: result });
  } catch (error) { next(error); }
});

router.post('/:assignmentId/correct', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = z.object({
      clockedInAt: z.string().optional(),
      clockedOutAt: z.string().optional(),
      totalBreakMinutes: z.number().int().min(0).optional(),
      reason: z.string().min(1, 'Reason is required'),
    }).parse(req.body);

    const assignment = await prisma.shiftAssignment.findFirst({
      where: { id: req.params.assignmentId, restaurantId: req.user!.restaurantId },
      select: { user: { select: { firstName: true, lastName: true } } },
    });
    if (!assignment) throw new NotFoundError('Attendance record not found');

    const result = await createApprovalRequest({
      restaurantId: req.user!.restaurantId,
      requestedById: req.user!.id,
      requestType: 'ATTENDANCE_CORRECTION',
      title: `Attendance correction requested: ${assignment.user.firstName} ${assignment.user.lastName}`,
      description: parsed.reason,
      entityType: 'attendance',
      entityId: req.params.assignmentId,
      payload: { assignmentId: req.params.assignmentId, correctionData: parsed },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    res.status(202).json({ success: true, message: 'Attendance correction request submitted for approval', data: result });
  } catch (error) {
    if (error instanceof z.ZodError) next(new BadRequestError(error.errors[0].message));
    else next(error);
  }
});

router.post('/:assignmentId/mark-absent', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { reason } = z.object({ reason: z.string().min(1) }).parse(req.body);
    const result = await shiftService.markAssignmentAbsent(req.params.assignmentId, req.user!.restaurantId, reason, req.user!.id, req.ip, req.headers['user-agent']);
    res.json({ success: true, message: 'Marked absent', data: result });
  } catch (error) {
    if (error instanceof z.ZodError) next(new BadRequestError(error.errors[0].message));
    else next(error);
  }
});

router.post('/:assignmentId/excuse', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { reason } = z.object({ reason: z.string().min(1) }).parse(req.body);
    const result = await shiftService.excuseAbsence(req.params.assignmentId, req.user!.restaurantId, reason, req.user!.id, req.ip, req.headers['user-agent']);
    res.json({ success: true, message: 'Absence excused', data: result });
  } catch (error) {
    if (error instanceof z.ZodError) next(new BadRequestError(error.errors[0].message));
    else next(error);
  }
});

export default router;
