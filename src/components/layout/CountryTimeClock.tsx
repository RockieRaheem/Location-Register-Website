import React, { useEffect, useMemo, useState } from 'react';
import { Clock3 } from 'lucide-react';
import type { Country, Theme } from '../../types';
import { countryTimeZoneConfig } from '../../shared/timeZones';
import { useTimeZone } from '../../contexts/TimeZoneContext';

interface Props { theme: Theme; countries: Country[]; }

const CountryTimeClock: React.FC<Props> = ({ theme, countries }) => {
  const { countryCode, timeZone, setCountryTimeZone, setTimeZone, formatTime } = useTimeZone();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const country = countries.find((item) => item.countryCode === countryCode);
  const config = useMemo(
    () => countryTimeZoneConfig(countryCode, country?.timeZones, country?.defaultTimeZone),
    [countryCode, country?.timeZones, country?.defaultTimeZone],
  );
  useEffect(() => {
    if (!config.timeZones.includes(timeZone)) setCountryTimeZone(countryCode, config.defaultTimeZone);
  }, [config.defaultTimeZone, config.timeZones, countryCode, timeZone, setCountryTimeZone]);
  const control = theme === 'dark' ? 'border-slate-700 bg-slate-900 text-slate-200' : 'border-slate-200 bg-white text-slate-700';
  return (
    <div className={`hidden lg:flex items-center gap-2 rounded-lg border px-2 py-1.5 ${control}`} aria-label="Country local time">
      <Clock3 size={16} className="text-yellow-500" aria-hidden="true" />
      <span className="min-w-[132px] font-mono text-xs font-semibold tabular-nums">{formatTime(now)}</span>
      <select aria-label="Time country" value={countryCode} onChange={(event) => setCountryTimeZone(event.target.value)} className={`max-w-28 bg-transparent text-xs outline-none ${control}`}>
        {countries.map((item) => <option key={item.countryCode} value={item.countryCode}>{item.name}</option>)}
      </select>
      {config.timeZones.length > 1 && <select aria-label="Country timezone" value={timeZone} onChange={(event) => setTimeZone(event.target.value)} className={`max-w-36 bg-transparent text-xs outline-none ${control}`}>
        {config.timeZones.map((zone) => <option key={zone} value={zone}>{zone.replaceAll('_', ' ')}</option>)}
      </select>}
    </div>
  );
};

export default CountryTimeClock;
