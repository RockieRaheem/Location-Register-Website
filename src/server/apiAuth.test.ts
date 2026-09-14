import { canReadLocation, hasApiPermission, hasCountryWideRead, type ApiPrincipal, type ApiRole } from './apiPolicy.ts';

const principal = (role: ApiRole, countries: string[] = []): ApiPrincipal => ({
  uid: `${role}-user`,
  role,
  assignedCountryCodes: countries,
  assignedLocationReferenceCodes: [],
});

describe('API role permissions', () => {
  it('keeps developers read-only', () => {
    expect(hasApiPermission(principal('developer'), 'read')).toBe(true);
    expect(hasApiPermission(principal('developer'), 'contribute', 'UG')).toBe(false);
  });

  it('limits contributors to assigned countries and non-destructive changes', () => {
    const user = principal('contributor', ['UG']);
    expect(hasApiPermission(user, 'contribute', 'UG')).toBe(true);
    expect(hasApiPermission(user, 'contribute', 'KE')).toBe(false);
    expect(hasApiPermission(user, 'manage_country', 'UG')).toBe(false);
  });

  it('limits country admins to managing assigned countries', () => {
    const user = principal('country_admin', ['UG']);
    expect(hasApiPermission(user, 'manage_country', 'UG')).toBe(true);
    expect(hasApiPermission(user, 'manage_country', 'KE')).toBe(false);
    expect(hasApiPermission(user, 'manage_system')).toBe(false);
  });

  it('allows administrators to manage the system', () => {
    expect(hasApiPermission(principal('admin'), 'manage_system')).toBe(true);
  });

  it('limits country-scoped reads to assigned countries', () => {
    const user = principal('developer', ['UG']);
    expect(hasCountryWideRead(user, 'UG')).toBe(true);
    expect(hasCountryWideRead(user, 'KE')).toBe(false);
    expect(canReadLocation(user, { uid: 'kampala', countryCode: 'UG' }, () => false)).toBe(true);
    expect(canReadLocation(user, { uid: 'nairobi', countryCode: 'KE' }, () => false)).toBe(false);
  });

  it('makes assigned location roots override broader country access', () => {
    const user = { ...principal('developer', ['UG']), assignedLocationReferenceCodes: ['UG-L02-KAMPALA'] };
    expect(hasCountryWideRead(user, 'UG')).toBe(false);
    expect(canReadLocation(user, { uid: 'kampala-child', countryCode: 'UG' }, (uid) => uid === 'kampala-child')).toBe(true);
    expect(canReadLocation(user, { uid: 'gulu', countryCode: 'UG' }, () => false)).toBe(false);
  });
});
