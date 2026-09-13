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
      '/locations/{referenceCode}/children',
      '/locations/{referenceCode}/subtree',
      '/locations/{referenceCode}/ancestors',
      '/locations/{referenceCode}/geometry',
    ]));
  });
});
