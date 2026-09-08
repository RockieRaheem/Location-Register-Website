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
import { apiPrincipal, authenticateApiRequest, authorize, authorizeOwner, isOwnerRequest } from './apiAuth.ts';
import { apiRoles, type ApiRole } from './apiPolicy.ts';

try {
  loadEnvFile(path.join(process.cwd(), '.env.local'));
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
}

const databasePath = process.env.LOCATION_DATABASE_PATH
  ? path.resolve(process.env.LOCATION_DATABASE_PATH)
  : path.join(process.cwd(), 'data', 'database', 'location-register.sqlite');
const locationDatabase = new LocationDatabase(databasePath);

if (locationDatabase.getStatistics().countries === 0) {
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
  for (const country of countriesToMigrate) locationDatabase.syncManagedLocations(country);
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
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  app.use('/api', authenticateApiRequest);

  app.get('/api/v1/session', (request, response) => {
    const principal = apiPrincipal(request);
    return response.json({ ...principal, isOwner: isOwnerRequest(request) });
  });

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

  const countryFromLocation = (request: express.Request) => locationDatabase.getLocation(routeParam(request, 'uid'))?.countryCode;
  const countryFromReference = (request: express.Request) => locationDatabase.getLocationByReferenceCode(routeParam(request, 'referenceCode'))?.countryCode;
  const canReadLocation = (request: express.Request, location: LocationRecord) => {
    const principal = apiPrincipal(request);
    return principal.role === 'admin'
      || principal.assignedCountryCodes.includes(location.countryCode)
      || locationDatabase.isWithinAnyScope(location.uid, principal.assignedLocationReferenceCodes);
  };
  const authorizeLocationRead: express.RequestHandler = (request, response, next) => {
    const location = locationDatabase.getLocationByReferenceCode(routeParam(request, 'referenceCode'));
    if (!location) return response.status(404).json({ message: 'Location reference not found' });
    if (!canReadLocation(request, location)) {
      return response.status(403).json({ code: 'LOCATION_SCOPE_REQUIRED', message: 'This account is not assigned to the requested location subtree.' });
    }
    return next();
  };
  const locationLinks = (referenceCode: string) => ({
    self: `/api/v1/locations/${referenceCode}`,
    children: `/api/v1/locations/${referenceCode}/children`,
    subtree: `/api/v1/locations/${referenceCode}/subtree`,
    ancestors: `/api/v1/locations/${referenceCode}/ancestors`,
    geometry: `/api/v1/locations/${referenceCode}/geometry`,
  });

  // Stable, versioned integration API. Reference codes are immutable public identifiers;
  // UUID routes below remain available to the first-party application.
  app.get('/api/v1/countries', (_request, response) => response.json({ items: locationDatabase.getCountries() }));

  app.get('/api/v1/countries/:countryCode/schema', (request, response) => {
    try {
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
      const parentReferenceCode = request.query.parentReferenceCode?.toString();
      const parent = parentReferenceCode ? locationDatabase.getLocationByReferenceCode(parentReferenceCode) : undefined;
      if (parentReferenceCode && (!parent || parent.countryCode !== routeParam(request, 'countryCode').toUpperCase())) {
        return response.status(404).json({ message: 'Parent location reference not found in this country' });
      }
      const principal = apiPrincipal(request);
      if (principal.assignedLocationReferenceCodes.length > 0 && (!parent || !canReadLocation(request, parent))) {
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

  app.post('/api/v1/countries/:countryCode/locations', authorize('contribute', (request) => routeParam(request, 'countryCode')), (request, response) => {
    try {
      const parent = locationDatabase.getLocationByReferenceCode(String(request.body.parentReferenceCode || ''));
      if (!parent || parent.countryCode !== routeParam(request, 'countryCode').toUpperCase()) {
        return response.status(404).json({ message: 'Parent location reference not found in this country' });
      }
      return response.status(201).json(locationDatabase.insertLocation({
        ...request.body,
        countryCode: routeParam(request, 'countryCode').toUpperCase(),
        parentUid: parent.uid,
      } as NewLocationInput, actorFromRequest(request)));
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

  app.get('/api/v1/locations/:referenceCode/geometry', authorizeLocationRead, (request, response) => {
    const location = locationDatabase.getLocationByReferenceCode(routeParam(request, 'referenceCode'));
    if (!location) return response.status(404).json({ message: 'Location reference not found' });
    const geometry = locationDatabase.getGeometry(location.uid);
    return geometry ? response.json(geometry) : response.status(404).json({ message: 'Geometry not available for this location' });
  });

  app.patch('/api/v1/locations/:referenceCode', authorize('contribute', countryFromReference), (request, response) => {
    try {
      const location = locationDatabase.getLocationByReferenceCode(routeParam(request, 'referenceCode'));
      if (!location) return response.status(404).json({ message: 'Location reference not found' });
      return response.json(locationDatabase.updateLocation(location.uid, request.body, actorFromRequest(request)));
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
      return response.json(locationDatabase.moveLocation(location.uid, parent.uid, actorFromRequest(request)));
    } catch (error) {
      return response.status(errorStatus(error)).json({ message: error instanceof Error ? error.message : 'Unable to move location' });
    }
  });

  app.delete('/api/v1/locations/:referenceCode', authorize('manage_country', countryFromReference), (request, response) => {
    try {
      const location = locationDatabase.getLocationByReferenceCode(routeParam(request, 'referenceCode'));
      if (!location) return response.status(404).json({ message: 'Location reference not found' });
      locationDatabase.deleteLocation(location.uid, request.query.cascade === 'true', actorFromRequest(request));
      return response.status(204).send();
    } catch (error) {
      return response.status(errorStatus(error)).json({ message: error instanceof Error ? error.message : 'Unable to delete location' });
    }
  });

  // Compatibility endpoints: existing screens still receive numeric local IDs,
  // plus canonical UUIDs projected from the normalized location tables.
  app.get('/api/countries', (_request, response) => response.json(locationDatabase.getCountries()));

  app.get('/api/countries/:id', (request, response) => {
    const country = locationDatabase.getCountryByLegacyId(Number.parseInt(routeParam(request, 'id'), 10));
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
      return response.json(locationDatabase.listLocations(routeParam(request, 'countryCode'), {
        parentUid: request.query.parentUid?.toString(),
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
    return location ? response.json(location) : response.status(404).json({ message: 'Location not found' });
  });

  app.get('/api/location-registry/references/:referenceCode', (request, response) => {
    const location = locationDatabase.getLocationByReferenceCode(routeParam(request, 'referenceCode'));
    return location ? response.json(location) : response.status(404).json({ message: 'Location reference not found' });
  });

  app.get('/api/location-registry/locations/:uid/ancestors', (request, response) => {
    if (!locationDatabase.getLocation(routeParam(request, 'uid'))) return response.status(404).json({ message: 'Location not found' });
    return response.json(locationDatabase.getAncestors(routeParam(request, 'uid')));
  });

  app.get('/api/location-registry/locations/:uid/geometry', (request, response) => {
    if (!locationDatabase.getLocation(routeParam(request, 'uid'))) return response.status(404).json({ message: 'Location not found' });
    const geometry = locationDatabase.getGeometry(routeParam(request, 'uid'));
    return geometry ? response.json(geometry) : response.status(404).json({ message: 'Geometry not available for this location' });
  });

  app.get('/api/location-registry/locations/:uid/descendants', (request, response) => {
    if (!locationDatabase.getLocation(routeParam(request, 'uid'))) return response.status(404).json({ message: 'Location not found' });
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
