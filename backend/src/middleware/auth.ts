/* eslint-disable @typescript-eslint/no-namespace */
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../database';
import { env } from '../config';
import { UnauthorizedError, ForbiddenError } from '../types';

export interface AuthenticatedUser {
  id: string;
  restaurantId: string;
  email: string;
  firstName: string;
  lastName: string;
  status: string;
  roles: string[];
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

const ACCESS_COOKIE = 'restaurant_pos_access';

export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const token = req.cookies?.[ACCESS_COOKIE];

    if (!token) {
      throw new UnauthorizedError('Authentication required');
    }

    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: ['HS256'] }) as {
      userId: string;
      restaurantId: string;
      typ?: string;
    };

    if (payload.typ !== 'access') {
      throw new UnauthorizedError('Invalid authentication');
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: {
        roles: {
          include: { role: true },
        },
      },
    });

    if (!user || user.restaurantId !== payload.restaurantId) {
      throw new UnauthorizedError('Invalid authentication');
    }

    if (user.status === 'INACTIVE' || user.status === 'SUSPENDED') {
      throw new ForbiddenError('Account is inactive or suspended');
    }

    req.user = {
      id: user.id,
      restaurantId: user.restaurantId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      status: user.status,
      roles: user.roles.map((ur) => ur.role.name),
    };

    next();
  } catch (error) {
    if (error instanceof UnauthorizedError || error instanceof ForbiddenError) {
      next(error);
    } else {
      next(new UnauthorizedError('Authentication required'));
    }
  }
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = req.cookies?.[ACCESS_COOKIE];

  if (!token) {
    next();
    return;
  }

  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: ['HS256'] }) as {
      userId: string;
      restaurantId: string;
      typ?: string;
    };

    if (payload.typ !== 'access') {
      next();
      return;
    }

    prisma.user
      .findUnique({
        where: { id: payload.userId },
        include: {
          roles: {
            include: { role: true },
          },
        },
      })
      .then((user) => {
        if (user && user.restaurantId === payload.restaurantId && user.status === 'ACTIVE') {
          req.user = {
            id: user.id,
            restaurantId: user.restaurantId,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            status: user.status,
            roles: user.roles.map((ur) => ur.role.name),
          };
        }
        next();
      })
      .catch(() => next());
  } catch {
    next();
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new UnauthorizedError('Authentication required'));
      return;
    }

    const hasRole = roles.some((role) => req.user!.roles.includes(role));

    if (!hasRole) {
      next(new ForbiddenError('Insufficient permissions'));
      return;
    }

    next();
  };
}

export function hasRole(user: AuthenticatedUser | undefined, role: string): boolean {
  if (!user) return false;
  return user.roles.includes(role);
}

export function hasAnyRole(user: AuthenticatedUser | undefined, roles: string[]): boolean {
  if (!user) return false;
  return roles.some((role) => user.roles.includes(role));
}

export function canManageStaff(user: AuthenticatedUser | undefined): boolean {
  return hasAnyRole(user, ['ADMIN', 'MANAGER']);
}

export function canManageInventory(user: AuthenticatedUser | undefined): boolean {
  return hasAnyRole(user, ['ADMIN', 'MANAGER', 'STOCK_KEEPER']);
}

export function canViewReports(user: AuthenticatedUser | undefined): boolean {
  return hasAnyRole(user, ['ADMIN', 'MANAGER']);
}

export function canUseKitchen(user: AuthenticatedUser | undefined): boolean {
  return hasAnyRole(user, ['ADMIN', 'MANAGER', 'CHEF']);
}

export function canManagePayments(user: AuthenticatedUser | undefined): boolean {
  return hasAnyRole(user, ['ADMIN', 'MANAGER', 'CASHIER']);
}

export function canManageReceipts(user: AuthenticatedUser | undefined): boolean {
  return hasAnyRole(user, ['ADMIN', 'MANAGER', 'CASHIER']);
}

export function canVoidPayment(user: AuthenticatedUser | undefined): boolean {
  return hasAnyRole(user, ['ADMIN', 'MANAGER']);
}

export function canIssueRefund(user: AuthenticatedUser | undefined): boolean {
  return hasAnyRole(user, ['ADMIN', 'MANAGER']);
}
