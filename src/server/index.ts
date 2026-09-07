import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { allAfricanCountries } from '../data/mockData.ts';
import type { AdminLevelName, Country, LocationRecord } from '../types.ts';
import { LocationDatabase, type NewLocationInput } from './locationDatabase.ts';

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

function actorFromRequest(request: express.Request): string {
  return request.header('x-actor-id')?.trim() || 'api';
}

function errorStatus(error: unknown): number {
  const message = error instanceof Error ? error.message : '';
  if (message.includes('not found') || message.includes('not configured')) return 404;
  if (message.includes('UNIQUE constraint') || message.includes('has children')) return 409;
  return 400;
}

async function startServer() {
  const app = express();
  const port = Number(process.env.PORT || 3000);
  app.use(cors());
  app.use(express.json({ limit: '50mb' }));

  // Compatibility endpoints: existing screens still receive numeric local IDs,
  // plus canonical UUIDs projected from the normalized location tables.
  app.get('/api/countries', (_request, response) => response.json(locationDatabase.getCountries()));

  app.get('/api/countries/:id', (request, response) => {
    const country = locationDatabase.getCountryByLegacyId(Number.parseInt(request.params.id, 10));
    return country ? response.json(country) : response.status(404).json({ message: 'Country not found' });
  });

  app.post('/api/countries', (request, response) => {
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

  app.put('/api/countries/:id', (request, response) => {
    try {
      const id = Number.parseInt(request.params.id, 10);
      if (!locationDatabase.getCountryByLegacyId(id)) return response.status(404).json({ message: 'Country not found' });
      const country: Country = { ...request.body, id, updatedAt: new Date().toISOString() };
      return response.json(locationDatabase.syncManagedLocations(country));
    } catch (error) {
      return response.status(errorStatus(error)).json({ message: error instanceof Error ? error.message : 'Unable to update country' });
    }
  });

  app.delete('/api/countries/:id', (request, response) => {
    const deleted = locationDatabase.deleteCountry(Number.parseInt(request.params.id, 10));
    return deleted ? response.status(204).send() : response.status(404).json({ message: 'Country not found' });
  });

  // Country-configurable hierarchy and canonical UUID-based location API.
  app.get('/api/location-registry/statistics', (request, response) => {
    response.json(locationDatabase.getStatistics(request.query.countryCode?.toString()));
  });

  app.get('/api/location-registry/countries/:countryCode/schema', (request, response) => {
    try {
      return response.json(locationDatabase.getHierarchy(request.params.countryCode));
    } catch (error) {
      return response.status(errorStatus(error)).json({ message: error instanceof Error ? error.message : 'Unable to load hierarchy' });
    }
  });

  app.put('/api/location-registry/countries/:countryCode/schema', (request, response) => {
    try {
      const definitions = request.body.levels as AdminLevelName[];
      if (!Array.isArray(definitions)) throw new Error('levels must be an array');
      return response.json(locationDatabase.setHierarchy(request.params.countryCode, definitions));
    } catch (error) {
      return response.status(errorStatus(error)).json({ message: error instanceof Error ? error.message : 'Unable to update hierarchy' });
    }
  });

  app.get('/api/location-registry/countries/:countryCode/locations', (request, response) => {
    try {
      return response.json(locationDatabase.listLocations(request.params.countryCode, {
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
    const location = locationDatabase.getLocation(request.params.uid);
    return location ? response.json(location) : response.status(404).json({ message: 'Location not found' });
  });

  app.get('/api/location-registry/locations/:uid/ancestors', (request, response) => {
    if (!locationDatabase.getLocation(request.params.uid)) return response.status(404).json({ message: 'Location not found' });
    return response.json(locationDatabase.getAncestors(request.params.uid));
  });

  app.get('/api/location-registry/locations/:uid/descendants', (request, response) => {
    if (!locationDatabase.getLocation(request.params.uid)) return response.status(404).json({ message: 'Location not found' });
    return response.json(locationDatabase.getDescendants(
      request.params.uid,
      integerQuery(request.query.maxDepth),
      integerQuery(request.query.limit, 1000),
      integerQuery(request.query.offset, 0),
    ));
  });

  app.post('/api/location-registry/locations', (request, response) => {
    try {
      return response.status(201).json(locationDatabase.insertLocation(request.body as NewLocationInput, actorFromRequest(request)));
    } catch (error) {
      return response.status(errorStatus(error)).json({ message: error instanceof Error ? error.message : 'Unable to create location' });
    }
  });

  app.patch('/api/location-registry/locations/:uid', (request, response) => {
    try {
      const patch = request.body as Partial<Pick<LocationRecord, 'name' | 'type' | 'status' | 'metadata'>>;
      return response.json(locationDatabase.updateLocation(request.params.uid, patch, actorFromRequest(request)));
    } catch (error) {
      return response.status(errorStatus(error)).json({ message: error instanceof Error ? error.message : 'Unable to update location' });
    }
  });

  app.post('/api/location-registry/locations/:uid/move', (request, response) => {
    try {
      return response.json(locationDatabase.moveLocation(request.params.uid, String(request.body.parentUid || ''), actorFromRequest(request)));
    } catch (error) {
      return response.status(errorStatus(error)).json({ message: error instanceof Error ? error.message : 'Unable to move location' });
    }
  });

  app.delete('/api/location-registry/locations/:uid', (request, response) => {
    try {
      locationDatabase.deleteLocation(request.params.uid, request.query.cascade === 'true', actorFromRequest(request));
      return response.status(204).send();
    } catch (error) {
      return response.status(errorStatus(error)).json({ message: error instanceof Error ? error.message : 'Unable to delete location' });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (_request, response) => response.sendFile(path.join(distPath, 'index.html')));
  }

  const server = app.listen(port, '0.0.0.0', () => {
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
