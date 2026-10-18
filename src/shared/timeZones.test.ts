import { countryTimeZoneConfig, formatZonedTime, isValidTimeZone } from './timeZones.ts';

describe('country timezone handling', () => {
  test('formats Uganda time with seconds, meridiem and timezone', () => {
    expect(formatZonedTime('2026-10-18T14:55:11.000Z', 'Africa/Kampala')).toBe('05:55:11 PM EAT');
  });

  test('supports countries with multiple timezones', () => {
    expect(countryTimeZoneConfig('CD')).toEqual({
      defaultTimeZone: 'Africa/Kinshasa',
      timeZones: ['Africa/Kinshasa', 'Africa/Lubumbashi'],
    });
  });

  test('rejects invalid configured zones and safely falls back', () => {
    expect(isValidTimeZone('Africa/Not_A_Zone')).toBe(false);
    expect(countryTimeZoneConfig('XX', ['Africa/Not_A_Zone']).defaultTimeZone).toBe('UTC');
  });
});
