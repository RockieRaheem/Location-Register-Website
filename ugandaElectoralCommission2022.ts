import electoralCommissionData from './data/uganda-electoral-commission-2022.json';

export interface ElectoralCommissionParish {
  name: string;
  villages: string[];
  sourceSections: Array<'byParish' | 'bySubcounty'>;
}

export interface ElectoralCommissionSubcounty {
  name: string;
  constituency: string | null;
  parishes: ElectoralCommissionParish[];
}

export interface ElectoralCommissionDistrict {
  name: string;
  type: 'District' | 'City';
  subcounties: ElectoralCommissionSubcounty[];
}

export interface ElectoralCommissionMetadata {
  title: string;
  sourceYear: number;
  sourceFileName: string;
  sourceSha256: string;
  hierarchyRule: string;
  statistics: {
    districtAndCityUnits: number;
    districts: number;
    cities: number;
    subcounties: number;
    parishes: number;
    uniqueFullVillagePaths: number;
    globalUniqueVillageNames: number;
  };
}

interface ElectoralCommissionDataset {
  metadata: ElectoralCommissionMetadata;
  districts: ElectoralCommissionDistrict[];
}

const dataset = electoralCommissionData as ElectoralCommissionDataset;

/**
 * Comparison key only. Display names always remain exactly as supplied by the
 * Electoral Commission source data.
 */
export const normalizeUgandaLocationName = (value: string): string =>
  value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

// The boundary dataset spells this district "Luwero" while the Electoral
// Commission source spells it "LUWEERO". No other cross-dataset guess is made.
const districtLookupAliases: Record<string, string> = {
  LUWERO: 'LUWEERO',
};

// The existing Kampala geometry labels this polygon "Central Division" while
// the source hierarchy records its parent unit as "KAMPALA CENTRAL".
const subcountyLookupAliases: Record<string, string> = {
  'KAMPALA|CENTRALDIVISION': 'KAMPALACENTRAL',
};

const districtsByName = new Map<string, ElectoralCommissionDistrict>();
for (const district of dataset.districts) {
  districtsByName.set(normalizeUgandaLocationName(district.name), district);
}

export const UGANDA_ELECTORAL_COMMISSION_2022_METADATA = dataset.metadata;

export function getElectoralCommissionDistricts(): ElectoralCommissionDistrict[] {
  return dataset.districts;
}

export function getElectoralCommissionDistrict(
  districtName: string,
): ElectoralCommissionDistrict | null {
  const normalized = normalizeUgandaLocationName(districtName);
  const aliased = districtLookupAliases[normalized] || normalized;
  return districtsByName.get(aliased) || null;
}

export function getElectoralCommissionSubcounties(
  districtName: string,
): ElectoralCommissionSubcounty[] {
  return getElectoralCommissionDistrict(districtName)?.subcounties || [];
}

export function getElectoralCommissionSubcounty(
  districtName: string,
  subcountyName: string,
): ElectoralCommissionSubcounty | null {
  const district = getElectoralCommissionDistrict(districtName);
  if (!district) return null;
  const normalizedDistrict = normalizeUgandaLocationName(district.name);
  const normalizedInput = normalizeUgandaLocationName(subcountyName);
  const normalized = subcountyLookupAliases[`${normalizedDistrict}|${normalizedInput}`]
    || normalizedInput;
  return district.subcounties.find(
    (subcounty) => normalizeUgandaLocationName(subcounty.name) === normalized,
  ) || null;
}
