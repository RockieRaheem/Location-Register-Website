import { authenticatedApiRequest } from './userAdministrationService';

export interface LocationLeader {
  uid: string;
  fullName: string;
  title: string;
  email?: string;
  phone?: string;
  organization?: string;
  biography?: string;
  termStartedOn?: string;
  termEndedOn?: string;
  isCurrent: boolean;
  updatedAt: string;
  updatedByEmail?: string;
}

export interface ResolvedLocation {
  uid: string;
  referenceCode: string;
  name: string;
  levelName: string;
  countryCode: string;
}

export interface LeadershipAudit {
  id: number;
  action: 'create' | 'update' | 'replace' | 'end';
  actorEmail?: string;
  actorUid: string;
  actorRole: string;
  occurredAt: string;
}

export async function resolveLocationPath(countryCode: string, path: string[]): Promise<ResolvedLocation> {
  const query = new URLSearchParams({ path: path.join('|') });
  return authenticatedApiRequest(`/api/v1/countries/${encodeURIComponent(countryCode)}/resolve-location?${query}`);
}

export function getLocationLeadership(referenceCode: string): Promise<{ location: ResolvedLocation; leader: LocationLeader | null }> {
  return authenticatedApiRequest(`/api/v1/locations/${encodeURIComponent(referenceCode)}/leader`);
}

export function getLocationLeadershipHistory(referenceCode: string): Promise<{ assignments: LocationLeader[]; audit: LeadershipAudit[] }> {
  return authenticatedApiRequest(`/api/v1/locations/${encodeURIComponent(referenceCode)}/leadership-history`);
}

export function saveLocationLeader(referenceCode: string, input: Partial<LocationLeader> & { fullName: string; title: string; replaceCurrent?: boolean }): Promise<{ leader: LocationLeader }> {
  return authenticatedApiRequest(`/api/v1/locations/${encodeURIComponent(referenceCode)}/leader`, { method: 'PUT', body: JSON.stringify(input) });
}

export function endLocationLeaderTerm(referenceCode: string, termEndedOn: string): Promise<void> {
  return authenticatedApiRequest(`/api/v1/locations/${encodeURIComponent(referenceCode)}/leader/end`, { method: 'POST', body: JSON.stringify({ termEndedOn }) });
}
