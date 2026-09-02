import React, { useState, useMemo } from 'react';
import { Theme, Country, AdminLevel, AdminLevelName } from '../types';
import Icon from './Icon';
import AddAdminLevelModal from './AddAdminLevelModal';
import DefineAdminLevelsModal from './DefineAdminLevelsModal';
import MultiSelectDropdown from './MultiSelectDropdown';
import AdminLevelProfileView from './AdminLevelProfileView';
import CountryProfileView from './CountryProfileView';

const FlagIcon: React.FC<{ countryCode: string; countryName: string }> = ({ countryCode, countryName }) => {
    return (
        <img 
            src={`https://flagcdn.com/w20/${countryCode.toLowerCase()}.png`}
            alt={`Flag of ${countryName}`}
            className="w-5 h-auto rounded-sm object-cover shadow-xs"
            title={countryName}
        />
    );
};

interface CountryAdminLevelsPageProps {
    theme: Theme;
    countries: Country[];
    onUpdateCountry: (country: Country) => Promise<void>;
    onNavigate?: (view: any) => void;
}

const CountryAdminLevelsPage: React.FC<CountryAdminLevelsPageProps> = ({ 
    theme, 
    countries, 
    onUpdateCountry, 
    onNavigate 
}) => {
    const [isAddAreaModalOpen, setIsAddAreaModalOpen] = useState(false);
    const [isDefineLevelsModalOpen, setIsDefineLevelsModalOpen] = useState(false);
    const [countryToDefine, setCountryToDefine] = useState<Country | null>(null);

    // Navigation and sub-page modes:
    // 'countries' = main country list
    // 'level-info' = dedicated Level Information table (opened on click on level card)
    // 'edit-areas' = administrative area editor / manager (opened on click on edit button)
    // 'level-profile' = dedicated Level Profile view (opened in content area on click on View Profile)
    // 'country-profile' = dedicated Country Profile view (opened in content area on click on Country View icon)
    const [viewMode, setViewMode] = useState<'countries' | 'level-info' | 'edit-areas' | 'level-profile' | 'country-profile'>('countries');
    const [selectedCountryId, setSelectedCountryId] = useState<number | null>(null);
    const [activeLevelTab, setActiveLevelTab] = useState<number>(1);

    // Selected Area for Profile view
    const [selectedAreaForProfile, setSelectedAreaForProfile] = useState<AdminLevel | null>(null);

    // Search and filter states for Level Info page
    const [areaSearchText, setAreaSearchText] = useState('');
    const [selectedParentFilter, setSelectedParentFilter] = useState<string>('all');
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [itemsPerPage, setItemsPerPage] = useState<number>(10);

    // Form states for Edit subpage
    const [newAreaName, setNewAreaName] = useState('');
    const [newAreaParentId, setNewAreaParentId] = useState<string>('');
    const [isCustomizingLevelNames, setIsCustomizingLevelNames] = useState(false);
    const [saveFeedback, setSaveFeedback] = useState<string | null>(null);

    // Main countries filter states
    const [isFilterVisible, setIsFilterVisible] = useState(false);
    const [levelFilter, setLevelFilter] = useState('');
    const [countryFilter, setCountryFilter] = useState<string[]>([]);
    const [creatorFilter, setCreatorFilter] = useState('');
    const [updaterFilter, setUpdaterFilter] = useState('');

    const showSavedToast = (msg: string) => {
        setSaveFeedback(msg);
        setTimeout(() => {
            setSaveFeedback(null);
        }, 3000);
    };

    const handleAddAdminArea = async (newAdminLevelData: Omit<AdminLevel, 'id'>) => {
        const country = countries.find(c => c.countryCode === newAdminLevelData.countryCode);
        if (country) {
            const newId = (country.adminLevels.length > 0 ? Math.max(...country.adminLevels.map(al => al.id)) : 0) + 1;
            const updatedCountry = {
                ...country,
                adminLevels: [...country.adminLevels, { ...newAdminLevelData, id: newId }],
                updatedBy: 'Paul Mboya',
                updatedAt: new Date().toISOString()
            };
            await onUpdateCountry(updatedCountry);
            showSavedToast(`Added ${newAdminLevelData.name} to ${country.name}`);
        }
    };
    
    const handleSaveDefinitions = async (countryCode: string, levels: AdminLevelName[], count: number) => {
        const country = countries.find(c => c.countryCode === countryCode);
        if (country) {
            const updatedCountry = {
                ...country,
                adminLevelNames: levels,
                numberOfAdminLevels: count,
                updatedBy: 'Paul Mboya',
                updatedAt: new Date().toISOString()
            };
            await onUpdateCountry(updatedCountry);
            showSavedToast(`Updated administrative levels for ${country.name}`);
        }
    };

    const uniqueFilterOptions = useMemo(() => {
        const levels = [...new Set(countries.map(c => c.numberOfAdminLevels).filter(Boolean) as number[])].sort((a, b) => a - b);
        const creators = [...new Set(countries.map(c => c.createdBy).filter(Boolean) as string[])].sort();
        const updaters = [...new Set(countries.map(c => c.updatedBy).filter(Boolean) as string[])].sort();
        return { levels, creators, updaters };
    }, [countries]);

    const filteredCountriesData = useMemo(() => {
        return countries
            .map(country => {
                const levelCounts = country.adminLevels.reduce((acc, level) => {
                    acc[level.level] = (acc[level.level] || 0) + 1;
                    return acc;
                }, {} as Record<number, number>);
                
                return {
                    ...country,
                    levelCounts,
                    totalAreas: country.adminLevels.length,
                };
            })
            .filter(country => {
                if (levelFilter && country.numberOfAdminLevels !== parseInt(levelFilter)) return false;
                if (countryFilter.length > 0 && !countryFilter.includes(country.name)) return false;
                if (creatorFilter && country.createdBy !== creatorFilter) return false;
                if (updaterFilter && country.updatedBy !== updaterFilter) return false;
                return true;
            });
    }, [countries, levelFilter, countryFilter, creatorFilter, updaterFilter]);

    const maxLevelsAcrossAll = useMemo(() => {
        return filteredCountriesData.reduce((max, country) => Math.max(max, country.numberOfAdminLevels || 0), 0);
    }, [filteredCountriesData]);

    const levelHeaders = Array.from({ length: maxLevelsAcrossAll }, (_, i) => i + 1);

    const handleResetFilters = () => {
        setLevelFilter('');
        setCountryFilter([]);
        setCreatorFilter('');
        setUpdaterFilter('');
    };

    // Active selected country for subpages
    const activeCountry = useMemo(() => {
        if (selectedCountryId === null) return null;
        return countries.find(c => c.id === selectedCountryId) || null;
    }, [countries, selectedCountryId]);

    const activeAdminLevelsCount = activeCountry?.numberOfAdminLevels || 1;
    const safeActiveLevelTab = activeLevelTab > activeAdminLevelsCount ? 1 : activeLevelTab;

    // Helper: Level names for active country
    const getLevelTierName = (levelNum: number): string => {
        if (!activeCountry) return `Level ${levelNum}`;
        const matched = activeCountry.adminLevelNames?.find(n => n.level === levelNum);
        return matched?.name || `Level ${levelNum}`;
    };

    const currentTabLevelName = getLevelTierName(safeActiveLevelTab);
    const parentLevelTierName = safeActiveLevelTab > 1 ? getLevelTierName(safeActiveLevelTab - 1) : null;
    const nextLevelTierName = safeActiveLevelTab < activeAdminLevelsCount ? getLevelTierName(safeActiveLevelTab + 1) : null;

    // Tabs for Level Selector
    const levelTabs = useMemo(() => {
        if (!activeCountry) return [];
        return Array.from({ length: activeAdminLevelsCount }, (_, i) => {
            const levelNum = i + 1;
            const name = getLevelTierName(levelNum);
            const count = activeCountry.adminLevels.filter(al => al.level === levelNum).length;
            return { level: levelNum, name, count };
        });
    }, [activeCountry, activeAdminLevelsCount]);

    // Parent Level areas for dropdown filters
    const parentLevelAreas = useMemo(() => {
        if (!activeCountry || safeActiveLevelTab <= 1) return [];
        return activeCountry.adminLevels.filter(al => al.level === safeActiveLevelTab - 1);
    }, [activeCountry, safeActiveLevelTab]);

    // Child counts for Level N+1
    const childCountMap = useMemo(() => {
        if (!activeCountry) return new Map<number, number>();
        const map = new Map<number, number>();
        const nextLevelAreas = activeCountry.adminLevels.filter(al => al.level === safeActiveLevelTab + 1);
        for (const child of nextLevelAreas) {
            if (child.parentAdminLevelId) {
                map.set(child.parentAdminLevelId, (map.get(child.parentAdminLevelId) || 0) + 1);
            }
        }
        return map;
    }, [activeCountry, safeActiveLevelTab]);

    // Helper: Get ancestor lineage from Level 1 up to this area
    const getAreaLineage = (area: AdminLevel): AdminLevel[] => {
        if (!activeCountry) return [area];
        const lineage: AdminLevel[] = [area];
        let current = area;
        while (current.parentAdminLevelId) {
            const parent = activeCountry.adminLevels.find(al => al.id === current.parentAdminLevelId);
            if (!parent) break;
            lineage.unshift(parent);
            current = parent;
        }
        return lineage;
    };

    // Helper: Get direct child areas of a given area
    const getDirectChildAreas = (area: AdminLevel): AdminLevel[] => {
        if (!activeCountry) return [];
        return activeCountry.adminLevels.filter(al => al.parentAdminLevelId === area.id);
    };

    // Filtered areas for the active level tab
    const filteredTabAreas = useMemo(() => {
        if (!activeCountry) return [];
        let areas = activeCountry.adminLevels.filter(al => al.level === safeActiveLevelTab);

        if (selectedParentFilter && selectedParentFilter !== 'all') {
            const parentId = parseInt(selectedParentFilter, 10);
            areas = areas.filter(al => al.parentAdminLevelId === parentId);
        }

        if (areaSearchText.trim()) {
            const query = areaSearchText.toLowerCase();
            areas = areas.filter(al => {
                const nameMatches = al.name.toLowerCase().includes(query);
                const idMatches = al.id.toString().includes(query);
                const officeMatches = al.office?.townOrCity?.toLowerCase().includes(query) || al.office?.officeName?.toLowerCase().includes(query);
                const leaderMatches = al.leaders?.some(l => l.name.toLowerCase().includes(query) || l.title.toLowerCase().includes(query));
                
                // Lineage ancestor matches
                const lineage = getAreaLineage(al);
                const ancestorMatches = lineage.some(anc => anc.name.toLowerCase().includes(query));

                return nameMatches || idMatches || officeMatches || leaderMatches || ancestorMatches;
            });
        }

        return areas;
    }, [activeCountry, safeActiveLevelTab, selectedParentFilter, areaSearchText]);

    // Pagination calculations
    const totalPages = Math.max(1, Math.ceil(filteredTabAreas.length / itemsPerPage));
    const safeCurrentPage = currentPage > totalPages ? 1 : currentPage;
    const paginatedAreas = useMemo(() => {
        const startIndex = (safeCurrentPage - 1) * itemsPerPage;
        return filteredTabAreas.slice(startIndex, startIndex + itemsPerPage);
    }, [filteredTabAreas, safeCurrentPage, itemsPerPage]);

    // Handlers for Area profile view (in content area)
    const handleOpenProfile = (area: AdminLevel) => {
        setSelectedAreaForProfile(area);
        setViewMode('level-profile');
    };

    const handleSaveAreaFromProfile = async (updatedArea: AdminLevel) => {
        if (!activeCountry) return;
        const updatedAreas = activeCountry.adminLevels.map(al => al.id === updatedArea.id ? updatedArea : al);
        const updatedCountry: Country = {
            ...activeCountry,
            adminLevels: updatedAreas,
            updatedBy: 'Paul Mboya',
            updatedAt: new Date().toISOString()
        };
        await onUpdateCountry(updatedCountry);
        setSelectedAreaForProfile(updatedArea);
        showSavedToast(`Saved profile for "${updatedArea.name}"`);
    };

    // Handlers for Editor Mode
    const handleSaveLevelName = async (level: number, newName: string) => {
        if (!activeCountry) return;
        const existingNames = activeCountry.adminLevelNames || [];
        const index = existingNames.findIndex(n => n.level === level);
        
        let updatedNames = [...existingNames];
        if (index > -1) {
            updatedNames[index] = { ...updatedNames[index], name: newName };
        } else {
            updatedNames.push({ level, name: newName });
        }
        
        const updatedCountry = {
            ...activeCountry,
            adminLevelNames: updatedNames,
            updatedBy: 'Paul Mboya',
            updatedAt: new Date().toISOString()
        };
        await onUpdateCountry(updatedCountry);
        showSavedToast(`Renamed Level ${level} to "${newName || `Level ${level}`}"`);
    };

    const handleUpdateLevelCount = async (newCount: number) => {
        if (!activeCountry || newCount < 1 || newCount > 15) return;
        const existingNames = activeCountry.adminLevelNames || [];
        const adjustedNames = Array.from({ length: newCount }, (_, i) => {
            const level = i + 1;
            const matched = existingNames.find(n => n.level === level);
            return {
                level,
                name: matched ? matched.name : `Level ${level}`
            };
        });

        const updatedCountry = {
            ...activeCountry,
            numberOfAdminLevels: newCount,
            adminLevelNames: adjustedNames,
            updatedBy: 'Paul Mboya',
            updatedAt: new Date().toISOString()
        };
        await onUpdateCountry(updatedCountry);
        showSavedToast(`Updated level count to ${newCount}`);
    };

    const handleUpdateArea = async (areaId: number, name: string, parentAdminLevelId?: number) => {
        if (!activeCountry) return;
        const updatedAreas = activeCountry.adminLevels.map(al => {
            if (al.id === areaId) {
                return {
                    ...al,
                    name: name.trim(),
                    parentAdminLevelId: parentAdminLevelId
                };
            }
            return al;
        });

        const updatedCountry = {
            ...activeCountry,
            adminLevels: updatedAreas,
            updatedBy: 'Paul Mboya',
            updatedAt: new Date().toISOString()
        };
        await onUpdateCountry(updatedCountry);
        showSavedToast(`Saved area "${name}"`);
    };

    const handleDeleteArea = async (areaId: number) => {
        if (!activeCountry) return;
        const updatedAreas = activeCountry.adminLevels.filter(al => al.id !== areaId);
        const updatedCountry = {
            ...activeCountry,
            adminLevels: updatedAreas,
            updatedBy: 'Paul Mboya',
            updatedAt: new Date().toISOString()
        };
        await onUpdateCountry(updatedCountry);
        showSavedToast(`Deleted area from database`);
    };

    const handleAddNewArea = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeCountry || !newAreaName.trim()) return;
        
        const maxId = activeCountry.adminLevels.length > 0 
            ? Math.max(...activeCountry.adminLevels.map(al => al.id)) 
            : 0;
        
        const newArea: AdminLevel = {
            id: maxId + 1,
            name: newAreaName.trim(),
            level: safeActiveLevelTab,
            countryCode: activeCountry.countryCode,
            parentAdminLevelId: newAreaParentId ? parseInt(newAreaParentId, 10) : undefined,
            office: {
                officeName: `${newAreaName.trim()} Administrative Office`,
                townOrCity: newAreaName.trim(),
                phone: activeCountry.phoneCode ? `${activeCountry.phoneCode} 414 000 000` : '+256 414 000 000',
                email: `office.${newAreaName.trim().toLowerCase().replace(/\s+/g, '')}@gov.org`
            }
        };

        const updatedCountry = {
            ...activeCountry,
            adminLevels: [...activeCountry.adminLevels, newArea],
            updatedBy: 'Paul Mboya',
            updatedAt: new Date().toISOString()
        };

        await onUpdateCountry(updatedCountry);
        showSavedToast(`Added "${newArea.name}"`);
        setNewAreaName('');
        setNewAreaParentId('');
    };

    const isDarkMode = theme === 'dark';
    const commonInputClasses = isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-300 text-slate-900';
    const commonFocusClasses = 'focus:outline-none focus:ring-1 focus:ring-yellow-500 focus:border-yellow-500';

    return (
        <>
            <AddAdminLevelModal 
                isOpen={isAddAreaModalOpen} 
                onClose={() => setIsAddAreaModalOpen(false)} 
                onSave={handleAddAdminArea} 
                theme={theme} 
                countries={countries} 
            />
            <DefineAdminLevelsModal 
                isOpen={isDefineLevelsModalOpen} 
                onClose={() => setIsDefineLevelsModalOpen(false)} 
                onSave={handleSaveDefinitions} 
                theme={theme} 
                countryToDefine={countryToDefine} 
            />

            {saveFeedback && (
                <div className="fixed top-4 right-4 z-50 flex items-center space-x-2 px-4 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-lg shadow-xl animate-fade-in">
                    <Icon name="check" className="h-5 w-5 text-white" />
                    <span>{saveFeedback}</span>
                </div>
            )}

            <div className={`${isDarkMode ? 'bg-slate-900' : 'bg-white'} p-6 rounded-lg shadow-sm transition-all duration-300`}>
                
                {/* ------------------------------------------------------------- */}
                {/* VIEW 0A: DEDICATED COUNTRY PROFILE VIEW (CLICK ON COUNTRY VIEW ICON) */}
                {/* ------------------------------------------------------------- */}
                {viewMode === 'country-profile' && activeCountry ? (
                    <CountryProfileView
                        theme={theme}
                        country={activeCountry}
                        onBack={() => {
                            setViewMode('countries');
                            setSelectedCountryId(null);
                        }}
                        onSelectLevel={(level) => {
                            setActiveLevelTab(level);
                            setSelectedParentFilter('all');
                            setAreaSearchText('');
                            setCurrentPage(1);
                            setViewMode('level-info');
                        }}
                        onEditLevels={() => {
                            setActiveLevelTab(1);
                            setSelectedParentFilter('all');
                            setAreaSearchText('');
                            setViewMode('edit-areas');
                        }}
                        onUpdateCountry={onUpdateCountry}
                    />
                ) : viewMode === 'level-profile' && activeCountry && selectedAreaForProfile ? (
                    <AdminLevelProfileView
                        theme={theme}
                        country={activeCountry}
                        area={selectedAreaForProfile}
                        lineage={getAreaLineage(selectedAreaForProfile)}
                        childAreas={getDirectChildAreas(selectedAreaForProfile)}
                        onBack={() => {
                            setViewMode('level-info');
                        }}
                        onSaveArea={handleSaveAreaFromProfile}
                        onSelectArea={(newArea) => {
                            setSelectedAreaForProfile(newArea);
                            setActiveLevelTab(newArea.level);
                        }}
                        onJumpToChildLevelInTable={(targetLevel, parentId) => {
                            setActiveLevelTab(targetLevel);
                            setSelectedParentFilter(parentId.toString());
                            setCurrentPage(1);
                            setViewMode('level-info');
                        }}
                    />
                ) : viewMode === 'level-info' && activeCountry ? (
                    <div className="space-y-6 animate-fade-in">
                        {/* Top Bar Navigation & Breadcrumbs */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
                            <button 
                                onClick={() => {
                                    setViewMode('countries');
                                    setSelectedCountryId(null);
                                    setSelectedParentFilter('all');
                                    setAreaSearchText('');
                                    setCurrentPage(1);
                                }} 
                                className={`flex items-center space-x-2 text-sm font-semibold hover:opacity-80 transition-opacity ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}
                            >
                                <Icon name="chevron-left" className="h-4 w-4 text-yellow-500" />
                                <span>Back to Country Admin Levels</span>
                            </button>

                            {/* Breadcrumbs */}
                            <div className="flex items-center space-x-2 text-xs text-slate-400">
                                <span>Countries Management</span>
                                <span>/</span>
                                <span>Administrative Levels</span>
                                <span>/</span>
                                <span className="font-semibold text-slate-200">{activeCountry.name}</span>
                                <span>/</span>
                                <span className="font-bold text-yellow-500">
                                    Level {safeActiveLevelTab}: {currentTabLevelName}
                                </span>
                            </div>
                        </div>

                        {/* Level Info Banner with Country Flag & Switch to Edit Mode */}
                        <div className={`p-5 rounded-xl border ${isDarkMode ? 'bg-slate-800/50 border-slate-700/80' : 'bg-slate-50 border-slate-200'} flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-sm`}>
                            <div className="flex items-start sm:items-center space-x-4">
                                <div className="p-2 bg-slate-900/40 rounded-xl border border-slate-700/50 shadow-inner">
                                    <FlagIcon countryCode={activeCountry.countryCode} countryName={activeCountry.name} />
                                </div>
                                <div>
                                    <div className="flex items-center space-x-2.5">
                                        <h2 className="text-2xl font-bold text-slate-100">{activeCountry.name}</h2>
                                        <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                                            {activeAdminLevelsCount} Levels Total
                                        </span>
                                    </div>
                                    <p className={`text-xs mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                                        Viewing Level {safeActiveLevelTab} (<span className="font-bold text-slate-200">{currentTabLevelName}</span>) directory showing complete ancestor hierarchy, office headquarters, and leadership profiles.
                                    </p>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center space-x-3">
                                <button
                                    onClick={() => setViewMode('edit-areas')}
                                    className="flex items-center space-x-2 px-3.5 py-2 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-yellow-500 rounded-lg shadow-sm transition-all"
                                    title="Open the administrative structure editor"
                                >
                                    <Icon name="edit" className="h-4 w-4 text-yellow-500" />
                                    <span>Manage / Edit Areas</span>
                                </button>

                                <button
                                    onClick={() => setIsAddAreaModalOpen(true)}
                                    className="flex items-center space-x-2 px-3.5 py-2 text-xs font-bold bg-yellow-500 hover:bg-yellow-600 text-slate-950 rounded-lg shadow transition-colors"
                                >
                                    <Icon name="plus" className="h-4 w-4" />
                                    <span>Add Admin Area</span>
                                </button>
                            </div>
                        </div>

                        {/* Interactive Level Switcher Tabs */}
                        <div className="flex items-center space-x-2 overflow-x-auto pb-2 border-b border-slate-800">
                            {levelTabs.map((tab) => {
                                const isActive = tab.level === safeActiveLevelTab;
                                return (
                                    <button
                                        key={tab.level}
                                        onClick={() => {
                                            setActiveLevelTab(tab.level);
                                            setSelectedParentFilter('all');
                                            setCurrentPage(1);
                                        }}
                                        className={`px-4 py-2.5 rounded-lg text-xs font-bold transition-all duration-150 flex items-center space-x-2.5 whitespace-nowrap ${
                                            isActive
                                                ? 'bg-yellow-500 text-slate-950 shadow-md font-extrabold ring-1 ring-yellow-400'
                                                : isDarkMode
                                                    ? 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700'
                                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                                        }`}
                                    >
                                        <span className={`px-2 py-0.5 text-[10px] rounded-full font-mono ${
                                            isActive ? 'bg-slate-950 text-yellow-400' : 'bg-slate-900 text-slate-300'
                                        }`}>
                                            L{tab.level}
                                        </span>
                                        <span>{tab.name}</span>
                                        <span className={`text-[11px] px-2 py-0.5 rounded-full ${
                                            isActive ? 'bg-yellow-600/40 text-slate-950 font-black' : 'bg-slate-700/50 text-slate-300'
                                        }`}>
                                            {tab.count}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Table Search & Parent Filter Bar */}
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                            <div className="flex-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                                {/* Search box */}
                                <div className="relative flex-1">
                                    <Icon name="search" className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                                    <input
                                        type="text"
                                        value={areaSearchText}
                                        onChange={e => {
                                            setAreaSearchText(e.target.value);
                                            setCurrentPage(1);
                                        }}
                                        placeholder={`Search ${currentTabLevelName} areas by name, ID, leader, or town...`}
                                        className={`w-full text-xs rounded-lg pl-9 pr-4 py-2 border font-medium ${commonInputClasses} ${commonFocusClasses}`}
                                    />
                                    {areaSearchText && (
                                        <button 
                                            onClick={() => setAreaSearchText('')}
                                            className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-slate-200"
                                        >
                                            ✕
                                        </button>
                                    )}
                                </div>

                                {/* Parent Level filter if Level > 1 */}
                                {safeActiveLevelTab > 1 && parentLevelAreas.length > 0 && (
                                    <div className="flex items-center space-x-2">
                                        <label className="text-xs font-bold text-slate-400 whitespace-nowrap">
                                            Filter by {parentLevelTierName}:
                                        </label>
                                        <select
                                            value={selectedParentFilter}
                                            onChange={e => {
                                                setSelectedParentFilter(e.target.value);
                                                setCurrentPage(1);
                                            }}
                                            className={`text-xs rounded-lg border px-3 py-2 font-medium ${commonInputClasses} ${commonFocusClasses}`}
                                        >
                                            <option value="all">All {parentLevelTierName}s ({parentLevelAreas.length})</option>
                                            {parentLevelAreas.map(p => (
                                                <option key={p.id} value={p.id}>{p.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>

                            {/* Items per page selector */}
                            <div className="flex items-center space-x-2 self-end sm:self-auto text-xs text-slate-400">
                                <span>Rows:</span>
                                <select
                                    value={itemsPerPage}
                                    onChange={e => {
                                        setItemsPerPage(parseInt(e.target.value, 10));
                                        setCurrentPage(1);
                                    }}
                                    className={`text-xs rounded-md border px-2 py-1 ${commonInputClasses} ${commonFocusClasses}`}
                                >
                                    <option value={5}>5</option>
                                    <option value={10}>10</option>
                                    <option value={20}>20</option>
                                    <option value={50}>50</option>
                                </select>
                            </div>
                        </div>

                        {/* Hierarchical Information Table */}
                        <div className={`overflow-hidden rounded-xl border ${isDarkMode ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200 bg-white'} shadow-sm`}>
                            <div className="overflow-x-auto">
                                <table className={`min-w-full divide-y ${isDarkMode ? 'divide-slate-800' : 'divide-slate-200'}`}>
                                    <thead className={isDarkMode ? 'bg-slate-800/90' : 'bg-slate-100'}>
                                        <tr>
                                            <th scope="col" className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-400 w-16">
                                                # ID
                                            </th>

                                            {/* Render Columns for Level 1 through Level K */}
                                            {Array.from({ length: safeActiveLevelTab }, (_, i) => {
                                                const lvl = i + 1;
                                                const name = getLevelTierName(lvl);
                                                const isCurrentTarget = lvl === safeActiveLevelTab;
                                                return (
                                                    <th 
                                                        key={lvl} 
                                                        scope="col" 
                                                        className={`px-4 py-3 text-left text-xs font-bold uppercase tracking-wider ${
                                                            isCurrentTarget 
                                                                ? 'text-yellow-400 bg-yellow-500/10' 
                                                                : 'text-slate-400'
                                                        }`}
                                                    >
                                                        Level {lvl}: {name}
                                                    </th>
                                                );
                                            })}

                                            <th scope="col" className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-400">
                                                Office & Headquarters
                                            </th>

                                            <th scope="col" className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-400">
                                                Leaders & Contacts
                                            </th>

                                            {safeActiveLevelTab < activeAdminLevelsCount && (
                                                <th scope="col" className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-400">
                                                    Sub-Areas ({nextLevelTierName})
                                                </th>
                                            )}

                                            <th scope="col" className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-slate-400 w-28">
                                                Profile / View
                                            </th>
                                        </tr>
                                    </thead>

                                    <tbody className={`divide-y ${isDarkMode ? 'divide-slate-800 bg-slate-900/40' : 'divide-slate-200 bg-white'}`}>
                                        {paginatedAreas.length === 0 ? (
                                            <tr>
                                                <td 
                                                    colSpan={safeActiveLevelTab + 5} 
                                                    className="px-6 py-12 text-center text-slate-500 text-sm"
                                                >
                                                    <div className="flex flex-col items-center justify-center space-y-2">
                                                        <Icon name="archive" className="h-8 w-8 text-slate-600" />
                                                        <span className="font-semibold">No administrative areas found for Level {safeActiveLevelTab} ({currentTabLevelName}).</span>
                                                        <span className="text-xs text-slate-500">Try adjusting your search query or switch to edit mode to register areas.</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : (
                                            paginatedAreas.map((area, index) => {
                                                const lineage = getAreaLineage(area);
                                                const childCount = childCountMap.get(area.id) || 0;
                                                const office = area.office || {};
                                                const leaders = area.leaders || [];
                                                const primaryLeader = leaders[0];

                                                return (
                                                    <tr 
                                                        key={area.id} 
                                                        className={`hover:bg-slate-800/30 transition-colors group ${
                                                            index % 2 === 1 && isDarkMode ? 'bg-slate-800/10' : ''
                                                        }`}
                                                    >
                                                        {/* ID */}
                                                        <td className="px-4 py-3.5 whitespace-nowrap text-xs font-mono text-slate-400">
                                                            #{area.id}
                                                        </td>

                                                        {/* Hierarchy Columns: Level 1 up to Level K */}
                                                        {Array.from({ length: safeActiveLevelTab }, (_, i) => {
                                                            const lvl = i + 1;
                                                            const isTargetLevel = lvl === safeActiveLevelTab;
                                                            // Find ancestor for level `lvl`
                                                            const ancestorAtLevel = lineage.find(a => a.level === lvl);

                                                            return (
                                                                <td 
                                                                    key={lvl} 
                                                                    className={`px-4 py-3.5 whitespace-nowrap text-xs ${
                                                                        isTargetLevel 
                                                                            ? 'font-bold text-slate-100 bg-yellow-500/5' 
                                                                            : 'font-medium text-slate-400'
                                                                    }`}
                                                                >
                                                                    {ancestorAtLevel ? (
                                                                        <div className="flex items-center space-x-1.5">
                                                                            {isTargetLevel && (
                                                                                <span className="w-1.5 h-1.5 rounded-full bg-yellow-400"></span>
                                                                            )}
                                                                            <span className={isTargetLevel ? 'text-yellow-400 font-extrabold text-sm' : 'text-slate-300'}>
                                                                                {ancestorAtLevel.name}
                                                                            </span>
                                                                        </div>
                                                                    ) : (
                                                                        <span className="text-slate-600 italic">—</span>
                                                                    )}
                                                                </td>
                                                            );
                                                        })}

                                                        {/* Office Location Summary */}
                                                        <td className="px-4 py-3.5 text-xs text-slate-300 max-w-xs">
                                                            <div className="flex flex-col space-y-0.5">
                                                                <span className="font-semibold text-slate-200 truncate" title={office.officeName || `${area.name} Administrative Headquarters`}>
                                                                    {office.officeName || `${area.name} HQ`}
                                                                </span>
                                                                <span className="text-[11px] text-slate-400 truncate flex items-center space-x-1">
                                                                    <Icon name="map" className="h-3 w-3 text-yellow-500 flex-shrink-0" />
                                                                    <span>{office.townOrCity || area.name}, {office.street || 'Main Civic Road'}</span>
                                                                </span>
                                                            </div>
                                                        </td>

                                                        {/* Leaders Summary */}
                                                        <td className="px-4 py-3.5 text-xs text-slate-300 max-w-xs">
                                                            {primaryLeader ? (
                                                                <div className="flex flex-col space-y-0.5">
                                                                    <div className="flex items-center space-x-1.5">
                                                                        <span className="font-bold text-slate-100 truncate">{primaryLeader.name}</span>
                                                                        {leaders.length > 1 && (
                                                                            <span className="px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-400 text-[10px] font-bold">
                                                                                +{leaders.length - 1} more
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <span className="text-[11px] text-yellow-400 font-medium truncate">
                                                                        {primaryLeader.title} • {primaryLeader.phone}
                                                                    </span>
                                                                </div>
                                                            ) : (
                                                                <div className="flex items-center space-x-1 text-slate-500 italic text-[11px]">
                                                                    <Icon name="user" className="h-3 w-3" />
                                                                    <span>Administrator Assigned</span>
                                                                </div>
                                                            )}
                                                        </td>

                                                        {/* Sub-Areas Drill-down */}
                                                        {safeActiveLevelTab < activeAdminLevelsCount && (
                                                            <td className="px-4 py-3.5 whitespace-nowrap text-xs">
                                                                {childCount > 0 ? (
                                                                    <button
                                                                        onClick={() => {
                                                                            setActiveLevelTab(safeActiveLevelTab + 1);
                                                                            setSelectedParentFilter(area.id.toString());
                                                                            setCurrentPage(1);
                                                                        }}
                                                                        className="px-2.5 py-1 rounded-full bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 font-bold text-xs flex items-center space-x-1 transition-all"
                                                                        title={`Inspect ${childCount} ${nextLevelTierName}s in ${area.name}`}
                                                                    >
                                                                        <span>{childCount} {nextLevelTierName}{childCount === 1 ? '' : 's'}</span>
                                                                        <Icon name="chevron-right" className="h-3 w-3" />
                                                                    </button>
                                                                ) : (
                                                                    <span className="text-slate-500 text-xs italic">0 sub-areas</span>
                                                                )}
                                                            </td>
                                                        )}

                                                        {/* Actions: View Profile Button */}
                                                        <td className="px-4 py-3.5 whitespace-nowrap text-center">
                                                            <button
                                                                onClick={() => handleOpenProfile(area)}
                                                                className="px-3 py-1.5 bg-yellow-500 hover:bg-yellow-600 text-slate-950 font-extrabold text-xs rounded-lg flex items-center space-x-1.5 shadow-sm transition-all mx-auto active:scale-95"
                                                                title={`Open detailed profile for ${area.name}`}
                                                            >
                                                                <Icon name="eye" className="h-3.5 w-3.5 text-slate-950" />
                                                                <span>View Profile</span>
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination Controls */}
                            <div className={`px-4 py-3.5 border-t flex flex-col sm:flex-row items-center justify-between gap-3 text-xs ${
                                isDarkMode ? 'bg-slate-800/70 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600'
                            }`}>
                                <div>
                                    Showing <span className="font-bold text-slate-200">{filteredTabAreas.length > 0 ? (safeCurrentPage - 1) * itemsPerPage + 1 : 0}</span> to <span className="font-bold text-slate-200">{Math.min(safeCurrentPage * itemsPerPage, filteredTabAreas.length)}</span> of <span className="font-bold text-yellow-500">{filteredTabAreas.length}</span> {currentTabLevelName} areas
                                </div>

                                {totalPages > 1 && (
                                    <div className="flex items-center space-x-1.5">
                                        <button
                                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                            disabled={safeCurrentPage === 1}
                                            className={`px-2.5 py-1.5 rounded border text-xs font-semibold disabled:opacity-30 disabled:cursor-not-allowed ${
                                                isDarkMode ? 'border-slate-700 hover:bg-slate-700 text-slate-300' : 'border-slate-300 hover:bg-slate-100 text-slate-700'
                                            }`}
                                        >
                                            Prev
                                        </button>

                                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
                                            <button
                                                key={pageNum}
                                                onClick={() => setCurrentPage(pageNum)}
                                                className={`w-7 h-7 rounded text-xs font-bold transition-all ${
                                                    pageNum === safeCurrentPage
                                                        ? 'bg-yellow-500 text-slate-950 font-black'
                                                        : isDarkMode
                                                            ? 'text-slate-300 hover:bg-slate-700'
                                                            : 'text-slate-700 hover:bg-slate-200'
                                                }`}
                                            >
                                                {pageNum}
                                            </button>
                                        ))}

                                        <button
                                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                            disabled={safeCurrentPage === totalPages}
                                            className={`px-2.5 py-1.5 rounded border text-xs font-semibold disabled:opacity-30 disabled:cursor-not-allowed ${
                                                isDarkMode ? 'border-slate-700 hover:bg-slate-700 text-slate-300' : 'border-slate-300 hover:bg-slate-100 text-slate-700'
                                            }`}
                                        >
                                            Next
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ) : viewMode === 'edit-areas' && activeCountry ? (
                    /* ------------------------------------------------------------- */
                    /* VIEW 2: FULL AREA MANAGEMENT / EDITOR (OPENED VIA EDIT BUTTON) */
                    /* ------------------------------------------------------------- */
                    <div className="space-y-6 animate-fade-in">
                        {/* Top Navigation Bar */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
                            <button 
                                onClick={() => {
                                    setViewMode('countries');
                                    setSelectedCountryId(null);
                                    setSelectedParentFilter('all');
                                    setAreaSearchText('');
                                }} 
                                className={`flex items-center space-x-2 text-sm font-semibold hover:opacity-80 transition-opacity ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}
                            >
                                <Icon name="chevron-left" className="h-4 w-4 text-yellow-500" />
                                <span>Back to Country Admin Levels</span>
                            </button>

                            {/* Breadcrumbs */}
                            <div className="flex items-center space-x-2 text-xs text-slate-400">
                                <span>Countries Management</span>
                                <span>/</span>
                                <span>Administrative Levels</span>
                                <span>/</span>
                                <span className="font-semibold text-slate-200">{activeCountry.name}</span>
                                <span>/</span>
                                <span className="font-bold text-yellow-500">Edit Level {safeActiveLevelTab}: {currentTabLevelName}</span>
                            </div>
                        </div>

                        {/* Country & Level Header Banner */}
                        <div className={`p-5 rounded-xl border ${isDarkMode ? 'bg-slate-800/50 border-slate-700/80' : 'bg-slate-50 border-slate-200'} flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-sm`}>
                            <div className="flex items-start sm:items-center space-x-4">
                                <div className="p-2 bg-slate-900/40 rounded-lg border border-slate-700/50 shadow-inner">
                                    <FlagIcon countryCode={activeCountry.countryCode} countryName={activeCountry.name} />
                                </div>
                                <div>
                                    <div className="flex items-center space-x-2.5">
                                        <h2 className="text-2xl font-bold text-slate-100">{activeCountry.name}</h2>
                                        <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                                            {activeAdminLevelsCount} Admin Levels
                                        </span>
                                    </div>
                                    <p className={`text-xs mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                                        Editing <span className="font-bold text-slate-200">Level {safeActiveLevelTab} ({currentTabLevelName})</span> with <span className="font-bold text-yellow-400">{filteredTabAreas.length} registered areas</span>.
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center space-x-3">
                                <button
                                    onClick={() => setViewMode('level-info')}
                                    className="flex items-center space-x-2 px-3.5 py-2 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-yellow-500 rounded-lg shadow-sm transition-all"
                                >
                                    <Icon name="eye" className="h-4 w-4 text-yellow-500" />
                                    <span>View Info Table</span>
                                </button>

                                <button
                                    onClick={() => setIsCustomizingLevelNames(!isCustomizingLevelNames)}
                                    className={`flex items-center space-x-2 px-3.5 py-2 text-xs font-bold rounded-lg border transition-all ${
                                        isCustomizingLevelNames
                                            ? 'bg-yellow-500 text-slate-950 border-yellow-500 shadow-md'
                                            : isDarkMode
                                                ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                                                : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                                    }`}
                                >
                                    <Icon name="adjustments" className="h-4 w-4" />
                                    <span>{isCustomizingLevelNames ? 'Hide Settings' : 'Customize Level Tiers'}</span>
                                </button>

                                <button
                                    onClick={() => setIsAddAreaModalOpen(true)}
                                    className="flex items-center space-x-2 px-3.5 py-2 text-xs font-bold bg-yellow-500 hover:bg-yellow-600 text-slate-950 rounded-lg shadow transition-colors"
                                >
                                    <Icon name="plus" className="h-4 w-4" />
                                    <span>Add Area Modal</span>
                                </button>
                            </div>
                        </div>

                        {/* Expandable Level Hierarchy & Custom Naming Settings */}
                        {isCustomizingLevelNames && (
                            <div className={`p-5 rounded-xl border animate-fade-in ${isDarkMode ? 'bg-slate-800/80 border-yellow-500/30' : 'bg-yellow-50/50 border-yellow-300'}`}>
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center space-x-2">
                                        <Icon name="adjustments" className="h-5 w-5 text-yellow-500" />
                                        <h3 className="font-bold text-sm text-slate-100">Level Names & Depth Hierarchy Configuration</h3>
                                    </div>
                                    <span className="text-xs text-slate-400">Database changes auto-save</span>
                                </div>
                                
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
                                    {Array.from({ length: activeCountry.numberOfAdminLevels || 1 }, (_, i) => {
                                        const levelNum = i + 1;
                                        const existingNameObj = activeCountry.adminLevelNames?.find(n => n.level === levelNum);
                                        const currentName = existingNameObj?.name || '';
                                        const count = activeCountry.adminLevels.filter(al => al.level === levelNum).length;
                                        return (
                                            <div key={levelNum} className={`flex flex-col space-y-1.5 p-3 rounded-lg border ${
                                                levelNum === safeActiveLevelTab
                                                    ? 'bg-yellow-500/10 border-yellow-500/60 ring-1 ring-yellow-500/40'
                                                    : 'bg-slate-900/40 border-slate-700/60'
                                            }`}>
                                                <div className="flex justify-between items-center">
                                                    <label className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                                                        Level {levelNum} {levelNum === safeActiveLevelTab && <span className="text-yellow-400 font-extrabold">(Active)</span>}
                                                    </label>
                                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-yellow-400 font-mono">
                                                        {count} areas
                                                    </span>
                                                </div>
                                                <input
                                                    type="text"
                                                    defaultValue={currentName}
                                                    placeholder={`e.g. ${levelNum === 1 ? 'Region' : levelNum === 2 ? 'District' : 'Village'}`}
                                                    onBlur={e => handleSaveLevelName(levelNum, e.target.value)}
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter') {
                                                            handleSaveLevelName(levelNum, (e.target as HTMLInputElement).value);
                                                        }
                                                    }}
                                                    className={`text-xs px-2.5 py-1.5 rounded border ${commonInputClasses} ${commonFocusClasses}`}
                                                />
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className="mt-4 pt-3 border-t border-slate-700/60 flex items-center justify-between flex-wrap gap-3">
                                    <div className="flex items-center space-x-3">
                                        <span className="text-xs font-bold text-slate-300">Total Administrative Levels:</span>
                                        <div className="flex items-center space-x-2">
                                            <button
                                                onClick={() => handleUpdateLevelCount((activeCountry.numberOfAdminLevels || 1) - 1)}
                                                disabled={(activeCountry.numberOfAdminLevels || 1) <= 1}
                                                className="px-2.5 py-1 text-xs font-bold rounded border border-slate-700 bg-slate-800 text-slate-200 disabled:opacity-40"
                                            >
                                                - Decrease
                                            </button>
                                            <span className="text-xs font-bold font-mono text-yellow-400 px-2">
                                                {activeCountry.numberOfAdminLevels || 1}
                                            </span>
                                            <button
                                                onClick={() => handleUpdateLevelCount((activeCountry.numberOfAdminLevels || 1) + 1)}
                                                disabled={(activeCountry.numberOfAdminLevels || 1) >= 10}
                                                className="px-2.5 py-1 text-xs font-bold rounded border border-slate-700 bg-slate-800 text-slate-200 disabled:opacity-40"
                                            >
                                                + Add Tier
                                            </button>
                                        </div>
                                    </div>
                                    <span className="text-xs text-slate-400">Clicking on any tier tab below switches the table view</span>
                                </div>
                            </div>
                        )}

                        {/* Level Tab Switcher */}
                        <div className="flex items-center space-x-2 overflow-x-auto pb-2 border-b border-slate-800">
                            {levelTabs.map((tab) => {
                                const isActive = tab.level === safeActiveLevelTab;
                                return (
                                    <button
                                        key={tab.level}
                                        onClick={() => {
                                            setActiveLevelTab(tab.level);
                                            setSelectedParentFilter('all');
                                        }}
                                        className={`px-4 py-2.5 rounded-lg text-xs font-bold transition-all duration-150 flex items-center space-x-2.5 whitespace-nowrap ${
                                            isActive
                                                ? 'bg-yellow-500 text-slate-950 shadow-md font-extrabold ring-1 ring-yellow-400'
                                                : isDarkMode
                                                    ? 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700'
                                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                                        }`}
                                    >
                                        <span className={`px-2 py-0.5 text-[10px] rounded-full font-mono ${
                                            isActive ? 'bg-slate-950 text-yellow-400' : 'bg-slate-900 text-slate-300'
                                        }`}>
                                            L{tab.level}
                                        </span>
                                        <span>{tab.name}</span>
                                        <span className={`text-[11px] px-2 py-0.5 rounded-full ${
                                            isActive ? 'bg-yellow-600/40 text-slate-950 font-black' : 'bg-slate-700/50 text-slate-300'
                                        }`}>
                                            {tab.count}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Filter Bar */}
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                            <div className="flex-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                                <div className="relative flex-1">
                                    <Icon name="search" className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                                    <input
                                        type="text"
                                        value={areaSearchText}
                                        onChange={e => setAreaSearchText(e.target.value)}
                                        placeholder={`Search ${currentTabLevelName} areas...`}
                                        className={`w-full text-xs rounded-lg pl-9 pr-4 py-2 border font-medium ${commonInputClasses} ${commonFocusClasses}`}
                                    />
                                    {areaSearchText && (
                                        <button 
                                            onClick={() => setAreaSearchText('')}
                                            className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-slate-200"
                                        >
                                            ✕
                                        </button>
                                    )}
                                </div>

                                {safeActiveLevelTab > 1 && parentLevelAreas.length > 0 && (
                                    <div className="flex items-center space-x-2">
                                        <label className="text-xs font-bold text-slate-400 whitespace-nowrap">
                                            Filter by {parentLevelTierName}:
                                        </label>
                                        <select
                                            value={selectedParentFilter}
                                            onChange={e => setSelectedParentFilter(e.target.value)}
                                            className={`text-xs rounded-lg border px-3 py-2 font-medium ${commonInputClasses} ${commonFocusClasses}`}
                                        >
                                            <option value="all">All {parentLevelTierName}s ({parentLevelAreas.length})</option>
                                            {parentLevelAreas.map(p => (
                                                <option key={p.id} value={p.id}>{p.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Editable Areas Table */}
                        <div className={`overflow-hidden rounded-xl border ${isDarkMode ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200 bg-white'} shadow-sm`}>
                            <div className="overflow-x-auto">
                                <table className={`min-w-full divide-y ${isDarkMode ? 'divide-slate-800' : 'divide-slate-200'}`}>
                                    <thead className={isDarkMode ? 'bg-slate-800/90' : 'bg-slate-100'}>
                                        <tr>
                                            <th scope="col" className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-400 w-16">
                                                ID
                                            </th>
                                            {safeActiveLevelTab > 1 && (
                                                <th scope="col" className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-yellow-500 w-64">
                                                    Parent Area ({parentLevelTierName})
                                                </th>
                                            )}
                                            <th scope="col" className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-400">
                                                Administrative Area Name ({currentTabLevelName})
                                            </th>
                                            <th scope="col" className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-400 w-36">
                                                Sub-Areas
                                            </th>
                                            <th scope="col" className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-slate-400 w-44">
                                                Actions
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className={`divide-y ${isDarkMode ? 'divide-slate-800 bg-slate-900/40' : 'divide-slate-200 bg-white'}`}>
                                        {filteredTabAreas.length === 0 ? (
                                            <tr>
                                                <td colSpan={safeActiveLevelTab > 1 ? 5 : 4} className="px-6 py-12 text-center text-slate-500 text-sm">
                                                    No areas found. Use the form below to add one.
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredTabAreas.map((area) => {
                                                const childCount = childCountMap.get(area.id) || 0;
                                                return (
                                                    <tr key={area.id} className="hover:bg-slate-800/30 transition-colors">
                                                        <td className="px-4 py-3 whitespace-nowrap text-xs font-mono text-slate-400">
                                                            #{area.id}
                                                        </td>

                                                        {safeActiveLevelTab > 1 && (
                                                            <td className="px-4 py-3 whitespace-nowrap">
                                                                <select
                                                                    id={`area-parent-select-${area.id}`}
                                                                    defaultValue={area.parentAdminLevelId || ''}
                                                                    className={`w-full text-xs rounded-md border px-2.5 py-1.5 font-medium ${commonInputClasses} ${commonFocusClasses}`}
                                                                >
                                                                    <option value="">-- No Parent Selected --</option>
                                                                    {parentLevelAreas.map(p => (
                                                                        <option key={p.id} value={p.id}>{p.name}</option>
                                                                    ))}
                                                                </select>
                                                            </td>
                                                        )}

                                                        <td className="px-4 py-3">
                                                            <input
                                                                id={`area-name-input-${area.id}`}
                                                                type="text"
                                                                defaultValue={area.name}
                                                                className={`w-full text-xs font-semibold rounded-md border px-3 py-1.5 ${commonInputClasses} ${commonFocusClasses}`}
                                                                placeholder="Area Name"
                                                            />
                                                        </td>

                                                        <td className="px-4 py-3 whitespace-nowrap text-xs">
                                                            {safeActiveLevelTab < activeAdminLevelsCount ? (
                                                                <button
                                                                    onClick={() => {
                                                                        setActiveLevelTab(safeActiveLevelTab + 1);
                                                                        setSelectedParentFilter(area.id.toString());
                                                                    }}
                                                                    className="px-2.5 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center space-x-1"
                                                                >
                                                                    <span>{childCount} {nextLevelTierName}</span>
                                                                    <Icon name="chevron-right" className="h-3 w-3" />
                                                                </button>
                                                            ) : (
                                                                <span className="text-xs text-slate-500 italic">Leaf Level</span>
                                                            )}
                                                        </td>

                                                        <td className="px-4 py-3 text-right">
                                                            <div className="flex items-center justify-end space-x-1.5">
                                                                <button
                                                                    onClick={() => handleOpenProfile(area)}
                                                                    className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-yellow-400 border border-slate-700 hover:border-yellow-500 rounded-md font-bold text-xs flex items-center space-x-1 transition-colors"
                                                                    title="View/Edit Complete Profile"
                                                                >
                                                                    <Icon name="eye" className="h-3.5 w-3.5" />
                                                                    <span>Profile</span>
                                                                </button>

                                                                <button
                                                                    onClick={() => {
                                                                        const nameInput = document.getElementById(`area-name-input-${area.id}`) as HTMLInputElement;
                                                                        const parentSelect = document.getElementById(`area-parent-select-${area.id}`) as HTMLSelectElement;
                                                                        const updatedName = nameInput ? nameInput.value.trim() : '';
                                                                        const updatedParentId = parentSelect && parentSelect.value ? parseInt(parentSelect.value, 10) : undefined;
                                                                        if (updatedName) {
                                                                            handleUpdateArea(area.id, updatedName, updatedParentId);
                                                                        }
                                                                    }}
                                                                    className="px-2.5 py-1.5 bg-yellow-500 text-slate-950 rounded-md font-bold text-xs flex items-center space-x-1 hover:bg-yellow-600 transition-colors shadow-sm"
                                                                    title="Save Row Changes"
                                                                >
                                                                    <Icon name="check" className="h-3.5 w-3.5" />
                                                                    <span>Save</span>
                                                                </button>

                                                                <button
                                                                    onClick={() => handleDeleteArea(area.id)}
                                                                    className="px-2.5 py-1.5 bg-red-600/80 hover:bg-red-600 text-white rounded-md font-bold text-xs flex items-center space-x-1 transition-colors"
                                                                    title="Delete Area"
                                                                >
                                                                    <Icon name="trash" className="h-3.5 w-3.5" />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Quick Add Area Form: Parent Area on Left, Area Name on Right */}
                        <div className={`p-5 rounded-xl border ${isDarkMode ? 'bg-slate-800/30 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                            <div className="flex items-center space-x-2 mb-3">
                                <Icon name="plus" className="h-4 w-4 text-yellow-500" />
                                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                                    Add New Area to Level {safeActiveLevelTab} ({currentTabLevelName})
                                </h4>
                            </div>

                            <form onSubmit={handleAddNewArea} className="flex flex-col md:flex-row items-end gap-4">
                                {safeActiveLevelTab > 1 && (
                                    <div className="w-full md:w-80">
                                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                                            Parent Area ({parentLevelTierName || `Level ${safeActiveLevelTab - 1}`})
                                        </label>
                                        <select
                                            value={newAreaParentId}
                                            onChange={e => setNewAreaParentId(e.target.value)}
                                            className={`w-full text-sm rounded-lg border px-3 py-2 font-medium ${commonInputClasses} ${commonFocusClasses}`}
                                        >
                                            <option value="">-- Select Parent Area --</option>
                                            {parentLevelAreas.map(p => (
                                                <option key={p.id} value={p.id}>{p.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                <div className="flex-1 w-full">
                                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                                        Administrative Area Name
                                    </label>
                                    <input
                                        type="text"
                                        value={newAreaName}
                                        onChange={e => setNewAreaName(e.target.value)}
                                        placeholder={`e.g., Central ${currentTabLevelName}`}
                                        className={`w-full text-sm rounded-lg border px-3 py-2 font-medium ${commonInputClasses} ${commonFocusClasses}`}
                                        required
                                    />
                                </div>

                                <button
                                    type="submit"
                                    className="px-5 py-2 bg-yellow-500 hover:bg-yellow-600 text-slate-950 text-sm font-bold rounded-lg flex items-center space-x-1.5 w-full md:w-auto h-10 justify-center shadow transition-colors"
                                >
                                    <Icon name="plus" className="h-4 w-4" />
                                    <span>Add Area</span>
                                </button>
                            </form>
                        </div>
                    </div>
                ) : (
                    /* ------------------------------------------------------------- */
                    /* VIEW 3: MAIN COUNTRIES ADMINISTRATIVE LEVELS DIRECTORY TABLE   */
                    /* ------------------------------------------------------------- */
                    <>
                        <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
                            <div>
                                <h2 className="text-xl font-bold text-slate-100">Country Administrative Levels</h2>
                                <p className={`text-xs mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                                    Click any level cell card in the table to open full hierarchy information, office locations, and leadership profiles.
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                {onNavigate && (
                                    <button 
                                        onClick={() => onNavigate('country-locations-upload')} 
                                        className="flex items-center space-x-2 px-4 py-2 text-sm font-semibold text-slate-100 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md transition-colors"
                                    >
                                        <Icon name="upload" className="h-4 w-4 text-yellow-500" />
                                        <span>Upload Locations</span>
                                    </button>
                                )}
                                <button 
                                    onClick={() => setIsAddAreaModalOpen(true)} 
                                    className="flex items-center space-x-2 px-4 py-2 text-sm font-semibold text-slate-900 bg-yellow-500 rounded-md hover:bg-yellow-600 shadow-sm"
                                >
                                   <Icon name="plus" className="h-4 w-4" />
                                   <span>Add Admin Area</span>
                                </button>
                            </div>
                        </div>

                        {/* Filter Collapsible */}
                        <div className={`${isDarkMode ? 'border-slate-700' : 'border-slate-200'} border rounded-lg mb-6`}>
                            <div className="flex justify-between items-center p-4 cursor-pointer" onClick={() => setIsFilterVisible(!isFilterVisible)}>
                                <div className="flex items-center">
                                    <Icon name="filter" className={`h-5 w-5 mr-3 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} />
                                    <h3 className="font-semibold">Filters</h3>
                                </div>
                                <Icon name="chevron-down" className={`h-5 w-5 text-slate-400 transition-transform duration-300 ${isFilterVisible ? 'rotate-180' : ''}`} />
                            </div>
                            {isFilterVisible && (
                                <div className={`border-t p-4 ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                        <div>
                                            <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>Number of Levels</label>
                                            <select value={levelFilter} onChange={e => setLevelFilter(e.target.value)} className={`w-full text-sm px-3 py-2 rounded-md ${isDarkMode ? 'bg-slate-800 border-slate-600' : 'bg-slate-50 border-slate-300'} border`}>
                                                <option value="">All</option>
                                                {uniqueFilterOptions.levels.map(l => <option key={l} value={l}>{l}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>Countries</label>
                                            <MultiSelectDropdown theme={theme} options={countries.map(c => c.name)} selected={countryFilter} onChange={setCountryFilter} placeholder="Select countries" />
                                        </div>
                                        <div>
                                            <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>Added By</label>
                                            <select value={creatorFilter} onChange={e => setCreatorFilter(e.target.value)} className={`w-full text-sm px-3 py-2 rounded-md ${isDarkMode ? 'bg-slate-800 border-slate-600' : 'bg-slate-50 border-slate-300'} border`}>
                                                <option value="">All</option>
                                                {uniqueFilterOptions.creators.map(c => <option key={c} value={c}>{c}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>Updated By</label>
                                            <select value={updaterFilter} onChange={e => setUpdaterFilter(e.target.value)} className={`w-full text-sm px-3 py-2 rounded-md ${isDarkMode ? 'bg-slate-800 border-slate-600' : 'bg-slate-50 border-slate-300'} border`}>
                                                <option value="">All</option>
                                                {uniqueFilterOptions.updaters.map(u => <option key={u} value={u}>{u}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                    <div className="mt-4 flex justify-end">
                                        <button onClick={handleResetFilters} className={`flex items-center space-x-2 px-4 py-2 text-sm font-medium border rounded-md ${isDarkMode ? 'border-slate-600 text-slate-300 hover:bg-slate-700' : 'border-slate-300 text-slate-700 hover:bg-slate-100'}`}>
                                            <Icon name="refresh" className="h-4 w-4" />
                                            <span>Reset</span>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Country Table */}
                        <div className="overflow-x-auto">
                            <table className={`min-w-full divide-y ${isDarkMode ? 'divide-slate-700' : 'divide-slate-200'}`}>
                                <thead className={isDarkMode ? 'bg-slate-800' : 'bg-slate-50'}>
                                    <tr>
                                        <th scope="col" className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Country</th>
                                        <th scope="col" className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Total Areas</th>
                                        {levelHeaders.map(levelNum => (
                                            <th key={levelNum} scope="col" className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                                                Level {levelNum}
                                            </th>
                                        ))}
                                        <th scope="col" className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody className={`divide-y ${isDarkMode ? 'bg-slate-900 divide-slate-700' : 'bg-white divide-slate-200'}`}>
                                    {filteredCountriesData.map(country => (
                                        <tr key={country.id} className="hover:bg-slate-800/5 transition-colors">
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <div className="flex items-center">
                                                    <FlagIcon countryCode={country.countryCode} countryName={country.name} />
                                                    <span className={`ml-3 font-medium ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>{country.name}</span>
                                                </div>
                                            </td>
                                            <td className={`px-4 py-3 whitespace-nowrap text-sm font-semibold ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                                                {country.totalAreas}
                                            </td>
                                            {levelHeaders.map(levelNum => {
                                                const count = country.levelCounts[levelNum] || 0;
                                                const levelName = country.adminLevelNames?.find(n => n.level === levelNum)?.name;
                                                const isDefinedForCountry = levelNum <= (country.numberOfAdminLevels || 0);
                                                return (
                                                    <td key={levelNum} className="px-3 py-2 whitespace-nowrap text-sm">
                                                        {isDefinedForCountry ? (
                                                            <button
                                                                onClick={() => {
                                                                    setSelectedCountryId(country.id);
                                                                    setActiveLevelTab(levelNum);
                                                                    setSelectedParentFilter('all');
                                                                    setAreaSearchText('');
                                                                    setCurrentPage(1);
                                                                    setViewMode('level-info');
                                                                }}
                                                                className={`group text-left w-full px-2.5 py-1.5 rounded-lg border transition-all duration-150 flex flex-col items-start ${
                                                                    isDarkMode
                                                                        ? 'bg-slate-800/70 hover:bg-yellow-500/10 border-slate-700 hover:border-yellow-500/60 text-slate-200 hover:text-yellow-400'
                                                                        : 'bg-slate-50 hover:bg-yellow-50/80 border-slate-200 hover:border-yellow-400 text-slate-800 hover:text-yellow-700 shadow-sm'
                                                                }`}
                                                                title={`Click to open Level ${levelNum} (${levelName || `Level ${levelNum}`}) info table`}
                                                            >
                                                                <div className="flex items-center justify-between w-full space-x-1">
                                                                    <span className="text-xs font-semibold truncate max-w-[100px]" title={levelName || `Level ${levelNum}`}>
                                                                        {levelName || `Level ${levelNum}`}
                                                                    </span>
                                                                    <Icon name="chevron-right" className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity text-yellow-500" />
                                                                </div>
                                                                <div className="flex items-center space-x-1 mt-0.5">
                                                                    <span className="text-xs font-bold font-mono text-yellow-500">{count}</span>
                                                                    <span className="text-[10px] text-slate-400">areas</span>
                                                                </div>
                                                            </button>
                                                        ) : (
                                                            <span className="text-slate-500 text-xs px-2">-</span>
                                                        )}
                                                    </td>
                                                );
                                            })}
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <div className="flex items-center space-x-1.5">
                                                    <button 
                                                        onClick={() => { 
                                                            setSelectedCountryId(country.id); 
                                                            setViewMode('country-profile');
                                                        }} 
                                                        title="View Country Profile" 
                                                        className={`p-2 rounded-lg border ${
                                                            isDarkMode
                                                                ? 'border-slate-700 bg-slate-800 text-slate-300 hover:text-yellow-400 hover:border-yellow-500'
                                                                : 'border-slate-200 bg-white text-slate-600 hover:text-yellow-600 hover:border-yellow-400'
                                                        } transition-all`}
                                                    >
                                                        <Icon name="view" className="h-4 w-4"/>
                                                    </button>
                                                    <button 
                                                        onClick={() => { 
                                                            setSelectedCountryId(country.id); 
                                                            setActiveLevelTab(1); 
                                                            setSelectedParentFilter('all');
                                                            setAreaSearchText('');
                                                            setViewMode('edit-areas');
                                                        }} 
                                                        title="Edit Country Admin Levels & Hierarchy" 
                                                        className={`p-2 rounded-lg border ${
                                                            isDarkMode
                                                                ? 'border-slate-700 bg-slate-800 text-slate-300 hover:text-yellow-400 hover:border-yellow-500'
                                                                : 'border-slate-200 bg-white text-slate-600 hover:text-yellow-600 hover:border-yellow-400'
                                                        } transition-all`}
                                                    >
                                                        <Icon name="edit" className="h-4 w-4"/>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </div>
        </>
    );
};

export default CountryAdminLevelsPage;
