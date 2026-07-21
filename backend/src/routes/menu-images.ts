import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { env } from '../config';
import { requireAuth, requireRole } from '../middleware/auth';
import { BadRequestError } from '../types';
import { createAuditLog } from '../services/audit.service';

const router = Router();
router.use(requireAuth);

const MAX_IMAGE_SIZE_BYTES = 2 * 1024 * 1024;
const MENU_UPLOAD_SUBDIR = 'menu';
const PUBLIC_UPLOAD_PREFIX = '/uploads/menu/';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_SIZE_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.mimetype)) {
      cb(new BadRequestError('Only JPEG, PNG, WebP, and GIF images are allowed'));
      return;
    }
    cb(null, true);
  },
});

const extensionByMimeType: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

function getUploadRoot(): string {
  return path.resolve(env.UPLOAD_DIRECTORY);
}

function getMenuUploadDirectory(): string {
  return path.join(getUploadRoot(), MENU_UPLOAD_SUBDIR);
}

function hasValidImageSignature(buffer: Buffer, mimeType: string): boolean {
  if (mimeType === 'image/jpeg') {
    return buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mimeType === 'image/png') {
    return buffer.length > 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (mimeType === 'image/webp') {
    return buffer.length > 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  }
  if (mimeType === 'image/gif') {
    const signature = buffer.subarray(0, 6).toString('ascii');
    return signature === 'GIF87a' || signature === 'GIF89a';
  }
  return false;
}

function isLocalMenuImageUrl(imageUrl: string): boolean {
  return imageUrl.startsWith(PUBLIC_UPLOAD_PREFIX) && !imageUrl.includes('..') && !imageUrl.includes('\\');
}

function localImagePathFromUrl(imageUrl: string): string {
  const filename = path.basename(imageUrl);
  return path.join(getMenuUploadDirectory(), filename);
}

router.post('/', requireRole('ADMIN', 'MANAGER'), upload.single('image'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      throw new BadRequestError('Image file is required');
    }

    if (!hasValidImageSignature(req.file.buffer, req.file.mimetype)) {
      throw new BadRequestError('Uploaded file content does not match a supported image type');
    }

    const extension = extensionByMimeType[req.file.mimetype];
    const filename = `${Date.now()}-${crypto.randomUUID()}${extension}`;
    const directory = getMenuUploadDirectory();
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(path.join(directory, filename), req.file.buffer, { flag: 'wx' });

    const imageUrl = `${PUBLIC_UPLOAD_PREFIX}${filename}`;
    await createAuditLog({
      restaurantId: req.user!.restaurantId,
      userId: req.user!.id,
      action: 'MENU_IMAGE_UPLOADED',
      entityType: 'MENU_IMAGE',
      description: `Uploaded menu image ${filename}`,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(201).json({
      success: true,
      data: {
        imageUrl,
        filename,
        contentType: req.file.mimetype,
        size: req.file.size,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const imageUrl = typeof req.query.imageUrl === 'string' ? req.query.imageUrl : '';
    if (!imageUrl || !isLocalMenuImageUrl(imageUrl)) {
      throw new BadRequestError('Only local menu images can be deleted');
    }

    await fs.rm(localImagePathFromUrl(imageUrl), { force: true });

    await createAuditLog({
      restaurantId: req.user!.restaurantId,
      userId: req.user!.id,
      action: 'MENU_IMAGE_DELETED',
      entityType: 'MENU_IMAGE',
      description: `Deleted menu image ${path.basename(imageUrl)}`,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({ success: true, message: 'Image deleted' });
  } catch (error) {
    next(error);
  }
});

export default router;
