import React from 'react';
import { ArrowRight, MapPin } from 'lucide-react';
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

export const ParishAndVillageCanvas: React.FC<ParishAndVillageCanvasProps> = ({
  currentLevel, parishes, selectedParish, selectedVillage, hoveredEntity,
  subcountyName, districtName, theme, onSelectParish, onSelectVillage, onHoverEntity,
}) => {
  const dark = theme === 'dark';
  const items = currentLevel === 'parishes' ? parishes : selectedParish?.villages || [];
  const parentName = currentLevel === 'parishes' ? subcountyName : selectedParish?.name || 'Parish';

  return (
    <section className="mx-auto flex h-full w-full max-w-5xl flex-col px-4 py-6 sm:px-8">
      <header className="mb-5 border-b border-slate-200 pb-4 dark:border-slate-800">
        <p className="mb-1 text-xs font-semibold text-slate-500">Uganda / {districtName} / {subcountyName}</p>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
              {currentLevel === 'parishes' ? `Parishes and wards in ${parentName}` : `Villages and cells in ${parentName}`}
            </h2>
            <p className="mt-1 text-sm text-slate-500">Select one item to continue through the official administrative hierarchy.</p>
          </div>
          <span className="text-sm font-medium text-slate-500">{items.length.toLocaleString()} records</span>
        </div>
      </header>

      <div className={`overflow-hidden rounded-xl border ${dark ? 'border-slate-800 bg-slate-950' : 'border-slate-200 bg-white'}`}>
        {items.map((item, index) => {
          const isParish = currentLevel === 'parishes';
          const parish = isParish ? item as UgandaParishNode : null;
          const village = isParish ? null : item as UgandaVillageNode;
          const selected = isParish ? selectedParish?.id === item.id : selectedVillage?.id === item.id;
          const active = selected || hoveredEntity === item.name;
          return (
            <button
              type="button"
              key={item.id || index}
              onClick={() => isParish ? onSelectParish(parish!) : onSelectVillage(village!)}
              onMouseEnter={() => onHoverEntity(item.name)}
              onMouseLeave={() => onHoverEntity(null)}
              className={`group flex w-full items-center gap-4 border-b px-4 py-3.5 text-left transition-colors last:border-b-0 ${dark ? 'border-slate-800' : 'border-slate-100'} ${active ? (dark ? 'bg-slate-900' : 'bg-slate-50') : (dark ? 'hover:bg-slate-900' : 'hover:bg-slate-50')}`}
            >
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${dark ? 'bg-slate-900 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                <MapPin size={16} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{item.name}</span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  {isParish ? `${parish!.type} · ${parish!.villages.length.toLocaleString()} villages/cells` : `${village!.type} · Electoral Commission 2022`}
                </span>
              </span>
              <ArrowRight size={16} className="shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5" />
            </button>
          );
        })}
        {items.length === 0 && <div className="p-10 text-center text-sm text-slate-500">No records are available for this location.</div>}
      </div>
    </section>
  );
};

export default ParishAndVillageCanvas;
