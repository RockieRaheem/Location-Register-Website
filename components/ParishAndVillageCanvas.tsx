import React from 'react';
import { motion } from 'motion/react';
import { 
  Building2, MapPin, Users, Award, ShieldCheck, ArrowRight, CheckCircle2,
  Compass, Store
} from 'lucide-react';
import { Theme } from '../types';
import { UgandaParishNode, UgandaVillageNode } from '../ugandaAdminHierarchy';

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
  currentLevel,
  parishes,
  selectedParish,
  selectedVillage,
  hoveredEntity,
  subcountyName,
  districtName,
  theme,
  onSelectParish,
  onSelectVillage,
  onHoverEntity
}) => {
  // If we are at the Parish level, render the cartographic parish grid / cells
  if (currentLevel === 'parishes') {
    return (
      <div className="w-full h-full p-4 sm:p-8 flex flex-col justify-center items-center overflow-y-auto max-w-5xl mx-auto">
        <div className="text-center mb-6 max-w-lg">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border border-yellow-500/20 mb-2">
            <Award size={12} />
            Administrative Level 5 • Parishes & Wards
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight">
            {subcountyName} Parishes & Wards
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Click any Parish or Ward below to inspect its villages and source hierarchy.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4 w-full">
          {parishes.map((parish, idx) => {
            const isHovered = hoveredEntity === parish.name;
            const isSourceHierarchyOnly = parish.sourceName === 'Uganda Electoral Commission administrative hierarchy';
            const villageCount = parish.villages ? parish.villages.length : 0;
            const totalShops = parish.villages?.reduce((acc, v) => acc + (v.shopDensity || 0), 0) || 0;

            return (
              <motion.div
                key={parish.id || idx}
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onSelectParish(parish)}
                onMouseEnter={() => onHoverEntity(parish.name)}
                onMouseLeave={() => onHoverEntity(null)}
                className={`p-5 rounded-2xl border transition-all duration-200 cursor-pointer relative overflow-hidden flex flex-col justify-between shadow-sm hover:shadow-md ${
                  isHovered
                    ? 'border-yellow-500 bg-yellow-500/10 shadow-yellow-500/5'
                    : theme === 'dark'
                    ? 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                    : 'bg-white border-slate-200/90 hover:border-slate-300'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20 tracking-wider">
                      {parish.type || 'Parish'}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                      {villageCount} {isSourceHierarchyOnly ? 'Source Villages' : 'Mapped Villages'}
                    </span>
                  </div>

                  <h3 className="text-lg font-black tracking-tight text-slate-900 dark:text-white flex items-center justify-between">
                    <span>{parish.name}</span>
                    <ArrowRight size={16} className={`transition-transform duration-200 ${isHovered ? 'translate-x-1 text-yellow-500' : 'text-slate-400 opacity-60'}`} />
                  </h3>

                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono">
                    ID: {parish.id || `UG-P-${idx + 1}`}
                  </p>

                  <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-slate-600 dark:text-slate-300 gap-3">
                      <span className="text-[11px] text-slate-400 flex items-center gap-1 font-bold">
                        <Users size={12} className="text-indigo-400" />
                        Parish Chief:
                      </span>
                      <span className="font-semibold text-right">{parish.parishChief || 'Not provided by source'}</span>
                    </div>

                    <div className="flex items-center justify-between text-slate-600 dark:text-slate-300 gap-3">
                      <span className="text-[11px] text-slate-400 flex items-center gap-1 font-bold">
                        <ShieldCheck size={12} className="text-emerald-400" />
                        LC2 Chairperson:
                      </span>
                      <span className="font-semibold text-right">{parish.lc2Chairperson || 'Not provided by source'}</span>
                    </div>

                    {!isSourceHierarchyOnly && <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                      <span className="text-[11px] text-slate-400 flex items-center gap-1 font-bold">
                        <Award size={12} className="text-yellow-500" />
                        PDM SACCO:
                      </span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400 truncate max-w-[180px]" title={parish.pdmSaccoName}>
                        {parish.pdmSaccoName || `${parish.name} PDM SACCO`}
                      </span>
                    </div>}
                  </div>
                </div>

                <div className="mt-4 pt-2.5 flex items-center justify-between text-[11px] font-bold text-yellow-600 dark:text-yellow-400">
                  <span className="flex items-center gap-1">
                    {isSourceHierarchyOnly ? <ShieldCheck size={12} /> : <Store size={12} />}
                    {isSourceHierarchyOnly ? 'Electoral Commission 2022' : `~${totalShops} Active Retail Points`}
                  </span>
                  <span className="flex items-center gap-1 underline text-xs">
                    Drill down to Villages →
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    );
  }

  // Level 6: Villages / Cells / Zones in the selected Parish
  const currentVillages = selectedParish?.villages || [];

  return (
    <div className="w-full h-full p-4 sm:p-8 flex flex-col justify-center items-center overflow-y-auto max-w-5xl mx-auto">
      <div className="text-center mb-6 max-w-lg">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 mb-2">
          <CheckCircle2 size={12} />
          Administrative Level 6 • Village / Cell Nodes
        </div>
        <h2 className="text-xl sm:text-2xl font-black tracking-tight">
          Villages in {selectedParish?.name || 'Parish'}
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          {subcountyName} • {districtName}. Click any village to inspect its source hierarchy path.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 w-full">
        {currentVillages.map((village, idx) => {
          const isHovered = hoveredEntity === village.name;
          const isSelected = selectedVillage?.name === village.name;
          const isSourceHierarchyOnly = village.verificationStatus === 'Source hierarchy only';

          return (
            <motion.div
              key={village.id || idx}
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onSelectVillage(village)}
              onMouseEnter={() => onHoverEntity(village.name)}
              onMouseLeave={() => onHoverEntity(null)}
              className={`p-4 rounded-2xl border transition-all duration-200 cursor-pointer relative overflow-hidden flex flex-col justify-between shadow-xs hover:shadow-md ${
                isSelected
                  ? 'border-yellow-500 bg-yellow-500/15 shadow-yellow-500/10 ring-2 ring-yellow-500/30'
                  : isHovered
                  ? 'border-emerald-500 bg-emerald-500/10'
                  : theme === 'dark'
                  ? 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-1.5 mb-2">
                  <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-500 border border-rose-500/20 tracking-wider">
                    {village.type || 'Ekyalo (LC1)'}
                  </span>
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                    {isSourceHierarchyOnly ? 'EC hierarchy' : village.pdmStatus || 'Status not recorded'}
                  </span>
                </div>

                <h3 className="text-base font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
                  <MapPin size={15} className="text-red-500 shrink-0" />
                  <span className="truncate">{village.name}</span>
                </h3>

                <div className="mt-2.5 space-y-1 text-xs">
                  <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                    <span className="text-[11px] font-bold">LC1 Chairperson:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 text-right">{village.lc1Chairperson || 'Not provided by source'}</span>
                  </div>
                  {!isSourceHierarchyOnly && <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                    <span className="text-[11px] font-bold">Shop Density:</span>
                    <span className="font-bold text-rose-500">{village.shopDensity} Shops/km²</span>
                  </div>}
                  {!isSourceHierarchyOnly && <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                    <span className="text-[11px] font-bold">Weekly Sales:</span>
                    <span className="font-bold text-emerald-500">USh {village.weeklySalesVolumeUGX?.toLocaleString()}</span>
                  </div>}
                  {isSourceHierarchyOnly && (
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono break-all">
                      {village.sourcePath}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-3 pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[10px] font-mono text-slate-400">
                <span className="flex items-center gap-1">
                  <Compass size={11} className="text-yellow-500" />
                  {village.lat !== undefined && village.lon !== undefined
                    ? `${village.lat.toFixed(3)}°N, ${village.lon.toFixed(3)}°E`
                    : 'Coordinates not provided'}
                </span>
                <span className="text-yellow-600 dark:text-yellow-400 font-bold uppercase">
                  View Card →
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default ParishAndVillageCanvas;
