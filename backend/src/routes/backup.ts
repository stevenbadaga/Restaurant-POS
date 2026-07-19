import { Router, Request, Response } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';
import { requireAuth } from '../middleware/auth';
import { env } from '../config';

const router = Router();

// All backup routes require authentication + manager role
router.use(requireAuth);
router.use((req: Request, res: Response, next) => {
  const roles = (req as any).user?.roles || [];
  const canView = roles.some((r: string) => ['ADMIN', 'MANAGER'].includes(r));
  if (!canView) {
    res.status(403).json({ success: false, message: 'Only managers can view backup status.' });
    return;
  }
  next();
});

/**
 * GET /api/backup/status
 * Returns the current backup status: latest backup, last status, directory info.
 */
router.get('/status', async (_req: Request, res: Response) => {
  try {
    const backupDir = path.resolve(env.BACKUP_DIRECTORY);
    const logDir = path.join(backupDir, 'logs');

    const result: Record<string, any> = {
      directory: backupDir,
      exists: false,
      lastBackup: null,
      lastStatus: null,
      recentBackups: [],
      totalBackups: 0,
      totalSize: null,
      oldestBackupAge: null,
    };

    // Check if directory exists
    try {
      await fs.access(backupDir);
      result.exists = true;
    } catch {
      res.json({ success: true, data: result });
      return;
    }

    // Read status file
    try {
      const statusFilePath = path.join(logDir, 'last-backup-status.txt');
      const statusContent = await fs.readFile(statusFilePath, 'utf-8');
      result.lastStatus = statusContent.trim();
    } catch {
      // Status file may not exist yet
    }

    // Read last backup path
    try {
      const lastPathFile = path.join(logDir, 'last-backup-path.txt');
      const lastPath = (await fs.readFile(lastPathFile, 'utf-8')).trim();
      if (lastPath) {
        const stat = await fs.stat(lastPath);
        result.lastBackup = {
          path: lastPath,
          name: path.basename(lastPath),
          size: stat.size,
          sizeHuman: formatBytes(stat.size),
          createdAt: stat.birthtime.toISOString(),
          modifiedAt: stat.mtime.toISOString(),
        };
      }
    } catch {
      // Last backup path may not exist
    }

    // List recent backups
    try {
      const files = (await fs.readdir(backupDir))
        .filter((f) => f.endsWith('.dump'))
        .sort()
        .reverse()
        .slice(0, 10);

      const backupDetails = await Promise.all(
        files.map(async (f) => {
          const filePath = path.join(backupDir, f);
          try {
            const stat = await fs.stat(filePath);
            return {
              name: f,
              size: stat.size,
              sizeHuman: formatBytes(stat.size),
              modifiedAt: stat.mtime.toISOString(),
            };
          } catch {
            return { name: f, size: 0, sizeHuman: '0 B', modifiedAt: null };
          }
        })
      );
      result.recentBackups = backupDetails;

      // Total size and count
      const allDumps = (await fs.readdir(backupDir)).filter((f) => f.endsWith('.dump'));
      result.totalBackups = allDumps.length;

      if (allDumps.length > 0) {
        const stats = await Promise.all(
          allDumps.map(async (f) => {
            try {
              return await fs.stat(path.join(backupDir, f));
            } catch {
              return null;
            }
          })
        );
        const validStats = stats.filter(Boolean) as any[];
        const totalBytes = validStats.reduce((sum, s) => sum + s.size, 0);
        result.totalSize = formatBytes(totalBytes);

        // Oldest backup age
        const ages = validStats.map((s) => s.mtime.getTime());
        const oldest = Math.min(...ages);
        result.oldestBackupAge = Math.floor((Date.now() - oldest) / 86400000) + ' days';
      }
    } catch {
      // Non-critical — directory might be empty or permissions issue
    }

    // Read latest log files
    try {
      await fs.access(logDir);
      const logs = (await fs.readdir(logDir))
        .filter((f) => f.startsWith('backup-') && f.endsWith('.log'))
        .sort()
        .reverse()
        .slice(0, 3);

      result.recentLogs = await Promise.all(
        logs.map(async (f) => {
          const content = await fs.readFile(path.join(logDir, f), 'utf-8');
          return { name: f, preview: content.split('\n').slice(0, 20).join('\n') };
        })
      );
    } catch {
      // Log directory may not exist
    }

    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve backup status.',
    });
  }
});

/**
 * GET /api/backup/health
 * Simple health check that verifies backup directory is accessible.
 */
router.get('/health', async (_req: Request, res: Response) => {
  try {
    const backupDir = path.resolve(env.BACKUP_DIRECTORY);
    let accessible = false;
    let writable = false;

    try {
      await fs.access(backupDir);
      accessible = true;
      // Test write access
      const testFile = path.join(backupDir, `.write-test-${Date.now()}`);
      await fs.writeFile(testFile, 'test', 'utf-8');
      await fs.unlink(testFile);
      writable = true;
    } catch {
      // Not accessible or not writable
    }

    res.json({
      success: true,
      data: {
        status: accessible && writable ? 'healthy' : 'unhealthy',
        directory: backupDir,
        accessible,
        writable,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Backup health check failed.',
    });
  }
});

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + units[i];
}

export default router;
