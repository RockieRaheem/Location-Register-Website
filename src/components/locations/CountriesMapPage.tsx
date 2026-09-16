import React, { useState, useMemo } from 'react';
import { Theme, Shop, RegionalEconomicLevel, Country } from '../../types';
import AfricaMap from './AfricaMap';
import CountryDetailMap from './CountryDetailMap';
import { UGANDA_ELECTORAL_COMMISSION_2022_METADATA } from '../../data/locations/ugandaElectoralCommission2022';

interface CountriesMapPageProps {
    theme: Theme;
    shops: Shop[];
    regionalLevels: RegionalEconomicLevel[];
    countries?: Country[];
}

const CountriesMapPage: React.FC<CountriesMapPageProps> = ({ theme, shops, regionalLevels, countries }) => {
    const [selectedCountryId, setSelectedCountryId] = useState<string | null>(null);
    const locationCounts = useMemo(() => ({
        UG: UGANDA_ELECTORAL_COMMISSION_2022_METADATA.statistics.uniqueFullVillagePaths,
    }), []);

    const shopDensity = useMemo(() => {
        const density: Record<string, number> = {};
        shops.forEach(shop => {
            density[shop.countryCode] = (density[shop.countryCode] || 0) + 1;
        });
        return density;
    }, [shops]);

    return (
        <div className={`h-[calc(100dvh-112px)] min-h-[560px] w-full flex flex-col rounded-xl relative overflow-hidden border ${theme === 'dark' ? 'border-slate-800 bg-slate-950' : 'border-slate-200 bg-white'}`}>
            {!selectedCountryId && (
                <header className={`z-10 shrink-0 border-b px-4 py-4 sm:px-6 ${theme === 'dark' ? 'border-slate-800 bg-slate-950' : 'border-slate-200 bg-white'}`}>
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Location explorer</p>
                            <h1 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">Explore Africa</h1>
                        </div>
                        <p className="max-w-xl text-sm leading-6 text-slate-500">Select a country once to open its administrative map. Use the map controls to zoom or reposition the view.</p>
                    </div>
                </header>
            )}
            {/* Map Container */}
            <div className="relative w-full h-full flex-1 min-h-0 flex items-center justify-center">
                {selectedCountryId ? (
                    <CountryDetailMap 
                        countryId={selectedCountryId} 
                        shops={shops} 
                        theme={theme} 
                        onBack={() => setSelectedCountryId(null)} 
                    />
                ) : (
                    <AfricaMap 
                        shops={shops}
                        shopDensity={shopDensity}
                        regionalLevels={regionalLevels}
                        theme={theme}
                        countries={countries}
                        locationCounts={locationCounts}
                        onCountryClick={(id) => setSelectedCountryId(id)}
                    />
                )}
            </div>
        </div>
    );
};

export default CountriesMapPage;
