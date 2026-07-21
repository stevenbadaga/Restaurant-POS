import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../database';
import { requireAuth, requireRole } from '../middleware/auth';
import { hashPassword } from '../services/auth.service';
import { createAuditLog } from '../services/audit.service';
import { BadRequestError, NotFoundError } from '../types';

const router = Router();
router.use(requireAuth);

const createStaffSchema = z.object({
  firstName: z.string().min(1, 'First name required'),
  lastName: z.string().min(1, 'Last name required'),
  email: z.string().email('Valid email required'),
  phone: z.string().optional().or(z.literal('')),
  employeeCode: z.string().min(1, 'Employee code required'),
  temporaryPassword: z.string().min(8, 'Password must be at least 8 characters'),
  roleNames: z.array(z.string()).min(1, 'At least one role required'),
});

const updateStaffSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  employeeCode: z.string().min(1).optional(),
});

const statusSchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']),
});

const rolesSchema = z.object({
  roleNames: z.array(z.string()).min(1, 'At least one role required'),
});

const sortFields = new Set(['firstName', 'lastName', 'email', 'employeeCode', 'status', 'lastLoginAt', 'createdAt', 'updatedAt']);

// GET /api/staff
router.get('/', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { search, status, role, page = '1', limit = '25', sort = 'createdAt', order = 'desc' } = req.query;
    const sortField = typeof sort === 'string' && sortFields.has(sort) ? sort : 'createdAt';
    const sortOrder = order === 'asc' ? 'asc' : 'desc';

    const where: any = { restaurantId: req.user!.restaurantId };
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { firstName: { contains: search as string, mode: 'insensitive' } },
        { lastName: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } },
        { employeeCode: { contains: search as string, mode: 'insensitive' } },
      ];
    }
    if (role) {
      where.roles = { some: { role: { name: role as string } } };
    }

    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 25));
    const skip = (pageNum - 1) * limitNum;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        include: { roles: { include: { role: true } } },
        skip,
        take: limitNum,
        orderBy: { [sortField]: sortOrder },
      }),
      prisma.user.count({ where }),
    ]);

    const safeUsers = users.map((u) => ({
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      fullName: `${u.firstName} ${u.lastName}`,
      email: u.email,
      phone: u.phone,
      employeeCode: u.employeeCode,
      status: u.status,
      roles: u.roles.map((ur) => ur.role.name),
      lastLoginAt: u.lastLoginAt,
      createdAt: u.createdAt,
    }));

    res.json({
      success: true,
      data: safeUsers,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/staff/:id
router.get('/:id', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
      include: { roles: { include: { role: true } } },
    });

    if (!user) throw new NotFoundError('Staff member not found');

    res.json({
      success: true,
      data: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: `${user.firstName} ${user.lastName}`,
        email: user.email,
        phone: user.phone,
        employeeCode: user.employeeCode,
        status: user.status,
        roles: user.roles.map((ur) => ur.role.name),
        mustChangePassword: user.mustChangePassword,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/staff
router.post('/', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = createStaffSchema.parse(req.body);
    const normalizedEmail = parsed.email.toLowerCase().trim();
    const isManager = req.user!.roles.includes('MANAGER');
    const isAdmin = req.user!.roles.includes('ADMIN');

    // Managers cannot assign ADMIN
    if (isManager && !isAdmin && parsed.roleNames.includes('ADMIN')) {
      throw new BadRequestError('You do not have permission to assign the ADMIN role');
    }

    const existingEmail = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existingEmail) throw new BadRequestError('Email already in use');

    const existingCode = await prisma.user.findFirst({
      where: { restaurantId: req.user!.restaurantId, employeeCode: parsed.employeeCode },
    });
    if (existingCode) throw new BadRequestError('Employee code already in use');

    // Validate roles exist
    const roles = await prisma.role.findMany({ where: { name: { in: parsed.roleNames } } });
    if (roles.length !== parsed.roleNames.length) {
      throw new BadRequestError('One or more roles are invalid');
    }

    const passwordHash = await hashPassword(parsed.temporaryPassword);

    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          restaurantId: req.user!.restaurantId,
          firstName: parsed.firstName,
          lastName: parsed.lastName,
          email: normalizedEmail,
          phone: parsed.phone || null,
          employeeCode: parsed.employeeCode,
          passwordHash,
          mustChangePassword: true,
          roles: {
            create: parsed.roleNames.map((name) => ({
              roleId: roles.find((r) => r.name === name)!.id,
            })),
          },
        },
        include: { roles: { include: { role: true } } },
      });

      await createAuditLog({
        restaurantId: req.user!.restaurantId,
        userId: req.user!.id,
        action: 'EMPLOYEE_CREATED',
        entityType: 'USER',
        entityId: newUser.id,
        description: `Created employee ${normalizedEmail}`,
        metadata: { roles: parsed.roleNames },
      });

      return newUser;
    });

    res.status(201).json({
      success: true,
      message: 'Staff member created successfully',
      data: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        employeeCode: user.employeeCode,
        roles: user.roles.map((ur) => ur.role.name),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new BadRequestError(error.errors[0].message));
    } else {
      next(error);
    }
  }
});

// PATCH /api/staff/:id
router.patch('/:id', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = updateStaffSchema.parse(req.body);
    const user = await prisma.user.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
    });
    if (!user) throw new NotFoundError('Staff member not found');

    if (parsed.email) {
      parsed.email = parsed.email.toLowerCase().trim();
      const existing = await prisma.user.findFirst({
        where: { email: parsed.email, id: { not: req.params.id } },
      });
      if (existing) throw new BadRequestError('Email already in use');
    }

    if (parsed.employeeCode) {
      const existing = await prisma.user.findFirst({
        where: { restaurantId: req.user!.restaurantId, employeeCode: parsed.employeeCode, id: { not: req.params.id } },
      });
      if (existing) throw new BadRequestError('Employee code already in use');
    }

    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: parsed,
      include: { roles: { include: { role: true } } },
    });

    await createAuditLog({
      restaurantId: req.user!.restaurantId,
      userId: req.user!.id,
      action: 'EMPLOYEE_UPDATED',
      entityType: 'USER',
      entityId: updated.id,
      description: `Updated employee ${updated.email}`,
      metadata: { changes: Object.keys(parsed) },
    });

    res.json({
      success: true,
      message: 'Staff member updated',
      data: {
        id: updated.id,
        firstName: updated.firstName,
        lastName: updated.lastName,
        email: updated.email,
        phone: updated.phone,
        employeeCode: updated.employeeCode,
        roles: updated.roles.map((ur) => ur.role.name),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new BadRequestError(error.errors[0].message));
    } else {
      next(error);
    }
  }
});

// PATCH /api/staff/:id/status
router.patch('/:id/status', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = statusSchema.parse(req.body);

    // Prevent self-deactivation
    if (req.params.id === req.user!.id) {
      throw new BadRequestError('You cannot change your own status');
    }

    const user = await prisma.user.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
      include: { roles: { include: { role: true } } },
    });
    if (!user) throw new NotFoundError('Staff member not found');

    // Prevent removal of last active admin
    if (user.roles.some((ur) => ur.role.name === 'ADMIN') && parsed.status !== 'ACTIVE') {
      const activeAdminCount = await prisma.user.count({
        where: {
          restaurantId: req.user!.restaurantId,
          status: 'ACTIVE',
          roles: { some: { role: { name: 'ADMIN' } } },
        },
      });
      if (activeAdminCount <= 1) {
        throw new BadRequestError('Cannot deactivate the last active administrator');
      }
    }

    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: { status: parsed.status },
    });

    // Revoke refresh tokens when deactivating
    if (parsed.status !== 'ACTIVE') {
      await prisma.refreshToken.updateMany({
        where: { userId: req.params.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    await createAuditLog({
      restaurantId: req.user!.restaurantId,
      userId: req.user!.id,
      action: parsed.status === 'ACTIVE' ? 'EMPLOYEE_ACTIVATED' : 'EMPLOYEE_DEACTIVATED',
      entityType: 'USER',
      entityId: updated.id,
      description: `Employee ${updated.email} status changed to ${parsed.status}`,
    });

    res.json({ success: true, message: `Status changed to ${parsed.status}` });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new BadRequestError(error.errors[0].message));
    } else {
      next(error);
    }
  }
});

// PUT /api/staff/:id/roles
router.put('/:id/roles', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = rolesSchema.parse(req.body);
    const isManager = req.user!.roles.includes('MANAGER');
    const isAdmin = req.user!.roles.includes('ADMIN');

    if (isManager && !isAdmin && parsed.roleNames.includes('ADMIN')) {
      throw new BadRequestError('You do not have permission to assign the ADMIN role');
    }

    const user = await prisma.user.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
      include: { roles: { include: { role: true } } },
    });
    if (!user) throw new NotFoundError('Staff member not found');

    // Check if removing ADMIN from last active admin
    const hadAdmin = user.roles.some((ur) => ur.role.name === 'ADMIN');
    const willHaveAdmin = parsed.roleNames.includes('ADMIN');
    if (hadAdmin && !willHaveAdmin) {
      const activeAdminCount = await prisma.user.count({
        where: {
          restaurantId: req.user!.restaurantId,
          status: 'ACTIVE',
          roles: { some: { role: { name: 'ADMIN' } } },
        },
      });
      if (activeAdminCount <= 1) {
        throw new BadRequestError('Cannot remove the last active administrator');
      }
    }

    const roles = await prisma.role.findMany({ where: { name: { in: parsed.roleNames } } });
    if (roles.length !== parsed.roleNames.length) {
      throw new BadRequestError('One or more roles are invalid');
    }

    await prisma.$transaction(async (tx) => {
      await tx.userRole.deleteMany({ where: { userId: req.params.id } });
      await tx.userRole.createMany({
        data: parsed.roleNames.map((name) => ({
          userId: req.params.id,
          roleId: roles.find((r) => r.name === name)!.id,
          assignedById: req.user!.id,
        })),
      });
    });

    await createAuditLog({
      restaurantId: req.user!.restaurantId,
      userId: req.user!.id,
      action: 'ROLE_ASSIGNMENT',
      entityType: 'USER',
      entityId: req.params.id,
      description: `Roles updated to ${parsed.roleNames.join(', ')}`,
    });

    res.json({ success: true, message: 'Roles updated', data: { roleNames: parsed.roleNames } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new BadRequestError(error.errors[0].message));
    } else {
      next(error);
    }
  }
});

export default router;
