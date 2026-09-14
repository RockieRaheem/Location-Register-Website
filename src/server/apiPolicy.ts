export type ApiRole = 'admin' | 'country_admin' | 'contributor' | 'developer' | 'manufacturer' | 'financial_institution';
export type ApiPermission = 'read' | 'contribute' | 'manage_country' | 'manage_system';

export interface ApiPrincipal {
  uid: string;
  email?: string;
  role: ApiRole;
  assignedCountryCodes: string[];
  assignedLocationReferenceCodes: string[];
}

export const apiRoles = new Set<ApiRole>(['admin', 'country_admin', 'contributor', 'developer', 'manufacturer', 'financial_institution']);

export function hasApiPermission(principal: ApiPrincipal, permission: ApiPermission, countryCode?: string): boolean {
  if (principal.role === 'admin') return true;
  if (permission === 'read') return true;
  if (permission === 'manage_system') return false;
  const assigned = Boolean(countryCode && principal.assignedCountryCodes.includes(countryCode.toUpperCase()));
  if (permission === 'manage_country') return principal.role === 'country_admin' && assigned;
  return (principal.role === 'country_admin' || principal.role === 'contributor') && assigned;
}

export function hasCountryWideRead(principal: ApiPrincipal, countryCode: string): boolean {
  if (principal.role === 'admin') return true;
  if (principal.assignedLocationReferenceCodes.length > 0) return false;
  return principal.assignedCountryCodes.length === 0
    || principal.assignedCountryCodes.includes(countryCode.toUpperCase());
}

export function canReadLocation(
  principal: ApiPrincipal,
  location: Pick<{ uid: string; countryCode: string }, 'uid' | 'countryCode'>,
  isWithinAssignedScope: (locationUid: string, references: string[]) => boolean,
): boolean {
  if (principal.role === 'admin') return true;
  if (principal.assignedLocationReferenceCodes.length > 0) {
    return isWithinAssignedScope(location.uid, principal.assignedLocationReferenceCodes);
  }
  return principal.assignedCountryCodes.length === 0
    || principal.assignedCountryCodes.includes(location.countryCode.toUpperCase());
}
