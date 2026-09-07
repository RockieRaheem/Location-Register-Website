import fs from 'node:fs';
import path from 'node:path';
import { LocationDatabase, normalizeLocationName } from '../../src/server/locationDatabase.ts';

type Position = [number, number];
type Geometry = { type: string; coordinates: unknown };
type Feature = { properties: Record<string, unknown>; geometry: Geometry };
type FeatureCollection = { type: 'FeatureCollection'; features: Feature[] };
type LocationRow = { uid: string; depth: number; normalized_name: string; parent_uid: string | null; metadata_json: string };

const root = path.resolve(import.meta.dirname, '../..');
const databasePath = path.resolve(process.argv.find((value) => value.endsWith('.sqlite')) || path.join(root, 'data', 'database', 'location-register.sqlite'));
const sourceDirectory = path.join(root, 'data', 'geospatial', 'uganda');
const database = new LocationDatabase(databasePath);

function readGeoJson(file: string): FeatureCollection {
  const parsed = JSON.parse(fs.readFileSync(path.join(sourceDirectory, file), 'utf8')) as FeatureCollection;
  if (parsed.type !== 'FeatureCollection' || !Array.isArray(parsed.features)) throw new Error(`${file} is not a GeoJSON FeatureCollection`);
  return parsed;
}

function visitPositions(value: unknown, visit: (position: Position) => void): void {
  if (!Array.isArray(value)) return;
  if (value.length >= 2 && typeof value[0] === 'number' && typeof value[1] === 'number') return visit(value as Position);
  for (const child of value) visitPositions(child, visit);
}

function bbox(geometry: Geometry): [number, number, number, number] {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  visitPositions(geometry.coordinates, ([x, y]) => {
    minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  });
  if (![minX, minY, maxX, maxY].every(Number.isFinite)) throw new Error('Geometry contains no valid coordinates');
  return [minX, minY, maxX, maxY];
}

const rows = database.db.prepare(`
  SELECT location.uid, location.depth, location.normalized_name, location.parent_uid, location.metadata_json
  FROM locations location JOIN countries country ON country.uid = location.country_uid
  WHERE country.iso2 = 'UG'
`).all() as LocationRow[];
const byUid = new Map(rows.map((row) => [row.uid, row]));
const byPath = new Map<string, LocationRow>();
const byDistrictAndName = new Map<string, LocationRow | null>();

function locationPath(row: LocationRow): string {
  const names: string[] = [];
  let current: LocationRow | undefined = row;
  while (current) { names.push(current.normalized_name); current = current.parent_uid ? byUid.get(current.parent_uid) : undefined; }
  return names.reverse().join('>');
}
for (const row of rows) {
  const pathParts = locationPath(row).split('>');
  byPath.set(pathParts.join('>'), row);
  if (row.depth >= 2) {
    const key = `${row.depth}|${pathParts[2]}|${row.normalized_name}`;
    byDistrictAndName.set(key, byDistrictAndName.has(key) ? null : row);
  }
}

function matchFeature(level: number, names: string[]): LocationRow | undefined {
  const exact = byPath.get(names.join('>'));
  if (exact) return exact;
  if (level >= 2) return byDistrictAndName.get(`${level}|${names[2]}|${names[level]}`) || undefined;
  return undefined;
}

const levels = [
  { file: 'uga_admin0.geojson', level: 0 },
  { file: 'uga_admin1.geojson', level: 1 },
  { file: 'uga_admin2.geojson', level: 2 },
  { file: 'uga_admin3.geojson', level: 3 },
  { file: 'uga_admin4.geojson', level: 4 },
];
let matched = 0;
let unmatched = 0;
const unmatchedExamples: string[] = [];

database.transaction(() => {
  for (const { file, level } of levels) {
    for (const feature of readGeoJson(file).features) {
      const names = Array.from({ length: level + 1 }, (_, index) => normalizeLocationName(String(feature.properties[`adm${index}_name`] || '')));
      const row = matchFeature(level, names);
      if (!row) { unmatched++; if (unmatchedExamples.length < 20) unmatchedExamples.push(names.join(' > ')); continue; }
      const pcode = String(feature.properties[`adm${level}_pcode`] || '');
      const metadata = JSON.parse(row.metadata_json || '{}') as Record<string, unknown>;
      metadata.centroid = { latitude: feature.properties.center_lat, longitude: feature.properties.center_lon };
      metadata.areaSquareKilometres = feature.properties.area_sqkm;
      database.db.prepare(`UPDATE locations SET metadata_json = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE uid = ?`)
        .run(JSON.stringify(metadata), row.uid);
      if (pcode) database.upsertExternalId(row.uid, 'UG_ADMIN_PCODE', pcode, String(feature.properties.version || 'v01'));
      database.upsertGeometry({ locationUid: row.uid, type: feature.geometry.type, geometry: feature.geometry, bbox: bbox(feature.geometry), sourceName: 'Uganda administrative boundaries', sourceVersion: String(feature.properties.version || 'v01') });
      matched++;
    }
  }
});

const report = { valid: true, databasePath, matched, unmatched, unmatchedExamples };
fs.writeFileSync(path.join(root, 'data', 'reports', 'uganda-geodata-enrichment.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
database.close();
