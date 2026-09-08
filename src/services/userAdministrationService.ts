import { auth } from '../config/firebase';
import type { ApplicationRole } from './firebaseAuthService';

export interface RegisteredUserAccess {
  uid: string;
  email: string;
  name: string;
  emailVerified: boolean;
  disabled: boolean;
  role: ApplicationRole;
  assignedCountryCodes: string[];
  assignedLocationReferenceCodes: string[];
  createdAt: string;
  lastSignInAt: string | null;
}

async function ownerRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Sign in as the system owner first.');
  const headers = new Headers(init?.headers);
  headers.set('Authorization', `Bearer ${token}`);
  if (init?.body) headers.set('Content-Type', 'application/json');
  const response = await fetch(url, { ...init, headers });
  const body = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(body?.message || 'The owner operation failed.');
  return body as T;
}

export async function getCurrentApiSession(): Promise<{ role: ApplicationRole; isOwner: boolean; assignedLocationReferenceCodes: string[] }> {
  return ownerRequest('/api/v1/session');
}

export interface LocationApiDescriptor {
  apiVersion: string;
  scope: { referenceCode: string; name: string; countryCode: string; levelName: string };
  description: string;
  links: Record<string, string>;
}

export function getLocationApiDescriptor(referenceCode: string): Promise<LocationApiDescriptor> {
  return ownerRequest(`/api/v1/locations/${encodeURIComponent(referenceCode)}/api`);
}

export async function listRegisteredUsers(): Promise<RegisteredUserAccess[]> {
  const result = await ownerRequest<{ items: RegisteredUserAccess[] }>('/api/v1/admin/users');
  return result.items;
}

export async function updateRegisteredUserAccess(
  uid: string,
  input: { role: ApplicationRole; status: 'active' | 'disabled'; assignedCountryCodes: string[]; assignedLocationReferenceCodes: string[] },
): Promise<void> {
  await ownerRequest(`/api/v1/admin/users/${encodeURIComponent(uid)}/access`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}
