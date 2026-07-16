import { prisma } from '../database/prisma';
import crypto from 'crypto';

// ─── Types ───────────────────────────────────────────────

export interface QrTokenData {
  id: string;
  tableId: string;
  tableName: string;
  tableCode: string;
  diningAreaName: string | null;
  tokenPrefix: string | null;
  isActive: boolean;
  createdAt: Date;
  rotatedAt: Date | null;
  revokedAt: Date | null;
  qrUrl: string | null;
}

export interface QrValidationResult {
  valid: boolean;
  restaurantId?: string;
  tableId?: string;
  tableName?: string;
  tableCode?: string;
  diningAreaName?: string | null;
  error?: string;
}

// ─── Helpers ─────────────────────────────────────────────

function generateSecureToken(): { token: string; hash: string; prefix: string } {
  const token = crypto.randomBytes(24).toString('hex');
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const prefix = token.slice(0, 8);
  return { token, hash, prefix };
}

// ─── Generate QR Token ──────────────────────────────────

export async function generateQrToken(
  restaurantId: string,
  tableId: string,
  baseUrl: string,
): Promise<{ token: string; prefix: string; qrUrl: string } | { error: string }> {
  // Verify table exists and belongs to restaurant
  const table = await prisma.restaurantTable.findFirst({
    where: { id: tableId, restaurantId },
    select: { id: true, name: true, code: true, isActive: true },
  });

  if (!table) return { error: 'Table not found.' };
  if (!table.isActive) return { error: 'Table is inactive.' };

  // Check existing active token
  const existingToken = await prisma.tableQrToken.findFirst({
    where: { tableId, restaurantId, isActive: true },
  });

  // Revoke existing active token if present
  if (existingToken) {
    await prisma.tableQrToken.update({
      where: { id: existingToken.id },
      data: { isActive: false, revokedAt: new Date() },
    });
  }

  // Generate new token
  const { token, hash, prefix } = generateSecureToken();
  const qrUrl = `${baseUrl.replace(/\/+$/, '')}/qr/${prefix}`;

  await prisma.tableQrToken.create({
    data: {
      restaurantId,
      tableId,
      tokenHash: hash,
      tokenPrefix: prefix,
      isActive: true,
    },
  });

  return { token, prefix, qrUrl };
}

// ─── List QR Tokens ─────────────────────────────────────

export async function listQrTokens(restaurantId: string): Promise<QrTokenData[]> {
  const tables = await prisma.restaurantTable.findMany({
    where: { restaurantId },
    include: {
      diningArea: { select: { name: true } },
      TableQrToken: {
        where: { isActive: true },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
    orderBy: [{ diningArea: { name: 'asc' } }, { name: 'asc' }],
  });

  const baseUrl = process.env.CLIENT_URL || 'http://localhost:5173';

  return tables.map((table) => {
    const activeToken = table.TableQrToken[0];
    return {
      id: activeToken?.id || '',
      tableId: table.id,
      tableName: table.name,
      tableCode: table.code,
      diningAreaName: table.diningArea?.name || null,
      tokenPrefix: activeToken?.tokenPrefix || null,
      isActive: !!activeToken?.isActive,
      createdAt: activeToken?.createdAt || new Date(0),
      rotatedAt: activeToken?.rotatedAt || null,
      revokedAt: activeToken?.revokedAt || null,
      qrUrl: activeToken
        ? `${baseUrl.replace(/\/+$/, '')}/qr/${activeToken.tokenPrefix}`
        : null,
    };
  });
}

// ─── Get Single Token ────────────────────────────────────

export async function getTokenById(
  tokenId: string,
  restaurantId: string,
): Promise<QrTokenData | { error: string }> {
  const token = await prisma.tableQrToken.findFirst({
    where: { id: tokenId, restaurantId },
    include: {
      table: {
        include: { diningArea: { select: { name: true } } },
      },
    },
  });

  if (!token) return { error: 'Token not found.' };

  const baseUrl = process.env.CLIENT_URL || 'http://localhost:5173';

  return {
    id: token.id,
    tableId: token.tableId,
    tableName: token.table.name,
    tableCode: token.table.code,
    diningAreaName: token.table.diningArea?.name || null,
    tokenPrefix: token.tokenPrefix || '',
    isActive: token.isActive,
    createdAt: token.createdAt,
    rotatedAt: token.rotatedAt,
    revokedAt: token.revokedAt,
    qrUrl: `${baseUrl.replace(/\/+$/, '')}/qr/${token.tokenPrefix}`,
  };
}

// ─── Rotate Token ────────────────────────────────────────

export async function rotateQrToken(
  tokenId: string,
  restaurantId: string,
  baseUrl: string,
): Promise<{ token: string; prefix: string; qrUrl: string } | { error: string }> {
  const existing = await prisma.tableQrToken.findFirst({
    where: { id: tokenId, restaurantId },
  });

  if (!existing) return { error: 'Token not found.' };

  // Revoke old token
  await prisma.tableQrToken.update({
    where: { id: tokenId },
    data: { isActive: false, rotatedAt: new Date() },
  });

  // Generate new token for same table
  return generateQrToken(restaurantId, existing.tableId, baseUrl);
}

// ─── Revoke Token ────────────────────────────────────────

export async function revokeQrToken(
  tokenId: string,
  restaurantId: string,
): Promise<{ message: string } | { error: string }> {
  const existing = await prisma.tableQrToken.findFirst({
    where: { id: tokenId, restaurantId },
  });

  if (!existing) return { error: 'Token not found.' };
  if (!existing.isActive) return { error: 'Token is already inactive.' };

  await prisma.tableQrToken.update({
    where: { id: tokenId },
    data: { isActive: false, revokedAt: new Date() },
  });

  return { message: 'Token revoked successfully.' };
}

// ─── Validate QR Token (Public) ─────────────────────────

export async function validateQrToken(
  tokenPrefix: string,
): Promise<QrValidationResult> {
  if (!tokenPrefix || tokenPrefix.length < 4) {
    return { valid: false, error: 'Invalid token.' };
  }

  // Find token by prefix (all active tokens have unique prefixes)
  const token = await prisma.tableQrToken.findFirst({
    where: {
      tokenPrefix,
      isActive: true,
    },
    include: {
      table: {
        include: { diningArea: { select: { name: true } } },
      },
    },
  });

  if (!token) {
    return { valid: false, error: 'Invalid or expired QR code.' };
  }

  // Validate restaurant
  const restaurant = await prisma.restaurant.findFirst({
    where: { id: token.restaurantId, isActive: true },
    select: { id: true, settings: true },
  });

  if (!restaurant) {
    return { valid: false, error: 'Restaurant not found.' };
  }

  // Check if QR ordering is enabled globally
  if (!restaurant.settings?.qrTableOrderingEnabled && !restaurant.settings?.dineInQrOrderingEnabled) {
    return { valid: false, error: 'QR ordering is not enabled.' };
  }

  // Check table is active
  if (!token.table.isActive) {
    return { valid: false, error: 'This table is not available.' };
  }

  if (token.table.status === 'OUT_OF_SERVICE') {
    return { valid: false, error: 'This table is out of service.' };
  }

  return {
    valid: true,
    restaurantId: token.restaurantId,
    tableId: token.tableId,
    tableName: token.table.name,
    tableCode: token.table.code,
    diningAreaName: token.table.diningArea?.name || null,
  };
}
