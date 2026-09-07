import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Building2, TrendingUp, Users, Calendar, Compass, BarChart2,
  Phone, ShieldCheck, Home, Store, CheckCircle2, Award, Landmark, MapPin
} from 'lucide-react';
import { Theme } from '../../types';
import { UgandaVillageNode, UgandaParishNode } from '../../data/locations/ugandaAdminHierarchy';

interface VillageProfileCardModalProps {
  village: UgandaVillageNode | { id: string; name: string; [key: string]: any } | null;
  parish?: UgandaParishNode | null;
  districtName?: string | null;
  subcountyName?: string | null;
  theme: Theme;
  onClose: () => void;
  onExploreOtherParishes?: () => void;
}

export const VillageProfileCardModal: React.FC<VillageProfileCardModalProps> = ({
  village,
  parish,
  districtName = 'District',
  subcountyName = 'Sub-County',
  theme,
  onClose,
  onExploreOtherParishes
}) => {
  if (!village) return null;

  // Read optional profile fields without fabricating missing source values.
  const node = village as Partial<UgandaVillageNode>;
  const isSourceHierarchyOnly = node.verificationStatus === 'Source hierarchy only';
  const notProvided = 'Not provided by source';
  const villageName = node.name || 'Village Node';
  const parishName = node.parishName || parish?.name || 'Parish';
  const subcounty = node.subcountyName || subcountyName || 'Sub-County';
  const district = node.districtName || districtName || 'District';
  const county = node.countyName || notProvided;
  const lcType = node.type || 'Ekyalo (LC1)';
  const lc1Chair = node.lc1Chairperson || notProvided;
  const lc1Phone = node.lc1Phone;
  const viceChair = node.viceChairperson || notProvided;
  const defenceSec = node.defenceSecretary || notProvided;
  const pdmSacco = node.pdmSaccoName || notProvided;
  const pdmReg = node.pdmRegistrationNo || notProvided;
  const pdmStatus = node.pdmStatus || 'Status not provided';
  const density = node.shopDensity;
  const weeklyVol = node.weeklySalesVolumeUGX;
  const population = node.estimatedPopulation;
  const households = node.estimatedHouseholds;
  const shopsList = node.mappedShops && node.mappedShops.length > 0 
    ? node.mappedShops 
    : [];
  const marketDays = node.marketDays || notProvided;
  const landmarks = node.keyLandmarks && node.keyLandmarks.length > 0 
    ? node.keyLandmarks 
    : [];
  const lat = node.lat;
  const lon = node.lon;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[140] flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm overflow-y-auto"
        onClick={onClose}
      >
        <motion.div 
          initial={{ opacity: 0, scale: 0.94, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 15 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className={`relative w-full max-w-lg rounded-2xl shadow-2xl p-5 sm:p-6 border max-h-[92vh] flex flex-col overflow-hidden ${
            theme === 'dark' ? 'bg-slate-900 border-slate-700/80 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex justify-between items-start pb-3 border-b border-slate-700/20 dark:border-slate-800 shrink-0">
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] uppercase bg-emerald-500/10 text-emerald-500 font-black px-2.5 py-0.5 rounded-full border border-emerald-500/20 tracking-wider flex items-center gap-1">
                  <CheckCircle2 size={10} />
                  {lcType}
                </span>
                <span className="text-[10px] uppercase bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 font-bold px-2 py-0.5 rounded border border-yellow-500/20">
                  {isSourceHierarchyOnly ? 'EC 2022 hierarchy' : pdmStatus}
                </span>
              </div>
              <h3 className="text-xl sm:text-2xl font-black tracking-tight mt-1.5 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-red-500 shrink-0" />
                <span>{villageName}</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                {parishName} • {subcounty} • {county} Constituency • {district}
              </p>
            </div>
            <button 
              onClick={onClose}
              className={`p-1.5 rounded-xl transition-colors ${
                theme === 'dark' ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : 'hover:bg-slate-100 text-slate-500 hover:text-slate-900'
              }`}
            >
              <X size={20} />
            </button>
          </div>

          {/* Scrollable Content Body */}
          <div className="overflow-y-auto py-3 space-y-3.5 pr-1 text-xs">
            {isSourceHierarchyOnly && (
              <div className={`p-3 rounded-xl border ${theme === 'dark' ? 'bg-blue-950/20 border-blue-900/40' : 'bg-blue-50 border-blue-200'}`}>
                <div className="flex items-center gap-2 font-black text-blue-600 dark:text-blue-400 uppercase tracking-wider text-[10px]">
                  <ShieldCheck size={13} />
                  Uganda Electoral Commission 2022
                </div>
                <p className="mt-1.5 text-[11px] text-slate-600 dark:text-slate-300">
                  This dataset verifies the administrative name and parent path only. It does not provide leadership, coordinates, population, PDM, shop, or sales data.
                </p>
                <p className="mt-2 font-mono text-[9px] break-all text-slate-500">{node.sourcePath}</p>
              </div>
            )}

            {/* KPI Stats Grid */}
            {!isSourceHierarchyOnly && <div className="grid grid-cols-2 gap-2.5">
              <div className={`p-3 rounded-xl border ${theme === 'dark' ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200/80'}`}>
                <span className="block text-[9px] uppercase font-bold text-slate-400">Shop density</span>
                <span className="text-base sm:text-lg font-black mt-0.5 flex items-center gap-1.5 text-rose-500">
                  <Building2 size={16} />
                  {density ?? 0} Shops/km²
                </span>
                <span className="text-[10px] text-slate-400 font-medium">
                  {households ?? 0} Households • ~{(population ?? 0).toLocaleString()} pop.
                </span>
              </div>
              <div className={`p-3 rounded-xl border ${theme === 'dark' ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200/80'}`}>
                <span className="block text-[9px] uppercase font-bold text-slate-400">Weekly sales Volume</span>
                <span className="text-base sm:text-lg font-black mt-0.5 flex items-center gap-1.5 text-emerald-500">
                  <TrendingUp size={16} />
                  USh {(weeklyVol ?? 0).toLocaleString()}
                </span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                  Active local commerce
                </span>
              </div>
            </div>}

            {/* LC1 Leadership & Local Governance */}
            <div className={`p-3 rounded-xl border space-y-2 ${theme === 'dark' ? 'bg-slate-950/40 border-slate-800' : 'bg-slate-50/70 border-slate-200'}`}>
              <div className="flex items-center justify-between pb-1 border-b border-slate-200 dark:border-slate-800">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <ShieldCheck size={13} className="text-blue-500" />
                  LC1 Local Leadership & Security
                </span>
                <span className="text-[9px] font-mono text-slate-400">
                  {isSourceHierarchyOnly ? 'Not included in source' : 'Profile data'}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 block font-bold">LC1 Chairperson:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1">
                    {lc1Chair}
                  </span>
                  {lc1Phone && <a href={`tel:${lc1Phone}`} className="text-[10px] text-blue-500 hover:underline flex items-center gap-1 mt-0.5">
                    <Phone size={10} />
                    {lc1Phone}
                  </a>}
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-bold">Vice Chairperson:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-100">{viceChair}</span>
                  <span className="text-[10px] text-slate-400 block font-bold mt-1">Secretary for Defence:</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{defenceSec}</span>
                </div>
              </div>
            </div>

            {/* Parish Development Model (PDM) Card */}
            {!isSourceHierarchyOnly && <div className={`p-3 rounded-xl border space-y-1.5 ${theme === 'dark' ? 'bg-emerald-950/20 border-emerald-900/40' : 'bg-emerald-50/50 border-emerald-200'}`}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <Award size={13} />
                  Parish Development Model (PDM)
                </span>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 font-bold border border-emerald-500/20">
                  {pdmReg}
                </span>
              </div>
              <p className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                {pdmSacco}
              </p>
              <p className="text-[11px] text-slate-600 dark:text-slate-400">
                Pillar 3 Financial Inclusion: Disbursement active for registered enterprise groups in this village node.
              </p>
            </div>}

            {/* Mapped Local Stores & Micro-Retailers */}
            {!isSourceHierarchyOnly && <div className="space-y-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Store size={12} className="text-yellow-500" />
                Mapped Local Outlets & Retailers
              </span>
              <div className="flex flex-wrap gap-1.5">
                {shopsList.map((s, idx) => (
                  <span 
                    key={idx}
                    className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold flex items-center gap-1.5 ${
                      theme === 'dark' ? 'bg-slate-950 border-slate-800 text-slate-300' : 'bg-white border-slate-200 text-slate-700'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 shrink-0" />
                    {s}
                  </span>
                ))}
              </div>
            </div>}

            {/* Market Days & Landmarks */}
            {!isSourceHierarchyOnly && <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
              <div className={`p-2.5 rounded-xl border ${theme === 'dark' ? 'bg-slate-950/30 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                <span className="text-[9px] uppercase font-bold text-slate-400 flex items-center gap-1">
                  <Calendar size={11} className="text-indigo-400" />
                  Market Days
                </span>
                <p className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">{marketDays}</p>
              </div>
              <div className={`p-2.5 rounded-xl border ${theme === 'dark' ? 'bg-slate-950/30 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                <span className="text-[9px] uppercase font-bold text-slate-400 flex items-center gap-1">
                  <Landmark size={11} className="text-amber-400" />
                  Key Landmarks
                </span>
                <p className="font-medium text-slate-700 dark:text-slate-300 mt-0.5 truncate" title={landmarks.join(', ')}>
                  {landmarks.join(' • ')}
                </p>
              </div>
            </div>}

            {/* Coordinates & Calibration */}
            <div className="flex items-center justify-between text-[11px] font-semibold pt-2 border-t border-slate-700/20 dark:border-slate-800">
              <div className="flex items-center gap-1.5 text-slate-400">
                <Compass size={12} className="text-yellow-500" />
                <span>Coordinates:</span>
                <span className="font-mono text-slate-700 dark:text-slate-300">
                  {lat !== undefined && lon !== undefined ? `${lat.toFixed(4)}° N, ${lon.toFixed(4)}° E` : 'Not provided by source'}
                </span>
              </div>
              <div className="flex items-center gap-1 text-emerald-500 font-mono text-[10px]">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
                {isSourceHierarchyOnly ? 'SOURCE IMPORTED' : 'PROFILE LOADED'}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-700/20 dark:border-slate-800 flex gap-2 shrink-0">
            {onExploreOtherParishes && (
              <button
                onClick={() => {
                  onClose();
                  onExploreOtherParishes();
                }}
                className={`flex-1 py-2.5 px-3 rounded-xl font-bold text-xs transition-colors border ${
                  theme === 'dark' ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200' : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
                }`}
              >
                Parishes in {subcounty}
              </button>
            )}
            <button
              onClick={onClose}
              className="flex-1 py-2.5 px-3 bg-yellow-500 hover:bg-yellow-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md"
            >
              Return to map
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default VillageProfileCardModal;
