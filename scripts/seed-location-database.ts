import fs from 'node:fs';
import path from 'node:path';
import { allAfricanCountries } from '../data.ts';
import electoralCommissionData from '../data/uganda-electoral-commission-2022.json';
import { UGANDA_DISTRICTS_DATA } from '../ugandaDistrictsData.ts';
import {
  getElectoralCommissionDistrict,
  normalizeUgandaLocationName,
  type ElectoralCommissionDistrict,
  UGANDA_ELECTORAL_COMMISSION_2022_METADATA,
} from '../ugandaElectoralCommission2022.ts';
import {
  deterministicUuid,
  LocationDatabase,
  normalizeLocationName,
  type NewLocationInput,
} from '../src/server/locationDatabase.ts';
import type { AdminLevelName, Country } from '../types.ts';

const projectRoot = path.resolve(import.meta.dirname, '..');
const databasePath = path.resolve(process.argv.find((argument) => argument.endsWith('.sqlite')) || path.join(projectRoot, 'data', 'location-register.sqlite'));
const reset = process.argv.includes('--reset');

if (reset) {
  for (const suffix of ['', '-shm', '-wal']) {
    const target = `${databasePath}${suffix}`;
    if (fs.existsSync(target)) fs.rmSync(target);
  }
}

const ugandaHierarchy: AdminLevelName[] = [
  { level: 1, key: 'region', name: 'Region', allowedTypes: ['Region', 'Source region unavailable'] },
  { level: 2, key: 'district_city', name: 'District / City', allowedTypes: ['District', 'City'] },
  { level: 3, key: 'county_municipality', name: 'County / Municipality / Constituency', allowedTypes: ['County', 'Municipality', 'Constituency'] },
  { level: 4, key: 'subcounty_division', name: 'Sub-County / Division / Town Council', allowedTypes: ['Sub-County', 'Division', 'Town Council'] },
  { level: 5, key: 'parish_ward', name: 'Parish / Ward', allowedTypes: ['Parish', 'Ward'] },
  { level: 6, key: 'village_cell', name: 'Village / Cell / Zone', allowedTypes: ['Village', 'Cell', 'Zone'] },
];

function locationUid(countryCode: string, canonicalPath: string): string {
  return deterministicUuid(`location:${countryCode}:${canonicalPath}`);
}

function inferCountyType(name: string): string {
  const normalized = normalizeLocationName(name);
  if (normalized.includes('MUNICIPALITY')) return 'Municipality';
  if (normalized.includes('COUNTY')) return 'County';
  return 'Constituency';
}

function inferSubcountyType(name: string): string {
  const normalized = normalizeLocationName(name);
  if (normalized.includes('DIVISION')) return 'Division';
  if (normalized.includes('TOWN COUNCIL') || normalized.endsWith(' T C')) return 'Town Council';
  return 'Sub-County';
}

const database = new LocationDatabase(databasePath);

try {
  for (const country of allAfricanCountries) {
    const countryInput: Country = country.countryCode === 'UG'
      ? { ...country, adminLevels: [], adminLevelNames: ugandaHierarchy, numberOfAdminLevels: ugandaHierarchy.length }
      : country;
    database.syncManagedLocations(countryInput);
  }

  database.deleteLocationsByManager('UG', 'electoral-commission-2022');
  const ugandaSchema = database.getHierarchy('UG');
  const sourceDistricts = electoralCommissionData.districts as ElectoralCommissionDistrict[];
  const regionBySourceDistrict = new Map<string, string>();

  for (const [mapDistrictName, mapDistrict] of Object.entries(UGANDA_DISTRICTS_DATA)) {
    const sourceDistrict = getElectoralCommissionDistrict(mapDistrictName);
    if (sourceDistrict) regionBySourceDistrict.set(sourceDistrict.name, mapDistrict.region);
  }
  for (const district of sourceDistricts) {
    if (regionBySourceDistrict.has(district.name) || district.type !== 'City') continue;
    const baseDistrict = getElectoralCommissionDistrict(district.name.replace(/ CITY$/, ''));
    if (baseDistrict && regionBySourceDistrict.has(baseDistrict.name)) {
      regionBySourceDistrict.set(district.name, regionBySourceDistrict.get(baseDistrict.name) as string);
    }
  }

  const regionNames = ['Central', 'Western', 'Eastern', 'Northern', 'Region not provided by source'];
  const usedRegions = new Set(sourceDistricts.map(
    (district) => regionBySourceDistrict.get(district.name) || 'Region not provided by source',
  ));
  const inputs: NewLocationInput[] = [];
  const regionUidByName = new Map<string, string>();
  let countyCount = 0;

  for (const regionName of regionNames.filter((name) => usedRegions.has(name))) {
    const uid = locationUid('UG', `UGANDA / ${regionName}`);
    regionUidByName.set(regionName, uid);
    inputs.push({
      uid,
      countryCode: 'UG',
      parentUid: ugandaSchema.rootLocationUid,
      levelOrder: 1,
      name: regionName,
      type: regionName === 'Region not provided by source' ? 'Source region unavailable' : 'Region',
      source: regionName === 'Region not provided by source'
        ? { name: UGANDA_ELECTORAL_COMMISSION_2022_METADATA.title, year: 2022 }
        : { name: 'Existing Uganda district boundary registry' },
      metadata: { managedBy: 'electoral-commission-2022' },
    });
  }

  for (const district of sourceDistricts) {
    const regionName = regionBySourceDistrict.get(district.name) || 'Region not provided by source';
    const regionUid = regionUidByName.get(regionName);
    if (!regionUid) throw new Error(`Missing region node for ${district.name}`);
    const districtCanonicalPath = `UGANDA / ${regionName} / ${district.name}`;
    const districtSourcePath = district.name;
    const districtUid = locationUid('UG', districtCanonicalPath);
    inputs.push({
      uid: districtUid,
      countryCode: 'UG',
      parentUid: regionUid,
      levelOrder: 2,
      name: district.name,
      type: district.type,
      source: { name: UGANDA_ELECTORAL_COMMISSION_2022_METADATA.title, year: 2022, path: districtSourcePath },
      metadata: { managedBy: 'electoral-commission-2022', regionAssignment: regionName },
    });

    const subcountiesByConstituency = new Map<string, typeof district.subcounties>();
    for (const subcounty of district.subcounties) {
      const constituency = subcounty.constituency;
      if (!constituency) throw new Error(`Missing constituency: ${district.name} / ${subcounty.name}`);
      const group = subcountiesByConstituency.get(constituency) || [];
      group.push(subcounty);
      subcountiesByConstituency.set(constituency, group);
    }

    for (const [constituency, subcounties] of subcountiesByConstituency) {
      countyCount += 1;
      const countyCanonicalPath = `${districtCanonicalPath} / ${constituency}`;
      const countySourcePath = `${districtSourcePath} / ${constituency}`;
      const countyUid = locationUid('UG', countyCanonicalPath);
      inputs.push({
        uid: countyUid,
        countryCode: 'UG',
        parentUid: districtUid,
        levelOrder: 3,
        name: constituency,
        type: inferCountyType(constituency),
        source: { name: UGANDA_ELECTORAL_COMMISSION_2022_METADATA.title, year: 2022, path: countySourcePath },
        metadata: { managedBy: 'electoral-commission-2022', sourceField: 'constituency' },
      });

      for (const subcounty of subcounties) {
        const subcountyCanonicalPath = `${countyCanonicalPath} / ${subcounty.name}`;
        const subcountySourcePath = `${districtSourcePath} / ${subcounty.name}`;
        const subcountyUid = locationUid('UG', subcountyCanonicalPath);
        inputs.push({
          uid: subcountyUid,
          countryCode: 'UG',
          parentUid: countyUid,
          levelOrder: 4,
          name: subcounty.name,
          type: inferSubcountyType(subcounty.name),
          source: { name: UGANDA_ELECTORAL_COMMISSION_2022_METADATA.title, year: 2022, path: subcountySourcePath },
          metadata: { managedBy: 'electoral-commission-2022' },
        });

        for (const parish of subcounty.parishes) {
          const parishCanonicalPath = `${subcountyCanonicalPath} / ${parish.name}`;
          const parishSourcePath = `${subcountySourcePath} / ${parish.name}`;
          const parishUid = locationUid('UG', parishCanonicalPath);
          inputs.push({
            uid: parishUid,
            countryCode: 'UG',
            parentUid: subcountyUid,
            levelOrder: 5,
            name: parish.name,
            type: normalizeLocationName(parish.name).includes('WARD') ? 'Ward' : 'Parish',
            source: { name: UGANDA_ELECTORAL_COMMISSION_2022_METADATA.title, year: 2022, path: parishSourcePath },
            metadata: { managedBy: 'electoral-commission-2022', sourceSections: parish.sourceSections },
          });

          for (const villageName of parish.villages) {
            const canonicalPath = `${parishCanonicalPath} / ${villageName}`;
            inputs.push({
              uid: locationUid('UG', canonicalPath),
              countryCode: 'UG',
              parentUid: parishUid,
              levelOrder: 6,
              name: villageName,
              type: 'Village',
              source: {
                name: UGANDA_ELECTORAL_COMMISSION_2022_METADATA.title,
                year: 2022,
                path: `${parishSourcePath} / ${villageName}`,
              },
              metadata: { managedBy: 'electoral-commission-2022' },
            });
          }
        }
      }
    }
  }

  const imported = database.importLocations(inputs, 'electoral-commission-2022-import');
  const luwero = database.listLocations('UG', { levelOrder: 2, search: 'LUWEERO', limit: 10 }).items
    .find((location) => normalizeUgandaLocationName(location.name) === 'LUWEERO');
  if (luwero) database.addAlias(luwero.uid, 'Luwero', 'en', 'Existing Uganda district boundary registry');
  const kampalaCentral = database.listLocations('UG', { levelOrder: 4, search: 'KAMPALA CENTRAL', limit: 10 }).items
    .find((location) => normalizeUgandaLocationName(location.name) === 'KAMPALACENTRAL');
  if (kampalaCentral) database.addAlias(kampalaCentral.uid, 'Central Division', 'en', 'Existing Kampala division geometry');

  const report = {
    databasePath,
    importedUgandaLocations: imported,
    uganda: {
      regions: usedRegions.size,
      districtAndCityUnits: sourceDistricts.length,
      countiesMunicipalitiesConstituencies: countyCount,
      subcounties: UGANDA_ELECTORAL_COMMISSION_2022_METADATA.statistics.subcounties,
      parishes: UGANDA_ELECTORAL_COMMISSION_2022_METADATA.statistics.parishes,
      villages: UGANDA_ELECTORAL_COMMISSION_2022_METADATA.statistics.uniqueFullVillagePaths,
    },
    database: database.getStatistics(),
    integrityCheck: database.integrityCheck(),
    sourceSha256: UGANDA_ELECTORAL_COMMISSION_2022_METADATA.sourceSha256,
  };
  fs.writeFileSync(path.join(projectRoot, 'data', 'location-database.seed-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
} finally {
  database.close();
}
