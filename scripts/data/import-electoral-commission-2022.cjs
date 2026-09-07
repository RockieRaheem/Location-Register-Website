const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const inputPath = process.argv[2];
const projectRoot = path.resolve(__dirname, '../..');
const outputPath = path.join(projectRoot, 'data', 'sources', 'uganda', 'electoral-commission-2022.json');
const reportPath = path.join(projectRoot, 'data', 'reports', 'uganda-electoral-commission-2022.import-report.json');

if (!inputPath) {
  console.error('Usage: node scripts/import-electoral-commission-2022.cjs <source-json>');
  process.exit(1);
}

const absoluteInputPath = path.resolve(inputPath);
const sourceBuffer = fs.readFileSync(absoluteInputPath);
const source = JSON.parse(sourceBuffer.toString('utf8'));

const fail = (message) => {
  throw new Error(`Electoral Commission import validation failed: ${message}`);
};

if (!Array.isArray(source.districts)) fail('districts must be an array');
if (!source.byVillage || Array.isArray(source.byVillage)) fail('byVillage must be an object');
if (!source.byParish || Array.isArray(source.byParish)) fail('byParish must be an object');
if (!source.bySubcounty || Array.isArray(source.bySubcounty)) fail('bySubcounty must be an object');

const sourceSha256 = crypto.createHash('sha256').update(sourceBuffer).digest('hex');
const districtSet = new Set(source.districts);
if (districtSet.size !== source.districts.length) fail('districts contains duplicate names');

const hierarchy = new Map();
const ensureDistrict = (districtName) => {
  if (!districtSet.has(districtName)) fail(`unknown district referenced: ${districtName}`);
  if (!hierarchy.has(districtName)) hierarchy.set(districtName, new Map());
  return hierarchy.get(districtName);
};

const ensureSubcounty = (districtName, subcountyName, constituency) => {
  const district = ensureDistrict(districtName);
  if (!district.has(subcountyName)) {
    district.set(subcountyName, {
      name: subcountyName,
      constituency: constituency || null,
      parishes: new Map(),
    });
  }
  const subcounty = district.get(subcountyName);
  if (constituency && subcounty.constituency && subcounty.constituency !== constituency) {
    fail(`conflicting constituency for ${districtName}||${subcountyName}`);
  }
  if (constituency) subcounty.constituency = constituency;
  return subcounty;
};

const ensureParish = (subcounty, parishName) => {
  if (!subcounty.parishes.has(parishName)) {
    subcounty.parishes.set(parishName, {
      name: parishName,
      villages: [],
      villageSet: new Set(),
      sourceSections: new Set(),
    });
  }
  return subcounty.parishes.get(parishName);
};

let bySubcountyVillageReferences = 0;
let bySubcountyDuplicateFullPaths = 0;
let duplicateParishSegments = 0;
let subcountyCountLabelMismatches = 0;

for (const [key, record] of Object.entries(source.bySubcounty)) {
  const expectedKey = `${record.district}||${record.subcounty}`;
  if (key !== expectedKey) fail(`bySubcounty key mismatch: ${key} !== ${expectedKey}`);
  if (!Array.isArray(record.data)) fail(`bySubcounty ${key} data must be an array`);

  const subcounty = ensureSubcounty(record.district, record.subcounty, record.constituency);
  const parishSegmentCounts = new Map();
  const referenceCount = record.data.reduce((total, parish) => total + parish.villages.length, 0);
  if (record.number_of_subcounties !== referenceCount) subcountyCountLabelMismatches += 1;

  for (const parishSegment of record.data) {
    if (!Array.isArray(parishSegment.villages)) fail(`parish villages must be an array in ${key}`);
    parishSegmentCounts.set(
      parishSegment.parish,
      (parishSegmentCounts.get(parishSegment.parish) || 0) + 1,
    );
    const parish = ensureParish(subcounty, parishSegment.parish);
    parish.sourceSections.add('bySubcounty');

    for (const villageName of parishSegment.villages) {
      bySubcountyVillageReferences += 1;
      if (parish.villageSet.has(villageName)) {
        bySubcountyDuplicateFullPaths += 1;
        continue;
      }
      parish.villageSet.add(villageName);
      parish.villages.push(villageName);
    }
  }

  duplicateParishSegments += [...parishSegmentCounts.values()]
    .filter((count) => count > 1)
    .reduce((total, count) => total + count - 1, 0);
}

let byParishVillageReferences = 0;
let byParishDuplicateFullPaths = 0;
let villagePathsAddedOnlyByParish = 0;
let parishPathsAddedOnlyByParish = 0;

for (const [key, record] of Object.entries(source.byParish)) {
  const expectedKey = `${record.district}||${record.subcounty}||${record.parish}`;
  if (key !== expectedKey) fail(`byParish key mismatch: ${key} !== ${expectedKey}`);
  if (!Array.isArray(record.villages)) fail(`byParish ${key} villages must be an array`);
  if (record.number_of_villages !== record.villages.length) {
    fail(`byParish village count mismatch for ${key}`);
  }

  const subcountyRecord = source.bySubcounty[`${record.district}||${record.subcounty}`];
  if (!subcountyRecord) fail(`byParish record has no parent subcounty: ${key}`);
  const subcounty = ensureSubcounty(
    record.district,
    record.subcounty,
    subcountyRecord.constituency,
  );
  const parishWasMissing = !subcounty.parishes.has(record.parish);
  const parish = ensureParish(subcounty, record.parish);
  if (parishWasMissing) parishPathsAddedOnlyByParish += 1;
  parish.sourceSections.add('byParish');

  for (const villageName of record.villages) {
    byParishVillageReferences += 1;
    if (parish.villageSet.has(villageName)) {
      byParishDuplicateFullPaths += 1;
      continue;
    }
    parish.villageSet.add(villageName);
    parish.villages.push(villageName);
    villagePathsAddedOnlyByParish += 1;
  }
}

for (const districtName of source.districts) ensureDistrict(districtName);

const districts = source.districts.map((districtName) => {
  const subcounties = [...hierarchy.get(districtName).values()].map((subcounty) => ({
    name: subcounty.name,
    constituency: subcounty.constituency,
    parishes: [...subcounty.parishes.values()].map((parish) => ({
      name: parish.name,
      villages: parish.villages,
      sourceSections: [...parish.sourceSections].sort(),
    })),
  }));

  return {
    name: districtName,
    type: districtName.endsWith(' CITY') ? 'City' : 'District',
    subcounties,
  };
});

const statistics = {
  districtAndCityUnits: districts.length,
  districts: districts.filter((district) => district.type === 'District').length,
  cities: districts.filter((district) => district.type === 'City').length,
  subcounties: districts.reduce((total, district) => total + district.subcounties.length, 0),
  parishes: districts.reduce(
    (total, district) => total + district.subcounties.reduce(
      (subTotal, subcounty) => subTotal + subcounty.parishes.length,
      0,
    ),
    0,
  ),
  uniqueFullVillagePaths: districts.reduce(
    (total, district) => total + district.subcounties.reduce(
      (subTotal, subcounty) => subTotal + subcounty.parishes.reduce(
        (parishTotal, parish) => parishTotal + parish.villages.length,
        0,
      ),
      0,
    ),
    0,
  ),
  globalUniqueVillageNames: Object.keys(source.byVillage).length,
};

if (statistics.districtAndCityUnits !== 145) fail(`expected 145 district/city units, found ${statistics.districtAndCityUnits}`);
if (statistics.districts !== 135) fail(`expected 135 districts, found ${statistics.districts}`);
if (statistics.cities !== 10) fail(`expected 10 cities, found ${statistics.cities}`);
if (statistics.subcounties !== 2191) fail(`expected 2191 subcounties, found ${statistics.subcounties}`);
if (statistics.parishes !== 8173) fail(`expected 8173 parishes, found ${statistics.parishes}`);
if (statistics.uniqueFullVillagePaths !== 74794) {
  fail(`expected 74794 unique full village paths, found ${statistics.uniqueFullVillagePaths}`);
}

const output = {
  metadata: {
    title: 'Uganda Electoral Commission administrative hierarchy',
    sourceYear: 2022,
    sourceFileName: path.basename(absoluteInputPath),
    sourceSha256,
    hierarchyRule: 'Lossless union of district-scoped bySubcounty and byParish indexes, deduplicated only by exact district/subcounty/parish/village path.',
    statistics,
  },
  districts,
};

const report = {
  source: {
    fileName: path.basename(absoluteInputPath),
    byteLength: sourceBuffer.length,
    sha256: sourceSha256,
  },
  output: statistics,
  sourceIndexCounts: {
    districts: source.districts.length,
    byVillage: Object.keys(source.byVillage).length,
    byParish: Object.keys(source.byParish).length,
    bySubcounty: Object.keys(source.bySubcounty).length,
    bySubcountyVillageReferences,
    byParishVillageReferences,
  },
  reconciliation: {
    duplicateParishSegmentsMerged: duplicateParishSegments,
    duplicateExactPathsIgnoredFromBySubcounty: bySubcountyDuplicateFullPaths,
    pathsAlreadyPresentWhenReadingByParish: byParishDuplicateFullPaths,
    parishPathsAddedOnlyByParish,
    villagePathsAddedOnlyByParish,
    subcountyCountLabelMismatches,
    note: 'The source field number_of_subcounties behaves like a village count in many records and is inconsistent with both reference and unique-name counts. It was not used as a hierarchy count.',
  },
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(output)}\n`, 'utf8');
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

console.log(JSON.stringify({ outputPath, reportPath, statistics, reconciliation: report.reconciliation }, null, 2));
