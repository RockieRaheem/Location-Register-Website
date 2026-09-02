import path from 'node:path';
import { LocationDatabase, normalizeLocationName } from '../src/server/locationDatabase.ts';
import { UGANDA_ELECTORAL_COMMISSION_2022_METADATA } from '../ugandaElectoralCommission2022.ts';

type Row = Record<string, string | number | null>;

const projectRoot = path.resolve(import.meta.dirname, '..');
const databasePath = path.resolve(process.argv.find((argument) => argument.endsWith('.sqlite')) || path.join(projectRoot, 'data', 'location-register.sqlite'));
const database = new LocationDatabase(databasePath);

const fail = (message: string): never => {
  throw new Error(`Location database validation failed: ${message}`);
};

try {
  const integrity = database.integrityCheck();
  if (integrity.length !== 1 || integrity[0] !== 'ok') fail(`integrity_check returned ${integrity.join(', ')}`);

  const foreignKeyErrors = database.db.prepare('PRAGMA foreign_key_check').all();
  if (foreignKeyErrors.length > 0) fail(`${foreignKeyErrors.length} foreign-key violations`);

  const ugandaSchema = database.getHierarchy('UG');
  const expectedLevelKeys = ['region', 'district_city', 'county_municipality', 'subcounty_division', 'parish_ward', 'village_cell'];
  if (ugandaSchema.levels.map((level) => level.key).join('|') !== expectedLevelKeys.join('|')) {
    fail('Uganda hierarchy definition differs from the configured six-level schema');
  }
  if (database.getHierarchy('KE').levels.length !== 1 || database.getHierarchy('NG').levels.length !== 2) {
    fail('country-specific hierarchy lengths were not preserved');
  }

  const depthRows = database.db.prepare(`
    SELECT depth, COUNT(*) AS count
    FROM locations
    WHERE country_uid = (SELECT uid FROM countries WHERE iso2 = 'UG')
    GROUP BY depth ORDER BY depth
  `).all() as Row[];
  const counts = Object.fromEntries(depthRows.map((row) => [Number(row.depth), Number(row.count)]));
  const expectedCounts: Record<number, number> = {
    0: 1,
    1: 5,
    2: 145,
    3: 347,
    4: 2191,
    5: 8173,
    6: 74794,
  };
  for (const [depth, expected] of Object.entries(expectedCounts)) {
    if (counts[Number(depth)] !== expected) fail(`Uganda depth ${depth}: expected ${expected}, found ${counts[Number(depth)]}`);
  }

  const badPathCounts = database.db.prepare(`
    SELECT location.uid, location.depth, COUNT(path.ancestor_uid) AS ancestors
    FROM locations location
    LEFT JOIN location_paths path ON path.descendant_uid = location.uid
    GROUP BY location.uid
    HAVING ancestors != location.depth + 1
    LIMIT 1
  `).get() as Row | undefined;
  if (badPathCounts) fail(`closure path count is wrong for ${badPathCounts.uid}`);

  const invalidParent = database.db.prepare(`
    SELECT child.uid
    FROM locations child
    JOIN locations parent ON parent.uid = child.parent_uid
    WHERE child.country_uid != parent.country_uid OR child.depth != parent.depth + 1
    LIMIT 1
  `).get() as Row | undefined;
  if (invalidParent) fail(`invalid parent relationship for ${invalidParent.uid}`);

  const sourceRows = Number((database.db.prepare(`
    SELECT COUNT(*) AS count FROM locations
    WHERE json_extract(metadata_json, '$.managedBy') = 'electoral-commission-2022'
  `).get() as Row).count);
  const expectedSourceRows = Object.values(expectedCounts).reduce((total, count) => total + count, 0) - 1;
  if (sourceRows !== expectedSourceRows) fail(`expected ${expectedSourceRows} Uganda source nodes, found ${sourceRows}`);

  const collisionVillages = database.db.prepare(`
    SELECT name FROM locations
    WHERE country_uid = (SELECT uid FROM countries WHERE iso2 = 'UG')
      AND depth = 6
      AND normalized_name IN ('KATONGO TUT', 'OBOLISO KOMOLO')
    ORDER BY name
  `).all() as Row[];
  const collisionNames = collisionVillages.map((row) => String(row.name));
  for (const expected of ['KATONGO - TUT', 'KATONGO TUT', 'OBOLISO KOMOLO', 'OBOLISO-KOMOLO']) {
    if (!collisionNames.includes(expected)) fail(`punctuation-distinct source village was lost: ${expected}`);
  }

  const aliasChecks = [
    ['LUWEERO', 'Luwero'],
    ['KAMPALA CENTRAL', 'Central Division'],
  ];
  for (const [canonical, alias] of aliasChecks) {
    const result = database.db.prepare(`
      SELECT location.name FROM location_aliases alias
      JOIN locations location ON location.uid = alias.location_uid
      WHERE alias.normalized_alias = ? AND location.normalized_name = ?
    `).get(normalizeLocationName(alias), normalizeLocationName(canonical));
    if (!result) {
      fail(`alias ${alias} did not resolve to ${canonical}`);
    }
  }

  const statistics = database.getStatistics();
  const report = {
    valid: true,
    databasePath,
    integrity,
    statistics,
    ugandaByDepth: counts,
    sourceSha256: UGANDA_ELECTORAL_COMMISSION_2022_METADATA.sourceSha256,
    punctuationDistinctVillagesPreserved: collisionNames,
  };
  console.log(JSON.stringify(report, null, 2));
} finally {
  database.close();
}
