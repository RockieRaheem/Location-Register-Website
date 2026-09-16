import fs from 'node:fs';
import path from 'node:path';
import { LocationDatabase, normalizeLocationName } from '../../src/server/locationDatabase.ts';

interface Candidate { metadata: Record<string, unknown>; districts: Array<{ name: string; subcounties: Array<{ name: string; constituency: string; parishes: Array<{ name: string; villages: string[] }> }> }> }
const root = process.cwd();
const candidate = JSON.parse(fs.readFileSync(path.join(root, 'data', 'sources', 'uganda', 'official-2024-2025', 'ec-2025-candidate.json'), 'utf8')) as Candidate;
const databasePath = process.env.LOCATION_DATABASE_PATH ? path.resolve(process.env.LOCATION_DATABASE_PATH) : path.join(root, 'data', 'database', 'location-register.sqlite');
const database = new LocationDatabase(databasePath);
try {
  const records: Array<{ path: string[]; referenceCode: string | null; match: 'exact' | 'unmatched' }> = [];
  for (const district of candidate.districts) {
    const districtRecord = database.listLocations('UG', { levelOrder: 2, search: district.name, limit: 100 }).items.find((item) => normalizeLocationName(item.name) === normalizeLocationName(district.name));
    const region = districtRecord ? database.getAncestors(districtRecord.uid).find((item) => item.levelOrder === 1)?.name : undefined;
    for (const subcounty of district.subcounties) for (const parish of subcounty.parishes) for (const village of parish.villages) {
      const pathNames = ['Uganda', region || '', district.name, subcounty.constituency, subcounty.name, parish.name, village].filter(Boolean);
      const matched = region ? database.resolveLocationPath('UG', pathNames) : null;
      records.push({ path: pathNames, referenceCode: matched?.referenceCode || null, match: matched ? 'exact' : 'unmatched' });
    }
  }
  const exact = records.filter((record) => record.match === 'exact').length;
  const report = { generatedAt: new Date().toISOString(), sourceEdition: '2025', total: records.length, exact, unmatched: records.length - exact, exactPercent: Number(((exact / records.length) * 100).toFixed(2)), warning: 'Unmatched does not mean new. Spelling, hierarchy, partial demarcation, and extraction differences require human review.' };
  const output = path.join(root, 'data', 'sources', 'uganda', 'official-2024-2025');
  fs.writeFileSync(path.join(output, 'ec-2025-crosswalk.json'), `${JSON.stringify({ report, records })}\n`);
  fs.writeFileSync(path.join(output, 'ec-2025-reconciliation-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
} finally { database.close(); }
