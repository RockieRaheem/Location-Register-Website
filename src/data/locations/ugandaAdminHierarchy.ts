import {
  getElectoralCommissionDistrict,
  getElectoralCommissionSubcounty,
  normalizeUgandaLocationName,
  UGANDA_ELECTORAL_COMMISSION_2022_METADATA,
} from './ugandaElectoralCommission2022';

export interface UgandaVillageNode {
  id: string;
  name: string;
  type: 'Village' | 'Cell' | 'Zone' | 'Trading Centre' | 'Landing Site' | 'Estate';
  localTerm: string;
  parishName: string;
  subcountyName: string;
  countyName: string;
  districtName: string;
  regionName: string;
  constituencyName?: string;
  lc1Chairperson?: string;
  lc1Phone?: string;
  viceChairperson?: string;
  defenceSecretary?: string;
  generalSecretary?: string;
  pdmSaccoName?: string;
  pdmRegistrationNo?: string;
  pdmStatus?: 'Active & Funded' | 'Disbursing Loans' | 'Registered' | 'Verified';
  estimatedHouseholds?: number;
  estimatedPopulation?: number;
  shopDensity?: number;
  weeklySalesVolumeUGX?: number;
  activeContributors?: number;
  mappedShops?: string[];
  keyLandmarks?: string[];
  marketDays?: string;
  lat?: number;
  lon?: number;
  syncStatus?: 'Synced' | 'Pending Sync';
  sourceName: string;
  sourceYear: number;
  sourcePath: string;
  verificationStatus: 'Source hierarchy only';
}

export interface UgandaParishNode {
  id: string;
  name: string;
  type: 'Parish' | 'Ward';
  localTerm: 'Muluka' | 'Ward' | 'Gombolola Parish';
  subcountyName: string;
  districtName: string;
  villagesCount: number;
  villages: UgandaVillageNode[];
  parishChief?: string;
  lc2Chairperson?: string;
  pdmSaccoName?: string;
  pdmPillar?: string;
  healthCentre?: string;
  primarySchool?: string;
  center_lat?: number;
  center_lon?: number;
  sourceName: string;
  sourceYear: number;
  sourcePath: string;
}

export interface UgandaSubcountyHierarchy {
  id: string;
  name: string;
  type: 'Sub-County' | 'Town Council' | 'City Division' | 'Municipal Division';
  localTerm: 'Gombolola' | 'Division' | 'Town Council';
  countyName: string;
  districtName: string;
  regionName: string;
  parishesCount: number;
  parishes: UgandaParishNode[];
  constituencyName?: string;
  subcountyChief?: string;
  lc3Chairperson?: string;
  sourceName: string;
  sourceYear: number;
  sourcePath: string;
}

function stableIdPart(value: string): string {
  return normalizeUgandaLocationName(value).toLowerCase().replace(/ /g, '-');
}

function inferSubcountyType(name: string): UgandaSubcountyHierarchy['type'] {
  const normalized = normalizeUgandaLocationName(name);
  if (normalized.includes('CITY DIVISION')) return 'City Division';
  if (normalized.includes('MUNICIPAL DIVISION')) return 'Municipal Division';
  if (normalized.includes('TOWN COUNCIL') || normalized.endsWith(' T C')) return 'Town Council';
  return 'Sub-County';
}

function inferParishType(name: string): UgandaParishNode['type'] {
  return normalizeUgandaLocationName(name).includes('WARD') ? 'Ward' : 'Parish';
}

/**
 * Returns only administrative names present in the imported Electoral Commission
 * source. The source contains no officials, coordinates, population, PDM, or
 * commercial profile fields, so this adapter deliberately leaves those optional
 * fields unset instead of synthesizing values.
 */
export function getUgandaSubcountyHierarchy(
  districtName: string,
  subcountyName: string,
  regionName = 'Region not provided by source',
): UgandaSubcountyHierarchy | null {
  const district = getElectoralCommissionDistrict(districtName);
  const subcounty = getElectoralCommissionSubcounty(districtName, subcountyName);
  if (!district || !subcounty) return null;

  const sourceName = UGANDA_ELECTORAL_COMMISSION_2022_METADATA.title;
  const sourceYear = UGANDA_ELECTORAL_COMMISSION_2022_METADATA.sourceYear;
  const districtId = stableIdPart(district.name);
  const subcountyId = `${districtId}/${stableIdPart(subcounty.name)}`;
  const subcountyPath = `${district.name} / ${subcounty.name}`;

  const parishes: UgandaParishNode[] = subcounty.parishes.map((parish, parishIndex) => {
    const parishId = `${subcountyId}/${stableIdPart(parish.name)}-${parishIndex + 1}`;
    const parishPath = `${subcountyPath} / ${parish.name}`;
    const parishType = inferParishType(parish.name);
    const villages: UgandaVillageNode[] = parish.villages.map((villageName, villageIndex) => ({
      id: `${parishId}/${stableIdPart(villageName)}-${villageIndex + 1}`,
      name: villageName,
      type: 'Village',
      localTerm: 'Village',
      parishName: parish.name,
      subcountyName: subcounty.name,
      countyName: subcounty.constituency,
      constituencyName: subcounty.constituency,
      districtName: district.name,
      regionName,
      sourceName,
      sourceYear,
      sourcePath: `${parishPath} / ${villageName}`,
      verificationStatus: 'Source hierarchy only',
    }));

    return {
      id: parishId,
      name: parish.name,
      type: parishType,
      localTerm: parishType === 'Ward' ? 'Ward' : 'Muluka',
      subcountyName: subcounty.name,
      districtName: district.name,
      villagesCount: villages.length,
      villages,
      sourceName,
      sourceYear,
      sourcePath: parishPath,
    };
  });

  const type = inferSubcountyType(subcounty.name);
  return {
    id: subcountyId,
    name: subcounty.name,
    type,
    localTerm: type === 'Town Council' ? 'Town Council' : type.includes('Division') ? 'Division' : 'Gombolola',
    countyName: subcounty.constituency,
    constituencyName: subcounty.constituency,
    districtName: district.name,
    regionName,
    parishesCount: parishes.length,
    parishes,
    sourceName,
    sourceYear,
    sourcePath: subcountyPath,
  };
}
