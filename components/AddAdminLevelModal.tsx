import React, { useState, useMemo } from 'react';
import { Country, Theme, AdminLevel } from '../types';
import Icon from './Icon';

interface AddAdminLevelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<AdminLevel, 'id'>) => void;
  theme: Theme;
  countries: Country[];
}

const AddAdminLevelModal: React.FC<AddAdminLevelModalProps> = ({ isOpen, onClose, onSave, theme, countries }) => {
    const [isClosing, setIsClosing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [adminLevel, setAdminLevel] = useState({
        countryCode: '',
        name: '',
        level: '1',
    });

    const selectedCountry = useMemo(() => {
        if (!adminLevel.countryCode) return null;
        return countries.find(c => c.countryCode === adminLevel.countryCode) || null;
    }, [adminLevel.countryCode, countries]);

    const countryLevelsInfo = useMemo(() => {
        if (!selectedCountry) return [];
        const definedCount = selectedCountry.numberOfAdminLevels || (selectedCountry.adminLevelNames?.length ?? 1);
        const maxLevelInAreas = selectedCountry.adminLevels?.reduce((max, al) => Math.max(max, al.level), 0) || 0;
        const totalLevels = Math.max(definedCount, maxLevelInAreas, 1);

        return Array.from({ length: totalLevels }, (_, idx) => {
            const levelNum = idx + 1;
            const levelNameObj = selectedCountry.adminLevelNames?.find(n => n.level === levelNum);
            const levelName = levelNameObj?.name || `Level ${levelNum}`;
            const areas = selectedCountry.adminLevels?.filter(al => al.level === levelNum) || [];
            return {
                level: levelNum,
                name: levelName,
                count: areas.length,
                areas: areas.map(a => a.name),
            };
        });
    }, [selectedCountry]);

    const resetForm = () => {
        setAdminLevel({ countryCode: '', name: '', level: '1' });
        setError(null);
    };

    const handleClose = () => {
        setIsClosing(true);
        setTimeout(() => {
            onClose();
            setIsClosing(false);
            resetForm();
        }, 300);
    };

    const handleCountryChange = (code: string) => {
        setAdminLevel(prev => ({
            ...prev,
            countryCode: code,
            level: '1',
        }));
        setError(null);
    };

    const handleSave = () => {
        setError(null);
        if (!adminLevel.countryCode || !adminLevel.name.trim()) {
            setError('Please select a country and enter an administrative area name.');
            return;
        }
        const levelNumber = parseInt(adminLevel.level, 10);
        if (isNaN(levelNumber) || levelNumber < 1) {
            setError('Please select or provide a valid level tier.');
            return;
        }

        onSave({
            countryCode: adminLevel.countryCode,
            name: adminLevel.name.trim(),
            level: levelNumber,
        });
        handleClose();
    };

    if (!isOpen && !isClosing) return null;

    const commonInputClasses = theme === 'dark'
        ? 'bg-slate-800 border-slate-700 text-slate-100 placeholder-slate-500'
        : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400';
    const commonFocusClasses = 'focus:outline-none focus:ring-1 focus:ring-yellow-500 focus:border-yellow-500';

    return (
        <div className={`fixed inset-0 bg-black z-50 flex justify-center items-center p-4 transition-opacity duration-300 ${isOpen && !isClosing ? 'opacity-100 bg-opacity-50' : 'opacity-0'}`} aria-modal="true" role="dialog">
            <div className={`${theme === 'dark' ? 'bg-slate-900' : 'bg-slate-50'} rounded-lg shadow-xl w-full max-w-xl max-h-[90vh] flex flex-col transition-all duration-300 ease-in-out ${isOpen && !isClosing ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}>
                {/* Header */}
                <div className={`flex justify-between items-center p-6 border-b ${theme === 'dark' ? 'border-slate-700' : 'border-slate-200'}`}>
                    <div>
                        <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-slate-100' : 'text-slate-900'}`}>
                            Add Admin Level
                        </h2>
                        <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                            Assign a new administrative area or division to a country
                        </p>
                    </div>
                    <button onClick={handleClose} className={`p-1 rounded-md transition-colors ${theme === 'dark' ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200'}`} aria-label="Close modal">
                        <Icon name="x-mark" className="h-6 w-6" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-5 overflow-y-auto">
                    {error && (
                        <div className="p-3 rounded-md bg-red-100 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm flex items-center gap-2">
                            <Icon name="exclamation-triangle" className="h-4 w-4 shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Country Selector */}
                    <div>
                        <label className={`block text-xs font-bold uppercase tracking-wider mb-1.5 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                            Country <span className="text-red-500">*</span>
                        </label>
                        <select
                            name="countryCode"
                            value={adminLevel.countryCode}
                            onChange={e => handleCountryChange(e.target.value)}
                            className={`block w-full rounded-md shadow-sm text-sm px-3 py-2.5 border ${commonInputClasses} ${commonFocusClasses}`}
                        >
                            <option value="">-- Select a country --</option>
                            {countries.map(c => (
                                <option key={c.countryCode} value={c.countryCode}>
                                    {c.name} ({c.countryCode}) - {c.numberOfAdminLevels || 0} Levels Defined
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Existing Levels in Table (Shown when Country is Selected) */}
                    {selectedCountry ? (
                        <div className={`p-4 rounded-lg border ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200 shadow-sm'}`}>
                            <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-200 dark:border-slate-700">
                                <div className="flex items-center space-x-2">
                                    <img 
                                        src={`https://flagcdn.com/w20/${selectedCountry.countryCode.toLowerCase()}.png`}
                                        alt={`Flag of ${selectedCountry.name}`}
                                        className="w-5 h-auto rounded-sm object-cover"
                                    />
                                    <h4 className={`text-xs font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}>
                                        Existing Levels in Table ({selectedCountry.name})
                                    </h4>
                                </div>
                                <span className={`text-[11px] font-mono px-2 py-0.5 rounded ${theme === 'dark' ? 'bg-slate-700 text-yellow-400' : 'bg-yellow-100 text-yellow-800'} font-semibold`}>
                                    {selectedCountry.adminLevels?.length || 0} Total Areas
                                </span>
                            </div>

                            {countryLevelsInfo.length === 0 ? (
                                <p className="text-xs text-slate-500 py-2">No levels or administrative areas defined yet for this country.</p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className={`min-w-full divide-y text-xs ${theme === 'dark' ? 'divide-slate-700' : 'divide-slate-200'}`}>
                                        <thead>
                                            <tr className={theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}>
                                                <th scope="col" className="text-left font-semibold pb-1.5 pr-2">Tier</th>
                                                <th scope="col" className="text-left font-semibold pb-1.5 px-2">Level Name / Type</th>
                                                <th scope="col" className="text-right font-semibold pb-1.5 px-2">Areas</th>
                                                <th scope="col" className="text-left font-semibold pb-1.5 pl-2">Sample Areas</th>
                                                <th scope="col" className="text-right font-semibold pb-1.5 pl-2">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className={`divide-y ${theme === 'dark' ? 'divide-slate-800' : 'divide-slate-100'}`}>
                                            {countryLevelsInfo.map((lvl) => {
                                                const isSelected = adminLevel.level === String(lvl.level);
                                                return (
                                                    <tr 
                                                        key={lvl.level}
                                                        className={`transition-colors ${isSelected ? (theme === 'dark' ? 'bg-yellow-500/10' : 'bg-yellow-50') : 'hover:bg-slate-500/5'}`}
                                                    >
                                                        <td className="py-2 pr-2 font-mono font-bold text-yellow-500">
                                                            Lvl {lvl.level}
                                                        </td>
                                                        <td className={`py-2 px-2 font-semibold ${theme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}>
                                                            {lvl.name}
                                                        </td>
                                                        <td className={`py-2 px-2 text-right font-mono font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                                                            {lvl.count}
                                                        </td>
                                                        <td className="py-2 pl-2 text-slate-500 truncate max-w-[140px]" title={lvl.areas.join(', ')}>
                                                            {lvl.areas.length > 0 ? lvl.areas.slice(0, 2).join(', ') + (lvl.areas.length > 2 ? '...' : '') : <span className="italic opacity-60">None</span>}
                                                        </td>
                                                        <td className="py-2 pl-2 text-right">
                                                            <button
                                                                type="button"
                                                                onClick={() => setAdminLevel(prev => ({ ...prev, level: String(lvl.level) }))}
                                                                className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all ${
                                                                    isSelected
                                                                        ? 'bg-yellow-500 text-slate-950 shadow-xs'
                                                                        : theme === 'dark'
                                                                            ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                                                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                                                }`}
                                                            >
                                                                {isSelected ? 'Selected' : 'Select'}
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className={`p-4 rounded-lg border border-dashed text-center text-xs ${theme === 'dark' ? 'border-slate-700 text-slate-400 bg-slate-800/20' : 'border-slate-300 text-slate-500 bg-slate-50'}`}>
                            Select a country above to view the levels already configured in the table.
                        </div>
                    )}

                    {/* Level Tier Selection */}
                    <div>
                        <label className={`block text-xs font-bold uppercase tracking-wider mb-1.5 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                            Target Level Tier <span className="text-red-500">*</span>
                        </label>
                        {selectedCountry && countryLevelsInfo.length > 0 ? (
                            <select
                                name="level"
                                value={adminLevel.level}
                                onChange={e => setAdminLevel(prev => ({ ...prev, level: e.target.value }))}
                                className={`block w-full rounded-md shadow-sm text-sm px-3 py-2.5 border ${commonInputClasses} ${commonFocusClasses}`}
                            >
                                {countryLevelsInfo.map(lvl => (
                                    <option key={lvl.level} value={String(lvl.level)}>
                                        Level {lvl.level} — {lvl.name} ({lvl.count} existing areas)
                                    </option>
                                ))}
                            </select>
                        ) : (
                            <input
                                type="number"
                                name="level"
                                min="1"
                                max="15"
                                value={adminLevel.level}
                                onChange={e => setAdminLevel(prev => ({ ...prev, level: e.target.value }))}
                                placeholder="1"
                                className={`block w-full rounded-md shadow-sm text-sm px-3 py-2.5 border ${commonInputClasses} ${commonFocusClasses}`}
                            />
                        )}
                    </div>

                    {/* Level / Area Name */}
                    <div>
                        <label className={`block text-xs font-bold uppercase tracking-wider mb-1.5 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                            Administrative Area Name <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            name="name"
                            value={adminLevel.name}
                            onChange={e => setAdminLevel(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="e.g. Central Region, Kampala District, Nakasero Parish"
                            className={`block w-full rounded-md shadow-sm text-sm px-3 py-2.5 border ${commonInputClasses} ${commonFocusClasses}`}
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className={`flex justify-end items-center p-6 border-t rounded-b-lg ${theme === 'dark' ? 'border-slate-700 bg-black/40' : 'border-slate-200 bg-slate-100'}`}>
                    <button
                        type="button"
                        onClick={handleClose}
                        className={`px-5 py-2.5 text-sm font-medium border rounded-md shadow-sm transition-colors ${
                            theme === 'dark'
                                ? 'text-slate-300 bg-transparent border-slate-600 hover:bg-slate-800'
                                : 'text-slate-700 bg-white border-slate-300 hover:bg-slate-50'
                        }`}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        className="ml-3 px-6 py-2.5 text-sm font-semibold text-slate-900 bg-yellow-500 border border-transparent rounded-md shadow-sm hover:bg-yellow-600 transition-colors"
                    >
                        Save Level
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AddAdminLevelModal;