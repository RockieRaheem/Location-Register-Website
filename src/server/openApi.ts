const bearerSecurity = [{ firebaseBearer: [] }];

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
      Error: {
        type: 'object',
        properties: { code: { type: 'string' }, message: { type: 'string' } },
      },
    },
  },
  paths: {
    '/countries': {
      get: { summary: 'List configured countries', operationId: 'listCountries', responses: { '200': { description: 'Country collection.' }, ...errorResponses } },
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
    '/countries/{countryCode}/resolve-location': {
      get: { summary: 'Resolve one location from its complete hierarchy path', operationId: 'resolveLocationPath', parameters: [{ name: 'countryCode', in: 'path', required: true, schema: { type: 'string' } }, { name: 'path', in: 'query', required: true, schema: { type: 'string' }, description: 'Pipe-delimited names from the country root to the target.' }], responses: { '200': { description: 'Exactly resolved location.' }, ...errorResponses } },
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
