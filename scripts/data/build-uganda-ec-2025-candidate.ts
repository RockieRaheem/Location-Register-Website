import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

type Parish = { name: string; villages: string[]; sourceSections: ['villageElectoralAreas2025'] };
type Subcounty = { name: string; constituency: string; parishes: Parish[] };
type District = { name: string; type: 'District' | 'City'; subcounties: Subcounty[] };
const root = process.cwd();
const sourcePath = path.join(root, 'data', 'sources', 'uganda', 'official-2024-2025', 'Split by village Local Goverment Electoral Areas for display.txt');
const source = fs.readFileSync(sourcePath, 'utf8').replace(/\r/g, '');
const clean = (value: string) => value.replace(/\s+/g, ' ').trim();
const hierarchy = new Map<string, Map<string, Map<string, Map<string, Set<string>>>>>();
const rejected: Array<{ page: number; line: string; reason: string }> = [];

for (const pageBlock of source.split(/\n-- \d+ of \d+ --\n/)) {
  const page = Number(pageBlock.match(/Page (\d+) of/)?.[1] || 0);
  const districtMatch = pageBlock.match(/District:\s*\t?([^\t\n]+)\t(\d+)/i);
  const constituencyMatch = pageBlock.match(/Constituency:\s*\t?([^\t\n]+)\t(\d+)/i);
  const subcountyMatch = pageBlock.match(/Subcounty\/Town\/Municipal Division:\s*\t?([^\t\n]+)\t(\d+)/i);
  const parishMatch = pageBlock.match(/Parish:\s*\t?([^\t\n]+)\t(\d+)/i);
  if (!districtMatch || !constituencyMatch || !subcountyMatch || !parishMatch) continue;
  const [district, constituency, subcounty, parish] = [districtMatch[1], constituencyMatch[1], subcountyMatch[1], parishMatch[1]].map(clean);
  const afterPosition = pageBlock.split(/COUNCILLORS\s*\n/i).at(-1) || '';
  const rows = afterPosition.split(/\nPage \d+ of/)[0].split('\n').map((line) => line.trim()).filter(Boolean);
  const villages: string[] = [];
  for (const row of rows) {
    const columns = row.split('\t').map(clean).filter(Boolean);
    if (columns.length < 2 || !/^\d{1,4}$/.test(columns.at(-1) || '')) {
      if (row.includes('\t')) rejected.push({ page, line: row, reason: 'unrecognized row shape' });
      continue;
    }
    const name = columns[0];
    if (!name || /^\d+$/.test(name) || /^(VILLAGES|ELECTORAL AREA)$/i.test(name)) continue;
    villages.push(name);
  }
  if (villages.length === 0) {
    rejected.push({ page, line: `${district} / ${subcounty} / ${parish}`, reason: 'no village rows parsed' });
    continue;
  }
  const constituencies = hierarchy.get(district) || new Map(); hierarchy.set(district, constituencies);
  const subcounties = constituencies.get(constituency) || new Map(); constituencies.set(constituency, subcounties);
  const parishes = subcounties.get(subcounty) || new Map(); subcounties.set(subcounty, parishes);
  const villageSet = parishes.get(parish) || new Set(); parishes.set(parish, villageSet);
  villages.forEach((village) => villageSet.add(village));
}

const districts: District[] = [...hierarchy].sort(([a], [b]) => a.localeCompare(b)).map(([districtName, constituencies]) => ({
  name: districtName,
  type: /CITY$/i.test(districtName) || /KAMPALA/i.test(districtName) ? 'City' : 'District',
  subcounties: [...constituencies].flatMap(([constituency, subcounties]) => [...subcounties].map(([subcountyName, parishes]) => ({
    name: subcountyName,
    constituency,
    parishes: [...parishes].map(([parishName, villages]) => ({ name: parishName, villages: [...villages], sourceSections: ['villageElectoralAreas2025'] })),
  }))),
}));
const uniqueNames = new Set<string>();
let subcountyCount = 0; let parishCount = 0; let villageCount = 0;
for (const district of districts) for (const subcounty of district.subcounties) {
  subcountyCount += 1;
  for (const parish of subcounty.parishes) {
    parishCount += 1; villageCount += parish.villages.length; parish.villages.forEach((name) => uniqueNames.add(name));
  }
}
const output = {
  metadata: {
    title: 'Uganda Electoral Commission demarcated local government electoral areas', sourceYear: 2025,
    sourceFileName: 'Split by village Local Goverment Electoral Areas for display.pdf',
    sourceSha256: createHash('sha256').update(fs.readFileSync(path.join(root, 'data', 'sources', 'uganda', 'official-2024-2025', 'pdf', 'Split by village Local Goverment Electoral Areas for display.pdf'))).digest('hex'),
    status: 'candidate', hierarchyRule: 'Parsed only from explicit district, constituency, subcounty, parish and village rows in the official EC 2025 display document.',
    statistics: { districtAndCityUnits: districts.length, subcounties: subcountyCount, parishes: parishCount, uniqueFullVillagePaths: villageCount, globalUniqueVillageNames: uniqueNames.size },
  }, districts,
};
const outputDirectory = path.join(root, 'data', 'sources', 'uganda', 'official-2024-2025');
fs.writeFileSync(path.join(outputDirectory, 'ec-2025-candidate.json'), `${JSON.stringify(output)}\n`);
fs.writeFileSync(path.join(outputDirectory, 'ec-2025-parser-report.json'), `${JSON.stringify({ metadata: output.metadata, rejectedCount: rejected.length, rejected: rejected.slice(0, 500) }, null, 2)}\n`);
console.log(JSON.stringify({ metadata: output.metadata, rejectedCount: rejected.length }, null, 2));
