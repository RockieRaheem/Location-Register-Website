import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft, ArrowRight, Check, ChevronRight, Home, Map, MapPin, Search, UserRound, X,
} from 'lucide-react';
import { Theme } from '../../types';
import {
  getElectoralCommissionDistrict,
  getElectoralCommissionSubcounties,
} from '../../data/locations/ugandaElectoralCommission2022';
import {
  getUgandaSubcountyHierarchy,
  UgandaParishNode,
  UgandaVillageNode,
} from '../../data/locations/ugandaAdminHierarchy';
import { UGANDA_DISTRICTS_DATA } from '../../data/maps/generated/ugandaDistrictsData';
import LocationLeadershipPanel from './LocationLeadershipPanel';

interface UgandaHierarchyExplorerProps {
  districtName: string;
  theme: Theme;
  onBackToCountry: () => void;
  onBackToAfrica: () => void;
}

type ExplorerLevel = 'subcounties' | 'parishes' | 'villages';

const normalize = (value: string) => value.trim().toLocaleLowerCase();
const includesQuery = (value: string, query: string) => normalize(value).includes(normalize(query));

const pluralLabel = (level: ExplorerLevel) => {
  if (level === 'subcounties') return 'sub-counties and divisions';
  if (level === 'parishes') return 'parishes and wards';
  return 'villages and cells';
};

const UgandaHierarchyExplorer: React.FC<UgandaHierarchyExplorerProps> = ({
  districtName, theme, onBackToCountry, onBackToAfrica,
}) => {
  const [level, setLevel] = useState<ExplorerLevel>('subcounties');
  const [subcountyName, setSubcountyName] = useState<string | null>(null);
  const [constituencyName, setConstituencyName] = useState<string | null>(null);
  const [parish, setParish] = useState<UgandaParishNode | null>(null);
  const [village, setVillage] = useState<UgandaVillageNode | null>(null);
  const [query, setQuery] = useState('');
  const [leadershipTarget, setLeadershipTarget] = useState<{ label: string; path: string[] } | null>(null);
  const dark = theme === 'dark';
  const district = useMemo(() => getElectoralCommissionDistrict(districtName), [districtName]);
  const regionName = UGANDA_DISTRICTS_DATA[districtName]?.region || 'Region not specified';
  const subcounties = useMemo(() => getElectoralCommissionSubcounties(districtName), [districtName]);
  const subcounty = useMemo(
    () => subcountyName ? getUgandaSubcountyHierarchy(districtName, subcountyName) : null,
    [districtName, subcountyName],
  );

  useEffect(() => setQuery(''), [level, subcountyName, parish?.id]);

  const records = useMemo(() => {
    if (level === 'subcounties') {
      return subcounties
        .filter((item) => includesQuery(item.name, query) || includesQuery(item.constituency || '', query))
        .map((item) => ({
          id: item.name,
          name: item.name,
          type: item.name.includes('DIVISION') ? 'Division' : item.name.includes('TOWN COUNCIL') ? 'Town Council' : 'Sub-county',
          secondary: item.constituency || 'Constituency not specified',
          count: item.parishes.length,
          countLabel: 'parishes/wards',
          source: item,
        }));
    }
    if (level === 'parishes') {
      return (subcounty?.parishes || [])
        .filter((item) => includesQuery(item.name, query))
        .map((item) => ({
          id: item.id,
          name: item.name,
          type: item.type,
          secondary: subcountyName || '',
          count: item.villages.length,
          countLabel: 'villages/cells',
          source: item,
        }));
    }
    return (parish?.villages || [])
      .filter((item) => includesQuery(item.name, query))
      .map((item) => ({
        id: item.id,
        name: item.name,
        type: item.type,
        secondary: parish?.name || '',
        count: null,
        countLabel: '',
        source: item,
      }));
  }, [level, parish, query, subcounties, subcounty, subcountyName]);

  const selectRecord = (record: typeof records[number]) => {
    if (level === 'subcounties') {
      setSubcountyName(record.name);
      setConstituencyName(record.secondary);
      setParish(null);
      setVillage(null);
      setLevel('parishes');
    } else if (level === 'parishes') {
      setParish(record.source as UgandaParishNode);
      setVillage(null);
      setLevel('villages');
    } else {
      setVillage(record.source as UgandaVillageNode);
    }
  };

  const goUp = () => {
    if (village) {
      setVillage(null);
    } else if (level === 'villages') {
      setLevel('parishes');
      setParish(null);
    } else if (level === 'parishes') {
      setLevel('subcounties');
      setSubcountyName(null);
      setConstituencyName(null);
    } else {
      onBackToCountry();
    }
  };

  const breadcrumb: Array<{ label: string; action?: () => void }> = [
    { label: 'Africa', action: onBackToAfrica },
    { label: 'Uganda', action: onBackToCountry },
    { label: regionName },
    { label: district?.name || districtName, action: () => { setLevel('subcounties'); setSubcountyName(null); setConstituencyName(null); setParish(null); setVillage(null); } },
    ...(subcountyName ? [{ label: subcountyName, action: () => { setLevel('parishes'); setParish(null); setVillage(null); } }] : []),
    ...(parish ? [{ label: parish.name, action: () => { setLevel('villages'); setVillage(null); } }] : []),
  ];
  const backLabel = village
    ? 'Back to villages'
    : level === 'villages'
      ? 'Back to parishes'
      : level === 'parishes'
        ? 'Back to sub-counties'
        : 'Back to Uganda map';
  const districtPath = ['Uganda', regionName, district?.name || districtName];
  const currentPath = level === 'subcounties'
    ? districtPath
    : level === 'parishes'
      ? [...districtPath, constituencyName || '', subcountyName || ''].filter(Boolean)
      : [...districtPath, constituencyName || '', subcountyName || '', parish?.name || ''].filter(Boolean);

  return (
    <div className={`absolute inset-0 z-40 flex flex-col ${dark ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-950'}`}>
      <header className={`shrink-0 border-b ${dark ? 'border-slate-800 bg-slate-950' : 'border-slate-200 bg-white'}`}>
        <div className="mx-auto flex min-h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
          <button type="button" onClick={goUp} className={`flex h-10 items-center gap-2 rounded-lg border px-3 text-sm font-semibold transition-colors ${dark ? 'border-slate-700 hover:bg-slate-900' : 'border-slate-300 hover:bg-slate-50'}`}>
            <ArrowLeft size={17} />
            <span className="hidden sm:inline">{backLabel}</span>
          </button>
          <nav aria-label="Location breadcrumb" className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto whitespace-nowrap text-sm">
            {breadcrumb.map((item, index) => (
              <React.Fragment key={`${item.label}-${index}`}>
                {index > 0 && <ChevronRight size={14} className="shrink-0 text-slate-400" />}
                {item.action ? <button type="button" onClick={item.action} className={`truncate rounded px-1.5 py-1 transition-colors hover:bg-slate-500/10 ${index === breadcrumb.length - 1 ? 'font-semibold text-slate-900 dark:text-white' : 'text-slate-500'}`}>{index === 0 && <Home size={14} className="mr-1 inline" />}{item.label}</button> : <span className="truncate px-1.5 py-1 text-slate-500">{item.label}</span>}
              </React.Fragment>
            ))}
          </nav>
          <span className="hidden text-xs font-medium text-slate-500 lg:block">Electoral Commission 2022</span>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
          <div className="mb-7 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <Map size={15} />
                {district?.type || 'District'} hierarchy
              </div>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                {level === 'subcounties' && district?.name}
                {level === 'parishes' && subcountyName}
                {level === 'villages' && parish?.name}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                Browse the official {pluralLabel(level)}. Select one record to continue deeper into the hierarchy.
              </p>
            </div>
            <div className="flex items-center gap-3"><button type="button" onClick={() => setLeadershipTarget({ label: currentPath[currentPath.length - 1], path: currentPath })} className={`flex h-10 items-center gap-2 rounded-lg border px-3 text-sm font-semibold ${dark ? 'border-slate-700 hover:bg-slate-900' : 'border-slate-300 bg-white hover:bg-slate-50'}`}><UserRound size={16} /> View leader</button><div className="flex items-center gap-2" aria-label="Hierarchy progress">
              {(['subcounties', 'parishes', 'villages'] as ExplorerLevel[]).map((step, index) => {
                const activeIndex = ['subcounties', 'parishes', 'villages'].indexOf(level);
                const complete = index < activeIndex;
                const active = step === level;
                return (
                  <div key={step} className="flex items-center gap-2">
                    {index > 0 && <span className={`h-px w-5 ${complete || active ? 'bg-yellow-500' : dark ? 'bg-slate-800' : 'bg-slate-300'}`} />}
                    <span className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold ${active ? 'border-yellow-500 bg-yellow-500 text-slate-950' : complete ? 'border-yellow-500 text-yellow-600' : dark ? 'border-slate-700 text-slate-500' : 'border-slate-300 text-slate-400'}`}>
                      {complete ? <Check size={14} /> : index + 1}
                    </span>
                  </div>
                );
              })}
            </div></div>
          </div>

          <div className={`mb-5 flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between ${dark ? 'border-slate-800 bg-slate-900/60' : 'border-slate-200 bg-white'}`}>
            <div className="px-1 text-sm text-slate-500"><strong className="font-semibold text-slate-800 dark:text-slate-200">{records.length.toLocaleString()}</strong> {pluralLabel(level)}</div>
            <label className={`flex h-10 w-full items-center gap-2 rounded-lg border px-3 sm:w-80 ${dark ? 'border-slate-700 bg-slate-950' : 'border-slate-300 bg-white'} focus-within:border-yellow-500 focus-within:ring-2 focus-within:ring-yellow-500/15`}>
              <Search size={16} className="text-slate-400" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${pluralLabel(level)}`} className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400" />
              {query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search" className="text-slate-400 hover:text-slate-700 dark:hover:text-white"><X size={15} /></button>}
            </label>
          </div>

          {records.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {records.map((record, index) => {
                const path = level === 'subcounties'
                  ? [...districtPath, record.secondary, record.name]
                  : level === 'parishes'
                    ? [...districtPath, constituencyName || '', subcountyName || '', record.name].filter(Boolean)
                    : [...districtPath, constituencyName || '', subcountyName || '', parish?.name || '', record.name].filter(Boolean);
                return <div key={record.id} className={`group flex min-w-0 items-center rounded-xl border transition-all ${dark ? 'border-slate-800 bg-slate-900/70 hover:border-slate-600 hover:bg-slate-900' : 'border-slate-200 bg-white hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md'}`}>
                <button type="button" onClick={() => selectRecord(record)} className="flex min-w-0 flex-1 items-center gap-3 p-4 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500">
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xs font-semibold tabular-nums ${dark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>{String(index + 1).padStart(2, '0')}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold" title={record.name}>{record.name}</span>
                    <span className="mt-1 block truncate text-xs text-slate-500">{record.type}{record.secondary ? ` · ${record.secondary}` : ''}</span>
                    {record.count != null && <span className="mt-2 block text-xs font-medium text-slate-500">{record.count.toLocaleString()} {record.countLabel}</span>}
                  </span>
                  <ArrowRight size={16} className="shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5" />
                </button>
                <button type="button" onClick={() => setLeadershipTarget({ label: record.name, path })} className="mr-3 rounded-lg p-2 text-slate-400 hover:bg-yellow-500/15 hover:text-yellow-600" title={`View ${record.name} leadership`} aria-label={`View ${record.name} leadership`}><UserRound size={17} /></button>
              </div>})}
            </div>
          ) : (
            <div className={`rounded-xl border border-dashed py-16 text-center ${dark ? 'border-slate-700' : 'border-slate-300'}`}>
              <MapPin size={25} className="mx-auto mb-3 text-slate-400" />
              <h2 className="text-sm font-semibold">No matching locations</h2>
              <p className="mt-1 text-sm text-slate-500">Check the spelling or clear your search.</p>
              <button type="button" onClick={() => setQuery('')} className="mt-4 text-sm font-semibold text-yellow-600">Clear search</button>
            </div>
          )}
        </div>
      </main>

      {village && (
        <aside className="absolute inset-0 z-50 flex items-end justify-end bg-slate-950/35 backdrop-blur-[2px] sm:p-4" onClick={() => setVillage(null)}>
          <div className={`w-full rounded-t-2xl border p-5 shadow-2xl sm:max-w-md sm:rounded-2xl ${dark ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-white'}`} onClick={(event) => event.stopPropagation()}>
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{village.type}</p>
                <h2 className="mt-1 text-xl font-semibold">{village.name}</h2>
              </div>
              <button type="button" onClick={() => setVillage(null)} aria-label="Close village details" className="rounded-lg p-2 text-slate-400 hover:bg-slate-500/10 hover:text-slate-700 dark:hover:text-white"><X size={18} /></button>
            </div>
            <dl className="divide-y divide-slate-200 text-sm dark:divide-slate-800">
              {[['District / City', village.districtName], ['Sub-county / Division', village.subcountyName], ['Parish / Ward', village.parishName], ['Source', `Electoral Commission ${village.sourceYear}`]].map(([label, value]) => (
                <div key={label} className="grid grid-cols-[140px_1fr] gap-4 py-3"><dt className="text-slate-500">{label}</dt><dd className="font-medium">{value}</dd></div>
              ))}
            </dl>
            <p className="mt-5 rounded-lg bg-slate-500/5 p-3 text-xs leading-5 text-slate-500">This dataset provides the official administrative name and hierarchy path. It does not claim coordinates, leadership, population, or commercial statistics for this village.</p>
          </div>
        </aside>
      )}
      {leadershipTarget && <LocationLeadershipPanel countryCode="UG" path={leadershipTarget.path} label={leadershipTarget.label} theme={theme} onClose={() => setLeadershipTarget(null)} />}
    </div>
  );
};

export default UgandaHierarchyExplorer;
