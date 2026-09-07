import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { apiRoles, hasApiPermission, type ApiPermission, type ApiPrincipal, type ApiRole } from './apiPolicy.ts';

export type { ApiPermission, ApiPrincipal, ApiRole } from './apiPolicy.ts';
const principals = new WeakMap<Request, ApiPrincipal>();
const projectId = process.env.FIREBASE_PROJECT_ID || 'any-location-36e76';
const checkRevokedTokens = process.env.FIREBASE_CHECK_REVOKED_TOKENS === 'true';

if (getApps().length === 0) initializeApp({ projectId });

function bearerToken(request: Request): string | undefined {
  const authorization = request.header('authorization');
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim();
}

export const authenticateApiRequest: RequestHandler = async (request, response, next) => {
  const token = bearerToken(request);
  if (!token) return response.status(401).json({ code: 'AUTHENTICATION_REQUIRED', message: 'Supply a Firebase ID token as a Bearer token.' });
  try {
    const decoded = await getAuth().verifyIdToken(token, checkRevokedTokens);
    const role = String(decoded.role || '') as ApiRole;
    if (!decoded.email_verified) return response.status(403).json({ code: 'EMAIL_NOT_VERIFIED', message: 'A verified email address is required.' });
    if (!apiRoles.has(role)) return response.status(403).json({ code: 'ROLE_NOT_ASSIGNED', message: 'No supported API role is assigned to this account.' });
    if (decoded.status === 'disabled') return response.status(403).json({ code: 'ACCOUNT_DISABLED', message: 'This account is disabled.' });
    const assignedCountryCodes = Array.isArray(decoded.assignedCountryCodes)
      ? decoded.assignedCountryCodes.map(String).map((value) => value.toUpperCase()).filter((value) => /^[A-Z]{2}$/.test(value))
      : [];
    principals.set(request, { uid: decoded.uid, email: decoded.email, role, assignedCountryCodes });
    return next();
  } catch {
    return response.status(401).json({ code: 'INVALID_TOKEN', message: 'The Firebase ID token is invalid, expired, or revoked.' });
  }
};

export function apiPrincipal(request: Request): ApiPrincipal {
  const principal = principals.get(request);
  if (!principal) throw new Error('Authenticated API principal is unavailable');
  return principal;
}

export function authorize(
  permission: ApiPermission,
  countryCode: (request: Request) => string | undefined = () => undefined,
): RequestHandler {
  return (request: Request, response: Response, next: NextFunction) => {
    const principal = apiPrincipal(request);
    const country = countryCode(request)?.toUpperCase();
    if (!hasApiPermission(principal, permission, country)) {
      return response.status(403).json({
        code: 'INSUFFICIENT_PERMISSION',
        message: country ? `Role ${principal.role} cannot perform this action for ${country}.` : `Role ${principal.role} cannot perform this action.`,
      });
    }
    return next();
  };
}
