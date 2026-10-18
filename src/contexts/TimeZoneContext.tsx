import React, { createContext, useContext, useMemo, useState } from 'react';
import { countryTimeZoneConfig, formatZonedDateTime, formatZonedTime, isValidTimeZone } from '../shared/timeZones';

interface TimeZoneContextValue {
  countryCode: string;
  timeZone: string;
  setCountryTimeZone: (countryCode: string, timeZone?: string) => void;
  setTimeZone: (timeZone: string) => void;
  formatTime: (date: Date | number | string) => string;
  formatDateTime: (date: Date | number | string) => string;
}

const STORAGE_KEY = 'any-location-time-preference';
const TimeZoneContext = createContext<TimeZoneContextValue | null>(null);

function initialPreference() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as { countryCode?: string; timeZone?: string };
    const countryCode = saved.countryCode?.toUpperCase() || 'UG';
    const config = countryTimeZoneConfig(countryCode);
    return { countryCode, timeZone: saved.timeZone && isValidTimeZone(saved.timeZone) ? saved.timeZone : config.defaultTimeZone };
  } catch {
    return { countryCode: 'UG', timeZone: 'Africa/Kampala' };
  }
}

export const TimeZoneProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [preference, setPreference] = useState(initialPreference);
  const save = (countryCode: string, timeZone: string) => {
    const next = { countryCode: countryCode.toUpperCase(), timeZone };
    setPreference(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* storage can be unavailable */ }
  };
  const value = useMemo<TimeZoneContextValue>(() => ({
    ...preference,
    setCountryTimeZone: (countryCode, timeZone) => {
      const config = countryTimeZoneConfig(countryCode);
      save(countryCode, timeZone && isValidTimeZone(timeZone) ? timeZone : config.defaultTimeZone);
    },
    setTimeZone: (timeZone) => { if (isValidTimeZone(timeZone)) save(preference.countryCode, timeZone); },
    formatTime: (date) => formatZonedTime(date, preference.timeZone),
    formatDateTime: (date) => formatZonedDateTime(date, preference.timeZone),
  }), [preference]);
  return <TimeZoneContext.Provider value={value}>{children}</TimeZoneContext.Provider>;
};

export function useTimeZone(): TimeZoneContextValue {
  const context = useContext(TimeZoneContext);
  if (!context) throw new Error('useTimeZone must be used within TimeZoneProvider');
  return context;
}
