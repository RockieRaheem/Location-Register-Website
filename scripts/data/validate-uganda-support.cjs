const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const sourceDirectory = path.join(root, 'data', 'sources', 'uganda', 'geosanga');
const read = (name) => JSON.parse(fs.readFileSync(path.join(sourceDirectory, name), 'utf8'));
const datasets = {
  districts: read('districts.json'),
  counties: read('counties.json'),
  subcounties: read('sub_counties.json'),
  parishes: read('parishes.json'),
  villages: read('villages.json'),
};

const fail = (message) => { throw new Error(`Uganda support validation failed: ${message}`); };
const index = (rows, name) => {
  const result = new Map();
  for (const row of rows) {
    if (!row.id || !row.name) fail(`${name} contains a row without id or name`);
    if (result.has(String(row.id))) fail(`${name} contains duplicate id ${row.id}`);
    result.set(String(row.id), row);
  }
  return result;
};

const indexes = Object.fromEntries(Object.entries(datasets).map(([name, rows]) => [name, index(rows, name)]));
for (const row of datasets.counties) if (!indexes.districts.has(String(row.district))) fail(`county ${row.id} has missing district ${row.district}`);
for (const row of datasets.subcounties) if (!indexes.counties.has(String(row.county))) fail(`subcounty ${row.id} has missing county ${row.county}`);
for (const row of datasets.parishes) if (!indexes.subcounties.has(String(row.subcounty))) fail(`parish ${row.id} has missing subcounty ${row.subcounty}`);
for (const row of datasets.villages) if (!indexes.parishes.has(String(row.parish))) fail(`village ${row.id} has missing parish ${row.parish}`);

const boundaryCounts = {};
for (let level = 0; level <= 4; level++) {
  const file = path.join(root, 'data', 'geospatial', 'uganda', `uga_admin${level}.geojson`);
  const geojson = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (geojson.type !== 'FeatureCollection' || !Array.isArray(geojson.features)) fail(`admin${level} is not a FeatureCollection`);
  boundaryCounts[`admin${level}`] = geojson.features.length;
}
const points = JSON.parse(fs.readFileSync(path.join(root, 'data', 'geospatial', 'uganda', 'uga_adminpoints.geojson'), 'utf8'));
if (points.type !== 'FeatureCollection' || !Array.isArray(points.features)) fail('administrative points are not a FeatureCollection');
for (const feature of points.features) {
  const coordinates = feature.geometry?.coordinates;
  if (feature.geometry?.type !== 'Point' || !Array.isArray(coordinates) || !coordinates.every(Number.isFinite)) {
    fail('administrative points contain invalid geometry');
  }
}

console.log(JSON.stringify({
  valid: true,
  repositoryCounts: Object.fromEntries(Object.entries(datasets).map(([name, rows]) => [name, rows.length])),
  boundaryCounts,
  administrativePoints: points.features.length,
  note: 'Validated as a secondary source; it does not overwrite the newer Electoral Commission hierarchy.',
}, null, 2));
