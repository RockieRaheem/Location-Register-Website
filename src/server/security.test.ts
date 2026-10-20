import { configuredCorsOrigins, isCorsOriginAllowed } from './security.ts';

describe('server security policy', () => {
  it('allows configured production origins and rejects unconfigured origins', () => {
    const allowed = configuredCorsOrigins('https://app.example, https://admin.example');
    expect(isCorsOriginAllowed('https://app.example', true, allowed)).toBe(true);
    expect(isCorsOriginAllowed('https://attacker.example', true, allowed)).toBe(false);
  });

  it('permits non-browser clients and local development only outside production', () => {
    const allowed = new Set<string>();
    expect(isCorsOriginAllowed(undefined, true, allowed)).toBe(true);
    expect(isCorsOriginAllowed('http://localhost:3000', false, allowed)).toBe(true);
    expect(isCorsOriginAllowed('http://localhost:3000', true, allowed)).toBe(false);
  });
});
