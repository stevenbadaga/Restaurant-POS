import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../database';
import { env } from '../config';
import { BadRequestError, UnauthorizedError, ForbiddenError, NotFoundError } from '../types';
import { createAuditLog } from './audit.service';

const ACCESS_COOKIE = 'restaurant_pos_access';
const REFRESH_COOKIE = 'restaurant_pos_refresh';

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: Date;
  refreshExpiresAt: Date;
}

export async function generateAuthTokens(userId: string, restaurantId: string, userAgent?: string, ipAddress?: string): Promise<AuthTokens> {
  const accessExpiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
  const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const accessToken = jwt.sign(
    { userId, restaurantId, typ: 'access' },
    env.JWT_ACCESS_SECRET,
    { algorithm: 'HS256', expiresIn: env.ACCESS_TOKEN_EXPIRES_IN || '15m' } as any
  );

  const rawRefreshToken = crypto.randomBytes(40).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');

  await prisma.refreshToken.create({
    data: {
      restaurantId,
      userId,
      tokenHash,
      expiresAt: refreshExpiresAt,
      userAgent,
      ipAddress,
    },
  });

  return { accessToken, refreshToken: rawRefreshToken, accessExpiresAt, refreshExpiresAt };
}

export function getCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
    domain: env.COOKIE_DOMAIN || undefined,
  };
}

export function setAuthCookies(res: any, tokens: AuthTokens) {
  res.cookie(ACCESS_COOKIE, tokens.accessToken, getCookieOptions(15 * 60 * 1000));
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, getCookieOptions(7 * 24 * 60 * 60 * 1000));
}

export function clearAuthCookies(res: any) {
  const baseOptions = {
    path: '/',
    domain: env.COOKIE_DOMAIN || undefined,
    secure: env.COOKIE_SECURE,
    sameSite: 'lax' as const,
  };
  res.clearCookie(ACCESS_COOKIE, baseOptions);
  res.clearCookie(REFRESH_COOKIE, baseOptions);
}

async function validatePassword(password: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

async function checkAccountLockout(user: { failedLoginAttempts: number; lockedUntil: Date | null }): Promise<void> {
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const remainingMinutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
    throw new UnauthorizedError(`Account temporarily locked. Try again in ${remainingMinutes} minute(s).`);
  }
}

async function incrementFailedAttempts(userId: string, currentAttempts: number): Promise<void> {
  const newAttempts = currentAttempts + 1;
  const maxAttempts = 5;
  
  const updateData: any = { failedLoginAttempts: newAttempts };
  
  if (newAttempts >= maxAttempts) {
    updateData.lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 min lockout
  }
  
  await prisma.user.update({
    where: { id: userId },
    data: updateData,
  });
}

async function resetFailedAttempts(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
  });
}

async function revokeRefreshToken(tokenHash: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

async function revokeAllUserTokens(userId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export interface LoginResult {
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    employeeCode: string | null;
    status: string;
    mustChangePassword: boolean;
    roles: string[];
    lastLoginAt: Date | null;
  };
  restaurant: {
    id: string;
    name: string;
    currency: string;
    timezone: string;
  };
  tokens: AuthTokens;
}

export async function login(email: string, password: string, ipAddress?: string, userAgent?: string): Promise<LoginResult> {
  const normalizedEmail = email.toLowerCase().trim();

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    include: {
      roles: { include: { role: true } },
      restaurant: true,
    },
  });

  if (!user) {
    throw new UnauthorizedError('Invalid email or password');
  }

  await checkAccountLockout(user);

  const isValid = await validatePassword(password, user.passwordHash);
  
  if (!isValid) {
    await incrementFailedAttempts(user.id, user.failedLoginAttempts);
    await createAuditLog({
      restaurantId: user.restaurantId,
      userId: user.id,
      action: 'LOGIN_FAILURE',
      entityType: 'USER',
      entityId: user.id,
      description: 'Failed login attempt',
      ipAddress,
      userAgent,
    });
    throw new UnauthorizedError('Invalid email or password');
  }

  if (user.status !== 'ACTIVE') {
    throw new ForbiddenError('Account is not active');
  }

  await resetFailedAttempts(user.id);

  const tokens = await generateAuthTokens(user.id, user.restaurantId, userAgent, ipAddress);

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  await createAuditLog({
    restaurantId: user.restaurantId,
    userId: user.id,
    action: 'LOGIN_SUCCESS',
    entityType: 'USER',
    entityId: user.id,
    description: 'Successful login',
    ipAddress,
    userAgent,
  });

  return {
    user: {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      employeeCode: user.employeeCode,
      status: user.status,
      mustChangePassword: user.mustChangePassword,
      roles: user.roles.map((ur) => ur.role.name),
      lastLoginAt: user.lastLoginAt,
    },
    restaurant: {
      id: user.restaurant.id,
      name: user.restaurant.name,
      currency: user.restaurant.currency,
      timezone: user.restaurant.timezone,
    },
    tokens,
  };
}

export async function refreshToken(rawRefreshToken: string, ipAddress?: string, userAgent?: string): Promise<LoginResult> {
  if (!rawRefreshToken) {
    throw new UnauthorizedError('Refresh token required');
  }

  const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');

  const storedToken = await prisma.refreshToken.findFirst({
    where: {
      tokenHash,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    include: {
      user: {
        include: {
          roles: { include: { role: true } },
          restaurant: true,
        },
      },
    },
  });

  if (!storedToken) {
    const reusedToken = await prisma.refreshToken.findFirst({
      where: { tokenHash, revokedAt: { not: null } },
      select: { userId: true },
    });
    if (reusedToken) {
      await revokeAllUserTokens(reusedToken.userId);
    }
    throw new UnauthorizedError('Invalid or expired refresh token');
  }

  if (storedToken.user.status !== 'ACTIVE') {
    throw new ForbiddenError('Account is not active');
  }

  // Revoke old token (rotation)
  await revokeRefreshToken(tokenHash);

  const tokens = await generateAuthTokens(storedToken.userId, storedToken.user.restaurantId, userAgent || storedToken.userAgent || undefined, ipAddress);

  return {
    user: {
      id: storedToken.user.id,
      firstName: storedToken.user.firstName,
      lastName: storedToken.user.lastName,
      email: storedToken.user.email,
      phone: storedToken.user.phone,
      employeeCode: storedToken.user.employeeCode,
      status: storedToken.user.status,
      mustChangePassword: storedToken.user.mustChangePassword,
      roles: storedToken.user.roles.map((ur) => ur.role.name),
      lastLoginAt: storedToken.user.lastLoginAt,
    },
    restaurant: {
      id: storedToken.user.restaurant.id,
      name: storedToken.user.restaurant.name,
      currency: storedToken.user.restaurant.currency,
      timezone: storedToken.user.restaurant.timezone,
    },
    tokens,
  };
}

export async function logout(rawRefreshToken: string, userId: string, restaurantId: string, userAgent?: string, ipAddress?: string): Promise<void> {
  if (rawRefreshToken) {
    const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');
    await revokeRefreshToken(tokenHash);
  }

  await createAuditLog({
    restaurantId,
    userId,
    action: 'LOGOUT',
    entityType: 'USER',
    entityId: userId,
    description: 'User logged out',
    ipAddress,
    userAgent,
  });
}

export async function logoutAll(userId: string, restaurantId: string, userAgent?: string, ipAddress?: string): Promise<void> {
  await revokeAllUserTokens(userId);

  await createAuditLog({
    restaurantId,
    userId,
    action: 'LOGOUT_ALL',
    entityType: 'USER',
    entityId: userId,
    description: 'All sessions revoked',
    ipAddress,
    userAgent,
  });
}

export async function changePassword(
  userId: string,
  restaurantId: string,
  currentPassword: string,
  newPassword: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new BadRequestError('User not found');
  }

  const isValid = await validatePassword(currentPassword, user.passwordHash);
  if (!isValid) {
    throw new BadRequestError('Current password is incorrect');
  }

  const isSamePassword = await validatePassword(newPassword, user.passwordHash);
  if (isSamePassword) {
    throw new BadRequestError('New password must be different from current password');
  }

  const newHash = await hashPassword(newPassword);

  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash: newHash,
      mustChangePassword: false,
    },
  });

  // Revoke all existing sessions except the current one
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  await createAuditLog({
    restaurantId,
    userId,
    action: 'PASSWORD_CHANGE',
    entityType: 'USER',
    entityId: userId,
    description: 'Password changed successfully',
    ipAddress,
    userAgent,
  });
}

export async function getCurrentUser(userId: string): Promise<LoginResult['user'] & { restaurant: LoginResult['restaurant'] }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      roles: { include: { role: true } },
      restaurant: true,
    },
  });

  if (!user) {
    throw new UnauthorizedError('User not found');
  }

  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone,
    employeeCode: user.employeeCode,
    status: user.status,
    mustChangePassword: user.mustChangePassword,
    roles: user.roles.map((ur) => ur.role.name),
    lastLoginAt: user.lastLoginAt,
    restaurant: {
      id: user.restaurant.id,
      name: user.restaurant.name,
      currency: user.restaurant.currency,
      timezone: user.restaurant.timezone,
    },
  };
}

// ==========================================
// SESSION MANAGEMENT
// ==========================================

export interface SessionInfo {
  id: string;
  createdAt: Date;
  expiresAt: Date;
  userAgent: string | null;
  ipAddress: string | null;
  isCurrentSession: boolean;
}

function maskIpAddress(ip: string | null): string | null {
  if (!ip) return null;
  // Mask IPv4: show first 3 octets, mask the last
  const ipv4Match = ip.match(/^(\d+\.\d+\.\d+)\.\d+$/);
  if (ipv4Match) return `${ipv4Match[1]}.xxx`;
  // Mask IPv6: show first 4 groups, mask the rest
  const ipv6Match = ip.match(/^([0-9a-f:]+:[0-9a-f:]+:[0-9a-f:]+:[0-9a-f:]+):/i);
  if (ipv6Match) return `${ipv6Match[1]}:xxxx:xxxx:xxxx:xxxx`;
  return 'masked';
}

export async function listSessions(userId: string, currentTokenHash: string): Promise<SessionInfo[]> {
  const sessions = await prisma.refreshToken.findMany({
    where: {
      userId,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      createdAt: true,
      expiresAt: true,
      userAgent: true,
      ipAddress: true,
      tokenHash: true,
    },
  });

  return sessions.map((s) => ({
    id: s.id,
    createdAt: s.createdAt,
    expiresAt: s.expiresAt,
    userAgent: s.userAgent,
    ipAddress: maskIpAddress(s.ipAddress),
    isCurrentSession: s.tokenHash === currentTokenHash,
  }));
}

export async function revokeSession(sessionId: string, userId: string, restaurantId: string, userAgent?: string, ipAddress?: string): Promise<void> {
  const session = await prisma.refreshToken.findFirst({
    where: { id: sessionId, userId, revokedAt: null },
  });
  if (!session) throw new NotFoundError('Session not found');

  await prisma.refreshToken.update({
    where: { id: sessionId },
    data: { revokedAt: new Date() },
  });

  await createAuditLog({
    restaurantId,
    userId,
    action: 'SESSION_REVOKED',
    entityType: 'REFRESH_TOKEN',
    entityId: sessionId,
    description: 'Session revoked by user',
    ipAddress,
    userAgent,
  });
}

export async function revokeOtherSessions(userId: string, restaurantId: string, currentTokenHash: string, userAgent?: string, ipAddress?: string): Promise<void> {
  const result = await prisma.refreshToken.updateMany({
    where: {
      userId,
      revokedAt: null,
      tokenHash: { not: currentTokenHash },
    },
    data: { revokedAt: new Date() },
  });

  await createAuditLog({
    restaurantId,
    userId,
    action: 'OTHER_SESSIONS_REVOKED',
    entityType: 'USER',
    entityId: userId,
    description: `Revoked ${result.count} other session(s)`,
    ipAddress,
    userAgent,
  });
}

export async function checkSetupStatus(): Promise<{ setupRequired: boolean }> {
  const restaurantCount = await prisma.restaurant.count();
  const adminCount = await prisma.user.count({
    where: {
      roles: {
        some: {
          role: { name: 'ADMIN' },
        },
      },
    },
  });

  return { setupRequired: restaurantCount === 0 || adminCount === 0 };
}

export async function setupRestaurant(input: {
  restaurantName: string;
  restaurantEmail?: string;
  restaurantPhone?: string;
  address?: string;
  currency: string;
  timezone: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  password: string;
}): Promise<LoginResult> {
  const { setupRequired } = await checkSetupStatus();
  if (!setupRequired) {
    throw new BadRequestError('Setup has already been completed');
  }

  const normalizedEmail = input.email.toLowerCase().trim();
  const passwordHash = await hashPassword(input.password); // Hash BEFORE transaction to avoid blocking the DB connection

  const result = await prisma.$transaction(async (tx) => {
    const restaurant = await tx.restaurant.create({
      data: {
        name: input.restaurantName,
        email: (input.restaurantEmail || input.email).toLowerCase().trim(),
        phone: input.restaurantPhone,
        address: input.address,
        currency: input.currency,
        timezone: input.timezone,
        settings: {
          create: {},
        },
      },
    });

    const adminRole = await tx.role.findUnique({ where: { name: 'ADMIN' } });
    if (!adminRole) {
      throw new BadRequestError('System roles not configured. Run the seed script first.');
    }

    const user = await tx.user.create({
      data: {
        restaurantId: restaurant.id,
        firstName: input.firstName,
        lastName: input.lastName,
        email: normalizedEmail,
        phone: input.phone,
        status: 'ACTIVE',
        passwordHash,
        roles: {
          create: {
            roleId: adminRole.id,
          },
        },
      },
      include: {
        roles: { include: { role: true } },
      },
    });

    const auditId1 = crypto.randomUUID();
    const auditId2 = crypto.randomUUID();
    const now = new Date();

    await tx.auditLog.create({
      data: {
        id: auditId1,
        restaurantId: restaurant.id,
        userId: user.id,
        action: 'RESTAURANT_SETUP',
        entityType: 'RESTAURANT',
        entityId: restaurant.id,
        description: `Restaurant "${restaurant.name}" created with administrator ${user.email}`,
        hash: crypto.createHash('sha256').update(`setup|${restaurant.id}|${auditId1}|${now.toISOString()}`).digest('hex'),
        createdAt: now,
      },
    });

    await tx.auditLog.create({
      data: {
        id: auditId2,
        restaurantId: restaurant.id,
        userId: user.id,
        action: 'ADMIN_CREATED',
        entityType: 'USER',
        entityId: user.id,
        description: `Initial administrator account created for ${user.email}`,
        hash: crypto.createHash('sha256').update(`admin|${user.id}|${auditId2}|${now.toISOString()}`).digest('hex'),
        createdAt: now,
      },
    });

    return { restaurant, user };
  });

  const tokens = await generateAuthTokens(result.user.id, result.restaurant.id);

  return {
    user: {
      id: result.user.id,
      firstName: result.user.firstName,
      lastName: result.user.lastName,
      email: result.user.email,
      phone: result.user.phone,
      employeeCode: null,
      status: 'ACTIVE',
      mustChangePassword: false,
      roles: ['ADMIN'],
      lastLoginAt: null,
    },
    restaurant: {
      id: result.restaurant.id,
      name: result.restaurant.name,
      currency: result.restaurant.currency,
      timezone: result.restaurant.timezone,
    },
    tokens,
  };
}
