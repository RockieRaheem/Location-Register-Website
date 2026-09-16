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

export async function authenticatedApiRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Sign in as the system owner first.');
  const headers = new Headers(init?.headers);
  headers.set('Authorization', `Bearer ${token}`);
  if (init?.body) headers.set('Content-Type', 'application/json');
  const response = await fetch(url, { ...init, headers });
  const body = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(body?.message || 'The authenticated operation failed.');
  return body as T;
}

export async function getCurrentApiSession(): Promise<{ role: ApplicationRole; isOwner: boolean; assignedLocationReferenceCodes: string[] }> {
  return authenticatedApiRequest('/api/v1/session');
}

export async function getCurrentFirebaseIdToken(forceRefresh = false): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('Sign in before requesting an API token.');
  return user.getIdToken(forceRefresh);
}

export interface LocationApiDescriptor {
  apiVersion: string;
  scope: { referenceCode: string; name: string; countryCode: string; levelName: string };
  description: string;
  links: Record<string, string>;
}

export function getLocationApiDescriptor(referenceCode: string): Promise<LocationApiDescriptor> {
  return authenticatedApiRequest(`/api/v1/locations/${encodeURIComponent(referenceCode)}/api`);
}

export interface ApiCountryOption { countryCode: string; name: string; }
export interface ApiHierarchyLevel { order: number; key: string; name: string; }
export interface ApiLocationOption {
  referenceCode: string;
  name: string;
  countryCode: string;
  levelOrder: number;
  levelName: string;
  type: string;
}

export async function listAccessibleApiCountries(): Promise<ApiCountryOption[]> {
  const result = await authenticatedApiRequest<{ items: ApiCountryOption[] }>('/api/v1/countries');
  return result.items;
}

export async function getApiCountryHierarchy(countryCode: string): Promise<ApiHierarchyLevel[]> {
  const result = await authenticatedApiRequest<{ levels: ApiHierarchyLevel[] }>(`/api/v1/countries/${encodeURIComponent(countryCode)}/schema`);
  return result.levels;
}

export async function searchAccessibleApiLocations(countryCode: string, search: string, level?: number): Promise<ApiLocationOption[]> {
  const query = new URLSearchParams({ search, limit: '50', offset: '0' });
  if (level != null) query.set('level', String(level));
  const result = await authenticatedApiRequest<{ items: ApiLocationOption[] }>(`/api/v1/countries/${encodeURIComponent(countryCode)}/locations?${query}`);
  return result.items;
}

export async function listRegisteredUsers(): Promise<RegisteredUserAccess[]> {
  const result = await authenticatedApiRequest<{ items: RegisteredUserAccess[] }>('/api/v1/admin/users');
  return result.items;
}

export async function updateRegisteredUserAccess(
  uid: string,
  input: { role: ApplicationRole; status: 'active' | 'disabled'; assignedCountryCodes: string[]; assignedLocationReferenceCodes: string[] },
): Promise<void> {
  await authenticatedApiRequest(`/api/v1/admin/users/${encodeURIComponent(uid)}/access`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}
