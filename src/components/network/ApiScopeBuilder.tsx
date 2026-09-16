import React, { useEffect, useMemo, useState } from 'react';
import { Check, Copy, Database, Loader2, Search } from 'lucide-react';
import type { Theme } from '../../types';
import {
  ApiCountryOption, ApiHierarchyLevel, ApiLocationOption, getApiCountryHierarchy,
  listAccessibleApiCountries, LocationApiDescriptor, searchAccessibleApiLocations,
} from '../../services/userAdministrationService';

interface Props {
  theme: Theme;
  baseUrl: string;
  hasGlobalRead: boolean;
  assignedScopes: LocationApiDescriptor[];
}

type Mode = 'country-level' | 'location';
type Resource = 'record' | 'children' | 'subtree' | 'ancestors' | 'geometry';

const ApiScopeBuilder: React.FC<Props> = ({ theme, baseUrl, hasGlobalRead, assignedScopes }) => {
  const [countries, setCountries] = useState<ApiCountryOption[]>([]);
  const [levels, setLevels] = useState<ApiHierarchyLevel[]>([]);
  const [countryCode, setCountryCode] = useState('');
  const [level, setLevel] = useState(2);
  const [mode, setMode] = useState<Mode>(hasGlobalRead ? 'country-level' : 'location');
  const [resource, setResource] = useState<Resource>('subtree');
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<ApiLocationOption[]>([]);
  const [location, setLocation] = useState<ApiLocationOption | null>(null);
  const [scopeReference, setScopeReference] = useState(assignedScopes[0]?.scope.referenceCode || '');
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dark = theme === 'dark';

  useEffect(() => {
    void listAccessibleApiCountries().then((items) => {
      setCountries(items);
      setCountryCode(items[0]?.countryCode || assignedScopes[0]?.scope.countryCode || '');
    }).catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load API access.')).finally(() => setLoading(false));
  }, [assignedScopes]);

  useEffect(() => {
    if (!countryCode || !hasGlobalRead) return;
    void getApiCountryHierarchy(countryCode).then((items) => {
      setLevels(items);
      if (items.length) setLevel(items[0].order);
    }).catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load hierarchy.'));
  }, [countryCode, hasGlobalRead]);

  const assigned = assignedScopes.find((item) => item.scope.referenceCode === scopeReference);
  const reference = location?.referenceCode || assigned?.scope.referenceCode || '';
  const endpointPath = useMemo(() => {
    if (mode === 'country-level') return '/api/v1/countries/' + countryCode + '/locations?level=' + level + '&limit=100&offset=0';
    if (!reference) return '';
    if (resource === 'record') return '/api/v1/locations/' + reference;
    if (resource === 'subtree') return '/api/v1/locations/' + reference + '/subtree?limit=1000&offset=0';
    return '/api/v1/locations/' + reference + '/' + resource;
  }, [countryCode, level, mode, reference, resource]);

  const findLocations = async () => {
    if (!countryCode || search.trim().length < 2) return;
    setSearching(true);
    setError(null);
    try { setResults(await searchAccessibleApiLocations(countryCode, search.trim())); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to search locations.'); }
    finally { setSearching(false); }
  };

  const copyEndpoint = async () => {
    await navigator.clipboard.writeText(baseUrl + endpointPath);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  const control = 'h-11 w-full rounded-lg border px-3 text-sm outline-none transition-colors focus:border-yellow-500 focus:ring-2 focus:ring-yellow-500/15 ' + (dark ? 'border-slate-700 bg-slate-950 text-white' : 'border-slate-300 bg-white text-slate-900');
  const selectedButton = dark ? 'bg-slate-800 text-white' : 'bg-white text-slate-950 shadow-sm';
  if (loading) return <div className="flex min-h-64 items-center justify-center gap-2 text-sm text-slate-500"><Loader2 size={18} className="animate-spin" /> Loading your API access…</div>;
  if (!hasGlobalRead && assignedScopes.length === 0) return <div className={'rounded-xl border p-8 text-center ' + (dark ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-white')}><Database size={24} className="mx-auto mb-3 text-slate-400" /><h3 className="font-semibold">No location data is assigned yet</h3><p className="mt-1 text-sm text-slate-500">Ask the system owner to assign a country, district, sub-county, parish or village to your account.</p></div>;

  return (
    <section className={'overflow-hidden rounded-xl border ' + (dark ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-white')}>
      <div className="border-b border-slate-200 p-5 dark:border-slate-800">
        <div className="flex items-start gap-3"><span className="rounded-lg bg-yellow-500/10 p-2.5 text-yellow-600"><Database size={20} /></span><div><h3 className="text-lg font-semibold">Choose the data you need</h3><p className="mt-1 text-sm text-slate-500">Build an endpoint for an administrative level or one exact location.</p></div></div>
      </div>
      <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
        <div className="space-y-5">
          {hasGlobalRead && <fieldset><legend className="mb-2 text-sm font-semibold">1. Coverage</legend><div className={'grid grid-cols-2 gap-1 rounded-lg p-1 ' + (dark ? 'bg-slate-950' : 'bg-slate-100')}><button type="button" onClick={() => { setMode('country-level'); setLocation(null); }} className={'rounded-md px-3 py-2 text-sm font-medium ' + (mode === 'country-level' ? selectedButton : 'text-slate-500')}>Administrative level</button><button type="button" onClick={() => setMode('location')} className={'rounded-md px-3 py-2 text-sm font-medium ' + (mode === 'location' ? selectedButton : 'text-slate-500')}>Specific location</button></div></fieldset>}
          {hasGlobalRead ? <>
            <label className="block"><span className="mb-2 block text-sm font-semibold">2. Country</span><select className={control} value={countryCode} onChange={(event) => { setCountryCode(event.target.value); setLocation(null); setResults([]); }}>{countries.map((country) => <option key={country.countryCode} value={country.countryCode}>{country.name} ({country.countryCode})</option>)}</select></label>
            {mode === 'country-level' ? <label className="block"><span className="mb-2 block text-sm font-semibold">3. Administrative level</span><select className={control} value={level} onChange={(event) => setLevel(Number(event.target.value))}>{levels.map((item) => <option key={item.order} value={item.order}>{item.order}. {item.name}</option>)}</select></label> :
              <div><span className="mb-2 block text-sm font-semibold">3. Find a location</span><div className="flex gap-2"><input className={control} value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void findLocations(); }} placeholder="District, division, parish or village" /><button type="button" onClick={() => void findLocations()} disabled={searching || search.trim().length < 2} className="flex h-11 shrink-0 items-center gap-2 rounded-lg bg-yellow-500 px-4 text-sm font-semibold text-slate-950 disabled:opacity-50">{searching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />} Search</button></div>{results.length > 0 && <div className={'mt-2 max-h-52 overflow-y-auto rounded-lg border p-1 ' + (dark ? 'border-slate-700' : 'border-slate-200')}>{results.map((item) => <button type="button" key={item.referenceCode} onClick={() => setLocation(item)} className={'flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm ' + (location?.referenceCode === item.referenceCode ? 'bg-yellow-500/15' : 'hover:bg-slate-500/10')}><span className="truncate font-medium">{item.name}</span><span className="shrink-0 text-xs text-slate-500">{item.levelName}</span></button>)}</div>}</div>}
          </> :
            <label className="block"><span className="mb-2 block text-sm font-semibold">1. Assigned location</span><select className={control} value={scopeReference} onChange={(event) => setScopeReference(event.target.value)}>{assignedScopes.map((item) => <option key={item.scope.referenceCode} value={item.scope.referenceCode}>{item.scope.name} · {item.scope.levelName}</option>)}</select></label>}
          {mode === 'location' && <label className="block"><span className="mb-2 block text-sm font-semibold">{hasGlobalRead ? '4' : '2'}. Data to return</span><select className={control} value={resource} onChange={(event) => setResource(event.target.value as Resource)}><option value="subtree">Complete hierarchy below this location</option><option value="children">Direct child locations only</option><option value="record">Location record only</option><option value="ancestors">Path from country to this location</option><option value="geometry">Verified boundary geometry</option></select></label>}
        </div>
        <div className={'rounded-xl border p-4 ' + (dark ? 'border-slate-700 bg-slate-950' : 'border-slate-200 bg-slate-50')}>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Generated endpoint</p>
          {endpointPath ? <><code className="mt-3 block break-all rounded-lg bg-slate-950 p-3 text-xs leading-5 text-emerald-400">{baseUrl}{endpointPath}</code><button type="button" onClick={() => void copyEndpoint()} className="mt-3 flex items-center gap-2 rounded-lg bg-yellow-500 px-4 py-2 text-sm font-semibold text-slate-950">{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? 'Copied' : 'Copy endpoint'}</button><p className="mt-4 text-xs leading-5 text-slate-500">Send a Firebase ID token in the Authorization Bearer header. Results remain limited to your assigned role and location scope.</p></> : <p className="mt-3 text-sm text-slate-500">Choose a location to generate its endpoint.</p>}
        </div>
      </div>
      {error && <div className="border-t border-red-500/20 bg-red-500/5 px-5 py-3 text-sm text-red-500">{error}</div>}
    </section>
  );
};

export default ApiScopeBuilder;
