import { mockRegionalEconomicLevels } from '../data/mockData.ts';
import type { Country, RegionalEconomicLevel } from '../types.ts';

export interface ApiScopeCatalogItem {
  code: string;
  name: string;
  countryCodes: string[];
}

export interface ApiScopeCatalog {
  economicZones: ApiScopeCatalogItem[];
  regionalBlocks: ApiScopeCatalogItem[];
  countries: Array<{ countryCode: string; name: string; referenceCode: string | null }>;
}

const normalized = (value: string) => value.trim().toUpperCase();

export function buildApiScopeCatalog(
  countries: Country[],
  regionalBlocks: RegionalEconomicLevel[] = mockRegionalEconomicLevels,
): ApiScopeCatalog {
  const configuredCountries = new Map(countries.map((country) => [normalized(country.name), country]));
  const blockCodes = new Set(regionalBlocks.map((block) => normalized(block.abbreviation)));
  for (const country of countries) {
    for (const membership of country.economicZones || []) {
      const code = normalized(membership);
      if (/^[A-Z0-9-]{2,12}$/.test(code)) blockCodes.add(code);
    }
  }
  const zoneMembership = new Map<string, { name: string; countryCodes: Set<string> }>();
  const blockMembership = new Map<string, { name: string; countryCodes: Set<string> }>();

  for (const country of countries) {
    for (const zone of country.economicZones || []) {
      const code = normalized(zone);
      if (!code || blockCodes.has(code)) continue;
      const entry = zoneMembership.get(code) || { name: zone.trim(), countryCodes: new Set<string>() };
      entry.countryCodes.add(country.countryCode.toUpperCase());
      zoneMembership.set(code, entry);
    }
    for (const blockCode of blockCodes) {
      if (!(country.economicZones || []).some((membership) => normalized(membership) === blockCode)) continue;
      const entry = blockMembership.get(blockCode) || { name: blockCode, countryCodes: new Set<string>() };
      entry.countryCodes.add(country.countryCode.toUpperCase());
      blockMembership.set(blockCode, entry);
    }
  }

  for (const block of regionalBlocks) {
    const code = normalized(block.abbreviation);
    const entry = blockMembership.get(code) || { name: block.name, countryCodes: new Set<string>() };
    entry.name = block.name;
    for (const countryName of block.countries) {
      const countryCode = configuredCountries.get(normalized(countryName))?.countryCode.toUpperCase();
      if (countryCode) entry.countryCodes.add(countryCode);
    }
    blockMembership.set(code, entry);
  }

  return {
    economicZones: [...zoneMembership.entries()]
      .map(([code, entry]) => ({ code, name: entry.name, countryCodes: [...entry.countryCodes].sort() }))
      .sort((left, right) => left.name.localeCompare(right.name)),
    regionalBlocks: [...blockMembership.entries()]
      .map(([code, entry]) => ({ code, name: entry.name, countryCodes: [...entry.countryCodes].sort() }))
      .filter((block) => block.countryCodes.length > 0)
      .sort((left, right) => left.name.localeCompare(right.name)),
    countries: countries
      .map((country) => ({ countryCode: country.countryCode.toUpperCase(), name: country.name, referenceCode: country.referenceCode ?? null }))
      .sort((left, right) => left.name.localeCompare(right.name)),
  };
}

export function resolveApiScopeCountries(
  catalog: ApiScopeCatalog,
  economicZones: string[],
  regionalBlocks: string[],
  countryCodes: string[],
): string[] {
  const resolved = new Set(countryCodes.map(normalized));
  const zones = new Map(catalog.economicZones.map((zone) => [zone.code, zone]));
  const blocks = new Map(catalog.regionalBlocks.map((block) => [block.code, block]));
  for (const code of economicZones.map(normalized)) zones.get(code)?.countryCodes.forEach((countryCode) => resolved.add(countryCode));
  for (const code of regionalBlocks.map(normalized)) blocks.get(code)?.countryCodes.forEach((countryCode) => resolved.add(countryCode));
  return [...resolved].sort();
}
