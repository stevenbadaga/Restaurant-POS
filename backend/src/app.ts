import express from 'express';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';
import { allowedOrigins, env } from './config';
import routes from './routes';
import logger from './logging/logger';
import {
  errorHandler,
  notFoundHandler,
  correlationId,
  csrfProtection,
  originValidation,
} from './middleware';

const app = express();

// ==========================================
// Security Middleware — Helmet with hardened CSP
// ==========================================
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        // Note: 'unsafe-inline' and 'unsafe-eval' are required for React/Vite.
        // In a fully production-hardened build with subresource integrity,
        // these could be tightened.
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        fontSrc: ["'self'", 'data:'],
        connectSrc: ["'self'", ...allowedOrigins],
        frameAncestors: ["'none'"],
        formAction: ["'self'"],
        baseUri: ["'self'"],
        objectSrc: ["'none'"],
        ...(env.NODE_ENV === 'production' ? { upgradeInsecureRequests: [] } : {}),
      } as any,
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    hsts: env.NODE_ENV === 'production'
      ? { maxAge: 31536000, includeSubDomains: true, preload: true }
      : false,
    xFrameOptions: { action: 'deny' },
    xPermittedCrossDomainPolicies: { permittedPolicies: 'none' },
  })
);

// ==========================================
// Permissions-Policy
// ==========================================
app.use((_req, res, next) => {
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), display-capture=(), fullscreen=(self), picture-in-picture=()'
  );
  next();
});

// Request correlation ID for logging traceability
app.use(correlationId);

// ==========================================
// Structured Logging (early for accurate timing)
// ==========================================
if (env.NODE_ENV !== 'test') {
  app.use(
    pinoHttp({
      logger,
      autoLogging: {
        ignore: (req) => req.url === '/api/health/live' || req.url === '/api/health/ready',
      },
      redact: {
        paths: ['req.headers.authorization', 'req.headers.cookie', 'req.headers["x-csrf-token"]'],
        censor: '[REDACTED]',
      },
    })
  );
}

// ==========================================
// CORS
// ==========================================
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-csrf-token', 'x-correlation-id'],
    exposedHeaders: ['x-correlation-id'],
  })
);

// Origin validation (production only)
app.use(originValidation);

// ==========================================
// Rate Limiting
// ==========================================

// General API rate limit
const generalLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000,
  max: env.RATE_LIMIT_MAX || 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/health/live' || req.path === '/health/ready',
  message: { success: false, message: 'Too many requests, please try again later.' },
});

app.use('/api', generalLimiter);

// Auth rate limiter (stricter)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.AUTH_RATE_LIMIT_MAX || 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many authentication attempts, please try again later.' },
});

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/refresh', authLimiter);
app.use('/api/auth/change-password', authLimiter);

// Order operations rate limiter
const orderLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many order operations. Please slow down.' },
});

app.use('/api/orders', orderLimiter);

// Payment rate limiter
const paymentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many payment operations.' },
});

app.use('/api/payments', paymentLimiter);

// Report export rate limiter
const exportLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: env.RATE_LIMIT_MAX || 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many export requests. Please wait before generating another report.' },
});

app.use('/api/reports', exportLimiter);

// Reservation rate limiter
const reservationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many reservation operations.' },
});

app.use('/api/reservations', reservationLimiter);

// Customer search rate limiter
const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many search requests.' },
});

app.use('/api/customers', searchLimiter);

// ==========================================
// Body Parsing
// ==========================================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Cookie parsing
app.use(cookieParser());

// Compression
app.use(compression());

// Persistent uploaded assets
app.use('/uploads', express.static(path.resolve(env.UPLOAD_DIRECTORY), {
  fallthrough: false,
  index: false,
  maxAge: env.NODE_ENV === 'production' ? '7d' : 0,
  setHeaders(res) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  },
}));

// ==========================================
// CSRF protection for state-changing methods
// ==========================================
app.use('/api', csrfProtection);

// API routes
app.use('/api', routes);

// ==========================================
// Root-level health (liveness) endpoint
// ==========================================
app.get('/health', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
  });
});

// Not found handler
app.use(notFoundHandler);

// Error handler
app.use(errorHandler);

export default app;
