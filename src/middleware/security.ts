import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from '../config';
import logger from '../utils/logger';

/**
 * Security Middleware Configuration
 * Centralizes all security-related middleware setup
 */

// ============================================================
// 1. HELMET - Security Headers
// ============================================================
export const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
    },
  },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
  frameguard: { action: 'deny' },
  noSniff: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xssFilter: true,
});

// ============================================================
// 2. CORS - Whitelist Origins
// ============================================================
export const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    const allowedOrigins = config.security.allowedOrigins.map(o => o.trim());

    // Allow requests with no origin (e.g., mobile apps, curl, same-origin)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn('CORS: Request from disallowed origin', { origin, allowedOrigins });
      callback(new Error('CORS policy violation'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

// ============================================================
// 3. RATE LIMITING
// ============================================================

// General API rate limit
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Max 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  skipSuccessfulRequests: false,
  skip: (req) => {
    // Skip rate limit for health checks
    return req.path === '/health';
  },
});

// Strict rate limit for authentication endpoints
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Max 5 attempts
  message: 'Too many authentication attempts, please try again later.',
  skipSuccessfulRequests: true,
});

// Order creation rate limit (stricter)
export const orderLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // Max 10 orders per minute
  message: 'Too many orders created, please slow down.',
});

// ============================================================
// 4. API KEY VALIDATION MIDDLEWARE
// ============================================================
export const validateApiKey = (req: Request, res: Response, next: NextFunction): void => {
  // Skip validation for public endpoints
  const publicPaths = ['/health', '/api/candies', '/'];
  if (publicPaths.includes(req.path)) {
    return next();
  }

  const apiKey = req.headers['x-api-key'] as string;

  if (!apiKey || apiKey !== config.security.apiKey) {
    logger.warn('API: Invalid or missing API key', {
      path: req.path,
      hasApiKey: !!apiKey,
    });
    res.status(401).json({
      error: 'Unauthorized - Invalid or missing API key',
    });
    return;
  }

  next();
};

// ============================================================
// 5. SANITIZE ERROR RESPONSES
// ============================================================
export const errorSanitizer = (err: any, req: Request, res: Response, next: NextFunction): void => {
  const isProduction = process.env.NODE_ENV === 'production';

  // Log detailed error internally
  logger.error('API Error', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  // Send generic error to client in production
  if (isProduction) {
    res.status(err.status || 500).json({
      error: 'An error occurred processing your request',
    });
  } else {
    res.status(err.status || 500).json({
      error: err.message,
    });
  }
};

// ============================================================
// 6. INPUT SANITIZATION
// ============================================================
export const sanitizeInput = (req: Request, res: Response, next: NextFunction): void => {
  // Remove potential XSS/injection attempts from query and body
  const sanitizeString = (str: string): string => {
    if (typeof str !== 'string') return str;
    return str
      .replace(/[<>]/g, '') // Remove angle brackets
      .trim();
  };

  // Sanitize request body
  if (req.body && typeof req.body === 'object') {
    Object.keys(req.body).forEach((key) => {
      if (typeof req.body[key] === 'string') {
        req.body[key] = sanitizeString(req.body[key]);
      }
    });
  }

  // Sanitize query parameters
  Object.keys(req.query).forEach((key) => {
    if (typeof req.query[key] === 'string') {
      req.query[key] = sanitizeString(req.query[key]);
    }
  });

  next();
};

// ============================================================
// 7. SECURE HEADERS MIDDLEWARE
// ============================================================
export const secureHeaders = (req: Request, res: Response, next: NextFunction): void => {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  // Prevent content-type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Enable XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Prevent MIME type sniffing
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

  next();
};

// ============================================================
// 8. LOG SANITIZATION - Hide sensitive data
// ============================================================
export const maskSensitiveData = (data: any): any => {
  if (!data) return data;

  const sensitiveFields = [
    'password',
    'token',
    'access_token',
    'refresh_token',
    'secret',
    'clientSecret',
    'apiKey',
    'creditCard',
    'ssn',
  ];

  const sanitized = JSON.parse(JSON.stringify(data));

  const maskRecursive = (obj: any) => {
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        if (sensitiveFields.some((field) => key.toLowerCase().includes(field.toLowerCase()))) {
          obj[key] = '***REDACTED***';
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          maskRecursive(obj[key]);
        }
      }
    }
  };

  maskRecursive(sanitized);
  return sanitized;
};
