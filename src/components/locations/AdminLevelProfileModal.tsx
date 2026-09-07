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
        />
    );
};

interface AdminLevelProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    area: AdminLevel | null;
    country: Country | null;
    lineage: AdminLevel[]; // [Level 1 ancestor, Level 2 ancestor, ..., current area]
    childAreas?: AdminLevel[]; // direct sub-areas under this level
    onSaveArea?: (updatedArea: AdminLevel) => Promise<void>;
    onSelectChildArea?: (childArea: AdminLevel) => void;
    theme: Theme;
}

const AdminLevelProfileModal: React.FC<AdminLevelProfileModalProps> = ({
    isOpen,
    onClose,
    area,
    country,
    lineage,
    childAreas = [],
    onSaveArea,
    onSelectChildArea,
    theme
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [copyToast, setCopyToast] = useState<string | null>(null);

    // Form states for editing
    const [name, setName] = useState('');
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

    // New Leader Form state (for adding a leader)
    const [isAddingLeader, setIsAddingLeader] = useState(false);
    const [newLeaderName, setNewLeaderName] = useState('');
    const [newLeaderTitle, setNewLeaderTitle] = useState('');
    const [newLeaderPhone, setNewLeaderPhone] = useState('');
    const [newLeaderEmail, setNewLeaderEmail] = useState('');
    const [newLeaderDepartment, setNewLeaderDepartment] = useState('');
    const [newLeaderTerm, setNewLeaderTerm] = useState('2021 - 2026');

    // Populate state when modal opens or area changes
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
                // Generate default leadership placeholders appropriate for this level
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
                        name: `Dr. Chief Executive ${area.name}`,
                        title: area.level === 1 ? 'Regional Development Officer' : area.level === 2 ? 'Chief Administrative Officer (CAO)' : 'Assistant Secretary',
                        phone: country?.phoneCode ? `${country.phoneCode} 701 ${150 + area.id} ${300 + area.id}` : '+256 701 150 300',
                        email: `admin.${area.name.toLowerCase().replace(/[^a-z0-9]/g, '')}@gov.org`,
                        term: '2022 - 2027',
                        department: 'General Operations',
                        status: 'Active'
                    }
                ];
                setLeaders(defaultLeaders);
            }

            setIsEditing(false);
            setIsAddingLeader(false);
        }
    }, [area, country, isOpen]);

    if (!isOpen || !area || !country) return null;

    const currentLevelName = country.adminLevelNames?.find(n => n.level === area.level)?.name || `Level ${area.level}`;
    const nextLevelName = country.adminLevelNames?.find(n => n.level === area.level + 1)?.name || `Level ${area.level + 1}`;

    const handleCopy = (text: string, label: string) => {
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
            phone: newLeaderPhone.trim() || (country.phoneCode ? `${country.phoneCode} 700 000 000` : ''),
            email: newLeaderEmail.trim() || `${newLeaderName.toLowerCase().replace(/\s+/g, '.')}@gov.org`,
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

    const handleRemoveLeader = (leaderId: string) => {
        setLeaders(prev => prev.filter(l => l.id !== leaderId));
    };

    const handleUpdateLeaderField = (leaderId: string, field: keyof AdminAreaLeader, value: string) => {
        setLeaders(prev => prev.map(l => l.id === leaderId ? { ...l, [field]: value } : l));
    };

    const handleSaveChanges = async () => {
        if (!onSaveArea || !area) return;
        setIsSaving(true);

        const latNum = parseFloat(latitude);
        const lngNum = parseFloat(longitude);

        const updatedOffice: AdminAreaOffice = {
            officeName: officeName.trim(),
            building: building.trim(),
            street: street.trim(),
            townOrCity: townOrCity.trim(),
            postalCode: postalCode.trim(),
            phone: officePhone.trim(),
            email: officeEmail.trim(),
            coordinates: (!isNaN(latNum) && !isNaN(lngNum)) ? { latitude: latNum, longitude: lngNum } : undefined,
            workingHours: workingHours.trim()
        };

        const updatedArea: AdminLevel = {
            ...area,
            name: name.trim() || area.name,
            office: updatedOffice,
            leaders: leaders
        };

        try {
            await onSaveArea(updatedArea);
            setIsEditing(false);
            setCopyToast('Profile details successfully saved to database!');
            setTimeout(() => setCopyToast(null), 3000);
        } catch (err) {
            console.error('Failed to save area profile', err);
        } finally {
            setIsSaving(false);
        }
    };

    const isDarkMode = theme === 'dark';
    const cardBg = isDarkMode ? 'bg-slate-800/80 border-slate-700/80' : 'bg-slate-50 border-slate-200';
    const subCardBg = isDarkMode ? 'bg-slate-900/70 border-slate-800' : 'bg-white border-slate-200';
    const textPrimary = isDarkMode ? 'text-slate-100' : 'text-slate-900';
    const textMuted = isDarkMode ? 'text-slate-400' : 'text-slate-500';
    const inputClasses = `w-full text-xs font-medium rounded-lg border px-3 py-2 ${
        isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-100 placeholder-slate-500' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
    } focus:outline-none focus:ring-1 focus:ring-yellow-500 focus:border-yellow-500`;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-3 sm:p-5 overflow-y-auto animate-fade-in">
            {/* Copy Feedback Toast */}
            {copyToast && (
                <div className="fixed top-6 right-6 z-50 flex items-center space-x-2 px-4 py-2.5 bg-emerald-600 text-white text-xs font-bold rounded-lg shadow-2xl animate-fade-in">
                    <Icon name="check-circle" className="h-4 w-4 text-white" />
                    <span>{copyToast}</span>
                </div>
            )}

            <div 
                className={`relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl shadow-2xl border ${
                    isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
                } overflow-hidden`}
                onClick={e => e.stopPropagation()}
            >
                {/* Modal Header */}
                <div className={`px-6 py-4 border-b flex items-center justify-between gap-4 ${isDarkMode ? 'bg-slate-800/90 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="flex items-center space-x-3 min-w-0">
                        <div className="p-2 bg-slate-950/40 rounded-xl border border-slate-700/50 shadow-inner flex-shrink-0">
                            <FlagIcon countryCode={country.countryCode} countryName={country.name} />
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                                {isEditing ? (
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={e => setName(e.target.value)}
                                        className="text-lg font-bold px-2 py-0.5 rounded border border-yellow-500 bg-slate-950 text-white focus:outline-none"
                                        placeholder="Area Name"
                                    />
                                ) : (
                                    <h2 className="text-xl font-extrabold truncate text-yellow-500">
                                        {area.name}
                                    </h2>
                                )}
                                <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/40 whitespace-nowrap">
                                    Level {area.level}: {currentLevelName}
                                </span>
                                <span className="text-xs px-2 py-0.5 rounded bg-slate-700/60 text-slate-300 font-mono">
                                    ID #{area.id}
                                </span>
                            </div>

                            {/* Lineage Breadcrumbs */}
                            <div className="flex items-center space-x-1.5 text-xs text-slate-400 mt-1 truncate">
                                <span className="font-semibold text-slate-300">{country.name}</span>
                                {lineage.map((anc, idx) => (
                                    <React.Fragment key={anc.id}>
                                        <span>›</span>
                                        <span className={idx === lineage.length - 1 ? 'font-bold text-yellow-400' : 'text-slate-400'}>
                                            {anc.name}
                                        </span>
                                    </React.Fragment>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Header Action Buttons */}
                    <div className="flex items-center space-x-2 flex-shrink-0">
                        {isEditing ? (
                            <div className="flex items-center space-x-2">
                                <button
                                    onClick={() => setIsEditing(false)}
                                    className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-800 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveChanges}
                                    disabled={isSaving}
                                    className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-yellow-500 text-slate-950 hover:bg-yellow-600 flex items-center space-x-1.5 shadow transition-colors"
                                >
                                    <Icon name="check" className="h-3.5 w-3.5" />
                                    <span>{isSaving ? 'Saving...' : 'Save Profile'}</span>
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => setIsEditing(true)}
                                className={`px-3 py-1.5 text-xs font-bold rounded-lg border flex items-center space-x-1.5 transition-all ${
                                    isDarkMode 
                                        ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-600 hover:border-yellow-500' 
                                        : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300 hover:border-yellow-500'
                                }`}
                            >
                                <Icon name="edit" className="h-3.5 w-3.5 text-yellow-500" />
                                <span>Edit Profile</span>
                            </button>
                        )}

                        <button
                            onClick={onClose}
                            className={`p-2 rounded-lg text-slate-400 hover:text-slate-100 ${isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-100'} transition-colors`}
                            title="Close modal"
                        >
                            <Icon name="x-mark" className="h-5 w-5" />
                        </button>
                    </div>
                </div>

                {/* Modal Body (Scrollable) */}
                <div className="flex-1 p-6 space-y-6 overflow-y-auto">
                    {/* Top Highlights Banner */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className={`p-4 rounded-xl border ${cardBg} flex items-center space-x-3 shadow-xs`}>
                            <div className="p-2.5 rounded-lg bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">
                                <Icon name="map" className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                                <span className={`text-[10px] font-bold uppercase tracking-wider ${textMuted}`}>HQ Location</span>
                                <p className={`text-xs font-bold truncate ${textPrimary}`} title={townOrCity || area.name}>
                                    {townOrCity || area.name}, {country.countryCode}
                                </p>
                            </div>
                        </div>

                        <div className={`p-4 rounded-xl border ${cardBg} flex items-center space-x-3 shadow-xs`}>
                            <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                <Icon name="user-circle" className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                                <span className={`text-[10px] font-bold uppercase tracking-wider ${textMuted}`}>Key Leaders</span>
                                <p className={`text-xs font-bold ${textPrimary}`}>
                                    {leaders.length} Official{leaders.length === 1 ? '' : 's'} Assigned
                                </p>
                            </div>
                        </div>

                        <div className={`p-4 rounded-xl border ${cardBg} flex items-center space-x-3 shadow-xs`}>
                            <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                <Icon name="archive" className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                                <span className={`text-[10px] font-bold uppercase tracking-wider ${textMuted}`}>Sub-Areas</span>
                                <p className={`text-xs font-bold ${textPrimary}`}>
                                    {childAreas.length} {nextLevelName}{childAreas.length === 1 ? '' : 's'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* SECTION 1: LOCATION FOR THE OFFICE */}
                    <div className={`p-5 rounded-xl border ${cardBg} space-y-4`}>
                        <div className="flex items-center justify-between border-b border-slate-700/50 pb-3">
                            <div className="flex items-center space-x-2.5">
                                <div className="p-1.5 rounded-md bg-yellow-500/20 text-yellow-500">
                                    <Icon name="map" className="h-4 w-4" />
                                </div>
                                <h3 className={`text-sm font-bold uppercase tracking-wider ${textPrimary}`}>
                                    Location for the Office & Headquarters
                                </h3>
                            </div>
                            <span className="text-[11px] font-semibold text-yellow-500/90">
                                Official Administrative Desk
                            </span>
                        </div>

                        {isEditing ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className={`block text-[11px] font-bold uppercase ${textMuted}`}>Office / Headquarters Name</label>
                                    <input
                                        type="text"
                                        value={officeName}
                                        onChange={e => setOfficeName(e.target.value)}
                                        className={inputClasses}
                                        placeholder="e.g. Mukono District Local Government Headquarters"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className={`block text-[11px] font-bold uppercase ${textMuted}`}>Building / Floor / Complex</label>
                                    <input
                                        type="text"
                                        value={building}
                                        onChange={e => setBuilding(e.target.value)}
                                        className={inputClasses}
                                        placeholder="e.g. District Administration Block, 2nd Floor"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className={`block text-[11px] font-bold uppercase ${textMuted}`}>Street / Road / Highway</label>
                                    <input
                                        type="text"
                                        value={street}
                                        onChange={e => setStreet(e.target.value)}
                                        className={inputClasses}
                                        placeholder="e.g. Plot 14 Jinja-Kampala Highway"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className={`block text-[11px] font-bold uppercase ${textMuted}`}>Town / City & Postal Code</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <input
                                            type="text"
                                            value={townOrCity}
                                            onChange={e => setTownOrCity(e.target.value)}
                                            className={inputClasses}
                                            placeholder="Town or City"
                                        />
                                        <input
                                            type="text"
                                            value={postalCode}
                                            onChange={e => setPostalCode(e.target.value)}
                                            className={inputClasses}
                                            placeholder="Postal Code / P.O. Box"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className={`block text-[11px] font-bold uppercase ${textMuted}`}>Office Official Phone</label>
                                    <input
                                        type="text"
                                        value={officePhone}
                                        onChange={e => setOfficePhone(e.target.value)}
                                        className={inputClasses}
                                        placeholder="+256 414 000 000"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className={`block text-[11px] font-bold uppercase ${textMuted}`}>Office Official Email</label>
                                    <input
                                        type="email"
                                        value={officeEmail}
                                        onChange={e => setOfficeEmail(e.target.value)}
                                        className={inputClasses}
                                        placeholder="office@gov.org"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className={`block text-[11px] font-bold uppercase ${textMuted}`}>GPS Coordinates (Lat / Long)</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <input
                                            type="text"
                                            value={latitude}
                                            onChange={e => setLatitude(e.target.value)}
                                            className={inputClasses}
                                            placeholder="Latitude (e.g. 0.3476)"
                                        />
                                        <input
                                            type="text"
                                            value={longitude}
                                            onChange={e => setLongitude(e.target.value)}
                                            className={inputClasses}
                                            placeholder="Longitude (e.g. 32.5825)"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className={`block text-[11px] font-bold uppercase ${textMuted}`}>Working Hours</label>
                                    <input
                                        type="text"
                                        value={workingHours}
                                        onChange={e => setWorkingHours(e.target.value)}
                                        className={inputClasses}
                                        placeholder="e.g. Monday - Friday: 08:00 AM - 05:00 PM"
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Left column: Physical Address */}
                                <div className={`p-4 rounded-lg border ${subCardBg} space-y-2.5`}>
                                    <span className="text-[11px] font-bold tracking-wider uppercase text-yellow-500 flex items-center space-x-1.5">
                                        <Icon name="map" className="h-3.5 w-3.5" />
                                        <span>Physical Office Address</span>
                                    </span>
                                    <div>
                                        <h4 className={`text-sm font-extrabold ${textPrimary}`}>
                                            {officeName || `${area.name} Administrative Headquarters`}
                                        </h4>
                                        <p className={`text-xs mt-0.5 ${textMuted}`}>
                                            {building || `${area.name} Administration Complex`}
                                        </p>
                                        <p className={`text-xs ${textMuted}`}>
                                            {street || 'Civic Administrative Way'}
                                        </p>
                                        <p className={`text-xs font-semibold ${textPrimary} mt-1`}>
                                            {townOrCity || area.name}, {postalCode || 'P.O. Box 100'}
                                        </p>
                                    </div>

                                    {/* GPS badge and Google Maps link */}
                                    <div className="pt-2 border-t border-slate-700/40 flex items-center justify-between flex-wrap gap-2">
                                        <div className="flex items-center space-x-1.5 text-[11px] text-slate-300 font-mono">
                                            <span className="text-yellow-500 font-bold">GPS:</span>
                                            <span>{latitude || '0.3476'}, {longitude || '32.5825'}</span>
                                        </div>
                                        <button
                                            onClick={() => handleCopy(`${latitude || '0.3476'}, ${longitude || '32.5825'}`, 'GPS Coordinates')}
                                            className="text-[11px] font-semibold text-yellow-500 hover:underline flex items-center space-x-1"
                                        >
                                            <Icon name="template" className="h-3 w-3" />
                                            <span>Copy Pin</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Right column: Contact & Public Hours */}
                                <div className={`p-4 rounded-lg border ${subCardBg} space-y-2.5`}>
                                    <span className="text-[11px] font-bold tracking-wider uppercase text-blue-400 flex items-center space-x-1.5">
                                        <Icon name="phone" className="h-3.5 w-3.5" />
                                        <span>Direct Office Communication</span>
                                    </span>

                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center space-x-2">
                                                <Icon name="phone" className="h-3.5 w-3.5 text-yellow-500 flex-shrink-0" />
                                                <a 
                                                    href={`tel:${officePhone}`} 
                                                    className="text-xs font-semibold text-slate-200 hover:text-yellow-400 transition-colors"
                                                >
                                                    {officePhone || '+256 414 000 100'}
                                                </a>
                                            </div>
                                            <button
                                                onClick={() => handleCopy(officePhone, 'Office Phone')}
                                                className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 hover:text-yellow-400"
                                            >
                                                Copy
                                            </button>
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center space-x-2 min-w-0">
                                                <Icon name="chat-bubble" className="h-3.5 w-3.5 text-blue-400 flex-shrink-0" />
                                                <a 
                                                    href={`mailto:${officeEmail}`} 
                                                    className="text-xs font-semibold text-slate-200 hover:text-blue-400 truncate transition-colors"
                                                >
                                                    {officeEmail || `office.${area.name.toLowerCase()}@gov.org`}
                                                </a>
                                            </div>
                                            <button
                                                onClick={() => handleCopy(officeEmail, 'Office Email')}
                                                className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 hover:text-blue-400 flex-shrink-0"
                                            >
                                                Copy
                                            </button>
                                        </div>

                                        <div className="pt-2 border-t border-slate-700/40 flex items-center space-x-2 text-xs text-slate-300">
                                            <Icon name="calendar" className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
                                            <span className="text-[11px]">
                                                {workingHours || 'Monday - Friday: 08:00 AM - 05:00 PM'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* SECTION 2: LEADERS FOR THAT LEVEL AND THEIR CONTACT */}
                    <div className={`p-5 rounded-xl border ${cardBg} space-y-4`}>
                        <div className="flex items-center justify-between border-b border-slate-700/50 pb-3 flex-wrap gap-2">
                            <div className="flex items-center space-x-2.5">
                                <div className="p-1.5 rounded-md bg-blue-500/20 text-blue-400">
                                    <Icon name="users" className="h-4 w-4" />
                                </div>
                                <div>
                                    <h3 className={`text-sm font-bold uppercase tracking-wider ${textPrimary}`}>
                                        Leaders for Level {area.level} ({currentLevelName}) & Contacts
                                    </h3>
                                    <p className={`text-[11px] ${textMuted}`}>
                                        Elected representatives, administrative commissioners, and senior executives
                                    </p>
                                </div>
                            </div>

                            <button
                                onClick={() => setIsAddingLeader(!isAddingLeader)}
                                className="flex items-center space-x-1.5 px-3 py-1.5 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 border border-yellow-500/40 rounded-lg text-xs font-bold transition-all"
                            >
                                <Icon name="plus" className="h-3.5 w-3.5" />
                                <span>{isAddingLeader ? 'Cancel Leader' : 'Add Leader / Official'}</span>
                            </button>
                        </div>

                        {/* Quick Add Leader Form */}
                        {isAddingLeader && (
                            <form onSubmit={handleAddLeader} className={`p-4 rounded-lg border ${subCardBg} space-y-3 animate-fade-in`}>
                                <h4 className="text-xs font-bold uppercase tracking-wider text-yellow-400">
                                    New Leader Registration
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                    <div>
                                        <label className={`block text-[10px] font-bold uppercase ${textMuted} mb-1`}>Full Name *</label>
                                        <input
                                            type="text"
                                            value={newLeaderName}
                                            onChange={e => setNewLeaderName(e.target.value)}
                                            placeholder="e.g. Hon. Grace Namakula"
                                            className={inputClasses}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className={`block text-[10px] font-bold uppercase ${textMuted} mb-1`}>Title / Designation *</label>
                                        <input
                                            type="text"
                                            value={newLeaderTitle}
                                            onChange={e => setNewLeaderTitle(e.target.value)}
                                            placeholder="e.g. District Chairperson (LCV)"
                                            className={inputClasses}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className={`block text-[10px] font-bold uppercase ${textMuted} mb-1`}>Phone Contact</label>
                                        <input
                                            type="text"
                                            value={newLeaderPhone}
                                            onChange={e => setNewLeaderPhone(e.target.value)}
                                            placeholder="+256 772 123 456"
                                            className={inputClasses}
                                        />
                                    </div>
                                    <div>
                                        <label className={`block text-[10px] font-bold uppercase ${textMuted} mb-1`}>Official Email</label>
                                        <input
                                            type="email"
                                            value={newLeaderEmail}
                                            onChange={e => setNewLeaderEmail(e.target.value)}
                                            placeholder="official@gov.org"
                                            className={inputClasses}
                                        />
                                    </div>
                                    <div>
                                        <label className={`block text-[10px] font-bold uppercase ${textMuted} mb-1`}>Department / Bureau</label>
                                        <input
                                            type="text"
                                            value={newLeaderDepartment}
                                            onChange={e => setNewLeaderDepartment(e.target.value)}
                                            placeholder="e.g. Local Council Executive"
                                            className={inputClasses}
                                        />
                                    </div>
                                    <div>
                                        <label className={`block text-[10px] font-bold uppercase ${textMuted} mb-1`}>Term of Office</label>
                                        <input
                                            type="text"
                                            value={newLeaderTerm}
                                            onChange={e => setNewLeaderTerm(e.target.value)}
                                            placeholder="e.g. 2021 - 2026"
                                            className={inputClasses}
                                        />
                                    </div>
                                </div>
                                <div className="flex justify-end space-x-2 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setIsAddingLeader(false)}
                                        className="px-3 py-1.5 text-xs font-semibold rounded border border-slate-700 text-slate-300"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-4 py-1.5 text-xs font-bold rounded bg-yellow-500 text-slate-950 hover:bg-yellow-600 flex items-center space-x-1"
                                    >
                                        <Icon name="plus" className="h-3.5 w-3.5" />
                                        <span>Add Leader to List</span>
                                    </button>
                                </div>
                            </form>
                        )}

                        {/* Leaders Grid / List */}
                        {leaders.length === 0 ? (
                            <div className="p-8 text-center border border-dashed border-slate-700 rounded-xl">
                                <Icon name="users" className="h-8 w-8 mx-auto text-slate-500 mb-2" />
                                <p className="text-xs text-slate-400">No leaders recorded for this level area yet.</p>
                                <button
                                    onClick={() => setIsAddingLeader(true)}
                                    className="mt-3 px-3 py-1.5 text-xs font-bold rounded-lg bg-yellow-500 text-slate-950 hover:bg-yellow-600"
                                >
                                    Add First Leader
                                </button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                                {leaders.map((leader, idx) => (
                                    <div 
                                        key={leader.id || idx}
                                        className={`p-4 rounded-xl border ${subCardBg} flex flex-col justify-between space-y-3 relative group transition-all hover:border-yellow-500/50 shadow-xs`}
                                    >
                                        {/* Top Leader Info */}
                                        <div className="flex items-start space-x-3">
                                            {/* Avatar with initials */}
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-500 to-amber-600 flex items-center justify-center text-slate-950 font-black text-sm flex-shrink-0 shadow-md">
                                                {leader.name
                                                    .replace(/^(Hon\.|Dr\.|Rev\.|Col\.|Eng\.|Hajjat)\s+/i, '')
                                                    .split(' ')
                                                    .map(n => n[0])
                                                    .join('')
                                                    .slice(0, 2)
                                                    .toUpperCase() || 'LD'}
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between">
                                                    {isEditing ? (
                                                        <input
                                                            type="text"
                                                            value={leader.name}
                                                            onChange={e => handleUpdateLeaderField(leader.id, 'name', e.target.value)}
                                                            className="text-xs font-bold px-1.5 py-0.5 rounded border border-yellow-500/60 bg-slate-950 text-white w-full mr-2"
                                                        />
                                                    ) : (
                                                        <h4 className={`text-xs font-extrabold truncate ${textPrimary}`}>
                                                            {leader.name}
                                                        </h4>
                                                    )}

                                                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex-shrink-0">
                                                        {leader.status || 'Active'}
                                                    </span>
                                                </div>

                                                {isEditing ? (
                                                    <input
                                                        type="text"
                                                        value={leader.title}
                                                        onChange={e => handleUpdateLeaderField(leader.id, 'title', e.target.value)}
                                                        className="text-[11px] font-semibold text-yellow-400 px-1.5 py-0.5 rounded border border-slate-700 bg-slate-950 w-full mt-1"
                                                    />
                                                ) : (
                                                    <p className="text-[11px] font-semibold text-yellow-400 truncate">
                                                        {leader.title}
                                                    </p>
                                                )}

                                                <div className="flex items-center space-x-2 text-[10px] text-slate-400 mt-0.5">
                                                    <span>{leader.department || 'Administration'}</span>
                                                    {leader.term && (
                                                        <>
                                                            <span>•</span>
                                                            <span className="font-mono">{leader.term}</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Contacts Strip */}
                                        <div className="pt-2.5 border-t border-slate-800 space-y-1.5 text-xs">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center space-x-2 min-w-0">
                                                    <Icon name="phone" className="h-3 w-3 text-yellow-500 flex-shrink-0" />
                                                    {isEditing ? (
                                                        <input
                                                            type="text"
                                                            value={leader.phone}
                                                            onChange={e => handleUpdateLeaderField(leader.id, 'phone', e.target.value)}
                                                            className="text-[11px] px-1 py-0.5 rounded bg-slate-950 text-slate-200 border border-slate-700 w-full"
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
                                                        className="text-[10px] text-slate-400 hover:text-yellow-400 px-1.5 py-0.5 rounded bg-slate-800"
                                                    >
                                                        Copy
                                                    </button>
                                                )}
                                            </div>

                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center space-x-2 min-w-0">
                                                    <Icon name="chat-bubble" className="h-3 w-3 text-blue-400 flex-shrink-0" />
                                                    {isEditing ? (
                                                        <input
                                                            type="email"
                                                            value={leader.email}
                                                            onChange={e => handleUpdateLeaderField(leader.id, 'email', e.target.value)}
                                                            className="text-[11px] px-1 py-0.5 rounded bg-slate-950 text-slate-200 border border-slate-700 w-full"
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
                                                        className="text-[10px] text-slate-400 hover:text-blue-400 px-1.5 py-0.5 rounded bg-slate-800"
                                                    >
                                                        Copy
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Delete leader button in edit mode */}
                                        {isEditing && (
                                            <div className="pt-2 flex justify-end">
                                                <button
                                                    onClick={() => handleRemoveLeader(leader.id)}
                                                    className="px-2.5 py-1 text-[10px] font-bold text-red-400 hover:text-red-300 bg-red-950/40 hover:bg-red-900/60 rounded border border-red-800 flex items-center space-x-1"
                                                >
                                                    <Icon name="trash" className="h-3 w-3" />
                                                    <span>Remove Leader</span>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* SECTION 3: DIRECT SUB-ADMINISTRATIVE AREAS */}
                    {childAreas.length > 0 && (
                        <div className={`p-5 rounded-xl border ${cardBg} space-y-3`}>
                            <div className="flex items-center justify-between border-b border-slate-700/50 pb-2.5">
                                <div className="flex items-center space-x-2">
                                    <Icon name="archive" className="h-4 w-4 text-emerald-400" />
                                    <h3 className={`text-xs font-bold uppercase tracking-wider ${textPrimary}`}>
                                        Direct Sub-Areas in this {currentLevelName} ({childAreas.length} {nextLevelName}s)
                                    </h3>
                                </div>
                                <span className="text-[11px] text-slate-400">
                                    Level {area.level + 1}
                                </span>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                                {childAreas.map(child => (
                                    <button
                                        key={child.id}
                                        onClick={() => onSelectChildArea && onSelectChildArea(child)}
                                        className={`p-2.5 rounded-lg border text-left flex items-center justify-between transition-all ${
                                            isDarkMode
                                                ? 'bg-slate-900/60 hover:bg-yellow-500/10 border-slate-800 hover:border-yellow-500/60 text-slate-200 hover:text-yellow-400'
                                                : 'bg-white hover:bg-yellow-50 border-slate-200 hover:border-yellow-400 text-slate-800 hover:text-yellow-700'
                                        }`}
                                    >
                                        <div className="min-w-0 pr-1">
                                            <p className="text-xs font-bold truncate">{child.name}</p>
                                            <span className="text-[10px] text-slate-400 font-mono">ID #{child.id}</span>
                                        </div>
                                        <Icon name="chevron-right" className="h-3.5 w-3.5 text-yellow-500 flex-shrink-0" />
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Modal Footer */}
                <div className={`px-6 py-3.5 border-t flex items-center justify-between ${isDarkMode ? 'bg-slate-800/90 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="text-xs text-slate-400">
                        {country.name} Administrative Hierarchy • Level {area.level}
                    </div>

                    <div className="flex items-center space-x-2">
                        {isEditing && (
                            <button
                                onClick={handleSaveChanges}
                                disabled={isSaving}
                                className="px-4 py-2 text-xs font-bold rounded-lg bg-yellow-500 text-slate-950 hover:bg-yellow-600 flex items-center space-x-1.5 shadow transition-colors"
                            >
                                <Icon name="check" className="h-3.5 w-3.5" />
                                <span>{isSaving ? 'Saving...' : 'Save Profile Changes'}</span>
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className={`px-4 py-2 text-xs font-bold rounded-lg border ${
                                isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-600' : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                            }`}
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminLevelProfileModal;
