import { locationApiOpenApi } from './openApi.ts';

describe('Any-Location OpenAPI contract', () => {
  it('documents Firebase bearer authentication and every read hierarchy route', () => {
    expect(locationApiOpenApi.openapi).toBe('3.1.0');
    expect(locationApiOpenApi.components.securitySchemes.firebaseBearer.scheme).toBe('bearer');
    expect(Object.keys(locationApiOpenApi.paths)).toEqual(expect.arrayContaining([
      '/countries',
      '/countries/{countryCode}/schema',
      '/countries/{countryCode}/locations',
      '/locations/{referenceCode}',
      '/countries/{countryCode}/resolve-location',
      '/countries/{countryCode}/resolve-locations',
      '/locations/{referenceCode}/api',
      '/locations/{referenceCode}/children',
      '/locations/{referenceCode}/subtree',
      '/locations/{referenceCode}/descendants',
      '/locations/{referenceCode}/ancestors',
      '/locations/{referenceCode}/geometry',
      '/locations/{referenceCode}/leader',
      '/locations/{referenceCode}/leadership-history',
      '/locations/{referenceCode}/leader/end',
    ]));
  });
});
