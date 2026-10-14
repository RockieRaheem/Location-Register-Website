import React, { useEffect, useState } from 'react';
import { Check, Copy, KeyRound, Loader2, Plus, ShieldX, X } from 'lucide-react';
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

type GeographicScopeType = 'economic-zone' | 'regional-block' | 'country' | 'location';

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
  const [locationCountry, setLocationCountry] = useState('UG');
  const [locationSearch, setLocationSearch] = useState('');
  const [locationResults, setLocationResults] = useState<ApiScopeLocationOption[]>([]);
  const [selectedLocations, setSelectedLocations] = useState<ApiScopeLocationOption[]>([]);
  const [locationsLoading, setLocationsLoading] = useState(false);
  const [form, setForm] = useState({
    name: '', description: '', economicZones: [] as string[], regionalBlocks: [] as string[], countries: ['UG'], scopes: ['locations:read'],
    rpm: 60, quota: 10000, expiresAt: '',
  });

  const dark = theme === 'dark';
  const panel = dark ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-white';
  const input = `mt-1.5 h-10 w-full rounded-lg border px-3 text-sm ${dark ? 'border-slate-700 bg-slate-950' : 'border-slate-300 bg-white'}`;

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

  useEffect(() => {
    if (scopeType !== 'location' || !locationCountry || locationSearch.trim().length < 2) {
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
  }, [scopeType, locationCountry, locationSearch, selectedLocations]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true); setError('');
    try {
      const result = await createMachineApiClient({
        name: form.name,
        description: form.description,
        scopes: form.scopes,
        assignedEconomicZones: scopeType === 'economic-zone' ? form.economicZones : [],
        assignedRegionalBlocks: scopeType === 'regional-block' ? form.regionalBlocks : [],
        assignedCountryCodes: scopeType === 'country' ? form.countries : [],
        assignedLocationReferenceCodes: scopeType === 'location' ? selectedLocations.map((location) => location.referenceCode) : [],
        requestsPerMinute: form.rpm,
        dailyQuota: form.quota,
        expiresAt: form.expiresAt ? new Date(`${form.expiresAt}T23:59:59Z`).toISOString() : undefined,
      });
      setSecret(result.apiKey); setCopied(false);
      setForm((current) => ({ ...current, name: '', description: '' }));
      setIsCreateOpen(false);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to create API client.');
    } finally { setSaving(false); }
  };

  const revoke = async (uid: string) => { await revokeMachineApiClient(uid); await load(); };
  const changeScopeType = (nextType: GeographicScopeType) => {
    setScopeType(nextType);
    setForm((current) => ({ ...current, economicZones: [], regionalBlocks: [], countries: [] }));
    setSelectedLocations([]); setLocationSearch(''); setLocationResults([]);
  };
  const boundarySelectionCount = scopeType === 'economic-zone' ? form.economicZones.length
    : scopeType === 'regional-block' ? form.regionalBlocks.length
      : scopeType === 'country' ? form.countries.length : selectedLocations.length;

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

      <div className="flex justify-end">
        <button type="button" aria-expanded={isCreateOpen} aria-controls="create-service-client-form" onClick={() => setIsCreateOpen((open) => !open)} className={`inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-bold transition-colors ${isCreateOpen ? dark ? 'border border-slate-700 bg-slate-800 text-slate-200' : 'border border-slate-300 bg-white text-slate-700' : 'bg-yellow-500 text-slate-950 hover:bg-yellow-400'}`}>
          {isCreateOpen ? <X size={16} /> : <Plus size={16} />}{isCreateOpen ? 'Close form' : 'Create service client'}
        </button>
      </div>

      {isCreateOpen && (
        <form id="create-service-client-form" onSubmit={submit} className={`rounded-xl border p-5 ${panel}`}>
          <div className="mb-4 flex items-center gap-2">
            <Plus size={18} className="text-yellow-500" />
            <div><h3 className="font-bold">Create service client</h3><p className="mt-0.5 text-xs text-slate-500">Configure access, usage limits, and expiry before issuing the key.</p></div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium">Client name<input required autoFocus className={input} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
            <label className="text-sm font-medium">Geographic boundary
              <select className={input} style={{ colorScheme: dark ? 'dark' : 'light' }} value={scopeType} onChange={(event) => changeScopeType(event.target.value as GeographicScopeType)}>
                <option value="economic-zone">Economic zone</option><option value="regional-block">Regional block</option><option value="country">Country</option><option value="location">Specific locations and their descendants</option>
              </select>
            </label>
            <div className="md:col-span-2">
              {scopeType === 'economic-zone' && <ScopeMultiSelect label="Economic zones" placeholder="Select an economic zone" selected={form.economicZones} options={catalog.economicZones.map((zone) => ({ code: zone.code, name: zone.name, detail: `${zone.countryCodes.length} countries` }))} dark={dark} onChange={(values) => setForm({ ...form, economicZones: values })} />}
              {scopeType === 'regional-block' && <ScopeMultiSelect label="Regional blocks" placeholder="Select a regional block" selected={form.regionalBlocks} options={catalog.regionalBlocks.map((block) => ({ code: block.code, name: block.name, detail: `${block.countryCodes.length} countries` }))} dark={dark} onChange={(values) => setForm({ ...form, regionalBlocks: values })} />}
              {scopeType === 'country' && <ScopeMultiSelect label="Countries" placeholder="Select a country" selected={form.countries} options={catalog.countries.map((country) => ({ code: country.countryCode, name: country.name, detail: country.countryCode }))} dark={dark} onChange={(values) => setForm({ ...form, countries: values })} />}
              {scopeType === 'location' && <div className="grid gap-3 md:grid-cols-[minmax(180px,0.35fr)_1fr]">
                <label className="text-sm font-medium">Country to search<select className={input} style={{ colorScheme: dark ? 'dark' : 'light' }} value={locationCountry} onChange={(event) => { setLocationCountry(event.target.value); setLocationSearch(''); setLocationResults([]); }}><option value="">Select country</option>{catalog.countries.map((country) => <option key={country.countryCode} value={country.countryCode}>{country.name} ({country.countryCode})</option>)}</select></label>
                <div className="relative text-sm font-medium"><label htmlFor="service-client-location-search">Location scopes</label><div className={`mt-1.5 flex min-h-10 w-full flex-wrap items-center gap-1.5 rounded-lg border px-2 py-1 ${dark ? 'border-slate-700 bg-slate-950' : 'border-slate-300 bg-white'}`}>{selectedLocations.map((location) => <span key={location.referenceCode} className={`inline-flex h-7 items-center gap-1 rounded-md border px-2 text-xs font-bold ${dark ? 'border-slate-600 bg-slate-800' : 'border-slate-300 bg-slate-100'}`}>{location.name}<span className="font-normal text-slate-500">{location.levelName}</span><button type="button" onClick={() => setSelectedLocations((items) => items.filter((item) => item.referenceCode !== location.referenceCode))} aria-label={`Remove ${location.name}`} className="rounded p-0.5 hover:bg-red-500/15 hover:text-red-500"><X size={12} /></button></span>)}<input id="service-client-location-search" disabled={!locationCountry} className={`h-7 min-w-48 flex-1 border-0 bg-transparent px-1 text-sm font-normal outline-none ${dark ? 'text-slate-200 placeholder:text-slate-600' : 'text-slate-800 placeholder:text-slate-400'}`} value={locationSearch} onChange={(event) => setLocationSearch(event.target.value)} placeholder={selectedLocations.length ? 'Add another location' : 'Type at least 2 characters'} /></div>{(locationsLoading || locationResults.length > 0) && <div className={`absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border p-1 shadow-xl ${dark ? 'border-slate-700 bg-slate-950' : 'border-slate-200 bg-white'}`}>{locationsLoading ? <p className="p-3 text-xs text-slate-500">Searching locations…</p> : locationResults.map((location) => <button key={location.referenceCode} type="button" onClick={() => { setSelectedLocations((items) => [...items, location]); setLocationSearch(''); setLocationResults([]); }} className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm ${dark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'}`}><span className="font-semibold">{location.name}</span><span className="ml-3 text-xs text-slate-500">{location.levelName} · {location.referenceCode}</span></button>)}</div>}</div>
              </div>}
              <p className="mt-2 text-xs text-slate-500">Access is limited to the selected boundary. Location scopes include the selected locations and every descendant below them.</p>
            </div>
            <label className="text-sm font-medium">Requests per minute<input type="number" min="1" max="10000" className={input} value={form.rpm} onChange={(event) => setForm({ ...form, rpm: Number(event.target.value) })} /></label>
            <label className="text-sm font-medium">Daily quota<input type="number" min="1" max="10000000" className={input} value={form.quota} onChange={(event) => setForm({ ...form, quota: Number(event.target.value) })} /></label>
            <label className="text-sm font-medium">Expiry date<input type="date" className={input} value={form.expiresAt} onChange={(event) => setForm({ ...form, expiresAt: event.target.value })} /></label>
            <label className="text-sm font-medium">Description<input className={input} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
          </div>
          <fieldset className="mt-4">
            <legend className="text-sm font-medium">API permissions</legend><p className="mt-1 text-xs text-slate-500">Select only the operations this service needs.</p>
            <div className="mt-2 flex flex-wrap gap-2">{availableScopes.map((scope) => <label key={scope} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${dark ? 'border-slate-700' : 'border-slate-300'}`}><input type="checkbox" checked={form.scopes.includes(scope)} onChange={(event) => setForm({ ...form, scopes: event.target.checked ? [...form.scopes, scope] : form.scopes.filter((item) => item !== scope) })} />{scope}</label>)}</div>
          </fieldset>
          <div className="mt-5 flex flex-wrap gap-2">
            <button disabled={saving || !form.scopes.length || boundarySelectionCount === 0} className="flex h-10 items-center gap-2 rounded-lg bg-yellow-500 px-4 text-sm font-bold text-slate-950 disabled:opacity-50">{saving ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />} Create API key</button>
            <button type="button" onClick={() => setIsCreateOpen(false)} className={`h-10 rounded-lg border px-4 text-sm font-bold ${dark ? 'border-slate-700 text-slate-300' : 'border-slate-300 text-slate-700'}`}>Cancel</button>
          </div>
        </form>
      )}

      <section className={`rounded-xl border p-5 ${panel}`}>
        <h3 className="font-bold">Service clients</h3>
        {loading ? <Loader2 className="mt-5 animate-spin" /> : (
          <div className="mt-4 space-y-3">
            {clients.map((client) => (
              <div key={client.uid} className={`flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between ${dark ? 'border-slate-700' : 'border-slate-200'}`}>
                <div><div className="flex items-center gap-2"><span className="font-semibold">{client.name}</span><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${client.status === 'active' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>{client.status}</span></div><p className="mt-1 font-mono text-xs text-slate-500">al_live_{client.key_prefix}_••••••••</p><p className="mt-1 text-xs font-semibold text-yellow-500">{clientBoundaryLabel(client)}</p><p className="mt-1 text-xs text-slate-500">{client.scopes.join(' · ')} · {client.requests_per_minute}/min · {client.daily_quota}/day</p></div>
                {client.status === 'active' && <button type="button" onClick={() => void revoke(client.uid)} className="flex items-center gap-2 rounded-lg border border-red-500/30 px-3 py-2 text-xs font-bold text-red-500"><ShieldX size={15} /> Revoke</button>}
              </div>
            ))}
            {clients.length === 0 && <p className="text-sm text-slate-500">No machine clients created.</p>}
          </div>
        )}
      </section>
    </div>
  );
};

interface ScopeOption { code: string; name: string; detail: string; }

const ScopeMultiSelect = ({ label, placeholder, selected, options, dark, onChange }: {
  label: string; placeholder: string; selected: string[]; options: ScopeOption[]; dark: boolean; onChange: (values: string[]) => void;
}) => (
  <div className="text-sm font-medium">
    <span>{label}</span>
    <div className={`mt-1.5 flex min-h-10 w-full flex-wrap items-center gap-1.5 rounded-lg border px-2 py-1 ${dark ? 'border-slate-700 bg-slate-950' : 'border-slate-300 bg-white'}`}>
      {selected.map((code) => {
        const option = options.find((item) => item.code === code);
        return <span key={code} className={`inline-flex h-7 items-center gap-1 rounded-md border px-2 text-xs font-bold ${dark ? 'border-slate-600 bg-slate-800' : 'border-slate-300 bg-slate-100'}`}>{option?.name || code}<span className="font-normal text-slate-500">{option?.detail}</span><button type="button" onClick={() => onChange(selected.filter((item) => item !== code))} aria-label={`Remove ${option?.name || code}`} className="rounded p-0.5 hover:bg-red-500/15 hover:text-red-500"><X size={12} /></button></span>;
      })}
      <select aria-label={`Add ${label.toLowerCase()}`} style={{ colorScheme: dark ? 'dark' : 'light' }} className={`h-7 min-w-48 flex-1 border-0 px-1 text-sm font-normal outline-none ${dark ? 'bg-slate-950 text-slate-200' : 'bg-white text-slate-800'}`} value="" onChange={(event) => { if (event.target.value && !selected.includes(event.target.value)) onChange([...selected, event.target.value]); }}>
        <option value="">{selected.length ? `Add another ${label.toLowerCase().replace(/s$/, '')}` : placeholder}</option>
        {options.filter((option) => !selected.includes(option.code)).map((option) => <option className={dark ? 'bg-slate-950 text-slate-200' : 'bg-white text-slate-800'} key={option.code} value={option.code}>{option.name} ({option.detail})</option>)}
      </select>
    </div>
  </div>
);

function clientBoundaryLabel(client: MachineApiClient): string {
  if (client.assignedEconomicZones?.length) return `Economic zones: ${client.assignedEconomicZones.join(', ')}`;
  if (client.assignedRegionalBlocks?.length) return `Regional blocks: ${client.assignedRegionalBlocks.join(', ')}`;
  if (client.assignedCountryCodes?.length) return `Countries: ${client.assignedCountryCodes.join(', ')}`;
  if (client.assignedLocationReferenceCodes?.length) return `${client.assignedLocationReferenceCodes.length} specific location scope${client.assignedLocationReferenceCodes.length === 1 ? '' : 's'}`;
  return 'No geographic boundary';
}

export default ApiClientManagement;
