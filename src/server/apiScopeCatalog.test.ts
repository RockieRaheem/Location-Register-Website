import { buildApiScopeCatalog, resolveApiScopeCountries } from './apiScopeCatalog.ts';
import type { Country, RegionalEconomicLevel } from '../types.ts';

const country = (name: string, code: string, zones: string[]): Country => ({
  id: code.charCodeAt(0), name, countryCode: code, continent: 'Africa', economicZones: zones,
  currency: 'Currency', currencySymbol: '$', currencyCode: 'CUR', phoneCode: '+1', vat: 0, adminLevels: [],
});

describe('API geographic scope catalog', () => {
  const countries = [country('Uganda', 'UG', ['Eastern Africa', 'COMESA']), country('Kenya', 'KE', ['Eastern Africa'])];
  const blocks: RegionalEconomicLevel[] = [{ id: 1, name: 'East African Community', abbreviation: 'EAC', flag: '', description: '', countries: ['Uganda', 'Kenya'], color: '' }];
  const catalog = buildApiScopeCatalog(countries, blocks);

  it('keeps geographic zones separate from regional blocks', () => {
    expect(catalog.economicZones).toEqual([{ code: 'EASTERN AFRICA', name: 'Eastern Africa', countryCodes: ['KE', 'UG'] }]);
    expect(catalog.regionalBlocks).toEqual([
      { code: 'COMESA', name: 'COMESA', countryCodes: ['UG'] },
      { code: 'EAC', name: 'East African Community', countryCodes: ['KE', 'UG'] },
    ]);
  });

  it('resolves zone, block, and explicit country grants into effective countries', () => {
    expect(resolveApiScopeCountries(catalog, ['Eastern Africa'], [], [])).toEqual(['KE', 'UG']);
    expect(resolveApiScopeCountries(catalog, [], ['eac'], ['UG'])).toEqual(['KE', 'UG']);
  });
});
