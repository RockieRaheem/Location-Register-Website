import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, ChevronLeft, ChevronRight, Copy, Gauge, Globe2, KeyRound, Loader2, MapPinned, Plus, Search, ShieldCheck, ShieldX, X } from 'lucide-react';
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
type CountryCoverage = 'whole-country' | 'specific-hierarchy' | null;
type ClientWizardStep = 1 | 2 | 3;

const newClientForm = () => ({
  name: '', description: '', economicZones: [] as string[], regionalBlocks: [] as string[], countries: [] as string[], scopes: ['locations:read'],
  rpm: 60, quota: 10000, expiresAt: '',
});
type ClientForm = ReturnType<typeof newClientForm>;

const ApiClientManagement = ({ theme }: { theme: Theme }) => {
  const [clients, setClients] = useState<MachineApiClient[]>([]);
  const [catalog, setCatalog] = useState<ApiGeographicScopeCatalog>({ economicZones: [], regionalBlocks: [], countries: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [secret, setSecret] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [wizardStep, setWizardStep] = useState<ClientWizardStep>(1);
  const [scopeType, setScopeType] = useState<GeographicScopeType>('country');
  const [countryCoverage, setCountryCoverage] = useState<CountryCoverage>('whole-country');
  const [locationCountry, setLocationCountry] = useState('');
  const [locationSearch, setLocationSearch] = useState('');
  const [locationResults, setLocationResults] = useState<ApiScopeLocationOption[]>([]);
  const [selectedLocations, setSelectedLocations] = useState<ApiScopeLocationOption[]>([]);
  const [locationsLoading, setLocationsLoading] = useState(false);
  const [clientPage, setClientPage] = useState(1);
  const [clientsPerPage, setClientsPerPage] = useState(10);
  const [form, setForm] = useState(newClientForm);

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
    event.preventDefault();
    if (wizardStep !== 3) return;
    setSaving(true); setError('');
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
      setForm(newClientForm());
      setWizardStep(1); setScopeType('country'); setCountryCoverage('whole-country'); setLocationCountry(''); setSelectedLocations([]);
      setIsCreateOpen(false);
      await load();
      setClientPage(1);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to create API client.');
    } finally { setSaving(false); }
  };

  const revoke = async (uid: string) => { await revokeMachineApiClient(uid); await load(); };
  const openCreateClient = () => {
    setError(''); setWizardStep(1); setScopeType('country'); setCountryCoverage('whole-country'); setLocationCountry('');
    setLocationSearch(''); setLocationResults([]); setSelectedLocations([]); setForm(newClientForm()); setIsCreateOpen(true);
  };
  const changeScopeType = (nextType: GeographicScopeType) => {
    setScopeType(nextType);
    setCountryCoverage(nextType === 'country' ? 'whole-country' : null);
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
  const changeCountryCoverage = (coverage: Exclude<CountryCoverage, null>) => {
    setCountryCoverage(coverage);
    setSelectedLocations([]); setLocationSearch(''); setLocationResults([]);
    if (coverage === 'specific-hierarchy') {
      const countryCode = form.countries[0] || locationCountry || '';
      setLocationCountry(countryCode);
      setForm((current) => ({ ...current, countries: countryCode ? [countryCode] : [] }));
    }
  };
  const boundarySelectionCount = scopeType === 'economic-zone' ? form.economicZones.length
    : scopeType === 'regional-block' ? form.regionalBlocks.length
      : countryCoverage === 'whole-country' ? form.countries.length : selectedLocations.length;
  const stepOneComplete = form.name.trim().length > 0 && boundarySelectionCount > 0;
  const stepTwoComplete = form.scopes.length > 0 && form.rpm >= 1 && form.quota >= 1;
  const geographySummary = scopeType === 'economic-zone'
    ? form.economicZones.join(', ')
    : scopeType === 'regional-block'
      ? form.regionalBlocks.join(', ')
      : countryCoverage === 'whole-country'
        ? form.countries.map((code) => catalog.countries.find((country) => country.countryCode === code)?.name || code).join(', ')
        : `${catalog.countries.find((country) => country.countryCode === locationCountry)?.name || locationCountry}: ${selectedLocations.length} hierarchy root${selectedLocations.length === 1 ? '' : 's'}`;

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
        <form id="create-service-client-form" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="create-service-client-title" className={`flex max-h-[calc(100dvh-1.5rem)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border shadow-2xl shadow-black/50 sm:max-h-[calc(100dvh-3rem)] ${modalPanel}`}>
          <header className={`shrink-0 border-b px-5 py-4 sm:px-6 ${dark ? 'border-slate-700' : 'border-slate-200'}`}>
            <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-yellow-500/15 text-yellow-500"><KeyRound size={18} /></span>
              <div><h3 id="create-service-client-title" className={`font-bold ${dark ? 'text-white' : 'text-slate-950'}`}>Create service client</h3><p className={`mt-0.5 text-xs leading-5 ${dark ? 'text-slate-300' : 'text-slate-600'}`}>Issue a secure API identity in three clear steps.</p></div>
            </div>
            <button type="button" disabled={saving} onClick={() => setIsCreateOpen(false)} aria-label="Close create service client" className={`rounded-lg p-2 transition-colors disabled:opacity-50 ${dark ? 'text-slate-400 hover:bg-slate-800 hover:text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}`}><X size={19} /></button>
            </div>
            <WizardProgress step={wizardStep} dark={dark} />
          </header>
          <div className="overflow-y-auto px-5 py-5 sm:px-6">
          {error && <p className="mb-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-500">{error}</p>}
          {wizardStep === 1 && <div className="space-y-6">
            <section><div className="mb-3"><h4 className="font-semibold">Client identity</h4><p className={`mt-1 text-xs ${dark ? 'text-slate-400' : 'text-slate-500'}`}>Use a name your team will recognize in logs and audits.</p></div><div className="grid gap-4 md:grid-cols-2"><label className="text-sm font-medium">Client name<input required autoFocus className={input} placeholder="Example: Public map portal" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label className="text-sm font-medium">Description <span className="font-normal text-slate-500">(optional)</span><input className={input} placeholder="What will this integration do?" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label></div></section>
            <section><div className="mb-3"><h4 className="font-semibold">Geographic access</h4><p className={`mt-1 text-xs ${dark ? 'text-slate-400' : 'text-slate-500'}`}>Choose one boundary model, then select the areas this client may access.</p></div>
              <div className={`grid grid-cols-3 gap-1 rounded-xl border p-1 ${dark ? 'border-slate-600 bg-slate-950' : 'border-slate-300 bg-slate-100'}`}>{([['country', 'Country'], ['regional-block', 'Regional block'], ['economic-zone', 'Economic zone']] as const).map(([value, label]) => <button key={value} type="button" onClick={() => changeScopeType(value)} className={`min-h-10 rounded-lg px-2 text-xs font-semibold transition-colors sm:text-sm ${scopeType === value ? 'bg-yellow-500 text-slate-950 shadow-sm' : dark ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-white'}`}>{label}</button>)}</div>
              <div className="mt-4">
            <div className="md:col-span-2">
              {scopeType === 'economic-zone' && <ScopeMultiSelect label="Economic zones" placeholder="Select an economic zone" selected={form.economicZones} options={catalog.economicZones.map((zone) => ({ code: zone.code, name: zone.name, detail: `${zone.countryCodes.length} countries` }))} dark={dark} onChange={(values) => setForm({ ...form, economicZones: values })} />}
              {scopeType === 'regional-block' && <ScopeMultiSelect label="Regional blocks" placeholder="Select a regional block" selected={form.regionalBlocks} options={catalog.regionalBlocks.map((block) => ({ code: block.code, name: block.name, detail: `${block.countryCodes.length} countries` }))} dark={dark} onChange={(values) => setForm({ ...form, regionalBlocks: values })} />}
              {scopeType === 'country' && <CountryScopeFlow
                dark={dark}
                countries={catalog.countries}
                selectedCountryCodes={form.countries}
                coverage={countryCoverage}
                locationCountry={locationCountry}
                locationSearch={locationSearch}
                locationResults={locationResults}
                selectedLocations={selectedLocations}
                locationsLoading={locationsLoading}
                onCountriesChange={changeCountries}
                onCoverageChange={changeCountryCoverage}
                onLocationSearchChange={setLocationSearch}
                onLocationSelect={(location) => { setSelectedLocations((items) => items.length >= 100 || items.some((item) => item.referenceCode === location.referenceCode) ? items : [...items, location]); setLocationSearch(''); }}
                onLocationRemove={(referenceCode) => setSelectedLocations((items) => items.filter((item) => item.referenceCode !== referenceCode))}
              />}
            </div>
              </div>
            </section>
          </div>}
          {wizardStep === 2 && <PermissionsAndLimitsStep dark={dark} inputClass={input} form={form} onChange={setForm} />}
          {wizardStep === 3 && <ClientReviewStep dark={dark} form={form} geographySummary={geographySummary} scopeType={scopeType} countryCoverage={countryCoverage} onEditGeography={() => setWizardStep(1)} onEditPermissions={() => setWizardStep(2)} />}
          </div>
          <footer className={`flex shrink-0 items-center justify-between gap-3 border-t px-5 py-4 sm:px-6 ${dark ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-slate-50'}`}>
            <button type="button" disabled={saving} onClick={() => setIsCreateOpen(false)} className={`h-10 rounded-lg px-3 text-sm font-semibold disabled:opacity-50 ${dark ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-500 hover:bg-slate-200'}`}>Cancel</button>
            <div className="flex items-center gap-2">{wizardStep > 1 && <button type="button" disabled={saving} onClick={() => setWizardStep((wizardStep - 1) as ClientWizardStep)} className={`inline-flex h-10 items-center gap-1 rounded-lg border px-4 text-sm font-semibold ${dark ? 'border-slate-700 hover:bg-slate-800' : 'border-slate-300 bg-white hover:bg-slate-100'}`}><ChevronLeft size={16} />Back</button>}{wizardStep < 3 ? <button type="button" disabled={wizardStep === 1 ? !stepOneComplete : !stepTwoComplete} onClick={() => setWizardStep((wizardStep + 1) as ClientWizardStep)} className="inline-flex h-10 items-center gap-1 rounded-lg bg-yellow-500 px-4 text-sm font-bold text-slate-950 hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-40">Continue<ChevronRight size={16} /></button> : <button disabled={saving || !stepOneComplete || !stepTwoComplete} className="inline-flex h-10 items-center gap-2 rounded-lg bg-yellow-500 px-4 text-sm font-bold text-slate-950 hover:bg-yellow-400 disabled:opacity-50">{saving ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}Create API key</button>}</div>
          </footer>
        </form>
        </div>,
        document.body,
      )}

      <section className={`rounded-xl border p-5 ${panel}`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><h3 className="font-bold">Service clients</h3><p className="mt-1 text-xs text-slate-500">Create and manage credentials used by external systems.</p></div>
          <button type="button" aria-expanded={isCreateOpen} aria-controls="create-service-client-form" onClick={openCreateClient} className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-yellow-500 px-4 text-sm font-bold text-slate-950 transition-colors hover:bg-yellow-400">
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

const WizardProgress = ({ step, dark }: { step: ClientWizardStep; dark: boolean }) => {
  const steps = ['Client & geography', 'Permissions & limits', 'Review'];
  return <ol className="mt-4 grid grid-cols-3 gap-2" aria-label="Service client setup progress">{steps.map((label, index) => { const number = (index + 1) as ClientWizardStep; const active = number === step; const complete = number < step; return <li key={label} aria-current={active ? 'step' : undefined} className="min-w-0"><div className={`mb-1.5 h-1 rounded-full ${complete || active ? 'bg-yellow-500' : dark ? 'bg-slate-700' : 'bg-slate-200'}`} /><div className="flex items-center gap-2"><span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${complete ? 'bg-emerald-500 text-white' : active ? 'bg-yellow-500 text-slate-950' : dark ? 'bg-slate-800 text-slate-400' : 'bg-slate-200 text-slate-500'}`}>{complete ? <Check size={12} /> : number}</span><span className={`truncate text-[11px] font-semibold sm:text-xs ${active ? dark ? 'text-white' : 'text-slate-900' : dark ? 'text-slate-400' : 'text-slate-500'}`}>{label}</span></div></li>; })}</ol>;
};

const permissionDescriptions: Record<string, string> = {
  'locations:read': 'Browse and search location records',
  'geometry:read': 'Retrieve maps and boundary geometry',
  'leadership:read': 'View current location leaders',
  'locations:write': 'Create and update location records',
  'leadership:manage': 'Create and change leader assignments',
  'audit:read': 'Read accountability and change history',
  'webhooks:manage': 'Configure location-change webhooks',
};

const PermissionsAndLimitsStep = ({ dark, inputClass, form, onChange }: { dark: boolean; inputClass: string; form: ClientForm; onChange: React.Dispatch<React.SetStateAction<ClientForm>> }) => (
  <div className="space-y-6">
    <fieldset><legend className="font-semibold">API permissions</legend><p className={`mt-1 text-xs ${dark ? 'text-slate-400' : 'text-slate-500'}`}>Grant only what this integration needs. Read access is selected by default.</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">{availableScopes.map((scope) => { const checked = form.scopes.includes(scope); return <label key={scope} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors ${checked ? dark ? 'border-yellow-500/60 bg-yellow-500/10' : 'border-yellow-400 bg-yellow-50' : dark ? 'border-slate-700 bg-slate-950/50 hover:border-slate-600' : 'border-slate-200 hover:border-slate-300'}`}><span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${checked ? 'border-yellow-500 bg-yellow-500 text-slate-950' : dark ? 'border-slate-600' : 'border-slate-300'}`}>{checked && <Check size={13} />}</span><input type="checkbox" className="sr-only" checked={checked} onChange={(event) => onChange((current) => ({ ...current, scopes: event.target.checked ? [...current.scopes, scope] : current.scopes.filter((item) => item !== scope) }))} /><span><span className="block text-sm font-semibold">{scope}</span><span className={`mt-0.5 block text-xs ${dark ? 'text-slate-400' : 'text-slate-500'}`}>{permissionDescriptions[scope]}</span></span></label>; })}</div>
    </fieldset>
    <section className={`rounded-2xl border p-4 sm:p-5 ${dark ? 'border-slate-700 bg-slate-950/40' : 'border-slate-200 bg-slate-50'}`}><div className="flex items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-500"><Gauge size={18} /></span><div><h4 className="font-semibold">Usage limits</h4><p className={`mt-0.5 text-xs ${dark ? 'text-slate-400' : 'text-slate-500'}`}>Protect the platform from accidental traffic spikes.</p></div></div>
      <div className="mt-4 grid gap-4 sm:grid-cols-3"><label className="text-sm font-medium">Requests per minute<input type="number" min="1" max="10000" className={inputClass} value={form.rpm} onChange={(event) => onChange((current) => ({ ...current, rpm: Number(event.target.value) }))} /></label><label className="text-sm font-medium">Daily quota<input type="number" min="1" max="10000000" className={inputClass} value={form.quota} onChange={(event) => onChange((current) => ({ ...current, quota: Number(event.target.value) }))} /></label><label className="text-sm font-medium">Expiry date <span className="font-normal text-slate-500">(optional)</span><input type="date" className={inputClass} value={form.expiresAt} onChange={(event) => onChange((current) => ({ ...current, expiresAt: event.target.value }))} /></label></div>
    </section>
  </div>
);

const ClientReviewStep = ({ dark, form, geographySummary, scopeType, countryCoverage, onEditGeography, onEditPermissions }: { dark: boolean; form: ClientForm; geographySummary: string; scopeType: GeographicScopeType; countryCoverage: CountryCoverage; onEditGeography: () => void; onEditPermissions: () => void }) => (
  <div className="space-y-4"><div><h4 className="font-semibold">Review service client</h4><p className={`mt-1 text-xs ${dark ? 'text-slate-400' : 'text-slate-500'}`}>Confirm the boundary and privileges before generating the key.</p></div>
    <div className="grid gap-3 sm:grid-cols-2"><ReviewCard label="Client" value={form.name} detail={form.description || 'No description'} dark={dark} icon={<KeyRound size={17} />} onEdit={onEditGeography} /><ReviewCard label="Geographic access" value={geographySummary} detail={scopeType === 'country' && countryCoverage === 'specific-hierarchy' ? 'Selected roots and all descendants' : `Boundary type: ${scopeType.replace('-', ' ')}`} dark={dark} icon={<Globe2 size={17} />} onEdit={onEditGeography} /><ReviewCard label="Permissions" value={`${form.scopes.length} permission${form.scopes.length === 1 ? '' : 's'}`} detail={form.scopes.join(' · ')} dark={dark} icon={<ShieldCheck size={17} />} onEdit={onEditPermissions} /><ReviewCard label="Usage limits" value={`${form.rpm.toLocaleString()}/min · ${form.quota.toLocaleString()}/day`} detail={form.expiresAt ? `Expires ${form.expiresAt}` : 'No expiry date'} dark={dark} icon={<Gauge size={17} />} onEdit={onEditPermissions} /></div>
    <div className={`rounded-xl border p-4 text-xs leading-5 ${dark ? 'border-amber-500/30 bg-amber-500/10 text-amber-200' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>The API key is displayed once after creation. Store it securely before leaving this page.</div>
  </div>
);

const ReviewCard = ({ label, value, detail, dark, icon, onEdit }: { label: string; value: string; detail: string; dark: boolean; icon: React.ReactNode; onEdit: () => void }) => (
  <section className={`rounded-xl border p-4 ${dark ? 'border-slate-700 bg-slate-950/45' : 'border-slate-200 bg-slate-50'}`}><div className="flex items-start justify-between gap-3"><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${dark ? 'bg-slate-800 text-yellow-500' : 'bg-white text-amber-600 shadow-sm'}`}>{icon}</span><button type="button" onClick={onEdit} className="text-xs font-semibold text-yellow-500 hover:underline">Edit</button></div><p className={`mt-3 text-[10px] font-bold uppercase tracking-[0.14em] ${dark ? 'text-slate-500' : 'text-slate-400'}`}>{label}</p><p className="mt-1 break-words text-sm font-semibold">{value}</p><p className={`mt-1 break-words text-xs leading-5 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>{detail}</p></section>
);

type CountryOption = ApiGeographicScopeCatalog['countries'][number];

const CountryScopeFlow = ({ dark, countries, selectedCountryCodes, coverage, locationCountry, locationSearch, locationResults, selectedLocations, locationsLoading, onCountriesChange, onCoverageChange, onLocationSearchChange, onLocationSelect, onLocationRemove }: {
  dark: boolean;
  countries: CountryOption[];
  selectedCountryCodes: string[];
  coverage: CountryCoverage;
  locationCountry: string;
  locationSearch: string;
  locationResults: ApiScopeLocationOption[];
  selectedLocations: ApiScopeLocationOption[];
  locationsLoading: boolean;
  onCountriesChange: (countryCodes: string[]) => void;
  onCoverageChange: (coverage: Exclude<CountryCoverage, null>) => void;
  onLocationSearchChange: (value: string) => void;
  onLocationSelect: (location: ApiScopeLocationOption) => void;
  onLocationRemove: (referenceCode: string) => void;
}) => {
  const muted = dark ? 'text-slate-300' : 'text-slate-600';
  const coverageSelector = <fieldset><legend className="text-sm font-semibold">Coverage</legend><div className={`mt-2 grid grid-cols-2 gap-1 rounded-xl border p-1 ${dark ? 'border-slate-600 bg-slate-950' : 'border-slate-300 bg-slate-100'}`} role="radiogroup" aria-label="Country access coverage"><button type="button" role="radio" aria-checked={coverage === 'whole-country'} onClick={() => onCoverageChange('whole-country')} className={`flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold transition-colors ${coverage === 'whole-country' ? 'bg-yellow-500 text-slate-950 shadow-sm' : dark ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-white'}`}><Globe2 size={16} />Whole countries</button><button type="button" role="radio" aria-checked={coverage === 'specific-hierarchy'} onClick={() => onCoverageChange('specific-hierarchy')} className={`flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold transition-colors ${coverage === 'specific-hierarchy' ? 'bg-yellow-500 text-slate-950 shadow-sm' : dark ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-white'}`}><MapPinned size={16} />Specific locations</button></div></fieldset>;

  if (coverage === 'whole-country') {
    return <div className="space-y-4">{coverageSelector}<section className={`overflow-visible rounded-xl border p-4 ${dark ? 'border-emerald-500/30 bg-emerald-500/[0.05]' : 'border-emerald-200 bg-emerald-50/60'}`}><div className="mb-3"><h4 className="text-sm font-semibold">Countries with full access</h4><p className={`mt-1 text-xs ${muted}`}>Add every country this client needs. All configured locations and hierarchy levels are included.</p></div><CountryPicker countries={countries} selected={selectedCountryCodes} dark={dark} multiple placeholder="Add another country" onChange={onCountriesChange} /></section></div>;
  }

  return <div className="space-y-4">{coverageSelector}<section className={`overflow-visible rounded-xl border p-4 ${dark ? 'border-sky-500/30 bg-sky-500/[0.05]' : 'border-sky-200 bg-sky-50/60'}`}><div className="mb-3"><h4 className="text-sm font-semibold">One country, selected locations</h4><p className={`mt-1 text-xs ${muted}`}>Choose one country, then add regions, districts, or lower-level roots. Their descendants are included automatically.</p></div><CountryPicker countries={countries} selected={selectedCountryCodes} dark={dark} multiple={false} placeholder="Choose a country" onChange={onCountriesChange} /><div className="mt-4"><HierarchyLocationPicker dark={dark} disabled={!locationCountry} loading={locationsLoading} query={locationSearch} onQueryChange={onLocationSearchChange} results={locationResults} selected={selectedLocations} onSelect={onLocationSelect} onRemove={onLocationRemove} /></div></section></div>;
};

const CountryPicker = ({ countries, selected, dark, multiple, placeholder, onChange }: { countries: CountryOption[]; selected: string[]; dark: boolean; multiple: boolean; placeholder: string; onChange: (values: string[]) => void }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const matches = countries.filter((country) => !selected.includes(country.countryCode) && `${country.name} ${country.countryCode}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <div className="relative text-sm" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) { setOpen(false); setQuery(''); } }}>
    <label htmlFor={`country-picker-${multiple ? 'multiple' : 'single'}`} className="font-medium">{multiple ? `Countries · ${selected.length} selected` : 'Country'}</label>
    <div className={`mt-1.5 flex min-h-12 flex-wrap items-center gap-1.5 rounded-xl border px-2.5 py-2 transition-colors focus-within:border-yellow-500 focus-within:ring-2 focus-within:ring-yellow-500/20 ${dark ? 'border-slate-600 bg-slate-950 text-slate-100' : 'border-slate-300 bg-white text-slate-900'}`}>
      {selected.map((code) => { const country = countries.find((item) => item.countryCode === code); return <span key={code} className={`inline-flex h-8 items-center gap-2 rounded-lg border px-2.5 text-xs font-semibold ${dark ? 'border-slate-600 bg-slate-800' : 'border-slate-200 bg-slate-100'}`}><span aria-hidden="true">{countryFlag(code)}</span>{country?.name || code}<span className={dark ? 'text-slate-400' : 'text-slate-500'}>{code}</span>{multiple && <button type="button" onClick={() => onChange(selected.filter((item) => item !== code))} aria-label={`Remove ${country?.name || code}`} className="rounded p-0.5 hover:bg-red-500/15 hover:text-red-500"><X size={12} /></button>}</span>; })}
      <div className="flex min-w-52 flex-1 items-center gap-2">{multiple ? <Plus size={15} className="text-yellow-500" /> : <Search size={15} className={dark ? 'text-slate-400' : 'text-slate-500'} />}<input id={`country-picker-${multiple ? 'multiple' : 'single'}`} role="combobox" aria-expanded={open} aria-controls={`country-picker-options-${multiple ? 'multiple' : 'single'}`} value={query} onFocus={() => setOpen(true)} onChange={(event) => { setQuery(event.target.value); setOpen(true); }} placeholder={selected.length && !multiple ? '' : placeholder} className={`h-7 min-w-0 flex-1 border-0 bg-transparent outline-none ${dark ? 'placeholder:text-slate-500' : 'placeholder:text-slate-400'}`} /><ChevronDown size={16} className={`transition-transform ${open ? 'rotate-180' : ''} ${dark ? 'text-slate-400' : 'text-slate-500'}`} /></div>
    </div>
    {open && <div id={`country-picker-options-${multiple ? 'multiple' : 'single'}`} role="listbox" className={`absolute inset-x-0 top-full z-40 mt-2 max-h-64 overflow-y-auto rounded-xl border p-1.5 shadow-2xl ${dark ? 'border-slate-600 bg-slate-900 shadow-black/40' : 'border-slate-200 bg-white shadow-slate-900/15'}`}>
      {matches.length ? matches.map((country) => <button key={country.countryCode} type="button" role="option" aria-selected="false" onMouseDown={(event) => event.preventDefault()} onClick={() => { onChange(multiple ? [...selected, country.countryCode] : [country.countryCode]); setQuery(''); setOpen(multiple); }} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${dark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'}`}><span className="text-xl" aria-hidden="true">{countryFlag(country.countryCode)}</span><span className="min-w-0 flex-1 font-semibold">{country.name}</span><span className={`rounded-md px-2 py-1 text-[10px] font-bold ${dark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>{country.countryCode}</span></button>) : <p className={`px-3 py-3 text-xs ${dark ? 'text-slate-400' : 'text-slate-500'}`}>{selected.length === countries.length ? 'All available countries are selected.' : 'No matching countries.'}</p>}
    </div>}
  </div>;
};

function countryFlag(countryCode: string): string {
  return /^[A-Z]{2}$/.test(countryCode) ? [...countryCode].map((character) => String.fromCodePoint(127397 + character.charCodeAt(0))).join('') : '🌍';
}

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
