import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(5000),
  DATABASE_URL: z.string().url(),
  CLIENT_URL: z.string().url().default('http://localhost:5173'),
  ALLOWED_ORIGINS: z.string().optional(),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  ACCESS_TOKEN_EXPIRES_IN: z.string().default('15m'),
  REFRESH_TOKEN_EXPIRES_IN: z.string().default('7d'),
  COOKIE_SECURE: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .default('false'),
  COOKIE_DOMAIN: z.string().optional(),
  TRUST_PROXY: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .default('false'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  DATABASE_POOL_SIZE: z.coerce.number().int().positive().default(10),
  BACKUP_DIRECTORY: z.string().default('./backups'),
  PDF_TEMP_DIRECTORY: z.string().default('./temp'),
  UPLOAD_DIRECTORY: z.string().default('./uploads'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
  MAINTENANCE_MODE: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .default('false'),
}).superRefine((value, ctx) => {
  const weakSecretMarkers = ['change-in-production', 'dev-', 'development', 'secret'];
  const hasWeakMarker = (secret: string) => weakSecretMarkers.some((marker) => secret.toLowerCase().includes(marker));

  if (value.ALLOWED_ORIGINS) {
    for (const origin of value.ALLOWED_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean)) {
      try {
        new URL(origin);
      } catch {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['ALLOWED_ORIGINS'], message: `Invalid origin URL: ${origin}` });
      }
    }
  }

  if (value.NODE_ENV === 'production') {
    if (!value.COOKIE_SECURE) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['COOKIE_SECURE'], message: 'COOKIE_SECURE must be true in production' });
    }
    if (value.JWT_ACCESS_SECRET.length < 64 || hasWeakMarker(value.JWT_ACCESS_SECRET)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['JWT_ACCESS_SECRET'], message: 'JWT_ACCESS_SECRET must be a strong production secret of at least 64 characters' });
    }
    if (value.JWT_REFRESH_SECRET.length < 64 || hasWeakMarker(value.JWT_REFRESH_SECRET)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['JWT_REFRESH_SECRET'], message: 'JWT_REFRESH_SECRET must be a strong production secret of at least 64 characters' });
    }
    if (/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::|\/|$)/i.test(value.CLIENT_URL)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['CLIENT_URL'], message: 'CLIENT_URL must not be localhost in production' });
    }
  }
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  parsed.error.errors.forEach((err) => {
    console.error(`  - ${err.path.join('.')}: ${err.message}`);
  });
  process.exit(1);
}

export const env = parsed.data;

export const allowedOrigins = Array.from(new Set([
  parsed.data.CLIENT_URL,
  ...(parsed.data.ALLOWED_ORIGINS?.split(',').map((s) => s.trim()).filter(Boolean) ?? []),
]));
