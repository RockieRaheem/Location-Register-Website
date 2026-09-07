const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '../..');
const dataPath = path.join(projectRoot, 'data', 'sources', 'uganda', 'electoral-commission-2022.json');
const reportPath = path.join(projectRoot, 'data', 'reports', 'uganda-electoral-commission-2022.import-report.json');
const dataset = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));

const fail = (message) => {
  throw new Error(`Electoral Commission integration validation failed: ${message}`);
};

const expectUnique = (values, scope) => {
  const seen = new Set();
  for (const value of values) {
    if (seen.has(value)) fail(`duplicate ${scope}: ${value}`);
    seen.add(value);
  }
};

if (!dataset.metadata || !Array.isArray(dataset.districts)) fail('invalid dataset root');
expectUnique(dataset.districts.map((district) => district.name), 'district/city name');

let districtCount = 0;
let cityCount = 0;
let subcountyCount = 0;
let parishCount = 0;
let villagePathCount = 0;

for (const district of dataset.districts) {
  if (district.type === 'District') districtCount += 1;
  else if (district.type === 'City') cityCount += 1;
  else fail(`invalid unit type for ${district.name}`);

  if (!Array.isArray(district.subcounties)) fail(`invalid subcounties for ${district.name}`);
  expectUnique(district.subcounties.map((subcounty) => subcounty.name), `subcounty in ${district.name}`);

  for (const subcounty of district.subcounties) {
    subcountyCount += 1;
    if (!Array.isArray(subcounty.parishes)) fail(`invalid parishes in ${district.name}/${subcounty.name}`);
    expectUnique(
      subcounty.parishes.map((parish) => parish.name),
      `parish in ${district.name}/${subcounty.name}`,
    );

    for (const parish of subcounty.parishes) {
      parishCount += 1;
      if (!Array.isArray(parish.villages)) {
        fail(`invalid villages in ${district.name}/${subcounty.name}/${parish.name}`);
      }
      expectUnique(
        parish.villages,
        `village in ${district.name}/${subcounty.name}/${parish.name}`,
      );
      villagePathCount += parish.villages.length;
      const allowedSections = new Set(['byParish', 'bySubcounty']);
      if (!Array.isArray(parish.sourceSections) || parish.sourceSections.length === 0) {
        fail(`missing source section in ${district.name}/${subcounty.name}/${parish.name}`);
      }
      for (const section of parish.sourceSections) {
        if (!allowedSections.has(section)) fail(`invalid source section: ${section}`);
      }
    }
  }
}

const actual = {
  districtAndCityUnits: dataset.districts.length,
  districts: districtCount,
  cities: cityCount,
  subcounties: subcountyCount,
  parishes: parishCount,
  uniqueFullVillagePaths: villagePathCount,
};

const expected = {
  districtAndCityUnits: 145,
  districts: 135,
  cities: 10,
  subcounties: 2191,
  parishes: 8173,
  uniqueFullVillagePaths: 74794,
};

for (const [name, count] of Object.entries(expected)) {
  if (actual[name] !== count) fail(`${name}: expected ${count}, found ${actual[name]}`);
  if (dataset.metadata.statistics[name] !== count) fail(`metadata ${name} does not match`);
  if (report.output[name] !== count) fail(`report ${name} does not match`);
}

if (dataset.metadata.sourceSha256 !== report.source.sha256) fail('source SHA-256 differs from report');

const optionalSourcePath = process.argv[2];
if (optionalSourcePath) {
  const sourceHash = crypto
    .createHash('sha256')
    .update(fs.readFileSync(path.resolve(optionalSourcePath)))
    .digest('hex');
  if (sourceHash !== dataset.metadata.sourceSha256) fail('supplied source file SHA-256 differs');
}

console.log(JSON.stringify({ valid: true, sourceSha256: dataset.metadata.sourceSha256, counts: actual }, null, 2));
