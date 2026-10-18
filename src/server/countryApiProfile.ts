import type { Country } from '../types.ts';
import { countryTimeZoneConfig } from '../shared/timeZones.ts';

export interface CountryMapAvailability {
  hasVerifiedGeometry: boolean;
}

function flagEmoji(countryCode: string): string | null {
  const normalized = countryCode.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) return null;
  return String.fromCodePoint(...[...normalized].map((character) => 127397 + character.charCodeAt(0)));
}

export function buildCountryApiProfile(
  country: Country,
  mapAvailability: CountryMapAvailability,
) {
  const countryCode = country.countryCode.trim().toUpperCase();
  const lowerCountryCode = countryCode.toLowerCase();
  const referenceCode = country.referenceCode ?? null;
  const mapEndpoint = referenceCode ? `/api/v1/locations/${encodeURIComponent(referenceCode)}/map` : null;
  const geometryEndpoint = referenceCode ? `/api/v1/locations/${encodeURIComponent(referenceCode)}/geometry` : null;
  const time = countryTimeZoneConfig(countryCode, country.timeZones, country.defaultTimeZone);

  return {
    referenceCode,
    name: country.name,
    continent: country.continent,
    economicZones: country.economicZones ?? [],
    countryCode,
    phoneCode: country.phoneCode,
    time: {
      defaultTimeZone: time.defaultTimeZone,
      timeZones: time.timeZones,
      storage: 'UTC',
      displayFormat: 'hh:mm:ss A z',
    },
    codes: {
      iso2: countryCode,
      callingCode: country.phoneCode,
    },
    flag: {
      emoji: flagEmoji(countryCode),
      svgUrl: `https://flagcdn.com/${lowerCountryCode}.svg`,
      pngUrl: `https://flagcdn.com/w320/${lowerCountryCode}.png`,
      alt: `Flag of ${country.name}`,
    },
    currency: {
      name: country.currency,
      code: country.currencyCode,
      symbol: country.currencySymbol,
      decimalPlaces: country.decimalPlaces ?? 0,
      denominations: (country.currencyDenominators ?? []).map((denomination) => ({
        value: denomination.value,
        label: denomination.label,
        type: denomination.type,
        status: denomination.status,
        ...(denomination.frontImage ? { frontImage: denomination.frontImage } : {}),
        ...(denomination.backImage ? { backImage: denomination.backImage } : {}),
      })),
    },
    map: {
      hasVerifiedGeometry: mapAvailability.hasVerifiedGeometry,
      responseMode: mapAvailability.hasVerifiedGeometry ? 'geometry' : 'hierarchy',
      endpoint: mapEndpoint,
      geometryEndpoint,
      fallback: 'hierarchy',
    },
    links: {
      self: `/api/v1/countries/${encodeURIComponent(countryCode)}/profile`,
      hierarchy: `/api/v1/countries/${encodeURIComponent(countryCode)}/schema`,
      locations: `/api/v1/countries/${encodeURIComponent(countryCode)}/locations`,
      export: `/api/v1/countries/${encodeURIComponent(countryCode)}/export`,
      map: mapEndpoint,
    },
  };
}
