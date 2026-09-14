import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, MapPin, Search, X } from 'lucide-react';
import { Theme } from '../../types';
import { UgandaParishNode, UgandaVillageNode } from '../../data/locations/ugandaAdminHierarchy';

interface ParishAndVillageCanvasProps {
  currentLevel: 'parishes' | 'villages';
  parishes: UgandaParishNode[];
  selectedParish: UgandaParishNode | null;
  selectedVillage: UgandaVillageNode | null;
  hoveredEntity: string | null;
  subcountyName: string;
  districtName: string;
  theme: Theme;
  onSelectParish: (parish: UgandaParishNode) => void;
  onSelectVillage: (village: UgandaVillageNode) => void;
  onHoverEntity: (name: string | null) => void;
}

const matches = (value: string, query: string) =>
  value.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());

export const ParishAndVillageCanvas: React.FC<ParishAndVillageCanvasProps> = ({
  currentLevel, parishes, selectedParish, selectedVillage, hoveredEntity,
  subcountyName, districtName, theme, onSelectParish, onSelectVillage, onHoverEntity,
}) => {
  const [query, setQuery] = useState('');
  const dark = theme === 'dark';
  const isParishLevel = currentLevel === 'parishes';
  const allItems = isParishLevel ? parishes : selectedParish?.villages || [];
  const visibleItems = useMemo(() => allItems.filter((item) => matches(item.name, query)), [allItems, query]);
  const title = isParishLevel ? `Parishes and wards in ${subcountyName}` : `Villages and cells in ${selectedParish?.name || 'parish'}`;
  const locationPath = isParishLevel
    ? ['Uganda', districtName, subcountyName]
    : ['Uganda', districtName, subcountyName, selectedParish?.name || 'Parish'];

  useEffect(() => setQuery(''), [currentLevel, selectedParish?.id, subcountyName]);

  return (
    <section className={`min-h-full w-full ${dark ? 'bg-slate-950' : 'bg-slate-50'}`}>
      <div className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 lg:px-8">
        <nav aria-label="Current location" className="mb-3 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
          {locationPath.map((name, index) => (
            <React.Fragment key={`${name}-${index}`}>
              {index > 0 && <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">/</span>}
              <span className={index === locationPath.length - 1 ? 'font-semibold text-slate-700 dark:text-slate-300' : ''}>{name}</span>
            </React.Fragment>
          ))}
        </nav>

        <div className="mb-5 flex flex-col gap-4 border-b border-slate-200 pb-5 dark:border-slate-800 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">{isParishLevel ? 'Administrative level 5' : 'Administrative level 6'}</p>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">{title}</h2>
            <p className="mt-1.5 text-sm text-slate-500">{allItems.length.toLocaleString()} official {isParishLevel ? 'parish and ward' : 'village and cell'} records</p>
          </div>
          <label className={`flex h-11 w-full items-center gap-2 rounded-lg border px-3 sm:w-80 ${dark ? 'border-slate-700 bg-slate-900' : 'border-slate-300 bg-white'} focus-within:border-yellow-500 focus-within:ring-2 focus-within:ring-yellow-500/15`}>
            <Search size={17} className="shrink-0 text-slate-400" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={isParishLevel ? 'Find a parish or ward' : 'Find a village or cell'} className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-white" />
            {query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search" className="rounded p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white"><X size={15} /></button>}
          </label>
        </div>

        {visibleItems.length > 0 ? (
          <div className={isParishLevel ? 'grid gap-3 sm:grid-cols-2 xl:grid-cols-3' : 'grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'}>
            {visibleItems.map((item, index) => {
              const parish = isParishLevel ? item as UgandaParishNode : null;
              const village = isParishLevel ? null : item as UgandaVillageNode;
              const selected = isParishLevel ? selectedParish?.id === item.id : selectedVillage?.id === item.id;
              const active = selected || hoveredEntity === item.name;
              return (
                <button
                  type="button"
                  key={item.id || index}
                  onClick={() => isParishLevel ? onSelectParish(parish!) : onSelectVillage(village!)}
                  onMouseEnter={() => onHoverEntity(item.name)}
                  onMouseLeave={() => onHoverEntity(null)}
                  className={`group relative min-w-0 rounded-xl border text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500 ${isParishLevel ? 'p-4' : 'px-3.5 py-3'} ${active ? (dark ? 'border-yellow-500/60 bg-slate-900 shadow-lg shadow-black/10' : 'border-yellow-500 bg-white shadow-md') : (dark ? 'border-slate-800 bg-slate-900/60 hover:border-slate-600 hover:bg-slate-900' : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm')}`}
                >
                  {selected && <span className="absolute inset-y-3 left-0 w-0.5 rounded-r bg-yellow-500" />}
                  <div className="flex items-center gap-3">
                    <span className={`flex shrink-0 items-center justify-center rounded-lg font-semibold tabular-nums ${isParishLevel ? 'h-10 w-10 text-xs' : 'h-8 w-8 text-[11px]'} ${dark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-slate-900 dark:text-slate-100" title={item.name}>{item.name}</span>
                      <span className="mt-0.5 block truncate text-xs text-slate-500">
                        {isParishLevel ? `${parish!.type} · ${parish!.villages.length.toLocaleString()} villages/cells` : village!.type}
                      </span>
                    </span>
                    <ArrowRight size={15} className="shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className={`rounded-xl border border-dashed px-6 py-16 text-center ${dark ? 'border-slate-700' : 'border-slate-300'}`}>
            <MapPin size={24} className="mx-auto mb-3 text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">No matching locations</h3>
            <p className="mt-1 text-sm text-slate-500">Try another spelling or clear the search.</p>
            <button type="button" onClick={() => setQuery('')} className="mt-4 text-sm font-semibold text-yellow-600 hover:text-yellow-500">Clear search</button>
          </div>
        )}
      </div>
    </section>
  );
};

export default ParishAndVillageCanvas;
