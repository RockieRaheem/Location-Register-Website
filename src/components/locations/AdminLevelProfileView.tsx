import React, { useState, useEffect } from 'react';
import { Theme, Country, AdminLevel, AdminAreaLeader, AdminAreaOffice } from '../../types';
import Icon from '../shared/Icon';

const FlagIcon: React.FC<{ countryCode: string; countryName: string }> = ({ countryCode, countryName }) => {
    return (
        <img
            src={`https://flagcdn.com/w20/${countryCode.toLowerCase()}.png`}
            alt={`Flag of ${countryName}`}
            className="w-5 h-auto rounded-sm object-cover shadow-xs"
            title={countryName}
            onError={(e) => {
                const target = e.currentTarget;
                target.style.display = 'none';
            }}
        />
    );
};

interface AdminLevelProfileViewProps {
    theme: Theme;
    country: Country;
    area: AdminLevel;
    lineage: AdminLevel[]; // [Level 1 ancestor, Level 2 ancestor, ..., current area]
    childAreas?: AdminLevel[]; // direct sub-areas under this level
    onBack: () => void;
    onSaveArea: (updatedArea: AdminLevel) => Promise<void>;
    onSelectArea: (area: AdminLevel) => void;
    onJumpToChildLevelInTable?: (targetLevel: number, parentId: number) => void;
}

const AdminLevelProfileView: React.FC<AdminLevelProfileViewProps> = ({
    theme,
    country,
    area,
    lineage,
    childAreas = [],
    onBack,
    onSaveArea,
    onSelectArea,
    onJumpToChildLevelInTable
}) => {
    const isDarkMode = theme === 'dark';
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [copyToast, setCopyToast] = useState<string | null>(null);

    // Active Profile Tab: 'office' | 'leaders' | 'subareas'
    const [activeTab, setActiveTab] = useState<'office' | 'leaders' | 'subareas'>('office');

    // Form states for editing
    const [name, setName] = useState(area.name || '');
    const [officeName, setOfficeName] = useState('');
    const [building, setBuilding] = useState('');
    const [street, setStreet] = useState('');
    const [townOrCity, setTownOrCity] = useState('');
    const [postalCode, setPostalCode] = useState('');
    const [officePhone, setOfficePhone] = useState('');
    const [officeEmail, setOfficeEmail] = useState('');
    const [latitude, setLatitude] = useState<string>('');
    const [longitude, setLongitude] = useState<string>('');
    const [workingHours, setWorkingHours] = useState('');
    const [leaders, setLeaders] = useState<AdminAreaLeader[]>([]);

    // New Leader Form state (for adding a leader in edit mode)
    const [isAddingLeader, setIsAddingLeader] = useState(false);
    const [newLeaderName, setNewLeaderName] = useState('');
    const [newLeaderTitle, setNewLeaderTitle] = useState('');
    const [newLeaderPhone, setNewLeaderPhone] = useState('');
    const [newLeaderEmail, setNewLeaderEmail] = useState('');
    const [newLeaderDepartment, setNewLeaderDepartment] = useState('');
    const [newLeaderTerm, setNewLeaderTerm] = useState('2021 - 2026');

    // Populate state when area changes
    useEffect(() => {
        if (area) {
            setName(area.name || '');
            
            // Fallback office defaults if none exists
            const office = area.office || {};
            setOfficeName(office.officeName || `${area.name} Administrative Headquarters`);
            setBuilding(office.building || `${area.name} Local Government Complex`);
            setStreet(office.street || 'Main Civic Highway');
            setTownOrCity(office.townOrCity || area.name);
            setPostalCode(office.postalCode || `P.O. Box 100, ${area.name}`);
            setOfficePhone(office.phone || (country?.phoneCode ? `${country.phoneCode} 414 000 100` : '+256 414 000 100'));
            setOfficeEmail(office.email || `office.${area.name.toLowerCase().replace(/[^a-z0-9]/g, '')}@${country?.countryCode.toLowerCase() || 'gov'}.locationregister.org`);
            setLatitude(office.coordinates?.latitude ? office.coordinates.latitude.toString() : '0.3476');
            setLongitude(office.coordinates?.longitude ? office.coordinates.longitude.toString() : '32.5825');
            setWorkingHours(office.workingHours || 'Monday - Friday: 08:00 AM - 05:00 PM');

            // Default leaders if none exist
            if (area.leaders && area.leaders.length > 0) {
                setLeaders(area.leaders);
            } else {
                const levelName = country?.adminLevelNames?.find(n => n.level === area.level)?.name || `Level ${area.level}`;
                const defaultLeaders: AdminAreaLeader[] = [
                    {
                        id: `ldr-${area.id}-1`,
                        name: `Hon. Administrator ${area.name}`,
                        title: area.level === 1 ? 'Regional Commissioner' : area.level === 2 ? 'District Chairperson (LCV)' : `${levelName} Chairperson`,
                        phone: country?.phoneCode ? `${country.phoneCode} 772 ${100 + area.id} ${200 + area.id}` : '+256 772 100 200',
                        email: `leader.${area.name.toLowerCase().replace(/[^a-z0-9]/g, '')}@gov.org`,
                        term: '2021 - 2026',
                        department: 'Executive Administration',
                        status: 'Active'
                    },
                    {
                        id: `ldr-${area.id}-2`,
                        name: `Eng. Chief Administrative Officer`,
                        title: 'Chief Administrative Officer (CAO)',
                        phone: country?.phoneCode ? `${country.phoneCode} 701 ${110 + area.id} ${220 + area.id}` : '+256 701 110 220',
                        email: `cao.${area.name.toLowerCase().replace(/[^a-z0-9]/g, '')}@gov.org`,
                        term: 'Permanent & Pensionable',
                        department: 'Public Works & Civil Service',
                        status: 'Active'
                    }
                ];
                setLeaders(defaultLeaders);
            }
            setIsEditing(false);
            setIsAddingLeader(false);
        }
    }, [area, country]);

    const handleCopy = (text: string, label: string) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        setCopyToast(`Copied ${label} to clipboard!`);
        setTimeout(() => setCopyToast(null), 2500);
    };

    const handleAddLeader = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newLeaderName.trim() || !newLeaderTitle.trim()) return;

        const newLeader: AdminAreaLeader = {
            id: `ldr-${Date.now()}`,
            name: newLeaderName.trim(),
            title: newLeaderTitle.trim(),
            phone: newLeaderPhone.trim() || (country?.phoneCode ? `${country.phoneCode} 700 000 000` : '+256 700 000 000'),
            email: newLeaderEmail.trim() || `official.${newLeaderName.toLowerCase().replace(/\s+/g, '')}@gov.org`,
            department: newLeaderDepartment.trim() || 'General Administration',
            term: newLeaderTerm.trim() || '2021 - 2026',
            status: 'Active'
        };

        setLeaders(prev => [...prev, newLeader]);
        setNewLeaderName('');
        setNewLeaderTitle('');
        setNewLeaderPhone('');
        setNewLeaderEmail('');
        setNewLeaderDepartment('');
        setIsAddingLeader(false);
    };

    const handleRemoveLeader = (id: string) => {
        setLeaders(prev => prev.filter(l => l.id !== id));
    };

    const handleUpdateLeaderField = (id: string, field: keyof AdminAreaLeader, value: string) => {
        setLeaders(prev => prev.map(l => l.id === id ? { ...l, [field]: value } : l));
    };

    const handleSaveChanges = async () => {
        if (!name.trim()) return;
        setIsSaving(true);
        try {
            const updatedOffice: AdminAreaOffice = {
                officeName: officeName.trim(),
                building: building.trim(),
                street: street.trim(),
                townOrCity: townOrCity.trim(),
                postalCode: postalCode.trim(),
                phone: officePhone.trim(),
                email: officeEmail.trim(),
                workingHours: workingHours.trim(),
                coordinates: {
                    latitude: parseFloat(latitude) || 0,
                    longitude: parseFloat(longitude) || 0
                }
            };

            const updatedArea: AdminLevel = {
                ...area,
                name: name.trim(),
                office: updatedOffice,
                leaders: leaders
            };

            await onSaveArea(updatedArea);
            setIsEditing(false);
        } finally {
            setIsSaving(false);
        }
    };

    // Styling constants
    const cardBg = isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200';
    const cardInnerBg = isDarkMode ? 'bg-slate-950/60 border-slate-800/80' : 'bg-slate-50 border-slate-200/80';
    const textPrimary = isDarkMode ? 'text-slate-100' : 'text-slate-900';
    const textSecondary = isDarkMode ? 'text-slate-400' : 'text-slate-600';
    const inputClass = isDarkMode 
        ? 'bg-slate-950 border-slate-700 text-slate-100 placeholder-slate-500 focus:ring-yellow-500 focus:border-yellow-500' 
        : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:ring-yellow-500 focus:border-yellow-500';

    const currentLevelName = country?.adminLevelNames?.find(n => n.level === area.level)?.name || `Level ${area.level}`;
    const nextLevelName = country?.adminLevelNames?.find(n => n.level === area.level + 1)?.name || `Level ${area.level + 1}`;

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Copy Toast */}
            {copyToast && (
                <div className="fixed top-4 right-4 z-50 flex items-center space-x-2 px-4 py-2 bg-slate-900 text-yellow-400 border border-yellow-500/50 text-xs font-bold rounded-lg shadow-xl animate-fade-in">
                    <Icon name="check" className="h-4 w-4" />
                    <span>{copyToast}</span>
                </div>
            )}

            {/* TOP NAVIGATION & ACTION BAR */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
                {/* Back Button and Hierarchy Breadcrumbs */}
                <div className="space-y-1">
                    <button
                        onClick={onBack}
                        className={`inline-flex items-center space-x-2 text-sm font-semibold hover:opacity-80 transition-opacity ${
                            isDarkMode ? 'text-slate-300' : 'text-slate-700'
                        }`}
                    >
                        <div className="p-1 rounded-md bg-yellow-500/10 text-yellow-500 border border-yellow-500/30">
                            <Icon name="chevron-left" className="h-4 w-4" />
                        </div>
                        <span className="hover:underline">Back to {country.name} Level {area.level} ({currentLevelName}) List</span>
                    </button>

                    {/* Breadcrumbs Trail */}
                    <div className="flex items-center space-x-1.5 text-xs text-slate-400 overflow-x-auto pt-1">
                        <span className="hover:text-yellow-500 cursor-pointer" onClick={onBack}>Country Admin Levels</span>
                        <Icon name="chevron-right" className="h-3 w-3 text-slate-600" />
                        <span className="font-semibold text-slate-300 flex items-center space-x-1">
                            <FlagIcon countryCode={country.countryCode} countryName={country.name} />
                            <span>{country.name}</span>
                        </span>
                        
                        {lineage.map((anc, idx) => {
                            const isLast = idx === lineage.length - 1;
                            const ancLvlName = country.adminLevelNames?.find(n => n.level === anc.level)?.name || `Level ${anc.level}`;
                            return (
                                <React.Fragment key={anc.id}>
                                    <Icon name="chevron-right" className="h-3 w-3 text-slate-600" />
                                    {isLast ? (
                                        <span className="font-bold text-yellow-400">
                                            {anc.name} ({ancLvlName})
                                        </span>
                                    ) : (
                                        <button
                                            onClick={() => onSelectArea(anc)}
                                            className="hover:text-yellow-400 underline decoration-dotted transition-colors"
                                        >
                                            {anc.name} ({ancLvlName})
                                        </button>
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </div>
                </div>

                {/* Right Header Action Buttons */}
                <div className="flex items-center space-x-2.5 flex-shrink-0">
                    {isEditing ? (
                        <>
                            <button
                                onClick={handleSaveChanges}
                                disabled={isSaving}
                                className="px-4 py-2 text-xs font-bold rounded-lg bg-yellow-500 text-slate-950 hover:bg-yellow-600 flex items-center space-x-1.5 shadow transition-colors active:scale-95 disabled:opacity-50"
                            >
                                <Icon name="check" className="h-3.5 w-3.5" />
                                <span>{isSaving ? 'Saving...' : 'Save Profile Changes'}</span>
                            </button>
                            <button
                                onClick={() => setIsEditing(false)}
                                className={`px-3.5 py-2 text-xs font-bold rounded-lg border transition-colors ${
                                    isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700' : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                                }`}
                            >
                                Cancel
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={() => setIsEditing(true)}
                            className="px-4 py-2 text-xs font-bold rounded-lg bg-yellow-500 hover:bg-yellow-600 text-slate-950 flex items-center space-x-1.5 shadow transition-colors"
                        >
                            <Icon name="edit" className="h-3.5 w-3.5" />
                            <span>Edit Level Profile</span>
                        </button>
                    )}

                    <button
                        onClick={onBack}
                        className={`px-3.5 py-2 text-xs font-bold rounded-lg border flex items-center space-x-1.5 transition-colors ${
                            isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                        }`}
                    >
                        <Icon name="lookup-values" className="h-3.5 w-3.5" />
                        <span>All Level {area.level} Areas</span>
                    </button>
                </div>
            </div>

            {/* HERO CARD: AREA TITLE & HIERARCHY BADGES */}
            <div className={`p-6 rounded-2xl border ${cardBg} shadow-sm relative overflow-hidden`}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-2">
                        <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-yellow-500 text-slate-950 shadow-xs">
                                Level {area.level}: {currentLevelName}
                            </span>
                            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold ${
                                isDarkMode ? 'bg-slate-800 text-slate-300 border border-slate-700' : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}>
                                Area ID #{area.id}
                            </span>
                            <span className={`flex items-center space-x-1 text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                                isDarkMode ? 'bg-slate-800/80 text-slate-300 border border-slate-700' : 'bg-slate-100 text-slate-700'
                            }`}>
                                <FlagIcon countryCode={country.countryCode} countryName={country.name} />
                                <span>{country.name}</span>
                            </span>
                        </div>

                        {isEditing ? (
                            <div className="pt-2">
                                <label className="block text-xs font-bold text-slate-400 mb-1">Administrative Area Name</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    className={`text-xl font-bold rounded-lg px-3 py-1.5 border w-full max-w-md ${inputClass}`}
                                    placeholder="Enter administrative area name..."
                                />
                            </div>
                        ) : (
                            <h1 className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${textPrimary}`}>
                                {area.name} <span className="text-sm font-semibold text-yellow-500">({currentLevelName})</span>
                            </h1>
                        )}

                        <p className={`text-xs ${textSecondary} max-w-2xl`}>
                            Official administrative unit profile for <span className="font-semibold text-slate-200">{area.name}</span> under the sovereignty of {country.name}. Managed via the central Location Register.
                        </p>
                    </div>

                    {/* Quick Stats Summary Badges */}
                    <div className="flex items-center gap-3 flex-shrink-0">
                        <div className={`p-3 rounded-xl border text-center min-w-[100px] ${cardInnerBg}`}>
                            <span className="block text-xl font-extrabold text-yellow-400">{leaders.length}</span>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Leaders</span>
                        </div>
                        {childAreas.length > 0 && (
                            <div className={`p-3 rounded-xl border text-center min-w-[100px] ${cardInnerBg}`}>
                                <span className="block text-xl font-extrabold text-emerald-400">{childAreas.length}</span>
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{nextLevelName}s</span>
                            </div>
                        )}
                        <div className={`p-3 rounded-xl border text-center min-w-[100px] ${cardInnerBg}`}>
                            <span className="block text-xl font-extrabold text-blue-400">L{area.level}</span>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Tier Depth</span>
                        </div>
                    </div>
                </div>

                {/* Lineage Path Visualizer */}
                {lineage.length > 1 && (
                    <div className="mt-5 pt-4 border-t border-slate-700/50">
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center space-x-1.5">
                            <Icon name="filter" className="h-3 w-3 text-yellow-500" />
                            <span>Administrative Hierarchy Lineage</span>
                        </p>
                        <div className="flex items-center gap-2 overflow-x-auto pb-1">
                            <div className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center space-x-1.5 flex-shrink-0 ${
                                isDarkMode ? 'bg-slate-950 border-slate-800 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700'
                            }`}>
                                <FlagIcon countryCode={country.countryCode} countryName={country.name} />
                                <span>{country.name} (Nation)</span>
                            </div>
                            
                            {lineage.map((item, idx) => {
                                const isCurrent = item.id === area.id;
                                const itemLevelName = country.adminLevelNames?.find(n => n.level === item.level)?.name || `Level ${item.level}`;
                                return (
                                    <React.Fragment key={item.id}>
                                        <Icon name="chevron-right" className="h-3.5 w-3.5 text-slate-600 flex-shrink-0" />
                                        <button
                                            onClick={() => onSelectArea(item)}
                                            disabled={isCurrent}
                                            className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center space-x-1.5 flex-shrink-0 transition-all ${
                                                isCurrent
                                                    ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/60 font-bold'
                                                    : isDarkMode
                                                        ? 'bg-slate-950 hover:bg-slate-800 border-slate-800 text-slate-300 hover:text-yellow-400'
                                                        : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700 hover:text-yellow-600'
                                            }`}
                                        >
                                            <span className="px-1.5 py-0.2 rounded text-[10px] bg-slate-800 text-slate-400 font-mono">
                                                L{item.level}
                                            </span>
                                            <span>{item.name}</span>
                                            <span className="text-[10px] text-slate-400">({itemLevelName})</span>
                                        </button>
                                    </React.Fragment>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* TAB NAVIGATION: LOCATION FOR OFFICE vs LEADERS CONTACT INFORMATION */}
            <div className="flex border-b border-slate-800 space-x-2 overflow-x-auto pb-0">
                <button
                    onClick={() => setActiveTab('office')}
                    className={`flex items-center space-x-2.5 px-6 py-3.5 text-sm font-bold border-b-2 transition-all cursor-pointer ${
                        activeTab === 'office'
                            ? 'border-yellow-500 text-yellow-400 bg-yellow-500/10 rounded-t-xl'
                            : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
                    }`}
                >
                    <Icon name="map" className="h-4 w-4" />
                    <span>Location for Office</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                        Civic HQ
                    </span>
                </button>

                <button
                    onClick={() => setActiveTab('leaders')}
                    className={`flex items-center space-x-2.5 px-6 py-3.5 text-sm font-bold border-b-2 transition-all cursor-pointer ${
                        activeTab === 'leaders'
                            ? 'border-yellow-500 text-yellow-400 bg-yellow-500/10 rounded-t-xl'
                            : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
                    }`}
                >
                    <Icon name="users" className="h-4 w-4" />
                    <span>Leaders Contact Information</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-mono font-bold ${
                        activeTab === 'leaders' ? 'bg-yellow-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                    }`}>
                        {leaders.length}
                    </span>
                </button>

                {childAreas.length > 0 && (
                    <button
                        onClick={() => setActiveTab('subareas')}
                        className={`flex items-center space-x-2.5 px-6 py-3.5 text-sm font-bold border-b-2 transition-all cursor-pointer ${
                            activeTab === 'subareas'
                                ? 'border-yellow-500 text-yellow-400 bg-yellow-500/10 rounded-t-xl'
                                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
                        }`}
                    >
                        <Icon name="archive" className="h-4 w-4" />
                        <span>Direct Sub-Areas</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-mono font-bold ${
                            activeTab === 'subareas' ? 'bg-yellow-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                        }`}>
                            {childAreas.length}
                        </span>
                    </button>
                )}
            </div>

            {/* TAB CONTENT 1: LOCATION FOR THE OFFICE */}
            {activeTab === 'office' && (
                <div className="space-y-6 animate-fade-in">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        {/* Office Physical & Geographic Details (7 cols) */}
                        <div className="lg:col-span-7 space-y-6">
                            <div className={`p-6 rounded-2xl border ${cardBg} shadow-sm space-y-5`}>
                                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                                    <div className="flex items-center space-x-2">
                                        <div className="p-2 rounded-lg bg-yellow-500/10 text-yellow-500">
                                            <Icon name="map" className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <h2 className={`text-sm font-bold uppercase tracking-wider ${textPrimary}`}>
                                                Location for the Office
                                            </h2>
                                            <p className="text-[11px] text-slate-400">Headquarters & Civic Physical Address Information</p>
                                        </div>
                                    </div>
                                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30">
                                        Verified Location
                                    </span>
                                </div>

                                {/* Office Details */}
                                <div className="space-y-4 text-xs">
                                    {/* Office / Headquarters Name */}
                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                                            Official Headquarters / Complex Name
                                        </label>
                                        {isEditing ? (
                                            <input
                                                type="text"
                                                value={officeName}
                                                onChange={e => setOfficeName(e.target.value)}
                                                className={`w-full text-xs rounded-lg px-3 py-2 border font-medium ${inputClass}`}
                                                placeholder="e.g. Mukono District Headquarters"
                                            />
                                        ) : (
                                            <p className={`font-bold text-base ${textPrimary}`}>
                                                {officeName || `${area.name} Administrative Headquarters`}
                                            </p>
                                        )}
                                    </div>

                                    {/* Building & Street Address */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Building / Floor</label>
                                            {isEditing ? (
                                                <input
                                                    type="text"
                                                    value={building}
                                                    onChange={e => setBuilding(e.target.value)}
                                                    className={`w-full text-xs rounded-lg px-3 py-2 border font-medium ${inputClass}`}
                                                    placeholder="Civic Building, Wing B"
                                                />
                                            ) : (
                                                <p className={`font-semibold text-sm ${textPrimary}`}>{building || `${area.name} Local Government Complex`}</p>
                                            )}
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Street / Highway</label>
                                            {isEditing ? (
                                                <input
                                                    type="text"
                                                    value={street}
                                                    onChange={e => setStreet(e.target.value)}
                                                    className={`w-full text-xs rounded-lg px-3 py-2 border font-medium ${inputClass}`}
                                                    placeholder="Main Civic Road"
                                                />
                                            ) : (
                                                <p className={`font-semibold text-sm ${textPrimary}`}>{street || 'Main Civic Highway'}</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Town/City & Postal Code */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Town / City</label>
                                            {isEditing ? (
                                                <input
                                                    type="text"
                                                    value={townOrCity}
                                                    onChange={e => setTownOrCity(e.target.value)}
                                                    className={`w-full text-xs rounded-lg px-3 py-2 border font-medium ${inputClass}`}
                                                    placeholder={area.name}
                                                />
                                            ) : (
                                                <p className={`font-semibold text-sm ${textPrimary}`}>{townOrCity || area.name}</p>
                                            )}
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Postal Code / P.O. Box</label>
                                            {isEditing ? (
                                                <input
                                                    type="text"
                                                    value={postalCode}
                                                    onChange={e => setPostalCode(e.target.value)}
                                                    className={`w-full text-xs rounded-lg px-3 py-2 border font-medium ${inputClass}`}
                                                    placeholder={`P.O. Box 100, ${area.name}`}
                                                />
                                            ) : (
                                                <p className={`font-semibold text-sm ${textPrimary}`}>{postalCode || `P.O. Box 100, ${area.name}`}</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* GPS Coordinates & Working Hours */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-800">
                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                                                GPS Coordinates (Lat / Long)
                                            </label>
                                            {isEditing ? (
                                                <div className="grid grid-cols-2 gap-2">
                                                    <input
                                                        type="text"
                                                        value={latitude}
                                                        onChange={e => setLatitude(e.target.value)}
                                                        className={`w-full text-xs rounded px-2.5 py-1.5 border ${inputClass}`}
                                                        placeholder="Lat (0.34)"
                                                    />
                                                    <input
                                                        type="text"
                                                        value={longitude}
                                                        onChange={e => setLongitude(e.target.value)}
                                                        className={`w-full text-xs rounded px-2.5 py-1.5 border ${inputClass}`}
                                                        placeholder="Long (32.58)"
                                                    />
                                                </div>
                                            ) : (
                                                <div className="flex items-center space-x-2 text-slate-300 font-mono text-xs">
                                                    <Icon name="map" className="h-4 w-4 text-yellow-500" />
                                                    <span>{latitude || '0.3476'}° N, {longitude || '32.5825'}° E</span>
                                                </div>
                                            )}
                                        </div>

                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Official Working Hours</label>
                                            {isEditing ? (
                                                <input
                                                    type="text"
                                                    value={workingHours}
                                                    onChange={e => setWorkingHours(e.target.value)}
                                                    className={`w-full text-xs rounded px-2.5 py-1.5 border ${inputClass}`}
                                                    placeholder="Mon - Fri: 08:00 AM - 05:00 PM"
                                                />
                                            ) : (
                                                <p className="text-slate-300 font-medium text-xs flex items-center space-x-1.5">
                                                    <Icon name="history" className="h-3.5 w-3.5 text-emerald-400" />
                                                    <span>{workingHours || 'Mon - Fri: 08:00 AM - 05:00 PM'}</span>
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Office Contacts & Civic Channels (5 cols) */}
                        <div className="lg:col-span-5 space-y-6">
                            <div className={`p-6 rounded-2xl border ${cardBg} shadow-sm space-y-4`}>
                                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                                    <div className="flex items-center space-x-2">
                                        <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
                                            <Icon name="phone" className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <h3 className={`text-sm font-bold uppercase tracking-wider ${textPrimary}`}>
                                                Official Office Channels
                                            </h3>
                                            <p className="text-[11px] text-slate-400">Headquarters Communications Desk</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-3.5 text-xs">
                                    {/* Office Telephone */}
                                    <div className={`p-4 rounded-xl border ${cardInnerBg} space-y-2`}>
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                                            Official Civic Telephone
                                        </span>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center space-x-2 min-w-0 pr-2">
                                                <Icon name="phone" className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                                                {isEditing ? (
                                                    <input
                                                        type="text"
                                                        value={officePhone}
                                                        onChange={e => setOfficePhone(e.target.value)}
                                                        className={`w-full text-xs rounded px-2.5 py-1.5 border ${inputClass}`}
                                                        placeholder="+256 414 000 000"
                                                    />
                                                ) : (
                                                    <a 
                                                        href={`tel:${officePhone}`} 
                                                        className="font-bold text-sm text-slate-200 hover:text-yellow-400 truncate"
                                                    >
                                                        {officePhone}
                                                    </a>
                                                )}
                                            </div>
                                            {!isEditing && (
                                                <button
                                                    onClick={() => handleCopy(officePhone, 'Office Phone')}
                                                    className="text-xs text-slate-400 hover:text-yellow-400 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors"
                                                >
                                                    Copy
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Office Email */}
                                    <div className={`p-4 rounded-xl border ${cardInnerBg} space-y-2`}>
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                                            Official Headquarters Email
                                        </span>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center space-x-2 min-w-0 pr-2">
                                                <Icon name="chat-bubble" className="h-4 w-4 text-blue-400 flex-shrink-0" />
                                                {isEditing ? (
                                                    <input
                                                        type="email"
                                                        value={officeEmail}
                                                        onChange={e => setOfficeEmail(e.target.value)}
                                                        className={`w-full text-xs rounded px-2.5 py-1.5 border ${inputClass}`}
                                                        placeholder="office@gov.org"
                                                    />
                                                ) : (
                                                    <a 
                                                        href={`mailto:${officeEmail}`} 
                                                        className="font-bold text-sm text-slate-200 hover:text-blue-400 truncate"
                                                    >
                                                        {officeEmail}
                                                    </a>
                                                )}
                                            </div>
                                            {!isEditing && (
                                                <button
                                                    onClick={() => handleCopy(officeEmail, 'Office Email')}
                                                    className="text-xs text-slate-400 hover:text-blue-400 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors"
                                                >
                                                    Copy
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Quick switch to Leaders Tab */}
                                    <div className="pt-2">
                                        <button
                                            onClick={() => setActiveTab('leaders')}
                                            className="w-full py-2.5 px-4 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-yellow-400 font-bold text-xs flex items-center justify-center space-x-2 transition-colors"
                                        >
                                            <Icon name="users" className="h-4 w-4" />
                                            <span>View {leaders.length} Leaders & Officials</span>
                                            <Icon name="chevron-right" className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB CONTENT 2: LEADERS CONTACT INFORMATION */}
            {activeTab === 'leaders' && (
                <div className="space-y-6 animate-fade-in">
                    <div className={`p-6 rounded-2xl border ${cardBg} shadow-sm space-y-4`}>
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3 flex-wrap gap-2">
                            <div className="flex items-center space-x-2">
                                <div className="p-2 rounded-lg bg-yellow-500/10 text-yellow-500">
                                    <Icon name="users" className="h-5 w-5" />
                                </div>
                                <div>
                                    <h2 className={`text-sm font-bold uppercase tracking-wider ${textPrimary}`}>
                                        Leaders for that Level & Contacts
                                    </h2>
                                    <p className="text-[11px] text-slate-400">
                                        Elected, Appointed & Executive Officials ({leaders.length})
                                    </p>
                                </div>
                            </div>

                            {/* Add Leader Button */}
                            {isEditing && (
                                <button
                                    onClick={() => setIsAddingLeader(!isAddingLeader)}
                                    className="px-3.5 py-1.5 text-xs font-bold bg-yellow-500 hover:bg-yellow-600 text-slate-950 rounded-lg shadow flex items-center space-x-1.5 transition-colors"
                                >
                                    <Icon name={isAddingLeader ? "close" : "plus"} className="h-3.5 w-3.5" />
                                    <span>{isAddingLeader ? 'Cancel Form' : 'Add Official'}</span>
                                </button>
                            )}
                        </div>

                        {/* Add Leader Sub-form (in Edit Mode) */}
                        {isEditing && isAddingLeader && (
                            <form onSubmit={handleAddLeader} className={`p-5 rounded-xl border border-yellow-500/40 ${cardInnerBg} space-y-4 animate-fade-in`}>
                                <div className="flex items-center space-x-2 border-b border-slate-800 pb-2">
                                    <Icon name="plus" className="h-4 w-4 text-yellow-400" />
                                    <h4 className="text-xs font-bold text-yellow-400 uppercase tracking-wider">
                                        Register New Leader / Official
                                    </h4>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-400 mb-1">Full Name *</label>
                                        <input
                                            type="text"
                                            value={newLeaderName}
                                            onChange={e => setNewLeaderName(e.target.value)}
                                            className={`w-full text-xs rounded px-2.5 py-1.5 border ${inputClass}`}
                                            placeholder="e.g. Hon. Sarah Namubiru"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-400 mb-1">Designation / Title *</label>
                                        <input
                                            type="text"
                                            value={newLeaderTitle}
                                            onChange={e => setNewLeaderTitle(e.target.value)}
                                            className={`w-full text-xs rounded px-2.5 py-1.5 border ${inputClass}`}
                                            placeholder="e.g. District Chairperson"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-400 mb-1">Department / Portfolio</label>
                                        <input
                                            type="text"
                                            value={newLeaderDepartment}
                                            onChange={e => setNewLeaderDepartment(e.target.value)}
                                            className={`w-full text-xs rounded px-2.5 py-1.5 border ${inputClass}`}
                                            placeholder="e.g. Executive Administration"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-400 mb-1">Direct Phone</label>
                                        <input
                                            type="text"
                                            value={newLeaderPhone}
                                            onChange={e => setNewLeaderPhone(e.target.value)}
                                            className={`w-full text-xs rounded px-2.5 py-1.5 border ${inputClass}`}
                                            placeholder="+256 700 123 456"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-400 mb-1">Official Email</label>
                                        <input
                                            type="email"
                                            value={newLeaderEmail}
                                            onChange={e => setNewLeaderEmail(e.target.value)}
                                            className={`w-full text-xs rounded px-2.5 py-1.5 border ${inputClass}`}
                                            placeholder="leader@gov.org"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-400 mb-1">Term of Office</label>
                                        <input
                                            type="text"
                                            value={newLeaderTerm}
                                            onChange={e => setNewLeaderTerm(e.target.value)}
                                            className={`w-full text-xs rounded px-2.5 py-1.5 border ${inputClass}`}
                                            placeholder="2021 - 2026"
                                        />
                                    </div>
                                </div>

                                <div className="flex justify-end pt-2">
                                    <button
                                        type="submit"
                                        className="px-5 py-2 text-xs font-bold bg-yellow-500 hover:bg-yellow-600 text-slate-950 rounded-lg shadow transition-colors"
                                    >
                                        Add to Leadership Roster
                                    </button>
                                </div>
                            </form>
                        )}

                        {/* Leaders Cards Roster */}
                        {leaders.length === 0 ? (
                            <div className="py-12 text-center text-slate-400 text-xs">
                                <Icon name="users" className="h-10 w-10 mx-auto text-slate-600 mb-2" />
                                <p className="font-semibold text-sm">No leaders currently assigned for {area.name}.</p>
                                <p className="text-[11px] text-slate-500 mt-1">Click &quot;Edit Level Profile&quot; to assign administrators or chairpersons.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {leaders.map((leader, index) => (
                                    <div
                                        key={leader.id || index}
                                        className={`p-5 rounded-xl border transition-all ${cardInnerBg} space-y-3.5`}
                                    >
                                        {/* Leader Header */}
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex items-start space-x-3.5 min-w-0">
                                                <div className="w-11 h-11 rounded-xl bg-yellow-500/20 border border-yellow-500/40 text-yellow-400 font-extrabold flex items-center justify-center text-sm flex-shrink-0">
                                                    {leader.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                                                </div>
                                                <div className="min-w-0">
                                                    {isEditing ? (
                                                        <div className="space-y-1">
                                                            <input
                                                                type="text"
                                                                value={leader.name}
                                                                onChange={e => handleUpdateLeaderField(leader.id, 'name', e.target.value)}
                                                                className={`text-xs font-bold rounded px-2 py-1 border ${inputClass}`}
                                                                placeholder="Leader Full Name"
                                                            />
                                                            <input
                                                                type="text"
                                                                value={leader.title}
                                                                onChange={e => handleUpdateLeaderField(leader.id, 'title', e.target.value)}
                                                                className={`text-[11px] rounded px-2 py-0.5 border ${inputClass}`}
                                                                placeholder="Official Designation"
                                                            />
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <h4 className={`text-sm font-bold truncate ${textPrimary}`}>
                                                                {leader.name}
                                                            </h4>
                                                            <p className="text-xs font-semibold text-yellow-400 truncate">
                                                                {leader.title}
                                                            </p>
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex items-center space-x-2 flex-shrink-0">
                                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                                    {leader.status || 'Active'}
                                                </span>
                                                {isEditing && (
                                                    <button
                                                        onClick={() => handleRemoveLeader(leader.id)}
                                                        className="p-1 rounded text-red-400 hover:text-red-300 hover:bg-red-950/50 border border-red-800"
                                                        title="Remove Leader"
                                                    >
                                                        <Icon name="trash" className="h-3.5 w-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Leader Department & Term info */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-800">
                                            <div>
                                                <span className="text-[10px] font-bold uppercase text-slate-400 block">Department</span>
                                                {isEditing ? (
                                                    <input
                                                        type="text"
                                                        value={leader.department || ''}
                                                        onChange={e => handleUpdateLeaderField(leader.id, 'department', e.target.value)}
                                                        className={`w-full text-xs rounded px-2 py-0.5 border ${inputClass}`}
                                                    />
                                                ) : (
                                                    <span className="text-slate-300 font-medium">{leader.department || 'Executive Administration'}</span>
                                                )}
                                            </div>

                                            <div>
                                                <span className="text-[10px] font-bold uppercase text-slate-400 block">Term of Office</span>
                                                {isEditing ? (
                                                    <input
                                                        type="text"
                                                        value={leader.term || ''}
                                                        onChange={e => handleUpdateLeaderField(leader.id, 'term', e.target.value)}
                                                        className={`w-full text-xs rounded px-2 py-0.5 border ${inputClass}`}
                                                    />
                                                ) : (
                                                    <span className="text-slate-300 font-medium">{leader.term || '2021 - 2026'}</span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Leader Contacts: Phone & Email */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-800 text-xs">
                                            {/* Phone */}
                                            <div className="flex items-center justify-between bg-slate-950/60 px-2.5 py-1.5 rounded-lg border border-slate-800">
                                                <div className="flex items-center space-x-1.5 min-w-0 pr-1">
                                                    <Icon name="phone" className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
                                                    {isEditing ? (
                                                        <input
                                                            type="text"
                                                            value={leader.phone}
                                                            onChange={e => handleUpdateLeaderField(leader.id, 'phone', e.target.value)}
                                                            className={`text-xs rounded px-1.5 py-0.5 border ${inputClass}`}
                                                        />
                                                    ) : (
                                                        <a 
                                                            href={`tel:${leader.phone}`}
                                                            className="text-[11px] font-medium text-slate-300 hover:text-yellow-400 truncate"
                                                        >
                                                            {leader.phone}
                                                        </a>
                                                    )}
                                                </div>
                                                {!isEditing && (
                                                    <button
                                                        onClick={() => handleCopy(leader.phone, `${leader.name}'s Phone`)}
                                                        className="text-[10px] text-slate-400 hover:text-yellow-400 px-1.5 py-0.5 rounded bg-slate-800 flex-shrink-0"
                                                    >
                                                        Copy
                                                    </button>
                                                )}
                                            </div>

                                            {/* Email */}
                                            <div className="flex items-center justify-between bg-slate-950/60 px-2.5 py-1.5 rounded-lg border border-slate-800">
                                                <div className="flex items-center space-x-1.5 min-w-0 pr-1">
                                                    <Icon name="chat-bubble" className="h-3.5 w-3.5 text-blue-400 flex-shrink-0" />
                                                    {isEditing ? (
                                                        <input
                                                            type="email"
                                                            value={leader.email}
                                                            onChange={e => handleUpdateLeaderField(leader.id, 'email', e.target.value)}
                                                            className={`text-xs rounded px-1.5 py-0.5 border ${inputClass}`}
                                                        />
                                                    ) : (
                                                        <a 
                                                            href={`mailto:${leader.email}`} 
                                                            className="text-[11px] font-medium text-slate-300 hover:text-blue-400 truncate"
                                                        >
                                                            {leader.email}
                                                        </a>
                                                    )}
                                                </div>
                                                {!isEditing && (
                                                    <button
                                                        onClick={() => handleCopy(leader.email, `${leader.name}'s Email`)}
                                                        className="text-[10px] text-slate-400 hover:text-blue-400 px-1.5 py-0.5 rounded bg-slate-800 flex-shrink-0"
                                                    >
                                                        Copy
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* TAB CONTENT 3: DIRECT SUB-AREAS */}
            {activeTab === 'subareas' && childAreas.length > 0 && (
                <div className="space-y-6 animate-fade-in">
                    <div className={`p-6 rounded-2xl border ${cardBg} shadow-sm space-y-4`}>
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                            <div className="flex items-center space-x-2">
                                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
                                    <Icon name="archive" className="h-5 w-5" />
                                </div>
                                <div>
                                    <h3 className={`text-sm font-bold uppercase tracking-wider ${textPrimary}`}>
                                        Direct Sub-Areas ({childAreas.length} {nextLevelName}s)
                                    </h3>
                                    <p className="text-[11px] text-slate-400">Level {area.level + 1} entities reporting to {area.name}</p>
                                </div>
                            </div>
                            {onJumpToChildLevelInTable && (
                                <button
                                    onClick={() => onJumpToChildLevelInTable(area.level + 1, area.id)}
                                    className="text-xs font-bold text-yellow-400 hover:text-yellow-300 hover:underline flex items-center space-x-1"
                                >
                                    <span>Open in Table</span>
                                    <Icon name="chevron-right" className="h-3.5 w-3.5" />
                                </button>
                            )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {childAreas.map(child => (
                                <button
                                    key={child.id}
                                    onClick={() => onSelectArea(child)}
                                    className={`p-4 rounded-xl border text-left flex items-center justify-between transition-all group ${
                                        isDarkMode
                                            ? 'bg-slate-950/70 hover:bg-yellow-500/10 border-slate-800 hover:border-yellow-500/60 text-slate-200'
                                            : 'bg-slate-50 hover:bg-yellow-50 border-slate-200 hover:border-yellow-400 text-slate-800'
                                    }`}
                                >
                                    <div className="min-w-0 pr-2">
                                        <p className="text-xs font-bold truncate group-hover:text-yellow-400 transition-colors">
                                            {child.name}
                                        </p>
                                        <span className="text-[10px] text-slate-400 font-mono">
                                            Level {child.level} • ID #{child.id}
                                        </span>
                                    </div>
                                    <div className="p-1.5 rounded-lg bg-slate-800 group-hover:bg-yellow-500 group-hover:text-slate-950 text-slate-400 transition-colors">
                                        <Icon name="chevron-right" className="h-3.5 w-3.5" />
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* BOTTOM BAR WITH BACK BUTTON */}
            <div className={`p-4 rounded-xl border flex flex-col sm:flex-row items-center justify-between gap-3 ${cardBg}`}>
                <button
                    onClick={onBack}
                    className={`px-4 py-2 text-xs font-bold rounded-lg border flex items-center space-x-2 transition-all hover:scale-102 ${
                        isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
                    }`}
                >
                    <Icon name="chevron-left" className="h-4 w-4 text-yellow-500" />
                    <span>Back to Level {area.level} ({currentLevelName}) Table</span>
                </button>

                <div className="flex items-center space-x-2 text-xs text-slate-400">
                    <span>Administrative hierarchy management for {country.name}</span>
                </div>
            </div>
        </div>
    );
};

export default AdminLevelProfileView;
