import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { loadEnvFile } from 'node:process';
import { createServer as createHttpServer } from 'node:http';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { allAfricanCountries } from '../data/mockData.ts';
import type { AdminLevelName, Country, LocationRecord } from '../types.ts';
import { LocationDatabase, type NewLocationInput } from './locationDatabase.ts';
import { apiPrincipal, authenticateApiRequest, authorize, authorizeOwner, configureApiKeyVerifier, isOwnerRequest } from './apiAuth.ts';
import { apiRoles, canReadLocation as canPrincipalReadLocation, hasCountryWideRead as principalHasCountryWideRead, type ApiRole } from './apiPolicy.ts';
import { locationApiOpenApi } from './openApi.ts';
import { ApiPlatform } from './apiPlatform.ts';

try {
  loadEnvFile(path.join(process.cwd(), '.env.local'));
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
}

const databasePath = process.env.LOCATION_DATABASE_PATH
  ? path.resolve(process.env.LOCATION_DATABASE_PATH)
  : path.join(process.cwd(), 'data', 'database', 'location-register.sqlite');
const locationDatabase = new LocationDatabase(databasePath);
const apiPlatform = new ApiPlatform(locationDatabase);
configureApiKeyVerifier((key) => apiPlatform.verifyApiKey(key));

const candidateEditionPath = path.join(process.cwd(), 'data', 'sources', 'uganda', 'official-2024-2025', 'ec-2025-candidate.json');
const candidateCrosswalkPath = path.join(process.cwd(), 'data', 'sources', 'uganda', 'official-2024-2025', 'ec-2025-crosswalk.json');
const candidateCrosswalk = fs.existsSync(candidateCrosswalkPath)
  ? JSON.parse(fs.readFileSync(candidateCrosswalkPath, 'utf8')) as { report: Record<string, unknown>; records: Array<{ path: string[]; referenceCode: string | null; match: 'exact' | 'unmatched' }> }
  : null;
if (fs.existsSync(candidateEditionPath)) {
  const candidate = JSON.parse(fs.readFileSync(candidateEditionPath, 'utf8')) as { metadata: { title: string; sourceYear: number; sourceSha256: string; statistics: unknown; status: string } };
  locationDatabase.db.prepare(`INSERT OR IGNORE INTO location_dataset_editions(uid, country_code, edition, title, authority, effective_date, status, source_sha256, statistics_json, notes) VALUES (?, 'UG', ?, ?, 'Uganda Electoral Commission', '2025-01-10', 'candidate', ?, ?, ?)`)
    .run(`ug-ec-${candidate.metadata.sourceYear}-${candidate.metadata.sourceSha256.slice(0, 12)}`, String(candidate.metadata.sourceYear), candidate.metadata.title, candidate.metadata.sourceSha256, JSON.stringify(candidate.metadata.statistics), 'Partial demarcated electoral-area layer; not a complete replacement administrative hierarchy.');
}

{
  const legacyStorePath = path.join(process.cwd(), 'countries-store.json');
  let countriesToMigrate = allAfricanCountries;
  if (fs.existsSync(legacyStorePath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(legacyStorePath, 'utf8'));
      if (Array.isArray(parsed) && parsed.length > 0) countriesToMigrate = parsed as Country[];
    } catch (error) {
      console.error('Unable to read countries-store.json; loading configured defaults instead:', error);
    }
  }
  const registeredCodes = new Set(locationDatabase.getCountries().map((country) => country.countryCode));
  for (const country of countriesToMigrate) {
    // Register a canonical country root and schema. Legacy mock children are not
    // authoritative and some contain invalid cross-level parent relationships.
    if (!registeredCodes.has(country.countryCode)) {
      locationDatabase.syncManagedLocations({ ...country, adminLevels: [] });
    }
  }
}

function integerQuery(value: unknown, fallback?: number): number | undefined {
  if (value == null || value === '') return fallback;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isInteger(parsed) ? parsed : fallback;
}

function routeParam(request: express.Request, name: string): string {
  const value = request.params[name];
  return Array.isArray(value) ? value[0] : value;
}

function actorFromRequest(request: express.Request): string {
  return apiPrincipal(request).uid;
}

function leadershipActorFromRequest(request: express.Request) {
  const principal = apiPrincipal(request);
  return { uid: principal.uid, email: principal.email, role: principal.role };
}

function errorStatus(error: unknown): number {
  const message = error instanceof Error ? error.message : '';
  if (message.includes('not found') || message.includes('not configured')) return 404;
  if (message.includes('UNIQUE constraint') || message.includes('has children')) return 409;
  return 400;
}

async function startServer() {
  const app = express();
  const httpServer = createHttpServer(app);
  const port = Number(process.env.PORT || 3000);
  app.set('trust proxy', 1);
  app.use(apiPlatform.requestContext());
  app.use(apiPlatform.versionHeaders());
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  app.use('/api', authenticateApiRequest);
  app.use('/api', apiPlatform.usageLimits());
  app.use('/api', apiPlatform.idempotency());

  app.get('/api/v1/session', (request, response) => {
    const principal = apiPrincipal(request);
    return response.json({ ...principal, isOwner: isOwnerRequest(request) });
  });

  app.get('/api/v1/openapi.json', (_request, response) => response.json(locationApiOpenApi));

  app.get('/api/v1/admin/users', authorizeOwner, async (_request, response) => {
    try {
      const result = await getAuth().listUsers(1000);
      return response.json({
        items: result.users.map((account) => ({
          uid: account.uid,
          email: account.email || '',
          name: account.displayName || account.email?.split('@')[0] || 'User',
          emailVerified: account.emailVerified,
          disabled: account.disabled,
          role: String(account.customClaims?.role || 'contributor'),
          assignedCountryCodes: Array.isArray(account.customClaims?.assignedCountryCodes) ? account.customClaims.assignedCountryCodes : [],
          assignedLocationReferenceCodes: Array.isArray(account.customClaims?.assignedLocationReferenceCodes) ? account.customClaims.assignedLocationReferenceCodes : [],
          createdAt: account.metadata.creationTime,
          lastSignInAt: account.metadata.lastSignInTime || null,
        })),
      });
    } catch (error) {
      console.error('Unable to list Firebase users', error);
      return response.status(500).json({ message: 'Unable to load registered users. Check the server Firebase Admin credentials.' });
    }
  });

  app.patch('/api/v1/admin/users/:uid/access', authorizeOwner, async (request, response) => {
    try {
      const role = String(request.body.role || '') as ApiRole;
      const status = request.body.status === 'disabled' ? 'disabled' : 'active';
      const assignedCountryCodes = Array.isArray(request.body.assignedCountryCodes)
        ? [...new Set(request.body.assignedCountryCodes.map(String).map((code: string) => code.trim().toUpperCase()).filter((code: string) => /^[A-Z]{2}$/.test(code)))]
        : [];
      const assignedLocationReferenceCodes: string[] = Array.isArray(request.body.assignedLocationReferenceCodes)
        ? [...new Set<string>(request.body.assignedLocationReferenceCodes.map((value: unknown) => String(value).trim().toUpperCase()).filter(Boolean))]
        : [];
      if (!apiRoles.has(role)) return response.status(400).json({ message: 'Select a valid application role.' });
      if (!['country_admin', 'contributor'].includes(role) && assignedCountryCodes.length > 0) {
        return response.status(400).json({ message: 'Country assignments apply only to country administrators and contributors.' });
      }
      if (assignedLocationReferenceCodes.length > 10) return response.status(400).json({ message: 'Assign at most 10 location scope roots to one account.' });
      const invalidScope = assignedLocationReferenceCodes.find((code) => !locationDatabase.getLocationByReferenceCode(code));
      if (invalidScope) return response.status(400).json({ message: `Location scope reference not found: ${invalidScope}` });
      const account = await getAuth().getUser(routeParam(request, 'uid'));
      if (account.email && (process.env.OWNER_EMAILS || '').split(',').map((email) => email.trim().toLowerCase()).includes(account.email.toLowerCase())) {
        return response.status(409).json({ message: 'The configured owner account cannot be modified from this screen.' });
      }
      await getAuth().setCustomUserClaims(account.uid, { role, status, assignedCountryCodes, assignedLocationReferenceCodes });
      await getAuth().updateUser(account.uid, { disabled: status === 'disabled' });
      await getFirestore().doc(`users/${account.uid}`).set({
        uid: account.uid,
        email: account.email || '',
        name: account.displayName || account.email?.split('@')[0] || 'User',
        avatar: account.photoURL || null,
        role,
        status,
        assignedCountryCodes,
        assignedLocationReferenceCodes,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      return response.json({ uid: account.uid, role, status, assignedCountryCodes, assignedLocationReferenceCodes });
    } catch (error) {
      console.error('Unable to update Firebase user access', error);
      return response.status(500).json({ message: 'Unable to update this user. Check the server Firebase Admin credentials.' });
    }
  });

  app.get('/api/v1/admin/api-clients', authorizeOwner, (_request, response) => response.json({ items: apiPlatform.listClients() }));
  app.post('/api/v1/admin/api-clients', authorizeOwner, (request, response) => {
    try { return response.status(201).json(apiPlatform.createClient(request.body, actorFromRequest(request))); }
    catch (error) { return response.status(errorStatus(error)).json({ message: error instanceof Error ? error.message : 'Unable to create API client' }); }
  });
  app.post('/api/v1/admin/api-clients/:uid/revoke', authorizeOwner, (request, response) => { apiPlatform.revokeClient(routeParam(request, 'uid')); return response.status(204).send(); });

  app.get('/api/v1/dataset-editions', (request, response) => {
    const countryCode = String(request.query.countryCode || '').toUpperCase();
    const rows = locationDatabase.db.prepare(`SELECT uid, country_code AS countryCode, edition, title, authority, effective_date AS effectiveDate, status, source_sha256 AS sourceSha256, statistics_json AS statistics, notes, created_at AS createdAt FROM location_dataset_editions WHERE (? = '' OR country_code = ?) ORDER BY effective_date DESC, created_at DESC`).all(countryCode, countryCode) as Record<string, unknown>[];
    return response.json({ items: rows.map((row) => ({ ...row, statistics: JSON.parse(String(row.statistics)) })) });
  });
  app.get('/api/v1/dataset-editions/:uid/locations', (request, response) => {
    const edition = locationDatabase.db.prepare('SELECT * FROM location_dataset_editions WHERE uid = ?').get(routeParam(request, 'uid')) as Record<string, unknown> | undefined;
    if (!edition) return response.status(404).json({ message: 'Dataset edition not found' });
    if (edition.country_code !== 'UG' || edition.edition !== '2025' || !candidateCrosswalk) return response.status(404).json({ message: 'Edition records are not available from this server.' });
    const match = String(request.query.match || 'all'); const search = String(request.query.search || '').trim().toUpperCase();
    if (!['all', 'exact', 'unmatched'].includes(match)) return response.status(400).json({ code: 'INVALID_MATCH_FILTER', message: 'match must be all, exact, or unmatched.' });
    const filtered = candidateCrosswalk.records.filter((record) => (match === 'all' || record.match === match) && (!search || record.path.some((part) => part.toUpperCase().includes(search))));
    const limit = Math.min(Math.max(integerQuery(request.query.limit, 100) || 100, 1), 1000); const offset = Math.max(integerQuery(request.query.offset, 0) || 0, 0);
    return response.json({ edition: { uid: edition.uid, countryCode: edition.country_code, edition: edition.edition, status: edition.status }, items: filtered.slice(offset, offset + limit), total: filtered.length, limit, offset, reconciliation: candidateCrosswalk.report });
  });

  app.post('/api/v1/webhooks', (request, response) => {
    const principal = apiPrincipal(request);
    if (principal.identityType !== 'machine' || !principal.clientId || !principal.scopes?.includes('webhooks:manage')) return response.status(403).json({ code: 'WEBHOOK_SCOPE_REQUIRED', message: 'A machine credential with webhooks:manage is required.' });
    try { return response.status(201).json(apiPlatform.createWebhook(principal.clientId, request.body.url, Array.isArray(request.body.events) ? request.body.events : [])); }
    catch (error) { return response.status(400).json({ message: error instanceof Error ? error.message : 'Unable to create webhook' }); }
  });
  app.get('/api/v1/webhooks', (request, response) => {
    const principal = apiPrincipal(request);
    if (principal.identityType !== 'machine' || !principal.clientId || !principal.scopes?.includes('webhooks:manage')) return response.status(403).json({ code: 'WEBHOOK_SCOPE_REQUIRED', message: 'A machine credential with webhooks:manage is required.' });
    return response.json({ items: apiPlatform.listWebhooks(principal.clientId) });
  });
  app.delete('/api/v1/webhooks/:uid', (request, response) => {
    const principal = apiPrincipal(request);
    if (principal.identityType !== 'machine' || !principal.clientId || !principal.scopes?.includes('webhooks:manage')) return response.status(403).json({ code: 'WEBHOOK_SCOPE_REQUIRED', message: 'A machine credential with webhooks:manage is required.' });
    return apiPlatform.disableWebhook(principal.clientId, routeParam(request, 'uid')) ? response.status(204).send() : response.status(404).json({ message: 'Webhook not found' });
  });

  const countryFromLocation = (request: express.Request) => locationDatabase.getLocation(routeParam(request, 'uid'))?.countryCode;
  const countryFromReference = (request: express.Request) => locationDatabase.getLocationByReferenceCode(routeParam(request, 'referenceCode'))?.countryCode;
  const canReadLocation = (request: express.Request, location: LocationRecord) => {
    const principal = apiPrincipal(request);
    return canPrincipalReadLocation(principal, location, (uid, references) => locationDatabase.isWithinAnyScope(uid, references));
  };
  const hasCountryWideRead = (request: express.Request, countryCode: string) => principalHasCountryWideRead(apiPrincipal(request), countryCode);
  const canReadCountry = (request: express.Request, countryCode: string) => hasCountryWideRead(request, countryCode)
    || apiPrincipal(request).assignedLocationReferenceCodes.some((referenceCode) =>
      locationDatabase.getLocationByReferenceCode(referenceCode)?.countryCode === countryCode.toUpperCase());
  const requireCountryRead = (request: express.Request, response: express.Response): boolean => {
    if (canReadCountry(request, routeParam(request, 'countryCode'))) return true;
    response.status(403).json({ code: 'COUNTRY_SCOPE_REQUIRED', message: 'This account is not assigned to the requested country.' });
    return false;
  };
  const authorizeLocationRead: express.RequestHandler = (request, response, next) => {
    const location = locationDatabase.getLocationByReferenceCode(routeParam(request, 'referenceCode'));
    if (!location) return response.status(404).json({ message: 'Location reference not found' });
    if (!canReadLocation(request, location)) {
      return response.status(403).json({ code: 'LOCATION_SCOPE_REQUIRED', message: 'This account is not assigned to the requested location subtree.' });
    }
    return next();
  };
  const authorizeScopedLocationRead = (scope: string): express.RequestHandler => (request, response, next) => {
    const principal = apiPrincipal(request);
    if (principal.identityType === 'machine' && !principal.scopes?.includes(scope)) return response.status(403).json({ code: 'API_SCOPE_REQUIRED', message: `The credential requires ${scope}.` });
    return authorizeLocationRead(request, response, next);
  };
  const authorizeLocationContribution: express.RequestHandler = (request, response, next) => {
    const location = locationDatabase.getLocationByReferenceCode(routeParam(request, 'referenceCode'));
    if (!location) return response.status(404).json({ message: 'Location reference not found' });
    const principal = apiPrincipal(request);
    const countryAssigned = principal.assignedCountryCodes.includes(location.countryCode);
    const locationAssigned = principal.assignedLocationReferenceCodes.length > 0 && canReadLocation(request, location);
    const mayContribute = (principal.identityType === 'machine' && principal.scopes?.includes('locations:write') && canReadLocation(request, location))
      || principal.role === 'admin'
      || (principal.role === 'country_admin' && countryAssigned && canReadLocation(request, location))
      || (principal.role === 'contributor' && (countryAssigned || locationAssigned) && canReadLocation(request, location));
    if (!mayContribute) return response.status(403).json({ code: 'LOCATION_WRITE_SCOPE_REQUIRED', message: 'This account is not authorized to update leadership for this location.' });
    return next();
  };
  const authorizeLeadershipContribution: express.RequestHandler = (request, response, next) => {
    const principal = apiPrincipal(request);
    if (principal.identityType === 'machine' && !principal.scopes?.includes('leadership:manage')) return response.status(403).json({ code: 'LEADERSHIP_SCOPE_REQUIRED', message: 'The credential requires leadership:manage.' });
    return authorizeLocationContribution(request, response, next);
  };
  const locationLinks = (referenceCode: string) => ({
    self: `/api/v1/locations/${referenceCode}`,
    children: `/api/v1/locations/${referenceCode}/children`,
    subtree: `/api/v1/locations/${referenceCode}/subtree`,
    ancestors: `/api/v1/locations/${referenceCode}/ancestors`,
    geometry: `/api/v1/locations/${referenceCode}/geometry`,
    leader: `/api/v1/locations/${referenceCode}/leader`,
    leadershipHistory: `/api/v1/locations/${referenceCode}/leadership-history`,
  });

  // Stable, versioned integration API. Reference codes are immutable public identifiers;
  // UUID routes below remain available to the first-party application.
  app.get('/api/v1/countries', (request, response) => response.json({
    items: locationDatabase.getCountries().filter((country) => canReadCountry(request, country.countryCode)),
  }));

  app.get('/api/v1/countries/:countryCode/schema', (request, response) => {
    try {
      if (!requireCountryRead(request, response)) return;
      return response.json(locationDatabase.getHierarchy(routeParam(request, 'countryCode')));
    } catch (error) {
      return response.status(errorStatus(error)).json({ message: error instanceof Error ? error.message : 'Unable to load hierarchy' });
    }
  });

  app.put('/api/v1/countries/:countryCode/schema', authorize('manage_country', (request) => routeParam(request, 'countryCode')), (request, response) => {
    try {
      if (!Array.isArray(request.body.levels)) throw new Error('levels must be an array');
      return response.json(locationDatabase.setHierarchy(routeParam(request, 'countryCode'), request.body.levels as AdminLevelName[]));
    } catch (error) {
      return response.status(errorStatus(error)).json({ message: error instanceof Error ? error.message : 'Unable to update hierarchy' });
    }
  });

  app.get('/api/v1/countries/:countryCode/locations', (request, response) => {
    try {
      if (!requireCountryRead(request, response)) return;
      const parentReferenceCode = request.query.parentReferenceCode?.toString();
      const parent = parentReferenceCode ? locationDatabase.getLocationByReferenceCode(parentReferenceCode) : undefined;
      if (parentReferenceCode && (!parent || parent.countryCode !== routeParam(request, 'countryCode').toUpperCase())) {
        return response.status(404).json({ message: 'Parent location reference not found in this country' });
      }
      if (!hasCountryWideRead(request, routeParam(request, 'countryCode')) && (!parent || !canReadLocation(request, parent))) {
        return response.status(403).json({ code: 'LOCATION_SCOPE_REQUIRED', message: 'Use an assigned location reference as parentReferenceCode.' });
      }
      const page = locationDatabase.listLocations(routeParam(request, 'countryCode'), {
        parentUid: parent?.uid,
        levelOrder: integerQuery(request.query.level),
        search: request.query.search?.toString(),
        limit: integerQuery(request.query.limit, 100),
        offset: integerQuery(request.query.offset, 0),
      });
      return response.json({ ...page, apiVersion: 'v1' });
    } catch (error) {
      return response.status(errorStatus(error)).json({ message: error instanceof Error ? error.message : 'Unable to list locations' });
    }
  });

  app.get('/api/v1/countries/:countryCode/export', (request, response) => {
    try {
      if (!requireCountryRead(request, response)) return;
      const format = String(request.query.format || 'json').toLowerCase();
      if (!['json', 'csv', 'geojson'].includes(format)) return response.status(400).json({ code: 'INVALID_EXPORT_FORMAT', message: 'format must be json, csv, or geojson.' });
      const page = locationDatabase.listLocations(routeParam(request, 'countryCode'), { levelOrder: integerQuery(request.query.level), search: request.query.search?.toString(), limit: integerQuery(request.query.limit, 1000), offset: integerQuery(request.query.offset, 0) });
      const items = page.items.filter((item) => canReadLocation(request, item));
      if (format === 'csv') {
        const quote = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
        const body = ['referenceCode,name,type,levelName,levelOrder,countryCode', ...items.map((item) => [item.referenceCode, item.name, item.type, item.levelName, item.levelOrder, item.countryCode].map(quote).join(','))].join('\n');
        response.type('text/csv').setHeader('Content-Disposition', `attachment; filename="${routeParam(request, 'countryCode').toLowerCase()}-locations.csv"`); return response.send(body);
      }
      if (format === 'geojson') {
        const features = items.flatMap((item) => { const geometry = locationDatabase.getGeometry(item.uid); return geometry ? [{ type: 'Feature', id: item.referenceCode, properties: { referenceCode: item.referenceCode, name: item.name, type: item.type, levelName: item.levelName }, geometry: geometry.geometry }] : []; });
        return response.json({ type: 'FeatureCollection', features, pagination: { total: page.total, limit: page.limit, offset: page.offset } });
      }
      return response.json({ items, total: page.total, limit: page.limit, offset: page.offset });
    } catch (error) { return response.status(errorStatus(error)).json({ message: error instanceof Error ? error.message : 'Unable to export locations' }); }
  });

  app.get('/api/v1/countries/:countryCode/resolve-location', (request, response) => {
    try {
      if (!requireCountryRead(request, response)) return;
      const names = String(request.query.path || '').split('|').map((name) => name.trim()).filter(Boolean);
      if (names.length === 0 || names.length > 12) return response.status(400).json({ message: 'Supply a path containing 1 to 12 location names.' });
      const location = locationDatabase.resolveLocationPath(routeParam(request, 'countryCode'), names);
      if (!location) return response.status(404).json({ message: 'No location matches the complete hierarchy path.' });
      if (!canReadLocation(request, location)) return response.status(403).json({ code: 'LOCATION_SCOPE_REQUIRED', message: 'This account is not assigned to the resolved location.' });
      return response.json(location);
    } catch (error) {
      return response.status(errorStatus(error)).json({ message: error instanceof Error ? error.message : 'Unable to resolve location path' });
    }
  });

  app.post('/api/v1/countries/:countryCode/resolve-locations', (request, response) => {
    try {
      if (!requireCountryRead(request, response)) return;
      if (!Array.isArray(request.body.paths) || request.body.paths.length < 1 || request.body.paths.length > 500) {
        return response.status(400).json({ message: 'paths must contain between 1 and 500 hierarchy paths.' });
      }
      const items = request.body.paths.map((path: unknown, index: number) => {
        if (!Array.isArray(path) || path.length < 1 || path.length > 12 || path.some((name) => typeof name !== 'string' || !name.trim())) {
          throw new Error(`paths[${index}] must contain 1 to 12 non-empty location names`);
        }
        const names = path.map(String);
        const location = locationDatabase.resolveLocationPath(routeParam(request, 'countryCode'), names);
        return { path: names, location: location && canReadLocation(request, location) ? location : null };
      });
      return response.json({ items });
    } catch (error) {
      return response.status(errorStatus(error)).json({ message: error instanceof Error ? error.message : 'Unable to resolve location paths' });
    }
  });

  app.post('/api/v1/countries/:countryCode/locations', authorize('contribute', (request) => routeParam(request, 'countryCode')), (request, response) => {
    try {
      const parent = locationDatabase.getLocationByReferenceCode(String(request.body.parentReferenceCode || ''));
      if (!parent || parent.countryCode !== routeParam(request, 'countryCode').toUpperCase()) {
        return response.status(404).json({ message: 'Parent location reference not found in this country' });
      }
      const created = locationDatabase.insertLocation({
        ...request.body,
        countryCode: routeParam(request, 'countryCode').toUpperCase(),
        parentUid: parent.uid,
      } as NewLocationInput, actorFromRequest(request));
      apiPlatform.emit('location.created', created);
      return response.status(201).json(created);
    } catch (error) {
      return response.status(errorStatus(error)).json({ message: error instanceof Error ? error.message : 'Unable to create location' });
    }
  });

  app.get('/api/v1/locations/:referenceCode', authorizeLocationRead, (request, response) => {
    const location = locationDatabase.getLocationByReferenceCode(routeParam(request, 'referenceCode'));
    return response.json({ ...location, links: locationLinks(routeParam(request, 'referenceCode')) });
  });

  app.get('/api/v1/locations/:referenceCode/ancestors', authorizeLocationRead, (request, response) => {
    const location = locationDatabase.getLocationByReferenceCode(routeParam(request, 'referenceCode'));
    return location ? response.json({ items: locationDatabase.getAncestors(location.uid) }) : response.status(404).json({ message: 'Location reference not found' });
  });

  app.get('/api/v1/locations/:referenceCode/descendants', authorizeLocationRead, (request, response) => {
    const location = locationDatabase.getLocationByReferenceCode(routeParam(request, 'referenceCode'));
    if (!location) return response.status(404).json({ message: 'Location reference not found' });
    return response.json(locationDatabase.getDescendants(
      location.uid,
      integerQuery(request.query.maxDepth),
      integerQuery(request.query.limit, 1000),
      integerQuery(request.query.offset, 0),
    ));
  });

  app.get('/api/v1/locations/:referenceCode/children', authorizeLocationRead, (request, response) => {
    const referenceCode = routeParam(request, 'referenceCode');
    const location = locationDatabase.getLocationByReferenceCode(referenceCode) as LocationRecord;
    const page = locationDatabase.getDescendants(location.uid, 1, integerQuery(request.query.limit, 100), integerQuery(request.query.offset, 0));
    return response.json({ root: location, ...page, links: locationLinks(referenceCode), apiVersion: 'v1' });
  });

  app.get('/api/v1/locations/:referenceCode/subtree', authorizeLocationRead, (request, response) => {
    const referenceCode = routeParam(request, 'referenceCode');
    const location = locationDatabase.getLocationByReferenceCode(referenceCode) as LocationRecord;
    const page = locationDatabase.getDescendants(
      location.uid,
      integerQuery(request.query.maxDepth),
      integerQuery(request.query.limit, 1000),
      integerQuery(request.query.offset, 0),
    );
    return response.json({ root: location, ...page, links: locationLinks(referenceCode), apiVersion: 'v1' });
  });

  app.get('/api/v1/locations/:referenceCode/api', authorizeLocationRead, (request, response) => {
    const referenceCode = routeParam(request, 'referenceCode');
    const location = locationDatabase.getLocationByReferenceCode(referenceCode) as LocationRecord;
    return response.json({
      apiVersion: 'v1',
      scope: location,
      description: `Hierarchical API rooted at ${location.name} (${location.levelName}).`,
      links: locationLinks(referenceCode),
      query: { children: ['limit', 'offset'], subtree: ['maxDepth', 'limit', 'offset'] },
    });
  });

  app.get('/api/v1/locations/:referenceCode/geometry', authorizeScopedLocationRead('geometry:read'), (request, response) => {
    const location = locationDatabase.getLocationByReferenceCode(routeParam(request, 'referenceCode'));
    if (!location) return response.status(404).json({ message: 'Location reference not found' });
    const geometry = locationDatabase.getGeometry(location.uid);
    return geometry ? response.json(geometry) : response.status(404).json({ message: 'Geometry not available for this location' });
  });

  app.get('/api/v1/locations/:referenceCode/leader', authorizeScopedLocationRead('leadership:read'), (request, response) => {
    const location = locationDatabase.getLocationByReferenceCode(routeParam(request, 'referenceCode')) as LocationRecord;
    return response.json({ location, leader: locationDatabase.getCurrentLeader(location.uid) });
  });

  app.get('/api/v1/locations/:referenceCode/leadership-history', authorizeScopedLocationRead('audit:read'), (request, response) => {
    const location = locationDatabase.getLocationByReferenceCode(routeParam(request, 'referenceCode')) as LocationRecord;
    return response.json({ location, ...locationDatabase.getLeadershipHistory(location.uid, integerQuery(request.query.limit, 100), integerQuery(request.query.offset, 0)) });
  });

  app.put('/api/v1/locations/:referenceCode/leader', authorizeLeadershipContribution, (request, response) => {
    try {
      const location = locationDatabase.getLocationByReferenceCode(routeParam(request, 'referenceCode')) as LocationRecord;
      const leader = locationDatabase.saveCurrentLeader(location.uid, request.body, leadershipActorFromRequest(request)); apiPlatform.emit('leadership.changed', { location, leader }); return response.json({ location, leader });
    } catch (error) {
      return response.status(errorStatus(error)).json({ message: error instanceof Error ? error.message : 'Unable to save location leader' });
    }
  });

  app.post('/api/v1/locations/:referenceCode/leader/end', authorizeLeadershipContribution, (request, response) => {
    try {
      const location = locationDatabase.getLocationByReferenceCode(routeParam(request, 'referenceCode')) as LocationRecord;
      const leader = locationDatabase.endCurrentLeader(location.uid, request.body.termEndedOn, leadershipActorFromRequest(request)); apiPlatform.emit('leadership.changed', { location, leader }); return response.json({ location, leader });
    } catch (error) {
      return response.status(errorStatus(error)).json({ message: error instanceof Error ? error.message : 'Unable to end leader term' });
    }
  });

  app.patch('/api/v1/locations/:referenceCode', authorize('contribute', countryFromReference), (request, response) => {
    try {
      const location = locationDatabase.getLocationByReferenceCode(routeParam(request, 'referenceCode'));
      if (!location) return response.status(404).json({ message: 'Location reference not found' });
      const updated = locationDatabase.updateLocation(location.uid, request.body, actorFromRequest(request)); apiPlatform.emit('location.updated', updated); return response.json(updated);
    } catch (error) {
      return response.status(errorStatus(error)).json({ message: error instanceof Error ? error.message : 'Unable to update location' });
    }
  });

  app.post('/api/v1/locations/:referenceCode/move', authorize('manage_country', countryFromReference), (request, response) => {
    try {
      const location = locationDatabase.getLocationByReferenceCode(routeParam(request, 'referenceCode'));
      const parent = locationDatabase.getLocationByReferenceCode(String(request.body.parentReferenceCode || ''));
      if (!location || !parent) return response.status(404).json({ message: 'Location or parent reference not found' });
      if (location.countryCode !== parent.countryCode) return response.status(400).json({ message: 'Location and parent must belong to the same country' });
      const moved = locationDatabase.moveLocation(location.uid, parent.uid, actorFromRequest(request)); apiPlatform.emit('location.moved', moved); return response.json(moved);
    } catch (error) {
      return response.status(errorStatus(error)).json({ message: error instanceof Error ? error.message : 'Unable to move location' });
    }
  });

  app.delete('/api/v1/locations/:referenceCode', authorize('manage_country', countryFromReference), (request, response) => {
    try {
      const location = locationDatabase.getLocationByReferenceCode(routeParam(request, 'referenceCode'));
      if (!location) return response.status(404).json({ message: 'Location reference not found' });
      locationDatabase.deleteLocation(location.uid, request.query.cascade === 'true', actorFromRequest(request)); apiPlatform.emit('location.deleted', location);
      return response.status(204).send();
    } catch (error) {
      return response.status(errorStatus(error)).json({ message: error instanceof Error ? error.message : 'Unable to delete location' });
    }
  });

  // Compatibility endpoints: existing screens still receive numeric local IDs,
  // plus canonical UUIDs projected from the normalized location tables.
  app.get('/api/countries', (request, response) => response.json(
    locationDatabase.getCountries().filter((country) => canReadCountry(request, country.countryCode)),
  ));

  app.get('/api/countries/:id', (request, response) => {
    const country = locationDatabase.getCountryByLegacyId(Number.parseInt(routeParam(request, 'id'), 10));
    if (country && !canReadCountry(request, country.countryCode)) return response.status(403).json({ code: 'COUNTRY_SCOPE_REQUIRED', message: 'This account is not assigned to the requested country.' });
    return country ? response.json(country) : response.status(404).json({ message: 'Country not found' });
  });

  app.post('/api/countries', authorize('manage_system'), (request, response) => {
    try {
      const existing = locationDatabase.getCountries();
      const newCountry: Country = {
        ...request.body,
        id: existing.length > 0 ? Math.max(...existing.map((country) => country.id)) + 1 : 1,
        adminLevels: request.body.adminLevels || [],
        updatedAt: new Date().toISOString(),
      };
      return response.status(201).json(locationDatabase.syncManagedLocations(newCountry));
    } catch (error) {
      return response.status(errorStatus(error)).json({ message: error instanceof Error ? error.message : 'Unable to create country' });
    }
  });

  app.put('/api/countries/:id', authorize('manage_system'), (request, response) => {
    try {
      const id = Number.parseInt(routeParam(request, 'id'), 10);
      if (!locationDatabase.getCountryByLegacyId(id)) return response.status(404).json({ message: 'Country not found' });
      const country: Country = { ...request.body, id, updatedAt: new Date().toISOString() };
      return response.json(locationDatabase.syncManagedLocations(country));
    } catch (error) {
      return response.status(errorStatus(error)).json({ message: error instanceof Error ? error.message : 'Unable to update country' });
    }
  });

  app.delete('/api/countries/:id', authorize('manage_system'), (request, response) => {
    const deleted = locationDatabase.deleteCountry(Number.parseInt(routeParam(request, 'id'), 10));
    return deleted ? response.status(204).send() : response.status(404).json({ message: 'Country not found' });
  });

  // Country-configurable hierarchy and canonical UUID-based location API.
  app.get('/api/location-registry/statistics', (request, response) => {
    response.json(locationDatabase.getStatistics(request.query.countryCode?.toString()));
  });

  app.get('/api/location-registry/countries/:countryCode/schema', (request, response) => {
    try {
      if (!requireCountryRead(request, response)) return;
      return response.json(locationDatabase.getHierarchy(routeParam(request, 'countryCode')));
    } catch (error) {
      return response.status(errorStatus(error)).json({ message: error instanceof Error ? error.message : 'Unable to load hierarchy' });
    }
  });

  app.put('/api/location-registry/countries/:countryCode/schema', authorize('manage_country', (request) => routeParam(request, 'countryCode')), (request, response) => {
    try {
      const definitions = request.body.levels as AdminLevelName[];
      if (!Array.isArray(definitions)) throw new Error('levels must be an array');
      return response.json(locationDatabase.setHierarchy(routeParam(request, 'countryCode'), definitions));
    } catch (error) {
      return response.status(errorStatus(error)).json({ message: error instanceof Error ? error.message : 'Unable to update hierarchy' });
    }
  });

  app.get('/api/location-registry/countries/:countryCode/locations', (request, response) => {
    try {
      if (!requireCountryRead(request, response)) return;
      const parentUid = request.query.parentUid?.toString();
      const parent = parentUid ? locationDatabase.getLocation(parentUid) : null;
      if (!hasCountryWideRead(request, routeParam(request, 'countryCode')) && (!parent || !canReadLocation(request, parent))) {
        return response.status(403).json({ code: 'LOCATION_SCOPE_REQUIRED', message: 'Use an assigned location as parentUid.' });
      }
      return response.json(locationDatabase.listLocations(routeParam(request, 'countryCode'), {
        parentUid,
        levelOrder: integerQuery(request.query.level),
        search: request.query.search?.toString(),
        limit: integerQuery(request.query.limit, 100),
        offset: integerQuery(request.query.offset, 0),
      }));
    } catch (error) {
      return response.status(errorStatus(error)).json({ message: error instanceof Error ? error.message : 'Unable to list locations' });
    }
  });

  app.get('/api/location-registry/locations/:uid', (request, response) => {
    const location = locationDatabase.getLocation(routeParam(request, 'uid'));
    if (location && !canReadLocation(request, location)) return response.status(403).json({ code: 'LOCATION_SCOPE_REQUIRED', message: 'This account is not assigned to the requested location subtree.' });
    return location ? response.json(location) : response.status(404).json({ message: 'Location not found' });
  });

  app.get('/api/location-registry/references/:referenceCode', (request, response) => {
    const location = locationDatabase.getLocationByReferenceCode(routeParam(request, 'referenceCode'));
    if (location && !canReadLocation(request, location)) return response.status(403).json({ code: 'LOCATION_SCOPE_REQUIRED', message: 'This account is not assigned to the requested location subtree.' });
    return location ? response.json(location) : response.status(404).json({ message: 'Location reference not found' });
  });

  app.get('/api/location-registry/locations/:uid/ancestors', (request, response) => {
    const location = locationDatabase.getLocation(routeParam(request, 'uid'));
    if (!location) return response.status(404).json({ message: 'Location not found' });
    if (!canReadLocation(request, location)) return response.status(403).json({ code: 'LOCATION_SCOPE_REQUIRED', message: 'This account is not assigned to the requested location subtree.' });
    return response.json(locationDatabase.getAncestors(routeParam(request, 'uid')));
  });

  app.get('/api/location-registry/locations/:uid/geometry', (request, response) => {
    const location = locationDatabase.getLocation(routeParam(request, 'uid'));
    if (!location) return response.status(404).json({ message: 'Location not found' });
    if (!canReadLocation(request, location)) return response.status(403).json({ code: 'LOCATION_SCOPE_REQUIRED', message: 'This account is not assigned to the requested location subtree.' });
    const geometry = locationDatabase.getGeometry(routeParam(request, 'uid'));
    return geometry ? response.json(geometry) : response.status(404).json({ message: 'Geometry not available for this location' });
  });

  app.get('/api/location-registry/locations/:uid/descendants', (request, response) => {
    const location = locationDatabase.getLocation(routeParam(request, 'uid'));
    if (!location) return response.status(404).json({ message: 'Location not found' });
    if (!canReadLocation(request, location)) return response.status(403).json({ code: 'LOCATION_SCOPE_REQUIRED', message: 'This account is not assigned to the requested location subtree.' });
    return response.json(locationDatabase.getDescendants(
      routeParam(request, 'uid'),
      integerQuery(request.query.maxDepth),
      integerQuery(request.query.limit, 1000),
      integerQuery(request.query.offset, 0),
    ));
  });

  app.post('/api/location-registry/locations', authorize('contribute', (request) => String(request.body.countryCode || '')), (request, response) => {
    try {
      return response.status(201).json(locationDatabase.insertLocation(request.body as NewLocationInput, actorFromRequest(request)));
    } catch (error) {
      return response.status(errorStatus(error)).json({ message: error instanceof Error ? error.message : 'Unable to create location' });
    }
  });

  app.patch('/api/location-registry/locations/:uid', authorize('contribute', countryFromLocation), (request, response) => {
    try {
      const patch = request.body as Partial<Pick<LocationRecord, 'name' | 'type' | 'status' | 'metadata'>>;
      return response.json(locationDatabase.updateLocation(routeParam(request, 'uid'), patch, actorFromRequest(request)));
    } catch (error) {
      return response.status(errorStatus(error)).json({ message: error instanceof Error ? error.message : 'Unable to update location' });
    }
  });

  app.post('/api/location-registry/locations/:uid/move', authorize('manage_country', countryFromLocation), (request, response) => {
    try {
      return response.json(locationDatabase.moveLocation(routeParam(request, 'uid'), String(request.body.parentUid || ''), actorFromRequest(request)));
    } catch (error) {
      return response.status(errorStatus(error)).json({ message: error instanceof Error ? error.message : 'Unable to move location' });
    }
  });

  app.delete('/api/location-registry/locations/:uid', authorize('manage_country', countryFromLocation), (request, response) => {
    try {
      locationDatabase.deleteLocation(routeParam(request, 'uid'), request.query.cascade === 'true', actorFromRequest(request));
      return response.status(204).send();
    } catch (error) {
      return response.status(errorStatus(error)).json({ message: error instanceof Error ? error.message : 'Unable to delete location' });
    }
  });

  // API requests must terminate as JSON and must never fall through to the SPA HTML shell.
  app.use('/api', (request, response) => response.status(404).json({
    code: 'API_ROUTE_NOT_FOUND',
    message: `No API route matches ${request.method} ${request.originalUrl}.`,
    requestId: response.getHeader('X-Request-ID'),
  }));
  app.use((error: unknown, request: express.Request, response: express.Response, next: express.NextFunction) => {
    if (!request.path.startsWith('/api')) return next(error);
    const message = error instanceof Error ? error.message : 'Unexpected API error';
    const malformedJson = error instanceof SyntaxError && 'body' in error;
    return response.status(malformedJson ? 400 : 500).json({
      code: malformedJson ? 'INVALID_JSON' : 'INTERNAL_API_ERROR',
      message: malformedJson ? 'The request body is not valid JSON.' : message,
      requestId: response.getHeader('X-Request-ID'),
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    app.use((_request, response, next) => {
      response.setHeader('Cache-Control', 'no-store');
      next();
    });
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: { server: httpServer } },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (_request, response) => response.sendFile(path.join(distPath, 'index.html')));
  }

  const server = httpServer.listen(port, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${port}`);
    console.log(`Location database: ${databasePath}`);
  });

  const shutdown = () => server.close(() => {
    locationDatabase.close();
    process.exit(0);
  });
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

startServer().catch((error) => {
  console.error(error);
  locationDatabase.close();
  process.exit(1);
});
