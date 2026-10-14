export type ApiRole = 'admin' | 'country_admin' | 'contributor' | 'developer' | 'manufacturer' | 'financial_institution';
export type ApiPermission = 'read' | 'contribute' | 'manage_country' | 'manage_system';

export interface ApiPrincipal {
  uid: string;
  email?: string;
  role: ApiRole;
  assignedCountryCodes: string[];
  assignedLocationReferenceCodes: string[];
  assignedEconomicZones?: string[];
  assignedRegionalBlocks?: string[];
  identityType?: 'human' | 'machine';
  clientId?: string;
  scopes?: string[];
  requestsPerMinute?: number;
  dailyQuota?: number;
}

export const apiRoles = new Set<ApiRole>(['admin', 'country_admin', 'contributor', 'developer', 'manufacturer', 'financial_institution']);

function hasGeographicAssignments(principal: ApiPrincipal): boolean {
  return principal.assignedCountryCodes.length > 0
    || principal.assignedLocationReferenceCodes.length > 0
    || Boolean(principal.assignedEconomicZones?.length)
    || Boolean(principal.assignedRegionalBlocks?.length);
}

export function hasApiPermission(principal: ApiPrincipal, permission: ApiPermission, countryCode?: string): boolean {
  if (principal.identityType === 'machine') {
    const requiredScope = permission === 'read' ? 'locations:read' : permission === 'contribute' ? 'locations:write' : undefined;
    if (!requiredScope || !principal.scopes?.includes(requiredScope)) return false;
    if (!countryCode) return true;
    return !hasGeographicAssignments(principal) || principal.assignedCountryCodes.includes(countryCode.toUpperCase());
  }
  if (principal.role === 'admin') return true;
  if (permission === 'read') return true;
  if (permission === 'manage_system') return false;
  const assigned = Boolean(countryCode && principal.assignedCountryCodes.includes(countryCode.toUpperCase()));
  if (permission === 'manage_country') return principal.role === 'country_admin' && assigned;
  return (principal.role === 'country_admin' || principal.role === 'contributor') && assigned;
}

export function hasCountryWideRead(principal: ApiPrincipal, countryCode: string): boolean {
  if (principal.identityType === 'machine' && !principal.scopes?.includes('locations:read')) return false;
  if (principal.role === 'admin') return true;
  if (principal.assignedCountryCodes.includes(countryCode.toUpperCase())) return true;
  return !hasGeographicAssignments(principal);
}

export function canReadLocation(
  principal: ApiPrincipal,
  location: Pick<{ uid: string; countryCode: string }, 'uid' | 'countryCode'>,
  isWithinAssignedScope: (locationUid: string, references: string[]) => boolean,
): boolean {
  if (principal.identityType === 'machine' && !principal.scopes?.includes('locations:read')) return false;
  if (principal.role === 'admin') return true;
  if (principal.assignedCountryCodes.includes(location.countryCode.toUpperCase())) return true;
  if (principal.assignedLocationReferenceCodes.length > 0
    && isWithinAssignedScope(location.uid, principal.assignedLocationReferenceCodes)) return true;
  return !hasGeographicAssignments(principal);
}
