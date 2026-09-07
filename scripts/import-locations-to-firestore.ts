import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

type Row = Record<string, string | number | null>;

const projectRoot = path.resolve(import.meta.dirname, '..');
const databasePath = path.resolve(process.argv.find((value) => value.endsWith('.sqlite')) || path.join(projectRoot, 'data', 'location-register.sqlite'));
const shouldCommit = process.argv.includes('--commit');
const countryArgument = process.argv.find((value) => value.startsWith('--country='));
const selectedCountry = countryArgument?.split('=')[1]?.trim().toUpperCase();
const projectId = process.env.FIREBASE_PROJECT_ID || 'any-location-36e76';
const database = new DatabaseSync(databasePath, { readOnly: true });

function parseJson(value: unknown, fallback: unknown) {
  if (typeof value !== 'string') return fallback;
  try { return JSON.parse(value); } catch { return fallback; }
}

const countryFilter = selectedCountry ? 'WHERE iso2 = ?' : '';
const parameters = selectedCountry ? [selectedCountry] : [];
const countries = database.prepare(`SELECT * FROM countries ${countryFilter} ORDER BY iso2`).all(...parameters) as Row[];
if (countries.length === 0) throw new Error(selectedCountry ? `Country ${selectedCountry} was not found.` : 'No countries were found.');

const countryUids = new Set(countries.map((country) => String(country.uid)));
const allLevels = database.prepare('SELECT * FROM hierarchy_levels ORDER BY country_uid, level_order').all() as Row[];
const levels = allLevels.filter((level) => countryUids.has(String(level.country_uid)));
const allLocations = database.prepare(`
  SELECT location.*, country.iso2, level.level_key, level.name AS level_name
  FROM locations location
  JOIN countries country ON country.uid = location.country_uid
  LEFT JOIN hierarchy_levels level ON level.uid = location.level_uid
  ORDER BY location.depth, location.country_uid, location.uid
`).all() as Row[];
const locations = allLocations.filter((location) => countryUids.has(String(location.country_uid)));

const ancestorsByUid = new Map<string, string[]>();
for (const location of locations) {
  const uid = String(location.uid);
  const parentUid = location.parent_uid == null ? null : String(location.parent_uid);
  ancestorsByUid.set(uid, parentUid ? [...(ancestorsByUid.get(parentUid) || []), parentUid] : []);
}

console.log(JSON.stringify({
  mode: shouldCommit ? 'COMMIT' : 'DRY RUN',
  projectId,
  databasePath,
  countryCodes: countries.map((country) => country.iso2),
  countries: countries.length,
  hierarchyLevels: levels.length,
  locations: locations.length,
}, null, 2));

if (!shouldCommit) {
  console.log('No Firebase writes were made. Re-run with --commit after reviewing the counts and credentials.');
  database.close();
  process.exit(0);
}

if (getApps().length === 0) initializeApp({ credential: applicationDefault(), projectId });
const firestore = getFirestore();
const bulkWriter = firestore.bulkWriter();
bulkWriter.onWriteError((error) => {
  console.error(`Write failed for ${error.documentRef.path}: ${error.message}`);
  return error.failedAttempts < 5;
});

const now = Timestamp.now();
for (const country of countries) {
  bulkWriter.set(firestore.doc(`countries/${country.iso2}`), {
    ...parseJson(country.profile_json, {}),
    uid: country.uid,
    code: country.iso2,
    name: country.name,
    rootLocationUid: country.root_location_uid,
    schemaVersion: country.hierarchy_version,
    importedAt: now,
    sourceDatabase: path.basename(databasePath),
  }, { merge: true });
}

const countryCodeByUid = new Map(countries.map((country) => [String(country.uid), String(country.iso2)]));
for (const level of levels) {
  const code = countryCodeByUid.get(String(level.country_uid));
  if (!code) continue;
  bulkWriter.set(firestore.doc(`countries/${code}/hierarchyLevels/${level.uid}`), {
    uid: level.uid,
    countryUid: level.country_uid,
    order: level.level_order,
    key: level.level_key,
    name: level.name,
    alternateNames: parseJson(level.alternate_names_json, []),
    allowedTypes: parseJson(level.allowed_types_json, []),
    required: Boolean(level.is_required),
    importedAt: now,
  }, { merge: true });
}

for (const location of locations) {
  const uid = String(location.uid);
  bulkWriter.set(firestore.doc(`locations/${uid}`), {
    uid,
    countryUid: location.country_uid,
    countryCode: location.iso2,
    levelUid: location.level_uid,
    levelOrder: location.depth,
    levelKey: location.level_key || 'country',
    levelName: location.level_name || 'Country',
    parentUid: location.parent_uid,
    ancestorUids: ancestorsByUid.get(uid) || [],
    legacyId: location.legacy_id,
    name: location.name,
    normalizedName: String(location.normalized_name).toLowerCase(),
    type: location.type_label,
    status: location.status,
    source: {
      name: location.source_name || null,
      year: location.source_year || null,
      path: location.source_path || null,
    },
    metadata: parseJson(location.metadata_json, {}),
    importedAt: now,
  }, { merge: true });
}

await bulkWriter.close();
database.close();
console.log(`Imported ${locations.length.toLocaleString()} location documents into ${projectId}.`);
