import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Theme, Country } from '../types';
import CountryProfileView from './CountryProfileView';
import { X, Globe } from 'lucide-react';
import { allAfricanCountries } from '../data';

interface CountryProfileModalProps {
    theme: Theme;
    country?: Country | null;
    countryId?: string | null;
    countryName?: string | null;
    onClose: () => void;
    onSelectLevel?: (level: number) => void;
    onEditLevels?: () => void;
}

const CountryProfileModal: React.FC<CountryProfileModalProps> = ({
    theme,
    country: providedCountry,
    countryId,
    countryName,
    onClose,
    onSelectLevel,
    onEditLevels
}) => {
    const isDarkMode = theme === 'dark';

    // Resolve country object if only id or name is provided
    const resolvedCountry: Country | undefined = React.useMemo(() => {
        if (providedCountry) return providedCountry;
        if (countryId) {
            const normalizedId = countryId.toUpperCase().trim();
            const found = allAfricanCountries.find(
                c => c.countryCode.toUpperCase() === normalizedId || c.id.toString() === normalizedId
            );
            if (found) return found;
        }
        if (countryName) {
            const nameLower = countryName.toLowerCase().trim();
            const found = allAfricanCountries.find(
                c => c.name.toLowerCase() === nameLower
            );
            if (found) return found;
        }
        return undefined;
    }, [providedCountry, countryId, countryName]);

    if (!resolvedCountry) {
        return (
            <AnimatePresence>
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
                    onClick={onClose}
                >
                    <div
                        className={`p-6 rounded-2xl border max-w-md w-full text-center ${
                            isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
                        }`}
                        onClick={e => e.stopPropagation()}
                    >
                        <Globe className="w-12 h-12 text-yellow-500 mx-auto mb-3" />
                        <h3 className="text-lg font-bold">Country Profile Not Found</h3>
                        <p className="text-sm text-slate-400 mt-1">
                            Unable to load profile data for the requested country.
                        </p>
                        <button
                            onClick={onClose}
                            className="mt-5 px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-slate-950 font-bold rounded-lg text-sm"
                        >
                            Close
                        </button>
                    </div>
                </motion.div>
            </AnimatePresence>
        );
    }

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[120] flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/80 backdrop-blur-md"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.96, opacity: 0, y: 15 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.96, opacity: 0, y: 15 }}
                    className={`relative w-full max-w-6xl h-[92vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col border ${
                        isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
                    }`}
                    onClick={e => e.stopPropagation()}
                >
                    {/* Modal Top Floating Close Button */}
                    <button
                        onClick={onClose}
                        id="close-country-profile-modal-btn"
                        className={`absolute top-4 right-4 z-50 p-2.5 rounded-xl border backdrop-blur-md transition-all shadow-lg ${
                            isDarkMode
                                ? 'bg-slate-900/90 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800'
                                : 'bg-white/90 border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                        }`}
                        title="Close Profile Modal"
                    >
                        <X className="w-5 h-5" />
                    </button>

                    {/* Scrollable Profile Content */}
                    <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 custom-scrollbar">
                        <CountryProfileView
                            theme={theme}
                            country={resolvedCountry}
                            onBack={onClose}
                            onSelectLevel={onSelectLevel}
                            onEditLevels={onEditLevels}
                        />
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default CountryProfileModal;
