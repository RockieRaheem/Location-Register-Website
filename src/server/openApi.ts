const bearerSecurity = [{ firebaseBearer: [] }, { apiKey: [] }];

const errorResponses = {
  '401': { description: 'Missing, expired, invalid, or revoked Firebase ID token.' },
  '403': { description: 'The authenticated account does not have the required role or location scope.' },
  '404': { description: 'The requested country or location reference does not exist.' },
};

export const locationApiOpenApi = {
  openapi: '3.1.0',
  info: {
    title: 'Any-Location API',
    version: '1.0.0',
    description: 'Reference-code based access to configurable country administrative hierarchies.',
  },
  servers: [{ url: '/api/v1', description: 'Current Any-Location server' }],
  security: bearerSecurity,
  components: {
    securitySchemes: {
      firebaseBearer: { type: 'http', scheme: 'bearer', bearerFormat: 'Firebase ID token' },
      apiKey: { type: 'apiKey', in: 'header', name: 'X-API-Key', description: 'Hashed, scoped service credential. The plaintext key is shown only once.' },
    },
    schemas: {
      Location: {
        type: 'object',
        required: ['uid', 'referenceCode', 'countryCode', 'levelOrder', 'levelKey', 'levelName', 'name', 'type', 'status'],
        properties: {
          uid: { type: 'string', format: 'uuid' },
          referenceCode: { type: 'string', description: 'Immutable public location identifier.' },
          countryCode: { type: 'string', minLength: 2, maxLength: 2 },
          levelOrder: { type: 'integer', minimum: 0 },
          levelKey: { type: 'string' },
          levelName: { type: 'string' },
          parentUid: { type: ['string', 'null'], format: 'uuid' },
          name: { type: 'string' },
          type: { type: 'string' },
          status: { type: 'string', enum: ['active', 'inactive', 'deprecated'] },
          metadata: { type: 'object', additionalProperties: true },
        },
      },
      CountryProfile: {
        type: 'object',
        required: ['referenceCode', 'name', 'continent', 'countryCode', 'phoneCode', 'codes', 'flag', 'currency', 'time', 'map', 'links'],
        properties: {
          referenceCode: { type: ['string', 'null'], description: 'Immutable reference ID for the country root.' },
          name: { type: 'string' },
          continent: { type: 'string' },
          economicZones: { type: 'array', items: { type: 'string' } },
          countryCode: { type: 'string', minLength: 2, maxLength: 2, description: 'ISO 3166-1 alpha-2 country code.' },
          phoneCode: { type: 'string', description: 'International calling code.' },
          codes: {
            type: 'object',
            properties: { iso2: { type: 'string' }, callingCode: { type: 'string' } },
          },
          flag: {
            type: 'object',
            properties: { emoji: { type: ['string', 'null'] }, svgUrl: { type: 'string', format: 'uri' }, pngUrl: { type: 'string', format: 'uri' }, alt: { type: 'string' } },
          },
          currency: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              code: { type: 'string' },
              symbol: { type: 'string' },
              decimalPlaces: { type: 'integer' },
              denominations: {
                type: 'array',
                items: { type: 'object', properties: { value: { type: 'number' }, label: { type: 'string' }, type: { type: 'string', enum: ['Note', 'Coin'] }, status: { type: 'string', enum: ['Active', 'Inactive'] }, frontImage: { type: 'string' }, backImage: { type: 'string' } } },
              },
            },
          },
          time: {
            type: 'object',
            required: ['defaultTimeZone', 'timeZones', 'storage', 'displayFormat'],
            properties: {
              defaultTimeZone: { type: 'string', description: 'Default IANA timezone for country-wide displays.' },
              timeZones: { type: 'array', items: { type: 'string' }, description: 'IANA timezones used by the country.' },
              storage: { type: 'string', enum: ['UTC'], description: 'Canonical timestamp storage and interchange timezone.' },
              displayFormat: { type: 'string', example: 'hh:mm:ss A z' },
            },
          },
          map: {
            type: 'object',
            properties: { hasVerifiedGeometry: { type: 'boolean' }, responseMode: { type: 'string', enum: ['geometry', 'hierarchy'] }, endpoint: { type: ['string', 'null'] }, geometryEndpoint: { type: ['string', 'null'] }, fallback: { type: 'string', enum: ['hierarchy'] } },
          },
          links: { type: 'object', additionalProperties: { type: ['string', 'null'] } },
        },
      },
      Error: {
        type: 'object',
        properties: { code: { type: 'string' }, message: { type: 'string' } },
      },
    },
  },
  paths: {
    '/countries': {
      get: { summary: 'List country identity, flag, currency, denomination, and map profiles', operationId: 'listCountries', responses: { '200': { description: 'Country profile collection.' }, ...errorResponses } },
    },
    '/countries/{countryCode}/profile': {
      get: {
        summary: 'Get a country identity, flag, currency, denomination, and map profile', operationId: 'getCountryProfile',
        parameters: [{ name: 'countryCode', in: 'path', required: true, schema: { type: 'string', minLength: 2, maxLength: 2 } }],
        responses: { '200': { description: 'Country API profile.', content: { 'application/json': { schema: { $ref: '#/components/schemas/CountryProfile' } } } }, ...errorResponses },
      },
    },
    '/countries/{countryCode}/schema': {
      get: {
        summary: 'Get a country-specific hierarchy schema', operationId: 'getCountrySchema',
        parameters: [{ name: 'countryCode', in: 'path', required: true, schema: { type: 'string', minLength: 2, maxLength: 2 } }],
        responses: { '200': { description: 'Ordered hierarchy-level definitions.' }, ...errorResponses },
      },
    },
    '/countries/{countryCode}/locations': {
      get: {
        summary: 'List or search country locations', operationId: 'listCountryLocations',
        parameters: [
          { name: 'countryCode', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'parentReferenceCode', in: 'query', schema: { type: 'string' } },
          { name: 'level', in: 'query', schema: { type: 'integer', minimum: 0 } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 1000, default: 100 } },
          { name: 'offset', in: 'query', schema: { type: 'integer', minimum: 0, default: 0 } },
        ],
        responses: { '200': { description: 'Paginated location collection.' }, ...errorResponses },
      },
    },
    '/countries/{countryCode}/export': {
      get: { summary: 'Export a paginated location collection as JSON, CSV, or GeoJSON', operationId: 'exportCountryLocations', parameters: [{ name: 'countryCode', in: 'path', required: true, schema: { type: 'string' } }, { name: 'format', in: 'query', schema: { type: 'string', enum: ['json', 'csv', 'geojson'] } }, { name: 'level', in: 'query', schema: { type: 'integer' } }, { name: 'limit', in: 'query', schema: { type: 'integer', maximum: 1000 } }, { name: 'offset', in: 'query', schema: { type: 'integer' } }], responses: { '200': { description: 'Requested export page.' }, ...errorResponses } },
    },
    '/dataset-editions': {
      get: { summary: 'List source-backed dataset editions and publication status', operationId: 'listDatasetEditions', responses: { '200': { description: 'Dataset edition collection.' }, ...errorResponses } },
    },
    '/dataset-editions/{uid}/locations': {
      get: { summary: 'List paginated source paths and immutable-reference crosswalk results for an edition', operationId: 'listDatasetEditionLocations', parameters: [{ name: 'uid', in: 'path', required: true, schema: { type: 'string' } }, { name: 'match', in: 'query', schema: { type: 'string', enum: ['all', 'exact', 'unmatched'] } }, { name: 'search', in: 'query', schema: { type: 'string' } }, { name: 'limit', in: 'query', schema: { type: 'integer', maximum: 1000 } }, { name: 'offset', in: 'query', schema: { type: 'integer' } }], responses: { '200': { description: 'Edition path and reference-code crosswalk page.' }, ...errorResponses } },
    },
    '/webhooks': {
      get: { summary: 'List the current machine client webhooks', operationId: 'listWebhooks', responses: { '200': { description: 'Webhook collection without signing secrets.' }, ...errorResponses } },
      post: { summary: 'Register an HTTPS change webhook', operationId: 'createWebhook', responses: { '201': { description: 'Webhook and one-time signing secret.' }, ...errorResponses } },
    },
    '/webhooks/{uid}': {
      delete: { summary: 'Disable a webhook', operationId: 'disableWebhook', parameters: [{ name: 'uid', in: 'path', required: true, schema: { type: 'string' } }], responses: { '204': { description: 'Webhook disabled.' }, ...errorResponses } },
    },
    '/admin/api-clients': {
      get: { summary: 'List machine API clients', operationId: 'listApiClients', responses: { '200': { description: 'API clients without credential hashes.' }, ...errorResponses } },
      post: { summary: 'Create a scoped machine API client and one-time key', operationId: 'createApiClient', responses: { '201': { description: 'Client and one-time plaintext API key.' }, ...errorResponses } },
    },
    '/admin/api-scope-catalog': {
      get: { summary: 'List valid economic-zone, regional-block, and country access boundaries', operationId: 'getApiScopeCatalog', responses: { '200': { description: 'Owner-managed geographic scope catalog.' }, ...errorResponses } },
    },
    '/admin/api-scope-locations': {
      get: { summary: 'List or search lower-level locations for a service-client boundary', operationId: 'searchApiScopeLocations', parameters: [{ name: 'countryCode', in: 'query', required: true, schema: { type: 'string' } }, { name: 'search', in: 'query', required: false, description: 'Omit to list the first administrative level; use at least two characters to search every level.', schema: { type: 'string', minLength: 2 } }], responses: { '200': { description: 'Matching locations with immutable reference IDs.' }, ...errorResponses } },
    },
    '/admin/api-clients/{uid}/revoke': {
      post: { summary: 'Revoke a machine client and all of its credentials', operationId: 'revokeApiClient', parameters: [{ name: 'uid', in: 'path', required: true, schema: { type: 'string' } }], responses: { '204': { description: 'Client revoked.' }, ...errorResponses } },
    },
    '/countries/{countryCode}/resolve-location': {
      get: { summary: 'Resolve one location from its complete hierarchy path', operationId: 'resolveLocationPath', parameters: [{ name: 'countryCode', in: 'path', required: true, schema: { type: 'string' } }, { name: 'path', in: 'query', required: true, schema: { type: 'string' }, description: 'Pipe-delimited names from the country root to the target.' }], responses: { '200': { description: 'Exactly resolved location.' }, ...errorResponses } },
    },
    '/countries/{countryCode}/resolve-locations': {
      post: { summary: 'Map up to 500 complete hierarchy paths to immutable reference codes', operationId: 'resolveLocationPaths', parameters: [{ name: 'countryCode', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Path-to-location mappings; unmatched paths contain a null location.' }, ...errorResponses } },
    },
    '/locations/{referenceCode}': {
      get: { summary: 'Get one location', operationId: 'getLocation', parameters: [{ name: 'referenceCode', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Location and discoverable links.' }, ...errorResponses } },
    },
    '/locations/{referenceCode}/api': {
      get: { summary: 'Discover links for a location-scoped API', operationId: 'getLocationApiDescriptor', parameters: [{ name: 'referenceCode', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Location scope and discoverable links.' }, ...errorResponses } },
    },
    '/locations/{referenceCode}/children': {
      get: { summary: 'Get direct children', operationId: 'getLocationChildren', parameters: [{ name: 'referenceCode', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Direct child locations.' }, ...errorResponses } },
    },
    '/locations/{referenceCode}/subtree': {
      get: { summary: 'Get a complete paginated subtree', operationId: 'getLocationSubtree', parameters: [{ name: 'referenceCode', in: 'path', required: true, schema: { type: 'string' } }, { name: 'maxDepth', in: 'query', schema: { type: 'integer', minimum: 1 } }, { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 1000 } }, { name: 'offset', in: 'query', schema: { type: 'integer', minimum: 0 } }], responses: { '200': { description: 'Root location and descendant page.' }, ...errorResponses } },
    },
    '/locations/{referenceCode}/descendants': {
      get: { summary: 'Get paginated descendants', operationId: 'getLocationDescendants', parameters: [{ name: 'referenceCode', in: 'path', required: true, schema: { type: 'string' } }, { name: 'maxDepth', in: 'query', schema: { type: 'integer', minimum: 1 } }, { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 1000 } }, { name: 'offset', in: 'query', schema: { type: 'integer', minimum: 0 } }], responses: { '200': { description: 'Paginated descendant collection.' }, ...errorResponses } },
    },
    '/locations/{referenceCode}/ancestors': {
      get: { summary: 'Get the path from country to location', operationId: 'getLocationAncestors', parameters: [{ name: 'referenceCode', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Ordered ancestor collection.' }, ...errorResponses } },
    },
    '/locations/{referenceCode}/geometry': {
      get: { summary: 'Get verified GeoJSON geometry when available', operationId: 'getLocationGeometry', parameters: [{ name: 'referenceCode', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Source-attributed geometry.' }, ...errorResponses } },
    },
    '/locations/{referenceCode}/map': {
      get: { summary: 'Get a verified map or a non-geographic hierarchy fallback', operationId: 'getLocationMap', parameters: [{ name: 'referenceCode', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'GeoJSON feature when verified geometry exists; otherwise an explicit hierarchy visualization model.' }, ...errorResponses } },
    },
    '/locations/{referenceCode}/leader': {
      get: { summary: 'Get the current leader for a location', operationId: 'getLocationLeader', parameters: [{ name: 'referenceCode', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Current leader, or null when none is recorded.' }, ...errorResponses } },
      put: { summary: 'Create, update, or replace the current leader', operationId: 'saveLocationLeader', parameters: [{ name: 'referenceCode', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Saved leader assignment.' }, ...errorResponses } },
    },
    '/locations/{referenceCode}/leadership-history': {
      get: { summary: 'Get leader assignments and immutable change history', operationId: 'getLocationLeadershipHistory', parameters: [{ name: 'referenceCode', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Assignment and audit history.' }, ...errorResponses } },
    },
    '/locations/{referenceCode}/leader/end': {
      post: { summary: 'End the current leader term', operationId: 'endLocationLeaderTerm', parameters: [{ name: 'referenceCode', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Ended leader assignment.' }, ...errorResponses } },
    },
  },
} as const;
