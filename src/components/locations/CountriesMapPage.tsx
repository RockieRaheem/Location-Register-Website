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
        <div className={`h-[calc(100dvh-112px)] min-h-[560px] w-full flex flex-col items-center justify-center p-1 sm:p-2 rounded-2xl relative overflow-hidden border shadow-xl ${theme === 'dark' ? 'border-slate-800 bg-slate-950' : 'border-slate-200 bg-slate-100/70'}`}>
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
