import type { RequestHandler } from 'express';
import type { CorsOptions } from 'cors';

const localhostOrigin = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?$/;

export function configuredCorsOrigins(value = process.env.CORS_ALLOWED_ORIGINS || ''): Set<string> {
  return new Set(value.split(',').map((origin) => origin.trim()).filter(Boolean));
}

export function isCorsOriginAllowed(origin: string | undefined, production: boolean, allowed: Set<string>): boolean {
  if (!origin) return true;
  if (allowed.has(origin)) return true;
  return !production && localhostOrigin.test(origin);
}

export function corsOptions(): CorsOptions {
  const production = process.env.NODE_ENV === 'production';
  const allowed = configuredCorsOrigins();
  return {
    origin: (origin, callback) => callback(null, isCorsOriginAllowed(origin, production, allowed)),
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'Idempotency-Key', 'X-API-Key', 'X-Request-Id'],
    exposedHeaders: ['API-Version', 'Deprecation', 'Idempotency-Replayed', 'RateLimit-Limit', 'RateLimit-Remaining', 'Retry-After', 'X-Daily-Quota-Limit', 'X-Daily-Quota-Remaining', 'X-Request-Id'],
    maxAge: 86_400,
  };
}

export const securityHeaders: RequestHandler = (_request, response, next) => {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  if (process.env.NODE_ENV === 'production') {
    response.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
};
