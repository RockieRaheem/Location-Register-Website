import { buildCountryApiProfile } from './countryApiProfile.ts';
import type { Country } from '../types.ts';

const uganda: Country = {
  id: 1,
  referenceCode: 'UG-L00-ROOT',
  name: 'Uganda',
  continent: 'Africa',
  economicZones: ['Eastern Africa'],
  currency: 'Ugandan Shilling',
  currencySymbol: 'USh',
  currencyCode: 'UGX',
  countryCode: 'UG',
  phoneCode: '+256',
  vat: 18,
  decimalPlaces: 0,
  adminLevels: [],
  currencyDenominators: [
    { id: 1, value: 50_000, label: '50,000', type: 'Note', status: 'Active' },
  ],
};

describe('country API profile', () => {
  it('publishes identity, flag, currency, denominations, and map discovery', () => {
    const profile = buildCountryApiProfile(uganda, { hasVerifiedGeometry: true });

    expect(profile.codes).toEqual({ iso2: 'UG', callingCode: '+256' });
    expect(profile.flag).toMatchObject({ emoji: '🇺🇬', alt: 'Flag of Uganda' });
    expect(profile.currency.denominations).toEqual([
      { value: 50_000, label: '50,000', type: 'Note', status: 'Active' },
    ]);
    expect(profile.map).toMatchObject({
      hasVerifiedGeometry: true,
      responseMode: 'geometry',
      endpoint: '/api/v1/locations/UG-L00-ROOT/map',
      fallback: 'hierarchy',
    });
  });

  it('states when the map endpoint will use the hierarchy fallback', () => {
    const profile = buildCountryApiProfile(uganda, { hasVerifiedGeometry: false });
    expect(profile.map.responseMode).toBe('hierarchy');
    expect(profile.map.hasVerifiedGeometry).toBe(false);
  });
});
