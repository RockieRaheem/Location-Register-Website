import type { LocationHierarchySchema, LocationRecord } from '../types';

const API_BASE_URL = '/api/location-registry';

export interface LocationPage {
  items: LocationRecord[];
  total: number;
  limit: number;
  offset: number;
}

export interface LocationQuery {
  parentUid?: string;
  level?: number;
  search?: string;
  limit?: number;
  offset?: number;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const body = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(body.message || `Location registry request failed (${response.status})`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const locationRegistryService = {
  getSchema(countryCode: string): Promise<LocationHierarchySchema> {
    return request(`${API_BASE_URL}/countries/${encodeURIComponent(countryCode)}/schema`);
  },

  updateSchema(countryCode: string, levels: LocationHierarchySchema['levels']): Promise<LocationHierarchySchema> {
    return request(`${API_BASE_URL}/countries/${encodeURIComponent(countryCode)}/schema`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ levels: levels.map((level) => ({
        level: level.order,
        key: level.key,
        name: level.name,
        alternateNames: level.alternateNames,
        allowedTypes: level.allowedTypes,
      })) }),
    });
  },

  listLocations(countryCode: string, query: LocationQuery = {}): Promise<LocationPage> {
    const parameters = new URLSearchParams();
    if (query.parentUid) parameters.set('parentUid', query.parentUid);
    if (query.level) parameters.set('level', String(query.level));
    if (query.search) parameters.set('search', query.search);
    if (query.limit) parameters.set('limit', String(query.limit));
    if (query.offset) parameters.set('offset', String(query.offset));
    const suffix = parameters.size > 0 ? `?${parameters}` : '';
    return request(`${API_BASE_URL}/countries/${encodeURIComponent(countryCode)}/locations${suffix}`);
  },

  getLocation(uid: string): Promise<LocationRecord> {
    return request(`${API_BASE_URL}/locations/${encodeURIComponent(uid)}`);
  },

  getAncestors(uid: string): Promise<LocationRecord[]> {
    return request(`${API_BASE_URL}/locations/${encodeURIComponent(uid)}/ancestors`);
  },

  getDescendants(uid: string, maxDepth?: number, limit = 1000, offset = 0): Promise<{ items: LocationRecord[]; total: number }> {
    const parameters = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (maxDepth != null) parameters.set('maxDepth', String(maxDepth));
    return request(`${API_BASE_URL}/locations/${encodeURIComponent(uid)}/descendants?${parameters}`);
  },

  createLocation(input: {
    countryCode: string;
    parentUid: string;
    levelOrder: number;
    name: string;
    type: string;
    metadata?: Record<string, unknown>;
  }): Promise<LocationRecord> {
    return request(`${API_BASE_URL}/locations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
  },

  updateLocation(uid: string, patch: Partial<Pick<LocationRecord, 'name' | 'type' | 'status' | 'metadata'>>): Promise<LocationRecord> {
    return request(`${API_BASE_URL}/locations/${encodeURIComponent(uid)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
  },

  moveLocation(uid: string, parentUid: string): Promise<LocationRecord> {
    return request(`${API_BASE_URL}/locations/${encodeURIComponent(uid)}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parentUid }),
    });
  },

  deleteLocation(uid: string, cascade = false): Promise<void> {
    return request(`${API_BASE_URL}/locations/${encodeURIComponent(uid)}?cascade=${cascade}`, { method: 'DELETE' });
  },
};
