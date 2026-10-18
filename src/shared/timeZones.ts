export interface CountryTimeZoneConfig {
  defaultTimeZone: string;
  timeZones: string[];
}

// IANA identifiers, rather than fixed UTC offsets, preserve daylight-saving
// and government timezone rule changes provided by the runtime tz database.
const AFRICAN_COUNTRY_TIME_ZONES: Record<string, string[]> = {
  DZ: ['Africa/Algiers'], AO: ['Africa/Luanda'], BJ: ['Africa/Porto-Novo'], BW: ['Africa/Gaborone'],
  BF: ['Africa/Ouagadougou'], BI: ['Africa/Bujumbura'], CV: ['Atlantic/Cape_Verde'], CM: ['Africa/Douala'],
  CF: ['Africa/Bangui'], TD: ['Africa/Ndjamena'], KM: ['Indian/Comoro'],
  CD: ['Africa/Kinshasa', 'Africa/Lubumbashi'], CG: ['Africa/Brazzaville'], CI: ['Africa/Abidjan'],
  DJ: ['Africa/Djibouti'], EG: ['Africa/Cairo'], GQ: ['Africa/Malabo'], ER: ['Africa/Asmara'],
  SZ: ['Africa/Mbabane'], ET: ['Africa/Addis_Ababa'], GA: ['Africa/Libreville'], GM: ['Africa/Banjul'],
  GH: ['Africa/Accra'], GN: ['Africa/Conakry'], GW: ['Africa/Bissau'], KE: ['Africa/Nairobi'],
  LS: ['Africa/Maseru'], LR: ['Africa/Monrovia'], LY: ['Africa/Tripoli'], MG: ['Indian/Antananarivo'],
  MW: ['Africa/Blantyre'], ML: ['Africa/Bamako'], MR: ['Africa/Nouakchott'], MU: ['Indian/Mauritius'],
  MA: ['Africa/Casablanca'], MZ: ['Africa/Maputo'], NA: ['Africa/Windhoek'], NE: ['Africa/Niamey'],
  NG: ['Africa/Lagos'], RW: ['Africa/Kigali'], ST: ['Africa/Sao_Tome'], SN: ['Africa/Dakar'],
  SC: ['Indian/Mahe'], SL: ['Africa/Freetown'], SO: ['Africa/Mogadishu'], ZA: ['Africa/Johannesburg'],
  SS: ['Africa/Juba'], SD: ['Africa/Khartoum'], TZ: ['Africa/Dar_es_Salaam'], TG: ['Africa/Lome'],
  TN: ['Africa/Tunis'], UG: ['Africa/Kampala'], ZM: ['Africa/Lusaka'], ZW: ['Africa/Harare'],
  EH: ['Africa/El_Aaiun'], RE: ['Indian/Reunion'], YT: ['Indian/Mayotte'], SH: ['Atlantic/St_Helena'],
};

const TIME_ZONE_ABBREVIATIONS: Record<string, string> = {
  'Africa/Kampala': 'EAT', 'Africa/Nairobi': 'EAT', 'Africa/Dar_es_Salaam': 'EAT',
  'Africa/Addis_Ababa': 'EAT', 'Africa/Djibouti': 'EAT', 'Africa/Asmara': 'EAT',
  'Africa/Mogadishu': 'EAT', 'Indian/Comoro': 'EAT', 'Indian/Antananarivo': 'EAT',
  'Africa/Lagos': 'WAT', 'Africa/Kinshasa': 'WAT', 'Africa/Johannesburg': 'SAST',
  'Africa/Lubumbashi': 'CAT', 'Africa/Kigali': 'CAT', 'Africa/Harare': 'CAT',
  'Africa/Lusaka': 'CAT', 'Africa/Maputo': 'CAT', 'Africa/Gaborone': 'CAT',
};

export const FALLBACK_TIME_ZONE = 'UTC';

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format();
    return true;
  } catch {
    return false;
  }
}

export function countryTimeZoneConfig(
  countryCode?: string,
  configuredTimeZones?: string[],
  configuredDefault?: string,
): CountryTimeZoneConfig {
  const validConfigured = (configuredTimeZones ?? []).filter(isValidTimeZone);
  const catalog = AFRICAN_COUNTRY_TIME_ZONES[(countryCode ?? '').trim().toUpperCase()] ?? [];
  const timeZones = [...new Set(validConfigured.length ? validConfigured : catalog)].filter(isValidTimeZone);
  const requestedDefault = configuredDefault && isValidTimeZone(configuredDefault) ? configuredDefault : undefined;
  const defaultTimeZone = requestedDefault ?? timeZones[0] ?? FALLBACK_TIME_ZONE;
  return { defaultTimeZone, timeZones: timeZones.length ? timeZones : [defaultTimeZone] };
}

export function timeZoneAbbreviation(date: Date | number | string, timeZone: string): string {
  if (TIME_ZONE_ABBREVIATIONS[timeZone]) return TIME_ZONE_ABBREVIATIONS[timeZone];
  const value = new Date(date);
  if (Number.isNaN(value.getTime()) || !isValidTimeZone(timeZone)) return 'UTC';
  return new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'short' })
    .formatToParts(value).find((item) => item.type === 'timeZoneName')?.value || timeZone;
}

/** Formats exactly as HOUR:MINUTE:SECOND AM/PM TIMEZONE. */
export function formatZonedTime(date: Date | number | string, timeZone: string): string {
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return 'Invalid time';
  const safeTimeZone = isValidTimeZone(timeZone) ? timeZone : FALLBACK_TIME_ZONE;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: safeTimeZone, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
  }).formatToParts(value);
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  return `${read('hour')}:${read('minute')}:${read('second')} ${read('dayPeriod')} ${timeZoneAbbreviation(value, safeTimeZone)}`;
}

export function formatZonedDateTime(date: Date | number | string, timeZone: string): string {
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return String(date);
  const safeTimeZone = isValidTimeZone(timeZone) ? timeZone : FALLBACK_TIME_ZONE;
  const day = new Intl.DateTimeFormat('en-US', {
    timeZone: safeTimeZone, year: 'numeric', month: 'short', day: '2-digit',
  }).format(value);
  return `${day}, ${formatZonedTime(value, safeTimeZone)}`;
}
