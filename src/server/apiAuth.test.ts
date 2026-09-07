import { hasApiPermission, type ApiPrincipal, type ApiRole } from './apiPolicy.ts';

const principal = (role: ApiRole, countries: string[] = []): ApiPrincipal => ({
  uid: `${role}-user`,
  role,
  assignedCountryCodes: countries,
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
});
