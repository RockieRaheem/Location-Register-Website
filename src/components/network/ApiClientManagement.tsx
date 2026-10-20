import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronLeft, ChevronRight, Copy, KeyRound, Loader2, Plus, Search, ShieldX, X } from 'lucide-react';
import type { Theme } from '../../types';
import {
  createMachineApiClient,
  getApiGeographicScopeCatalog,
  listMachineApiClients,
  revokeMachineApiClient,
  searchApiScopeLocations,
  type ApiGeographicScopeCatalog,
  type ApiScopeLocationOption,
  type MachineApiClient,
} from '../../services/userAdministrationService';

const availableScopes = [
  'locations:read',
  'geometry:read',
  'leadership:read',
  'locations:write',
  'leadership:manage',
  'audit:read',
  'webhooks:manage',
];

const clientPageSizes = [5, 10, 20];

type GeographicScopeType = 'economic-zone' | 'regional-block' | 'country';
type CountryCoverage = 'whole-country' | 'specific-hierarchy';

const ApiClientManagement = ({ theme }: { theme: Theme }) => {
  const [clients, setClients] = useState<MachineApiClient[]>([]);
  const [catalog, setCatalog] = useState<ApiGeographicScopeCatalog>({ economicZones: [], regionalBlocks: [], countries: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [secret, setSecret] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [scopeType, setScopeType] = useState<GeographicScopeType>('country');
  const [countryCoverage, setCountryCoverage] = useState<CountryCoverage>('whole-country');
  const [locationCountry, setLocationCountry] = useState('UG');
  const [locationSearch, setLocationSearch] = useState('');
  const [locationResults, setLocationResults] = useState<ApiScopeLocationOption[]>([]);
  const [selectedLocations, setSelectedLocations] = useState<ApiScopeLocationOption[]>([]);
  const [locationsLoading, setLocationsLoading] = useState(false);
  const [clientPage, setClientPage] = useState(1);
  const [clientsPerPage, setClientsPerPage] = useState(10);
  const [form, setForm] = useState({
    name: '', description: '', economicZones: [] as string[], regionalBlocks: [] as string[], countries: ['UG'], scopes: ['locations:read'],
    rpm: 60, quota: 10000, expiresAt: '',
  });

  const dark = theme === 'dark';
  const panel = dark ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-white';
  const modalPanel = dark
    ? 'border-slate-600 bg-slate-900 text-slate-100 ring-1 ring-white/5'
    : 'border-slate-300 bg-white text-slate-900 ring-1 ring-slate-950/5';
  const input = `mt-1.5 h-10 w-full rounded-lg border px-3 text-sm outline-none transition-colors focus:border-yellow-500 focus:ring-2 focus:ring-yellow-500/20 disabled:cursor-not-allowed disabled:opacity-60 ${dark ? 'border-slate-600 bg-slate-950 text-slate-100 placeholder:text-slate-500' : 'border-slate-300 bg-white text-slate-900 placeholder:text-slate-400'}`;

  const load = async () => {
    try {
      const [clientItems, scopeCatalog] = await Promise.all([listMachineApiClients(), getApiGeographicScopeCatalog()]);
      setClients(clientItems);
      setCatalog(scopeCatalog);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load API clients.');
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  const clientPageCount = Math.max(1, Math.ceil(clients.length / clientsPerPage));
  const visibleClientPage = Math.min(clientPage, clientPageCount);
  const clientStartIndex = (visibleClientPage - 1) * clientsPerPage;
  const visibleClients = clients.slice(clientStartIndex, clientStartIndex + clientsPerPage);

  useEffect(() => {
    if (clientPage > clientPageCount) setClientPage(clientPageCount);
  }, [clientPage, clientPageCount]);

  useEffect(() => {
    if (!isCreateOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) setIsCreateOpen(false);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [isCreateOpen, saving]);

  useEffect(() => {
    if (scopeType !== 'country' || countryCoverage !== 'specific-hierarchy' || !locationCountry || locationSearch.trim().length === 1) {
      setLocationResults([]);
      return undefined;
    }
    const timer = window.setTimeout(async () => {
      setLocationsLoading(true);
      try {
        const results = await searchApiScopeLocations(locationCountry, locationSearch.trim());
        setLocationResults(results.filter((item) => !selectedLocations.some((selected) => selected.referenceCode === item.referenceCode)));
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Unable to search locations.');
      } finally { setLocationsLoading(false); }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [scopeType, countryCoverage, locationCountry, locationSearch, selectedLocations]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true); setError('');
    try {
      const result = await createMachineApiClient({
        name: form.name,
        description: form.description,
        scopes: form.scopes,
        assignedEconomicZones: scopeType === 'economic-zone' ? form.economicZones : [],
        assignedRegionalBlocks: scopeType === 'regional-block' ? form.regionalBlocks : [],
        assignedCountryCodes: scopeType === 'country' && countryCoverage === 'whole-country' ? form.countries : [],
        assignedLocationReferenceCodes: scopeType === 'country' && countryCoverage === 'specific-hierarchy' ? selectedLocations.map((location) => location.referenceCode) : [],
        requestsPerMinute: form.rpm,
        dailyQuota: form.quota,
        expiresAt: form.expiresAt ? new Date(`${form.expiresAt}T23:59:59Z`).toISOString() : undefined,
      });
      setSecret(result.apiKey); setCopied(false);
      setForm((current) => ({ ...current, name: '', description: '' }));
      setIsCreateOpen(false);
      await load();
      setClientPage(1);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to create API client.');
    } finally { setSaving(false); }
  };

  const revoke = async (uid: string) => { await revokeMachineApiClient(uid); await load(); };
  const changeScopeType = (nextType: GeographicScopeType) => {
    setScopeType(nextType);
    setCountryCoverage('whole-country');
    setForm((current) => ({ ...current, economicZones: [], regionalBlocks: [], countries: [] }));
    setSelectedLocations([]); setLocationSearch(''); setLocationResults([]);
  };
  const changeCountries = (values: string[]) => {
    const nextCountries = countryCoverage === 'specific-hierarchy' ? values.slice(-1) : values;
    setForm((current) => ({ ...current, countries: nextCountries }));
    if (countryCoverage === 'specific-hierarchy') {
      setLocationCountry(nextCountries[0] || '');
      setSelectedLocations([]); setLocationSearch(''); setLocationResults([]);
    }
  };
  const changeCountryCoverage = (coverage: CountryCoverage) => {
    setCountryCoverage(coverage);
    setSelectedLocations([]); setLocationSearch(''); setLocationResults([]);
    if (coverage === 'specific-hierarchy') {
      const countryCode = form.countries[0] || locationCountry || catalog.countries[0]?.countryCode || '';
      setLocationCountry(countryCode);
      setForm((current) => ({ ...current, countries: countryCode ? [countryCode] : [] }));
    }
  };
  const boundarySelectionCount = scopeType === 'economic-zone' ? form.economicZones.length
    : scopeType === 'regional-block' ? form.regionalBlocks.length
      : countryCoverage === 'whole-country' ? form.countries.length : selectedLocations.length;

  return (
    <div className="space-y-4">
      {error && <p className="rounded-lg bg-red-500/10 p-3 text-sm text-red-500">{error}</p>}
      {secret && (
        <section className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-5">
          <h3 className="font-bold text-amber-700 dark:text-amber-300">Copy this key now—it will not be shown again</h3>
          <div className="mt-3 flex gap-2">
            <code className="min-w-0 flex-1 break-all rounded-lg bg-slate-950 p-3 text-xs text-emerald-400">{secret}</code>
            <button type="button" aria-label="Copy API key" onClick={() => { void navigator.clipboard.writeText(secret); setCopied(true); }} className="rounded-lg bg-yellow-500 px-3 text-slate-950">{copied ? <Check /> : <Copy />}</button>
          </div>
        </section>
      )}

      {isCreateOpen && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-3 backdrop-blur-sm sm:p-6" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setIsCreateOpen(false); }}>
        <form id="create-service-client-form" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="create-service-client-title" className={`flex max-h-[calc(100dvh-1.5rem)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border shadow-2xl shadow-black/50 sm:max-h-[calc(100dvh-3rem)] ${modalPanel}`}>
          <header className={`flex shrink-0 items-start justify-between gap-4 border-b px-5 py-4 sm:px-6 ${dark ? 'border-slate-700' : 'border-slate-200'}`}>
            <div className="flex min-w-0 items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-yellow-500/15 text-yellow-500"><Plus size={18} /></span>
              <div><h3 id="create-service-client-title" className={`font-bold ${dark ? 'text-white' : 'text-slate-950'}`}>Create service client</h3><p className={`mt-0.5 text-xs leading-5 ${dark ? 'text-slate-300' : 'text-slate-600'}`}>Configure geographic access, permissions, usage limits, and expiry before issuing the key.</p></div>
            </div>
            <button type="button" disabled={saving} onClick={() => setIsCreateOpen(false)} aria-label="Close create service client" className={`rounded-lg p-2 transition-colors disabled:opacity-50 ${dark ? 'text-slate-400 hover:bg-slate-800 hover:text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}`}><X size={19} /></button>
          </header>
          <div className="overflow-y-auto px-5 py-5 sm:px-6">
          {error && <p className="mb-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-500">{error}</p>}
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium">Client name<input required autoFocus className={input} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
            <label className="text-sm font-medium">Geographic boundary
              <select className={input} style={{ colorScheme: dark ? 'dark' : 'light' }} value={scopeType} onChange={(event) => changeScopeType(event.target.value as GeographicScopeType)}>
                <option value="economic-zone">Economic zone</option><option value="regional-block">Regional block</option><option value="country">Country and its hierarchy</option>
              </select>
            </label>
            <div className="md:col-span-2">
              {scopeType === 'economic-zone' && <ScopeMultiSelect label="Economic zones" placeholder="Select an economic zone" selected={form.economicZones} options={catalog.economicZones.map((zone) => ({ code: zone.code, name: zone.name, detail: `${zone.countryCodes.length} countries` }))} dark={dark} onChange={(values) => setForm({ ...form, economicZones: values })} />}
              {scopeType === 'regional-block' && <ScopeMultiSelect label="Regional blocks" placeholder="Select a regional block" selected={form.regionalBlocks} options={catalog.regionalBlocks.map((block) => ({ code: block.code, name: block.name, detail: `${block.countryCodes.length} countries` }))} dark={dark} onChange={(values) => setForm({ ...form, regionalBlocks: values })} />}
              {scopeType === 'country' && <div className="space-y-4">
                {countryCoverage === 'whole-country'
                  ? <ScopeMultiSelect label="Countries" placeholder="Select a country" selected={form.countries} options={catalog.countries.map((country) => ({ code: country.countryCode, name: country.name, detail: country.countryCode }))} dark={dark} onChange={changeCountries} />
                  : <label className="block text-sm font-medium">Country<select className={input} style={{ colorScheme: dark ? 'dark' : 'light' }} value={form.countries[0] || ''} onChange={(event) => changeCountries(event.target.value ? [event.target.value] : [])}><option value="">Select a country</option>{catalog.countries.map((country) => <option key={country.countryCode} value={country.countryCode}>{country.name} ({country.countryCode})</option>)}</select></label>}
                <fieldset><legend className="text-sm font-medium">Coverage within the country</legend><div className="mt-2 grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Country coverage">
                  <button type="button" role="radio" aria-checked={countryCoverage === 'whole-country'} onClick={() => changeCountryCoverage('whole-country')} className={`rounded-xl border p-3 text-left transition-colors ${countryCoverage === 'whole-country' ? dark ? 'border-yellow-500 bg-yellow-500/10' : 'border-yellow-500 bg-yellow-50' : dark ? 'border-slate-600 bg-slate-950/60 hover:border-slate-500' : 'border-slate-300 bg-white hover:border-slate-400'}`}><span className="block text-sm font-semibold">Whole country</span><span className={`mt-1 block text-xs ${dark ? 'text-slate-300' : 'text-slate-600'}`}>Access every configured hierarchy level and location in the selected country.</span></button>
                  <button type="button" role="radio" aria-checked={countryCoverage === 'specific-hierarchy'} onClick={() => changeCountryCoverage('specific-hierarchy')} className={`rounded-xl border p-3 text-left transition-colors ${countryCoverage === 'specific-hierarchy' ? dark ? 'border-yellow-500 bg-yellow-500/10' : 'border-yellow-500 bg-yellow-50' : dark ? 'border-slate-600 bg-slate-950/60 hover:border-slate-500' : 'border-slate-300 bg-white hover:border-slate-400'}`}><span className="block text-sm font-semibold">Specific hierarchy locations</span><span className={`mt-1 block text-xs ${dark ? 'text-slate-300' : 'text-slate-600'}`}>Choose one or more regions, districts, counties, or lower-level locations and include their descendants.</span></button>
                </div></fieldset>
                {countryCoverage === 'specific-hierarchy' && <section className={`rounded-xl border p-4 ${dark ? 'border-slate-600 bg-slate-950/40' : 'border-slate-200 bg-slate-50'}`}><div><h4 className="text-sm font-semibold">Hierarchy access roots</h4><p className={`mt-1 text-xs ${dark ? 'text-slate-300' : 'text-slate-600'}`}>Search or open the dropdown, then select any configured hierarchy location. Every child below a selected root is included automatically.</p></div><div className="mt-3"><HierarchyLocationPicker dark={dark} disabled={!locationCountry} loading={locationsLoading} query={locationSearch} onQueryChange={setLocationSearch} results={locationResults} selected={selectedLocations} onSelect={(location) => { setSelectedLocations((items) => items.length >= 100 || items.some((item) => item.referenceCode === location.referenceCode) ? items : [...items, location]); setLocationSearch(''); }} onRemove={(referenceCode) => setSelectedLocations((items) => items.filter((item) => item.referenceCode !== referenceCode))} /></div></section>}
              </div>}
              <p className={`mt-3 text-xs ${dark ? 'text-slate-300' : 'text-slate-600'}`}>{scopeType === 'country' && countryCoverage === 'specific-hierarchy' ? 'Access is restricted to the selected hierarchy roots and every descendant beneath them.' : 'Access is limited to the selected geographic boundary.'}</p>
            </div>
            <label className="text-sm font-medium">Requests per minute<input type="number" min="1" max="10000" className={input} value={form.rpm} onChange={(event) => setForm({ ...form, rpm: Number(event.target.value) })} /></label>
            <label className="text-sm font-medium">Daily quota<input type="number" min="1" max="10000000" className={input} value={form.quota} onChange={(event) => setForm({ ...form, quota: Number(event.target.value) })} /></label>
            <label className="text-sm font-medium">Expiry date<input type="date" className={input} value={form.expiresAt} onChange={(event) => setForm({ ...form, expiresAt: event.target.value })} /></label>
            <label className="text-sm font-medium">Description<input className={input} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
          </div>
          <fieldset className="mt-4">
            <legend className="text-sm font-semibold">API permissions</legend><p className={`mt-1 text-xs ${dark ? 'text-slate-300' : 'text-slate-600'}`}>Select only the operations this service needs.</p>
            <div className="mt-2 flex flex-wrap gap-2">{availableScopes.map((scope) => <label key={scope} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium ${dark ? 'border-slate-600 bg-slate-950/70 text-slate-200' : 'border-slate-300 bg-slate-50 text-slate-800'}`}><input type="checkbox" className="accent-yellow-500" checked={form.scopes.includes(scope)} onChange={(event) => setForm({ ...form, scopes: event.target.checked ? [...form.scopes, scope] : form.scopes.filter((item) => item !== scope) })} />{scope}</label>)}</div>
          </fieldset>
          </div>
          <footer className={`flex shrink-0 flex-col-reverse gap-2 border-t px-5 py-4 sm:flex-row sm:justify-end sm:px-6 ${dark ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-slate-50'}`}>
            <button type="button" disabled={saving} onClick={() => setIsCreateOpen(false)} className={`h-10 rounded-lg border px-4 text-sm font-bold disabled:opacity-50 ${dark ? 'border-slate-700 text-slate-300' : 'border-slate-300 bg-white text-slate-700'}`}>Cancel</button>
            <button disabled={saving || !form.scopes.length || boundarySelectionCount === 0} className="flex h-10 items-center gap-2 rounded-lg bg-yellow-500 px-4 text-sm font-bold text-slate-950 disabled:opacity-50">{saving ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />} Create API key</button>
          </footer>
        </form>
        </div>,
        document.body,
      )}

      <section className={`rounded-xl border p-5 ${panel}`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><h3 className="font-bold">Service clients</h3><p className="mt-1 text-xs text-slate-500">Create and manage credentials used by external systems.</p></div>
          <button type="button" aria-expanded={isCreateOpen} aria-controls="create-service-client-form" onClick={() => { setError(''); setIsCreateOpen(true); }} className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-yellow-500 px-4 text-sm font-bold text-slate-950 transition-colors hover:bg-yellow-400">
            <Plus size={16} />Create service client
          </button>
        </div>
        {loading ? <Loader2 className="mt-5 animate-spin" /> : (
          <div className="mt-4">
            <div className={`overflow-x-auto rounded-xl border ${dark ? 'border-slate-700' : 'border-slate-200'}`}>
              <table className="w-full min-w-[1120px] table-auto border-collapse text-left text-sm">
                <caption className="sr-only">Service clients and their API access configuration</caption>
                <thead className={dark ? 'bg-slate-950 text-slate-300' : 'bg-slate-50 text-slate-600'}>
                  <tr>
                    <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wide">Client</th>
                    <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wide">Status</th>
                    <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wide">Credential</th>
                    <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wide">Geographic boundary</th>
                    <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wide">Permissions</th>
                    <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wide">Usage limits</th>
                    <th scope="col" className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide">Action</th>
                  </tr>
                </thead>
                <tbody className={dark ? 'divide-y divide-slate-700 bg-slate-900' : 'divide-y divide-slate-200 bg-white'}>
                  {visibleClients.map((client) => (
                    <tr key={client.uid} className={dark ? 'transition-colors hover:bg-slate-800/70' : 'transition-colors hover:bg-slate-50'}>
                      <td className="max-w-56 px-4 py-3.5 align-top"><p className="font-semibold">{client.name}</p>{client.description && <p className={`mt-1 line-clamp-2 text-xs ${dark ? 'text-slate-400' : 'text-slate-500'}`}>{client.description}</p>}</td>
                      <td className="px-4 py-3.5 align-top"><span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${client.status === 'active' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>{client.status}</span></td>
                      <td className="px-4 py-3.5 align-top"><code className={`whitespace-nowrap rounded-md px-2 py-1 font-mono text-xs ${dark ? 'bg-slate-950 text-slate-300' : 'bg-slate-100 text-slate-700'}`}>al_live_{client.key_prefix}_••••••••</code></td>
                      <td className="max-w-56 px-4 py-3.5 align-top"><span className="text-xs font-semibold text-yellow-500">{clientBoundaryLabel(client)}</span></td>
                      <td className="max-w-72 px-4 py-3.5 align-top"><div className="flex flex-wrap gap-1.5">{client.scopes.map((scope) => <span key={scope} className={`rounded-md border px-2 py-1 text-[10px] font-medium ${dark ? 'border-slate-600 bg-slate-800 text-slate-200' : 'border-slate-200 bg-slate-50 text-slate-700'}`}>{scope}</span>)}</div></td>
                      <td className={`whitespace-nowrap px-4 py-3.5 align-top text-xs ${dark ? 'text-slate-300' : 'text-slate-600'}`}><p><strong className={dark ? 'text-slate-100' : 'text-slate-900'}>{client.requests_per_minute.toLocaleString()}</strong> requests/min</p><p className="mt-1"><strong className={dark ? 'text-slate-100' : 'text-slate-900'}>{client.daily_quota.toLocaleString()}</strong> requests/day</p></td>
                      <td className="px-4 py-3.5 text-right align-top">{client.status === 'active' ? <button type="button" onClick={() => void revoke(client.uid)} className="ml-auto inline-flex items-center gap-2 rounded-lg border border-red-500/30 px-3 py-2 text-xs font-bold text-red-500 transition-colors hover:bg-red-500/10"><ShieldX size={15} />Revoke</button> : <span className="text-xs text-slate-500">No actions</span>}</td>
                    </tr>
                  ))}
                  {clients.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">No service clients have been created yet.</td></tr>}
                </tbody>
              </table>
            </div>
            {clients.length > 0 && <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-xs text-slate-500"><span>Rows per page</span><select aria-label="Service clients per page" style={{ colorScheme: dark ? 'dark' : 'light' }} value={clientsPerPage} onChange={(event) => { setClientsPerPage(Number(event.target.value)); setClientPage(1); }} className={`h-8 rounded-lg border px-2 text-xs outline-none ${dark ? 'border-slate-700 bg-slate-950 text-slate-200' : 'border-slate-300 bg-white text-slate-800'}`}>{clientPageSizes.map((size) => <option key={size} value={size}>{size}</option>)}</select><span>{clientStartIndex + 1}–{Math.min(clientStartIndex + clientsPerPage, clients.length)} of {clients.length}</span></div>
              <nav className="flex items-center gap-2" aria-label="Service client pages"><button type="button" disabled={visibleClientPage === 1} onClick={() => setClientPage((page) => Math.max(1, page - 1))} className={`inline-flex h-9 items-center gap-1 rounded-lg border px-3 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${dark ? 'border-slate-700 hover:bg-slate-800' : 'border-slate-300 hover:bg-slate-100'}`}><ChevronLeft size={15} />Previous</button><span className="min-w-20 text-center text-xs font-medium">Page {visibleClientPage} of {clientPageCount}</span><button type="button" disabled={visibleClientPage === clientPageCount} onClick={() => setClientPage((page) => Math.min(clientPageCount, page + 1))} className={`inline-flex h-9 items-center gap-1 rounded-lg border px-3 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${dark ? 'border-slate-700 hover:bg-slate-800' : 'border-slate-300 hover:bg-slate-100'}`}>Next<ChevronRight size={15} /></button></nav>
            </div>}
          </div>
        )}
      </section>
    </div>
  );
};

interface ScopeOption { code: string; name: string; detail: string; }

const HierarchyLocationPicker = ({ dark, disabled, loading, query, onQueryChange, results, selected, onSelect, onRemove }: {
  dark: boolean;
  disabled: boolean;
  loading: boolean;
  query: string;
  onQueryChange: (value: string) => void;
  results: ApiScopeLocationOption[];
  selected: ApiScopeLocationOption[];
  onSelect: (location: ApiScopeLocationOption) => void;
  onRemove: (referenceCode: string) => void;
}) => {
  const [open, setOpen] = useState(false);
  const atLimit = selected.length >= 100;
  const availableResults = results.filter((result) => !selected.some((item) => item.referenceCode === result.referenceCode));
  const status = atLimit ? 'Maximum of 100 hierarchy roots reached'
    : loading ? 'Loading hierarchy locations…'
      : query.trim().length === 1 ? 'Type one more character to search'
        : availableResults.length === 0 ? 'No matching hierarchy locations' : '';

  return <div className="relative text-sm font-medium" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <div className="flex items-center justify-between gap-2"><label htmlFor="service-client-hierarchy-picker">Hierarchy locations</label><span className={`text-[10px] font-normal ${dark ? 'text-slate-400' : 'text-slate-500'}`}>{selected.length}/100 roots</span></div>
    <div className={`mt-1.5 flex min-h-11 w-full flex-wrap items-center gap-1.5 rounded-lg border px-2 py-1.5 transition-colors focus-within:border-yellow-500 focus-within:ring-2 focus-within:ring-yellow-500/20 ${disabled ? 'cursor-not-allowed opacity-60' : ''} ${dark ? 'border-slate-600 bg-slate-950 text-slate-100' : 'border-slate-300 bg-white text-slate-900'}`}>
      {selected.map((location) => <span key={location.referenceCode} className={`inline-flex h-7 items-center gap-1 rounded-md border px-2 text-xs font-bold ${dark ? 'border-slate-600 bg-slate-800 text-slate-100' : 'border-slate-300 bg-slate-100 text-slate-900'}`}>{location.name}<span className={`font-normal ${dark ? 'text-slate-300' : 'text-slate-600'}`}>{location.levelName}</span><button type="button" onClick={() => onRemove(location.referenceCode)} aria-label={`Remove ${location.name}`} className="rounded p-0.5 hover:bg-red-500/15 hover:text-red-500"><X size={12} /></button></span>)}
      <div className="flex min-w-56 flex-1 items-center gap-2"><Search size={15} className={dark ? 'text-slate-400' : 'text-slate-500'} aria-hidden="true" /><input id="service-client-hierarchy-picker" role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls="service-client-hierarchy-results" disabled={disabled || atLimit} value={query} onFocus={() => setOpen(true)} onChange={(event) => { onQueryChange(event.target.value); setOpen(true); }} className={`h-7 min-w-0 flex-1 border-0 bg-transparent text-sm font-normal outline-none ${dark ? 'text-slate-100 placeholder:text-slate-500' : 'text-slate-900 placeholder:text-slate-400'}`} placeholder={disabled ? 'Select a country first' : atLimit ? 'Maximum hierarchy roots reached' : selected.length ? 'Search and add another location' : 'Search or select a hierarchy location'} /></div>
    </div>
    {open && !disabled && !atLimit && <div id="service-client-hierarchy-results" role="listbox" className={`absolute inset-x-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-xl border p-1 shadow-xl ${dark ? 'border-slate-600 bg-slate-900 text-slate-100 shadow-black/40' : 'border-slate-200 bg-white text-slate-900 shadow-slate-900/15'}`}>
      {status ? <p className={`px-3 py-3 text-xs ${dark ? 'text-slate-400' : 'text-slate-500'}`} role="status">{status}</p> : availableResults.map((location) => <button key={location.referenceCode} type="button" role="option" aria-selected="false" onMouseDown={(event) => event.preventDefault()} onClick={() => { onSelect(location); setOpen(false); }} className={`flex w-full items-center justify-between gap-4 rounded-lg px-3 py-2.5 text-left transition-colors ${dark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'}`}><span className="min-w-0"><span className="block truncate text-sm font-semibold">{location.name}</span><span className={`mt-0.5 block truncate text-xs ${dark ? 'text-slate-400' : 'text-slate-500'}`}>{location.referenceCode}</span></span><span className={`shrink-0 rounded-md px-2 py-1 text-[10px] font-semibold ${dark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>{location.levelName}</span></button>)}
    </div>}
  </div>;
};

const ScopeMultiSelect = ({ label, placeholder, selected, options, dark, onChange }: {
  label: string; placeholder: string; selected: string[]; options: ScopeOption[]; dark: boolean; onChange: (values: string[]) => void;
}) => (
  <div className="text-sm font-medium">
    <span>{label}</span>
    <div className={`mt-1.5 flex min-h-10 w-full flex-wrap items-center gap-1.5 rounded-lg border px-2 py-1 ${dark ? 'border-slate-600 bg-slate-950 text-slate-100' : 'border-slate-300 bg-white text-slate-900'}`}>
      {selected.map((code) => {
        const option = options.find((item) => item.code === code);
        return <span key={code} className={`inline-flex h-7 items-center gap-1 rounded-md border px-2 text-xs font-bold ${dark ? 'border-slate-600 bg-slate-800 text-slate-100' : 'border-slate-300 bg-slate-100 text-slate-900'}`}>{option?.name || code}<span className={`font-normal ${dark ? 'text-slate-300' : 'text-slate-600'}`}>{option?.detail}</span><button type="button" onClick={() => onChange(selected.filter((item) => item !== code))} aria-label={`Remove ${option?.name || code}`} className="rounded p-0.5 hover:bg-red-500/15 hover:text-red-500"><X size={12} /></button></span>;
      })}
      <select aria-label={`Add ${label.toLowerCase()}`} style={{ colorScheme: dark ? 'dark' : 'light' }} className={`h-7 min-w-48 flex-1 border-0 px-1 text-sm font-normal outline-none ${dark ? 'bg-slate-950 text-slate-200' : 'bg-white text-slate-800'}`} value="" onChange={(event) => { if (event.target.value && !selected.includes(event.target.value)) onChange([...selected, event.target.value]); }}>
        <option value="">{selected.length ? `Add another ${label === 'Countries' ? 'country' : label.toLowerCase().replace(/s$/, '')}` : placeholder}</option>
        {options.filter((option) => !selected.includes(option.code)).map((option) => <option className={dark ? 'bg-slate-950 text-slate-200' : 'bg-white text-slate-800'} key={option.code} value={option.code}>{option.name} ({option.detail})</option>)}
      </select>
    </div>
  </div>
);

function clientBoundaryLabel(client: MachineApiClient): string {
  if (client.assignedEconomicZones?.length) return `Economic zones: ${client.assignedEconomicZones.join(', ')}`;
  if (client.assignedRegionalBlocks?.length) return `Regional blocks: ${client.assignedRegionalBlocks.join(', ')}`;
  if (client.assignedCountryCodes?.length) return `Countries: ${client.assignedCountryCodes.join(', ')}`;
  if (client.assignedLocationReferenceCodes?.length) return `Hierarchy roots: ${client.assignedLocationReferenceCodes.length}`;
  return 'No geographic boundary';
}

export default ApiClientManagement;
