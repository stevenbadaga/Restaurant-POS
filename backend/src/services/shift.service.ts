import { prisma } from '../database';
import { BadRequestError, NotFoundError, ForbiddenError } from '../types';
import { createAuditLog } from './audit.service';

// ==========================================
// SHIFT TEMPLATES
// ==========================================

interface CreateTemplateInput {
  name: string;
  code: string;
  description?: string;
  startTime: string;
  endTime: string;
  crossesMidnight?: boolean;
  defaultBreakMinutes?: number;
  lateGraceMinutes?: number;
  earlyDepartureToleranceMinutes?: number;
  overtimeThresholdMinutes?: number;
  colorKey?: string;
}

async function validateTemplateUniqueness(
  restaurantId: string,
  name: string,
  code: string,
  excludeId?: string
): Promise<void> {
  const where: any = {
    restaurantId,
    OR: [{ name }, { code }],
  };
  if (excludeId) where.id = { not: excludeId };

  const existing = await prisma.shiftTemplate.findFirst({ where });
  if (existing) {
    const conflict = existing.name === name ? 'Name' : 'Code';
    throw new BadRequestError(`Shift template ${conflict.toLowerCase()} already exists`);
  }
}

export async function createShiftTemplate(
  restaurantId: string,
  input: CreateTemplateInput,
  userId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<any> {
  await validateTemplateUniqueness(restaurantId, input.name, input.code);

  const template = await prisma.shiftTemplate.create({
    data: {
      restaurantId,
      ...input,
      defaultBreakMinutes: input.defaultBreakMinutes ?? 0,
      lateGraceMinutes: input.lateGraceMinutes ?? 10,
      earlyDepartureToleranceMinutes: input.earlyDepartureToleranceMinutes ?? 10,
      overtimeThresholdMinutes: input.overtimeThresholdMinutes ?? 30,
    },
  });

  await createAuditLog({
    restaurantId,
    userId,
    action: 'SHIFT_TEMPLATE_CREATED',
    entityType: 'ShiftTemplate',
    entityId: template.id,
    description: `Shift template "${template.name}" created`,
    metadata: { code: template.code, startTime: template.startTime, endTime: template.endTime },
    ipAddress,
    userAgent,
  });

  return template;
}

export async function updateShiftTemplate(
  templateId: string,
  restaurantId: string,
  input: Partial<CreateTemplateInput>,
  userId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<any> {
  const template = await prisma.shiftTemplate.findFirst({
    where: { id: templateId, restaurantId },
  });
  if (!template) throw new NotFoundError('Shift template not found');

  if (input.name || input.code) {
    await validateTemplateUniqueness(
      restaurantId,
      input.name || template.name,
      input.code || template.code,
      templateId
    );
  }

  const updated = await prisma.shiftTemplate.update({
    where: { id: templateId },
    data: input,
  });

  await createAuditLog({
    restaurantId,
    userId,
    action: 'SHIFT_TEMPLATE_UPDATED',
    entityType: 'ShiftTemplate',
    entityId: templateId,
    description: `Shift template "${template.name}" updated`,
    metadata: { changes: Object.keys(input) },
    ipAddress,
    userAgent,
  });

  return updated;
}

export async function deactivateShiftTemplate(
  templateId: string,
  restaurantId: string,
  isActive: boolean,
  userId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  const result = await prisma.shiftTemplate.updateMany({
    where: { id: templateId, restaurantId },
    data: { isActive },
  });
  if (result.count === 0) throw new NotFoundError('Shift template not found');

  await createAuditLog({
    restaurantId,
    userId,
    action: isActive ? 'SHIFT_TEMPLATE_ACTIVATED' : 'SHIFT_TEMPLATE_DEACTIVATED',
    entityType: 'ShiftTemplate',
    entityId: templateId,
    description: `Shift template ${isActive ? 'activated' : 'deactivated'}`,
    ipAddress,
    userAgent,
  });
}

export async function listShiftTemplates(
  restaurantId: string,
  isActive?: boolean,
  search?: string
): Promise<any[]> {
  const where: any = { restaurantId };
  if (isActive !== undefined) where.isActive = isActive;
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { code: { contains: search, mode: 'insensitive' } },
    ];
  }

  const templates = await prisma.shiftTemplate.findMany({
    where,
    orderBy: { startTime: 'asc' },
    include: {
      _count: { select: { workShifts: true } },
    },
  });

  return templates;
}

// ==========================================
// WORK SHIFTS
// ==========================================

interface CreateWorkShiftInput {
  shiftTemplateId?: string;
  name: string;
  code: string;
  businessDate: string;
  scheduledStartAt: string;
  scheduledEndAt: string;
  notes?: string;
  assignments?: {
    userId: string;
    assignedRoleName: string;
    scheduledStartAt?: string;
    scheduledEndAt?: string;
  }[];
}

export async function createWorkShift(
  restaurantId: string,
  input: CreateWorkShiftInput,
  userId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<any> {
  // If using template, snapshot its values
  const nameSnapshot = input.name;
  const codeSnapshot = input.code;

  if (input.shiftTemplateId) {
    const template = await prisma.shiftTemplate.findFirst({
      where: { id: input.shiftTemplateId, restaurantId },
    });
    if (!template) throw new BadRequestError('Shift template not found');
  }

  // Validate business date
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.businessDate)) {
    throw new BadRequestError('Business date must be in YYYY-MM-DD format');
  }

  const result = await prisma.$transaction(async (tx) => {
    const shift = await tx.workShift.create({
      data: {
        restaurantId,
        shiftTemplateId: input.shiftTemplateId || null,
        nameSnapshot: input.name,
        codeSnapshot: input.code,
        businessDate: input.businessDate,
        scheduledStartAt: new Date(input.scheduledStartAt),
        scheduledEndAt: new Date(input.scheduledEndAt),
        status: 'DRAFT',
        notes: input.notes || null,
        createdById: userId,
      },
    });

    // Create assignments if provided
    if (input.assignments && input.assignments.length > 0) {
      for (const assignment of input.assignments) {
        // Validate user belongs to restaurant
        const user = await tx.user.findFirst({
          where: { id: assignment.userId, restaurantId },
        });
        if (!user) {
          throw new BadRequestError(`User ${assignment.userId} not found in this restaurant`);
        }
        if (user.status !== 'ACTIVE') {
          throw new BadRequestError(`User ${user.firstName} ${user.lastName} is not active`);
        }

        await tx.shiftAssignment.create({
          data: {
            restaurantId,
            workShiftId: shift.id,
            userId: assignment.userId,
            assignedRoleName: assignment.assignedRoleName,
            status: 'SCHEDULED',
            scheduledStartAt: assignment.scheduledStartAt
              ? new Date(assignment.scheduledStartAt)
              : shift.scheduledStartAt,
            scheduledEndAt: assignment.scheduledEndAt
              ? new Date(assignment.scheduledEndAt)
              : shift.scheduledEndAt,
          },
        });
      }
    }

    return shift;
  });

  await createAuditLog({
    restaurantId,
    userId,
    action: 'SHIFT_SCHEDULED',
    entityType: 'WorkShift',
    entityId: result.id,
    description: `Shift "${result.nameSnapshot}" created for ${input.businessDate}`,
    metadata: {
      businessDate: input.businessDate,
      assignmentCount: input.assignments?.length || 0,
    },
    ipAddress,
    userAgent,
  });

  return await getWorkShiftDetail(result.id, restaurantId);
}

export async function getWorkShiftDetail(
  shiftId: string,
  restaurantId: string
): Promise<any> {
  const shift = await prisma.workShift.findFirst({
    where: { id: shiftId, restaurantId },
    include: {
      assignments: {
        include: {
          user: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
        },
        orderBy: { scheduledStartAt: 'asc' },
      },
      handovers: {
        orderBy: { createdAt: 'desc' },
      },
      openedBy: { select: { id: true, firstName: true, lastName: true } },
      closedBy: { select: { id: true, firstName: true, lastName: true } },
      cancelledBy: { select: { id: true, firstName: true, lastName: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  if (!shift) throw new NotFoundError('Shift not found');

  return shift;
}

interface ListWorkShiftFilters {
  businessDate?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  templateId?: string;
  userId?: string;
  assignedRole?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: string;
}

export async function listWorkShifts(
  restaurantId: string,
  filters: ListWorkShiftFilters = {}
): Promise<any> {
  const page = filters.page || 1;
  const limit = Math.min(filters.limit || 20, 100);
  const skip = (page - 1) * limit;

  const where: any = { restaurantId };

  if (filters.businessDate) {
    where.businessDate = filters.businessDate;
  } else {
    if (filters.dateFrom) {
      where.businessDate = { ...(where.businessDate || {}), gte: filters.dateFrom };
    }
    if (filters.dateTo) {
      where.businessDate = { ...(where.businessDate || {}), lte: filters.dateTo };
    }
  }

  if (filters.status) where.status = filters.status;
  if (filters.templateId) where.shiftTemplateId = filters.templateId;
  if (filters.userId || filters.assignedRole) {
    where.assignments = {};
    if (filters.userId) where.assignments.some = { userId: filters.userId };
    if (filters.assignedRole) where.assignments.some = { assignedRoleName: filters.assignedRole };
  }

  const orderBy: any = {};
  orderBy[filters.sortBy || 'scheduledStartAt'] = filters.sortOrder || 'desc';

  const [shifts, total] = await Promise.all([
    prisma.workShift.findMany({
      where,
      include: {
        _count: {
          select: {
            assignments: true,
            handovers: true,
          },
        },
        assignments: {
          where: { status: { notIn: ['CANCELLED'] } },
          select: {
            id: true,
            assignedRoleName: true,
            status: true,
            clockedInAt: true,
            clockedOutAt: true,
            user: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
      orderBy,
      skip,
      take: limit,
    }),
    prisma.workShift.count({ where }),
  ]);

  return {
    shifts: shifts.map((s: any) => ({
      id: s.id,
      name: s.nameSnapshot,
      code: s.codeSnapshot,
      businessDate: s.businessDate,
      scheduledStartAt: s.scheduledStartAt,
      scheduledEndAt: s.scheduledEndAt,
      status: s.status,
      assignmentCount: s._count.assignments,
      handoverCount: s._count.handovers,
      clockedIn: s.assignments.filter((a: any) => a.status === 'CLOCKED_IN' || a.status === 'ON_BREAK').length,
      clockedOut: s.assignments.filter((a: any) => a.status === 'CLOCKED_OUT').length,
      absent: s.assignments.filter((a: any) => a.status === 'ABSENT').length,
      roles: [...new Set(s.assignments.map((a: any) => a.assignedRoleName))],
      createdAt: s.createdAt,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getCurrentShift(restaurantId: string): Promise<any> {
  const today = new Date().toISOString().split('T')[0];
  const shift = await prisma.workShift.findFirst({
    where: {
      restaurantId,
      businessDate: today,
      status: { in: ['SCHEDULED', 'OPEN'] },
    },
    include: {
      _count: { select: { assignments: true } },
      assignments: {
        where: { status: { notIn: ['CANCELLED', 'ABSENT'] } },
        include: {
          user: { select: { id: true, firstName: true, lastName: true } },
        },
      },
    },
    orderBy: { scheduledStartAt: 'asc' },
  });

  return shift || null;
}

export async function publishShift(
  shiftId: string,
  restaurantId: string,
  userId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<any> {
  const shift = await prisma.workShift.findFirst({
    where: { id: shiftId, restaurantId },
  });
  if (!shift) throw new NotFoundError('Shift not found');
  if (shift.status !== 'DRAFT') throw new BadRequestError('Only draft shifts can be published');

  const updated = await prisma.workShift.update({
    where: { id: shiftId },
    data: { status: 'SCHEDULED' },
  });

  await createAuditLog({
    restaurantId,
    userId,
    action: 'SHIFT_PUBLISHED',
    entityType: 'WorkShift',
    entityId: shiftId,
    description: `Shift "${shift.nameSnapshot}" published for ${shift.businessDate}`,
    metadata: { businessDate: shift.businessDate },
    ipAddress,
    userAgent,
  });

  return updated;
}

export async function openShift(
  shiftId: string,
  restaurantId: string,
  userId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<any> {
  const shift = await prisma.workShift.findFirst({
    where: { id: shiftId, restaurantId },
  });
  if (!shift) throw new NotFoundError('Shift not found');
  if (shift.status !== 'SCHEDULED') throw new BadRequestError('Only scheduled shifts can be opened');

  const updated = await prisma.workShift.update({
    where: { id: shiftId },
    data: {
      status: 'OPEN',
      openedAt: new Date(),
      openedById: userId,
    },
  });

  await createAuditLog({
    restaurantId,
    userId,
    action: 'SHIFT_OPENED',
    entityType: 'WorkShift',
    entityId: shiftId,
    description: `Shift "${shift.nameSnapshot}" opened`,
    ipAddress,
    userAgent,
  });

  return updated;
}

export async function beginShiftClosing(
  shiftId: string,
  restaurantId: string,
  userId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<any> {
  const shift = await prisma.workShift.findFirst({
    where: { id: shiftId, restaurantId },
    include: { assignments: true },
  });
  if (!shift) throw new NotFoundError('Shift not found');
  if (shift.status !== 'OPEN') throw new BadRequestError('Only open shifts can begin closing');

  // Check for unresolved issues
  const openSessions = await prisma.cashierSession.count({
    where: {
      restaurantId,
      workShiftId: shiftId,
      status: { in: ['OPEN', 'CLOSING'] },
    },
  });

  const uncheckedOut = shift.assignments.filter(
    (a) => a.status !== 'CLOCKED_OUT' && a.status !== 'ABSENT' && a.status !== 'EXCUSED' && a.status !== 'CANCELLED'
  ).length;

  const warnings: string[] = [];
  if (openSessions > 0) warnings.push(`${openSessions} cashier session(s) still open`);
  if (uncheckedOut > 0) warnings.push(`${uncheckedOut} employee(s) not clocked out`);

  const updated = await prisma.workShift.update({
    where: { id: shiftId },
    data: {
      status: 'CLOSING',
      closingStartedAt: new Date(),
    },
  });

  await createAuditLog({
    restaurantId,
    userId,
    action: 'SHIFT_CLOSING_STARTED',
    entityType: 'WorkShift',
    entityId: shiftId,
    description: `Shift "${shift.nameSnapshot}" closing started`,
    metadata: { warnings },
    ipAddress,
    userAgent,
  });

  return { shift: updated, warnings };
}

export async function closeShift(
  shiftId: string,
  restaurantId: string,
  userId: string,
  force?: boolean,
  ipAddress?: string,
  userAgent?: string
): Promise<any> {
  const shift = await prisma.workShift.findFirst({
    where: { id: shiftId, restaurantId },
    include: { assignments: true },
  });
  if (!shift) throw new NotFoundError('Shift not found');
  if (shift.status !== 'CLOSING' && !force) throw new BadRequestError('Shift must be in CLOSING status');

  // Check for unresolved sessions
  const openSessions = await prisma.cashierSession.count({
    where: {
      restaurantId,
      workShiftId: shiftId,
      status: { in: ['OPEN', 'CLOSING', 'PENDING_APPROVAL'] },
    },
  });

  if (openSessions > 0 && !force) {
    throw new BadRequestError(
      `${openSessions} cashier session(s) must be closed before closing the shift`
    );
  }

  const updated = await prisma.workShift.update({
    where: { id: shiftId },
    data: {
      status: 'CLOSED',
      closedAt: new Date(),
      closedById: userId,
    },
  });

  await createAuditLog({
    restaurantId,
    userId,
    action: 'SHIFT_CLOSED',
    entityType: 'WorkShift',
    entityId: shiftId,
    description: `Shift "${shift.nameSnapshot}" closed`,
    metadata: { forceClosed: !!force },
    ipAddress,
    userAgent,
  });

  return updated;
}

export async function cancelShift(
  shiftId: string,
  restaurantId: string,
  reason: string,
  userId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<any> {
  const shift = await prisma.workShift.findFirst({
    where: { id: shiftId, restaurantId },
  });
  if (!shift) throw new NotFoundError('Shift not found');
  if (shift.status === 'CLOSED') throw new BadRequestError('Cannot cancel a closed shift');
  if (shift.status === 'CANCELLED') throw new BadRequestError('Shift is already cancelled');

  const updated = await prisma.workShift.update({
    where: { id: shiftId },
    data: {
      status: 'CANCELLED',
      cancellationReason: reason,
      cancelledAt: new Date(),
      cancelledById: userId,
    },
  });

  await createAuditLog({
    restaurantId,
    userId,
    action: 'SHIFT_CANCELLED',
    entityType: 'WorkShift',
    entityId: shiftId,
    description: `Shift "${shift.nameSnapshot}" cancelled: ${reason}`,
    metadata: { reason, businessDate: shift.businessDate },
    ipAddress,
    userAgent,
  });

  return updated;
}

// ==========================================
// SHIFT ASSIGNMENTS
// ==========================================

export async function addShiftAssignment(
  shiftId: string,
  restaurantId: string,
  userId: string,
  assignedRoleName: string,
  scheduledStartAt?: string,
  scheduledEndAt?: string,
  actorUserId?: string,
  ipAddress?: string,
  userAgent?: string
): Promise<any> {
  const shift = await prisma.workShift.findFirst({
    where: { id: shiftId, restaurantId },
  });
  if (!shift) throw new NotFoundError('Shift not found');
  if (shift.status === 'CLOSED' || shift.status === 'CANCELLED') {
    throw new BadRequestError('Cannot modify a closed or cancelled shift');
  }

  // Validate user
  const user = await prisma.user.findFirst({
    where: { id: userId, restaurantId },
  });
  if (!user) throw new BadRequestError('User not found in this restaurant');
  if (user.status !== 'ACTIVE') throw new BadRequestError('User is not active');

  // Check for duplicate
  const existing = await prisma.shiftAssignment.findFirst({
    where: { workShiftId: shiftId, userId, assignedRoleName },
  });
  if (existing) throw new BadRequestError('Employee already assigned to this role in this shift');

  // Check for overlap
  const assignmentStart = scheduledStartAt ? new Date(scheduledStartAt) : shift.scheduledStartAt;
  const assignmentEnd = scheduledEndAt ? new Date(scheduledEndAt) : shift.scheduledEndAt;

  const overlapping = await prisma.shiftAssignment.findFirst({
    where: {
      userId,
      status: { notIn: ['CANCELLED'] },
      scheduledStartAt: { lt: assignmentEnd },
      scheduledEndAt: { gt: assignmentStart },
    },
  });

  if (overlapping) {
    throw new BadRequestError('Assignment overlaps with another existing assignment');
  }

  const assignment = await prisma.shiftAssignment.create({
    data: {
      restaurantId,
      workShiftId: shiftId,
      userId,
      assignedRoleName,
      status: 'SCHEDULED',
      scheduledStartAt: assignmentStart,
      scheduledEndAt: assignmentEnd,
    },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
    },
  });

  await createAuditLog({
    restaurantId,
    userId: actorUserId || userId,
    action: 'EMPLOYEE_ASSIGNED',
    entityType: 'ShiftAssignment',
    entityId: assignment.id,
    description: `${user.firstName} ${user.lastName} assigned as ${assignedRoleName}`,
    metadata: { shiftId, assignedRoleName },
    ipAddress,
    userAgent,
  });

  return assignment;
}

export async function removeShiftAssignment(
  assignmentId: string,
  restaurantId: string,
  actorUserId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  const assignment = await prisma.shiftAssignment.findFirst({
    where: { id: assignmentId, restaurantId },
    include: { workShift: true, user: { select: { firstName: true, lastName: true } } },
  });
  if (!assignment) throw new NotFoundError('Assignment not found');

  if (assignment.workShift.status === 'CLOSED' || assignment.workShift.status === 'CANCELLED') {
    throw new BadRequestError('Cannot modify a closed or cancelled shift');
  }

  if (assignment.status !== 'SCHEDULED') {
    throw new BadRequestError('Cannot remove an assignment that has started');
  }

  await prisma.shiftAssignment.delete({ where: { id: assignmentId } });

  await createAuditLog({
    restaurantId,
    userId: actorUserId,
    action: 'EMPLOYEE_UNASSIGNED',
    entityType: 'ShiftAssignment',
    entityId: assignmentId,
    description: `${assignment.user.firstName} ${assignment.user.lastName} removed from shift`,
    metadata: { shiftId: assignment.workShiftId },
    ipAddress,
    userAgent,
  });
}

export async function markAssignmentAbsent(
  assignmentId: string,
  restaurantId: string,
  reason: string,
  actorUserId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<any> {
  const assignment = await prisma.shiftAssignment.findFirst({
    where: { id: assignmentId, restaurantId },
    include: { user: { select: { firstName: true, lastName: true } } },
  });
  if (!assignment) throw new NotFoundError('Assignment not found');
  if (assignment.status !== 'SCHEDULED') {
    throw new BadRequestError('Only scheduled assignments can be marked absent');
  }

  const updated = await prisma.shiftAssignment.update({
    where: { id: assignmentId },
    data: {
      status: 'ABSENT',
      absenceReason: reason,
    },
  });

  await createAuditLog({
    restaurantId,
    userId: actorUserId,
    action: 'EMPLOYEE_MARKED_ABSENT',
    entityType: 'ShiftAssignment',
    entityId: assignmentId,
    description: `${assignment.user.firstName} ${assignment.user.lastName} marked absent: ${reason}`,
    metadata: { reason },
    ipAddress,
    userAgent,
  });

  return updated;
}

export async function excuseAbsence(
  assignmentId: string,
  restaurantId: string,
  reason: string,
  actorUserId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<any> {
  const assignment = await prisma.shiftAssignment.findFirst({
    where: { id: assignmentId, restaurantId },
    include: { user: { select: { firstName: true, lastName: true } } },
  });
  if (!assignment) throw new NotFoundError('Assignment not found');
  if (assignment.status !== 'ABSENT') {
    throw new BadRequestError('Only absent assignments can be excused');
  }

  const updated = await prisma.shiftAssignment.update({
    where: { id: assignmentId },
    data: {
      status: 'EXCUSED',
      absenceReason: reason,
    },
  });

  await createAuditLog({
    restaurantId,
    userId: actorUserId,
    action: 'ABSENCE_EXCUSED',
    entityType: 'ShiftAssignment',
    entityId: assignmentId,
    description: `${assignment.user.firstName} ${assignment.user.lastName} absence excused: ${reason}`,
    metadata: { reason },
    ipAddress,
    userAgent,
  });

  return updated;
}

// ==========================================
// ATTENDANCE — CLOCK IN
// ==========================================

export async function clockIn(
  userId: string,
  restaurantId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<any> {
  const settings = await prisma.restaurantSettings.findUnique({ where: { restaurantId } });

  // Find today's assignments
  const today = new Date().toISOString().split('T')[0];
  const assignments = await prisma.shiftAssignment.findMany({
    where: {
      userId,
      workShift: {
        restaurantId,
        businessDate: today,
      },
      status: { notIn: ['CANCELLED', 'ABSENT', 'EXCUSED', 'CLOCKED_OUT'] },
    },
    include: {
      workShift: {
        include: {
          shiftTemplate: true,
        },
      },
    },
  });

  if (assignments.length === 0) {
    // Check unscheduled clock-in
    if (!settings?.allowUnscheduledClockIn) {
      throw new BadRequestError('No scheduled assignment found and unscheduled clock-in is not allowed');
    }

    // Find or create an open shift for today
    let shift = await prisma.workShift.findFirst({
      where: { restaurantId, businessDate: today, status: { in: ['SCHEDULED', 'OPEN'] } },
    });

    if (!shift) {
      // Create an ad-hoc shift
      shift = await prisma.workShift.create({
        data: {
          restaurantId,
          nameSnapshot: 'Unscheduled',
          codeSnapshot: 'UNSCHEDULED',
          businessDate: today,
          scheduledStartAt: new Date(new Date().setHours(0, 0, 0, 0)),
          scheduledEndAt: new Date(new Date().setHours(23, 59, 59, 999)),
          status: 'OPEN',
          openedAt: new Date(),
          openedById: userId,
          createdById: userId,
        },
      });
    }

    // Get the user's role for assignment
    const userRoles = await prisma.userRole.findMany({
      where: { userId },
      include: { role: true },
    });
    const roleName = userRoles[0]?.role?.name || 'WAITER';

    // Create unscheduled assignment
    const assignment = await prisma.shiftAssignment.create({
      data: {
        restaurantId,
        workShiftId: shift.id,
        userId,
        assignedRoleName: roleName,
        status: 'CLOCKED_IN',
        scheduledStartAt: new Date(),
        scheduledEndAt: shift.scheduledEndAt,
        clockedInAt: new Date(),
      },
    });

    // Create attendance event
    await prisma.attendanceEvent.create({
      data: {
        restaurantId,
        workShiftId: shift.id,
        shiftAssignmentId: assignment.id,
        userId,
        eventType: 'CLOCK_IN',
        eventAt: new Date(),
        source: 'SELF_SERVICE',
        createdById: userId,
      },
    });

    // Open shift if needed
    if (shift.status === 'SCHEDULED') {
      await prisma.workShift.update({
        where: { id: shift.id },
        data: { status: 'OPEN', openedAt: new Date(), openedById: userId },
      });
    }

    await createAuditLog({
      restaurantId,
      userId,
      action: 'CLOCK_IN_UNSCHEDULED',
      entityType: 'ShiftAssignment',
      entityId: assignment.id,
      description: 'Unscheduled clock-in',
      metadata: { roleName, shiftId: shift.id },
      ipAddress,
      userAgent,
    });

    return { assignment: { ...assignment, unscheduled: true }, workShift: shift };
  }

  // Use the first assignment
  const assignment = assignments[0];

  if (assignment.status === 'CLOCKED_IN' || assignment.status === 'ON_BREAK') {
    throw new BadRequestError('Already clocked in');
  }

  // Calculate late minutes
  const now = new Date();
  const scheduledStart = assignment.scheduledStartAt;
  const graceMinutes = assignment.workShift.shiftTemplate?.lateGraceMinutes ?? 10;
  const lateMs = now.getTime() - scheduledStart.getTime();
  const lateMinutes = lateMs > graceMinutes * 60 * 1000 ? Math.floor(lateMs / 60000) : 0;

  const updated = await prisma.shiftAssignment.update({
    where: { id: assignment.id },
    data: {
      status: 'CLOCKED_IN',
      clockedInAt: now,
      lateMinutes,
    },
  });

  // Create attendance event
  await prisma.attendanceEvent.create({
    data: {
      restaurantId,
      workShiftId: assignment.workShiftId,
      shiftAssignmentId: assignment.id,
      userId,
      eventType: 'CLOCK_IN',
      eventAt: now,
      source: 'SELF_SERVICE',
      createdById: userId,
    },
  });

  // Open shift if still scheduled
  const shift = assignment.workShift;
  if (shift.status === 'SCHEDULED') {
    await prisma.workShift.update({
      where: { id: shift.id },
      data: { status: 'OPEN', openedAt: now, openedById: userId },
    });
  }

  await createAuditLog({
    restaurantId,
    userId,
    action: 'CLOCK_IN',
    entityType: 'ShiftAssignment',
    entityId: assignment.id,
    description: 'Clocked in',
    metadata: { lateMinutes, shiftId: shift.id },
    ipAddress,
    userAgent,
  });

  return { assignment: updated, workShift: shift };
}

// ==========================================
// BREAKS
// ==========================================

export async function startBreak(
  userId: string,
  restaurantId: string,
  note?: string,
  ipAddress?: string,
  userAgent?: string
): Promise<any> {
  const assignment = await getActiveAssignment(userId, restaurantId);
  if (!assignment) throw new BadRequestError('No active assignment found. Clock in first.');
  if (assignment.status === 'ON_BREAK') throw new BadRequestError('Already on break');

  // Check for existing open break
  const openBreak = await prisma.employeeBreak.findFirst({
    where: { shiftAssignmentId: assignment.id, endedAt: null },
  });
  if (openBreak) throw new BadRequestError('A break is already in progress');

  const employeeBreak = await prisma.employeeBreak.create({
    data: {
      restaurantId,
      shiftAssignmentId: assignment.id,
      startedAt: new Date(),
      startedById: userId,
      note: note || null,
    },
  });

  await prisma.shiftAssignment.update({
    where: { id: assignment.id },
    data: { status: 'ON_BREAK' },
  });

  // Create attendance event
  await prisma.attendanceEvent.create({
    data: {
      restaurantId,
      workShiftId: assignment.workShiftId,
      shiftAssignmentId: assignment.id,
      userId,
      eventType: 'BREAK_START',
      eventAt: new Date(),
      source: 'SELF_SERVICE',
      createdById: userId,
    },
  });

  await createAuditLog({
    restaurantId,
    userId,
    action: 'BREAK_STARTED',
    entityType: 'EmployeeBreak',
    entityId: employeeBreak.id,
    description: 'Break started',
    ipAddress,
    userAgent,
  });

  return employeeBreak;
}

export async function endBreak(
  userId: string,
  restaurantId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<any> {
  const assignment = await getActiveAssignment(userId, restaurantId);
  if (!assignment) throw new BadRequestError('No active assignment found');
  if (assignment.status !== 'ON_BREAK') throw new BadRequestError('Not currently on break');

  const openBreak = await prisma.employeeBreak.findFirst({
    where: { shiftAssignmentId: assignment.id, endedAt: null },
  });
  if (!openBreak) throw new BadRequestError('No open break found');

  const now = new Date();
  const durationMs = now.getTime() - openBreak.startedAt.getTime();
  const durationMinutes = Math.round(durationMs / 60000);

  await prisma.employeeBreak.update({
    where: { id: openBreak.id },
    data: {
      endedAt: now,
      durationMinutes,
      endedById: userId,
    },
  });

  // Recalculate total break minutes
  const allBreaks = await prisma.employeeBreak.findMany({
    where: { shiftAssignmentId: assignment.id, endedAt: { not: null } },
  });
  const totalBreakMinutes = allBreaks.reduce((sum, b) => sum + (b.durationMinutes || 0), 0);

  await prisma.shiftAssignment.update({
    where: { id: assignment.id },
    data: {
      status: 'CLOCKED_IN',
      totalBreakMinutes,
    },
  });

  // Create attendance event
  await prisma.attendanceEvent.create({
    data: {
      restaurantId,
      workShiftId: assignment.workShiftId,
      shiftAssignmentId: assignment.id,
      userId,
      eventType: 'BREAK_END',
      eventAt: now,
      source: 'SELF_SERVICE',
      createdById: userId,
    },
  });

  await createAuditLog({
    restaurantId,
    userId,
    action: 'BREAK_ENDED',
    entityType: 'EmployeeBreak',
    entityId: openBreak.id,
    description: `Break ended (${durationMinutes} minutes)`,
    metadata: { durationMinutes },
    ipAddress,
    userAgent,
  });

  return { ...openBreak, endedAt: now, durationMinutes };
}

// ==========================================
// CLOCK OUT
// ==========================================

export async function clockOut(
  userId: string,
  restaurantId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<any> {
  const assignment = await getActiveAssignment(userId, restaurantId);
  if (!assignment) throw new BadRequestError('No active assignment found. Not clocked in.');
  if (assignment.status === 'CLOCKED_OUT') throw new BadRequestError('Already clocked out');

  const settings = await prisma.restaurantSettings.findUnique({ where: { restaurantId } });
  const now = new Date();

  // Handle open break
  const openBreak = await prisma.employeeBreak.findFirst({
    where: { shiftAssignmentId: assignment.id, endedAt: null },
  });

  if (openBreak) {
    if (settings?.autoCloseOpenBreakOnClockOut) {
      const durationMs = now.getTime() - openBreak.startedAt.getTime();
      const durationMinutes = Math.round(durationMs / 60000);
      await prisma.employeeBreak.update({
        where: { id: openBreak.id },
        data: { endedAt: now, durationMinutes, endedById: userId },
      });
    } else {
      throw new BadRequestError('Cannot clock out with an open break. End your break first.');
    }
  }

  // Calculate worked minutes
  const clockedInAt = assignment.clockedInAt || assignment.scheduledStartAt;
  const totalMs = now.getTime() - clockedInAt.getTime();
  const totalMinutes = Math.round(totalMs / 60000);

  // Get all breaks for this assignment
  const allBreaks = await prisma.employeeBreak.findMany({
    where: { shiftAssignmentId: assignment.id, endedAt: { not: null } },
  });
  const totalBreakMinutes = allBreaks.reduce((sum, b) => sum + (b.durationMinutes || 0), 0);
  const workedMinutes = totalMinutes - totalBreakMinutes;

  // Calculate early departure and overtime
  const scheduledEnd = assignment.scheduledEndAt;
  const earlyDepartureMinutes = now < scheduledEnd
    ? Math.max(0, Math.floor((scheduledEnd.getTime() - now.getTime()) / 60000) - (assignment.workShift?.shiftTemplate?.earlyDepartureToleranceMinutes ?? 10))
    : 0;

  const scheduledDuration = Math.round(
    (scheduledEnd.getTime() - (assignment.clockedInAt || assignment.scheduledStartAt).getTime()) / 60000
  );
  const overtimeThreshold = assignment.workShift?.shiftTemplate?.overtimeThresholdMinutes ?? 30;
  const overtimeMinutes = workedMinutes > (scheduledDuration + overtimeThreshold)
    ? workedMinutes - scheduledDuration
    : 0;

  const updated = await prisma.shiftAssignment.update({
    where: { id: assignment.id },
    data: {
      status: 'CLOCKED_OUT',
      clockedOutAt: now,
      totalBreakMinutes,
      workedMinutes,
      earlyDepartureMinutes: Math.max(0, earlyDepartureMinutes),
      overtimeMinutes: Math.max(0, overtimeMinutes),
    },
  });

  // Create attendance event
  await prisma.attendanceEvent.create({
    data: {
      restaurantId,
      workShiftId: assignment.workShiftId,
      shiftAssignmentId: assignment.id,
      userId,
      eventType: 'CLOCK_OUT',
      eventAt: now,
      source: 'SELF_SERVICE',
      createdById: userId,
    },
  });

  await createAuditLog({
    restaurantId,
    userId,
    action: 'CLOCK_OUT',
    entityType: 'ShiftAssignment',
    entityId: assignment.id,
    description: 'Clocked out',
    metadata: {
      workedMinutes,
      totalBreakMinutes,
      earlyDepartureMinutes,
      overtimeMinutes,
    },
    ipAddress,
    userAgent,
  });

  return { ...updated, workedMinutes, totalBreakMinutes };
}

// ==========================================
// ATTENDANCE CORRECTIONS
// ==========================================

export async function correctAttendance(
  assignmentId: string,
  restaurantId: string,
  correctionData: {
    clockedInAt?: string;
    clockedOutAt?: string;
    totalBreakMinutes?: number;
    reason: string;
  },
  actorUserId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<any> {
  const assignment = await prisma.shiftAssignment.findFirst({
    where: { id: assignmentId, restaurantId },
    include: { user: { select: { firstName: true, lastName: true } } },
  });
  if (!assignment) throw new NotFoundError('Assignment not found');

  // Create manual correction event
  await prisma.attendanceEvent.create({
    data: {
      restaurantId,
      workShiftId: assignment.workShiftId,
      shiftAssignmentId: assignmentId,
      userId: assignment.userId,
      eventType: 'MANUAL_CORRECTION',
      eventAt: new Date(),
      source: 'MANAGER',
      note: correctionData.reason,
      createdById: actorUserId,
      isCorrection: true,
      correctedEventId: null, // Could link to the original clock-in event
    },
  });

  // Update assignment
  const updateData: any = {
    correctionReason: correctionData.reason,
    correctedById: actorUserId,
  };

  if (correctionData.clockedInAt) updateData.clockedInAt = new Date(correctionData.clockedInAt);
  if (correctionData.clockedOutAt) updateData.clockedOutAt = new Date(correctionData.clockedOutAt);
  if (correctionData.totalBreakMinutes !== undefined) updateData.totalBreakMinutes = correctionData.totalBreakMinutes;

  // Recalculate worked minutes if both times are set
  if (updateData.clockedInAt && updateData.clockedOutAt) {
    const totalMs = updateData.clockedOutAt.getTime() - updateData.clockedInAt.getTime();
    const totalMinutes = Math.round(totalMs / 60000);
    updateData.workedMinutes = totalMinutes - (correctionData.totalBreakMinutes ?? assignment.totalBreakMinutes);
  }

  const updated = await prisma.shiftAssignment.update({
    where: { id: assignmentId },
    data: {
      ...updateData,
      status: updateData.clockedOutAt ? 'CLOCKED_OUT' : assignment.status,
    },
  });

  await createAuditLog({
    restaurantId,
    userId: actorUserId,
    action: 'ATTENDANCE_CORRECTED',
    entityType: 'ShiftAssignment',
    entityId: assignmentId,
    description: `Attendance corrected for ${assignment.user.firstName} ${assignment.user.lastName}: ${correctionData.reason}`,
    metadata: {
      reason: correctionData.reason,
      originalClockedInAt: assignment.clockedInAt,
      originalClockedOutAt: assignment.clockedOutAt,
    },
    ipAddress,
    userAgent,
  });

  return updated;
}

// ==========================================
// HELPERS
// ==========================================

async function getActiveAssignment(userId: string, restaurantId: string): Promise<any> {
  const today = new Date().toISOString().split('T')[0];
  return prisma.shiftAssignment.findFirst({
    where: {
      userId,
      workShift: {
        restaurantId,
        businessDate: today,
      },
      status: { in: ['CLOCKED_IN', 'ON_BREAK'] },
    },
    include: {
      workShift: {
        include: { shiftTemplate: true },
      },
    },
  });
}

export async function getMyAttendance(
  userId: string,
  restaurantId: string,
  dateFrom?: string,
  dateTo?: string
): Promise<any> {
  const where: any = {
    userId,
    workShift: { restaurantId },
  };

  if (dateFrom) {
    where.workShift = {
      ...where.workShift,
      businessDate: {
        gte: dateFrom,
        ...(dateTo ? { lte: dateTo } : {}),
      },
    };
  }

  const assignments = await prisma.shiftAssignment.findMany({
    where,
    include: {
      workShift: {
        select: {
          nameSnapshot: true,
          codeSnapshot: true,
          businessDate: true,
          scheduledStartAt: true,
          scheduledEndAt: true,
        },
      },
      _count: {
        select: {
          employeeBreaks: true,
          attendanceEvents: true,
        },
      },
    },
    orderBy: { scheduledStartAt: 'desc' },
  });

  return assignments;
}

export async function getMyCurrentStatus(userId: string, restaurantId: string): Promise<any> {
  const today = new Date().toISOString().split('T')[0];

  const assignment = await prisma.shiftAssignment.findFirst({
    where: {
      userId,
      workShift: {
        restaurantId,
        businessDate: today,
      },
      status: { notIn: ['CANCELLED', 'ABSENT', 'EXCUSED', 'CLOCKED_OUT'] },
    },
    include: {
      workShift: {
        select: {
          id: true,
          nameSnapshot: true,
          codeSnapshot: true,
          businessDate: true,
          scheduledStartAt: true,
          scheduledEndAt: true,
          status: true,
        },
      },
      employeeBreaks: {
        where: { endedAt: null },
        select: { id: true, startedAt: true },
        take: 1,
      },
    },
    orderBy: { scheduledStartAt: 'desc' },
  });

  if (!assignment) {
    return { clockedIn: false, hasActiveShift: false };
  }

  const now = new Date();
  const workedMs = assignment.clockedInAt
    ? now.getTime() - (assignment.clockedInAt?.getTime() || now.getTime())
    : 0;
  const currentWorkedMinutes = Math.round(workedMs / 60000) - (assignment.totalBreakMinutes || 0);

  return {
    clockedIn: assignment.status === 'CLOCKED_IN' || assignment.status === 'ON_BREAK',
    onBreak: assignment.status === 'ON_BREAK',
    hasActiveShift: true,
    assignment: {
      id: assignment.id,
      workShiftId: assignment.workShiftId,
      assignedRoleName: assignment.assignedRoleName,
      status: assignment.status,
      scheduledStartAt: assignment.scheduledStartAt,
      scheduledEndAt: assignment.scheduledEndAt,
      clockedInAt: assignment.clockedInAt,
      totalBreakMinutes: assignment.totalBreakMinutes,
      workedMinutes: Math.max(0, currentWorkedMinutes),
      lateMinutes: assignment.lateMinutes,
    },
    workShift: assignment.workShift,
    openBreak: assignment.employeeBreaks[0] || null,
  };
}

export async function listAttendance(
  restaurantId: string,
  filters: {
    dateFrom?: string;
    dateTo?: string;
    userId?: string;
    assignedRole?: string;
    status?: string;
    late?: boolean;
    missingClockOut?: boolean;
    overtime?: boolean;
    page?: number;
    limit?: number;
  } = {}
): Promise<any> {
  const page = filters.page || 1;
  const limit = Math.min(filters.limit || 25, 100);
  const skip = (page - 1) * limit;

  const where: any = { restaurantId };

  if (filters.dateFrom || filters.dateTo) {
    where.scheduledStartAt = {};
    if (filters.dateFrom) where.scheduledStartAt.gte = new Date(filters.dateFrom);
    if (filters.dateTo) where.scheduledStartAt.lte = new Date(filters.dateTo);
  }

  if (filters.userId) where.userId = filters.userId;
  if (filters.assignedRole) where.assignedRoleName = filters.assignedRole;
  if (filters.status) where.status = filters.status;
  if (filters.late) where.lateMinutes = { gt: 0 };
  if (filters.missingClockOut) {
    where.status = 'CLOCKED_IN';
    where.clockedInAt = { not: null };
  }
  if (filters.overtime) where.overtimeMinutes = { gt: 0 };

  const [assignments, total] = await Promise.all([
    prisma.shiftAssignment.findMany({
      where,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
        workShift: { select: { nameSnapshot: true, codeSnapshot: true, businessDate: true } },
      },
      orderBy: { scheduledStartAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.shiftAssignment.count({ where }),
  ]);

  return {
    records: assignments,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    summary: {
      total,
      clockedIn: assignments.filter((a) => a.status === 'CLOCKED_IN' || a.status === 'ON_BREAK').length,
      clockedOut: assignments.filter((a) => a.status === 'CLOCKED_OUT').length,
      absent: assignments.filter((a) => a.status === 'ABSENT').length,
      late: assignments.filter((a) => (a.lateMinutes || 0) > 0).length,
      missingClockOut: assignments.filter((a) => a.status === 'CLOCKED_IN' && a.clockedInAt).length,
    },
  };
}

export async function managerClockIn(
  assignmentId: string,
  restaurantId: string,
  actorUserId: string,
  scheduledStartAt?: string,
  note?: string,
  ipAddress?: string,
  userAgent?: string
): Promise<any> {
  const assignment = await prisma.shiftAssignment.findFirst({
    where: { id: assignmentId, restaurantId },
    include: { workShift: true, user: { select: { firstName: true, lastName: true } } },
  });
  if (!assignment) throw new NotFoundError('Assignment not found');

  const now = new Date();
  const updated = await prisma.shiftAssignment.update({
    where: { id: assignmentId },
    data: {
      status: 'CLOCKED_IN',
      clockedInAt: now,
      ...(scheduledStartAt ? { scheduledStartAt: new Date(scheduledStartAt) } : {}),
    },
  });

  await prisma.attendanceEvent.create({
    data: {
      restaurantId,
      workShiftId: assignment.workShiftId,
      shiftAssignmentId: assignmentId,
      userId: assignment.userId,
      eventType: 'CLOCK_IN',
      eventAt: now,
      source: 'MANAGER',
      note: note || 'Manager clock-in',
      createdById: actorUserId,
    },
  });

  await createAuditLog({
    restaurantId,
    userId: actorUserId,
    action: 'MANAGER_CLOCK_IN',
    entityType: 'ShiftAssignment',
    entityId: assignmentId,
    description: `Manager clock-in for ${assignment.user.firstName} ${assignment.user.lastName}`,
    metadata: { note, originalTime: assignment.clockedInAt },
    ipAddress,
    userAgent,
  });

  return updated;
}

export async function managerClockOut(
  assignmentId: string,
  restaurantId: string,
  actorUserId: string,
  clockedOutAt?: string,
  note?: string,
  ipAddress?: string,
  userAgent?: string
): Promise<any> {
  const assignment = await prisma.shiftAssignment.findFirst({
    where: { id: assignmentId, restaurantId },
    include: { workShift: true, user: { select: { firstName: true, lastName: true } } },
  });
  if (!assignment) throw new NotFoundError('Assignment not found');

  const now = clockedOutAt ? new Date(clockedOutAt) : new Date();

  // Calculate worked minutes
  if (assignment.clockedInAt) {
    const totalMs = now.getTime() - assignment.clockedInAt.getTime();
    const totalMinutes = Math.round(totalMs / 60000);
    const workedMinutes = totalMinutes - (assignment.totalBreakMinutes || 0);

    await prisma.shiftAssignment.update({
      where: { id: assignmentId },
      data: {
        status: 'CLOCKED_OUT',
        clockedOutAt: now,
        workedMinutes: Math.max(0, workedMinutes),
      },
    });
  } else {
    await prisma.shiftAssignment.update({
      where: { id: assignmentId },
      data: {
        status: 'CLOCKED_OUT',
        clockedOutAt: now,
      },
    });
  }

  await prisma.attendanceEvent.create({
    data: {
      restaurantId,
      workShiftId: assignment.workShiftId,
      shiftAssignmentId: assignmentId,
      userId: assignment.userId,
      eventType: 'CLOCK_OUT',
      eventAt: now,
      source: 'MANAGER',
      note: note || 'Manager clock-out',
      createdById: actorUserId,
    },
  });

  await createAuditLog({
    restaurantId,
    userId: actorUserId,
    action: 'MANAGER_CLOCK_OUT',
    entityType: 'ShiftAssignment',
    entityId: assignmentId,
    description: `Manager clock-out for ${assignment.user.firstName} ${assignment.user.lastName}`,
    metadata: { note, forced: clockedOutAt !== undefined },
    ipAddress,
    userAgent,
  });

  return { ...assignment, status: 'CLOCKED_OUT', clockedOutAt: now };
}
