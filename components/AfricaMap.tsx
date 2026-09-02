import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Theme, Shop, RegionalEconomicLevel, Country } from '../types';
import { africaDetailedPaths, africaGeoViewBox, africaWidth, africaHeight } from '../africaPaths';
import { allAfricanCountries } from '../data';
import { motion, AnimatePresence, useMotionValue, useSpring } from 'motion/react';
import { ZoomIn, ZoomOut, Maximize2, RotateCcw, Eye } from 'lucide-react';
import Icon from './Icon';
import CountryProfileModal from './CountryProfileModal';

interface AfricaMapProps {
  shops: Shop[];
  shopDensity: Record<string, number>;
  regionalLevels: RegionalEconomicLevel[];
  theme: Theme;
  countries?: Country[];
  onCountryClick?: (countryId: string, countryName: string) => void;
  onCountryDoubleClick?: (countryId: string, countryName: string) => void;
}

// Cartographically calibrated label configurations for all African territories
// Ensures zero overlap, optimal scale-relative font sizing, and crisp visibility
const AFRICA_COUNTRY_LABELS: Record<string, { shortName: string; fontSize: number; x: number; y: number; hideAtDefault?: boolean }> = {
  DZ: { shortName: "Algeria", fontSize: 2.7, x: 82, y: 36 },
  EG: { shortName: "Egypt", fontSize: 2.6, x: 148, y: 36 },
  LY: { shortName: "Libya", fontSize: 2.7, x: 116, y: 38 },
  MA: { shortName: "Morocco", fontSize: 2.3, x: 58, y: 22 },
  TN: { shortName: "Tunisia", fontSize: 1.7, x: 98, y: 16 },
  EH: { shortName: "W. Sahara", fontSize: 1.8, x: 40, y: 42 },
  MR: { shortName: "Mauritania", fontSize: 2.5, x: 48, y: 54 },
  ML: { shortName: "Mali", fontSize: 2.6, x: 68, y: 56 },
  NE: { shortName: "Niger", fontSize: 2.6, x: 96, y: 62 },
  TD: { shortName: "Chad", fontSize: 2.6, x: 118, y: 68 },
  SD: { shortName: "Sudan", fontSize: 2.6, x: 145, y: 62 },
  ER: { shortName: "Eritrea", fontSize: 1.6, x: 168, y: 59 },
  ET: { shortName: "Ethiopia", fontSize: 2.6, x: 174, y: 82 },
  DJ: { shortName: "Djibouti", fontSize: 1.2, x: 180, y: 71 },
  SO: { shortName: "Somalia", fontSize: 2.2, x: 190, y: 88 },
  SS: { shortName: "S. Sudan", fontSize: 2.2, x: 146, y: 85 },
  CF: { shortName: "CAR", fontSize: 2.0, x: 124, y: 91 },
  CM: { shortName: "Cameroon", fontSize: 2.1, x: 107, y: 96 },
  NG: { shortName: "Nigeria", fontSize: 2.5, x: 92, y: 83 },
  BJ: { shortName: "Benin", fontSize: 1.3, x: 81, y: 88 },
  TG: { shortName: "Togo", fontSize: 1.2, x: 76.5, y: 90 },
  GH: { shortName: "Ghana", fontSize: 1.9, x: 71, y: 91 },
  CI: { shortName: "Côte d'Ivoire", fontSize: 1.8, x: 60, y: 90 },
  LR: { shortName: "Liberia", fontSize: 1.4, x: 51, y: 94 },
  SL: { shortName: "S. Leone", fontSize: 1.3, x: 44, y: 88 },
  GN: { shortName: "Guinea", fontSize: 1.8, x: 49, y: 78 },
  GW: { shortName: "G.-Bissau", fontSize: 1.2, x: 39, y: 75 },
  GM: { shortName: "Gambia", fontSize: 1.1, x: 38, y: 70 },
  SN: { shortName: "Senegal", fontSize: 1.9, x: 42, y: 65 },
  BF: { shortName: "Burkina Faso", fontSize: 1.7, x: 68, y: 76 },
  GQ: { shortName: "Eq. Guinea", fontSize: 1.1, x: 102, y: 107 },
  GA: { shortName: "Gabon", fontSize: 1.9, x: 107, y: 114 },
  CG: { shortName: "Congo", fontSize: 1.9, x: 116, y: 117 },
  CD: { shortName: "DR Congo", fontSize: 2.7, x: 132, y: 126 },
  UG: { shortName: "Uganda", fontSize: 1.9, x: 156, y: 99 },
  KE: { shortName: "Kenya", fontSize: 2.3, x: 171, y: 106 },
  RW: { shortName: "Rwanda", fontSize: 1.2, x: 153.5, y: 112.5 },
  BI: { shortName: "Burundi", fontSize: 1.2, x: 153.5, y: 117.5 },
  TZ: { shortName: "Tanzania", fontSize: 2.5, x: 164, y: 128 },
  AO: { shortName: "Angola", fontSize: 2.6, x: 120, y: 140 },
  ZM: { shortName: "Zambia", fontSize: 2.4, x: 140, y: 145 },
  MW: { shortName: "Malawi", fontSize: 1.5, x: 163, y: 146 },
  MZ: { shortName: "Mozambique", fontSize: 2.3, x: 170, y: 158 },
  ZW: { shortName: "Zimbabwe", fontSize: 2.1, x: 150, y: 161 },
  BW: { shortName: "Botswana", fontSize: 2.4, x: 136, y: 172 },
  NA: { shortName: "Namibia", fontSize: 2.5, x: 117, y: 168 },
  ZA: { shortName: "South Africa", fontSize: 2.6, x: 136, y: 194 },
  LS: { shortName: "Lesotho", fontSize: 1.2, x: 147, y: 192 },
  SZ: { shortName: "Eswatini", fontSize: 1.1, x: 154.5, y: 183 },
  MG: { shortName: "Madagascar", fontSize: 2.4, x: 195, y: 162 },
  CV: { shortName: "Cabo Verde", fontSize: 1.2, x: 20, y: 68 },
  ST: { shortName: "São Tomé", fontSize: 1.1, x: 95, y: 112 },
  KM: { shortName: "Comoros", fontSize: 1.1, x: 190, y: 137 },
  MU: { shortName: "Mauritius", fontSize: 1.1, x: 214, y: 166 },
  SC: { shortName: "Seychelles", fontSize: 1.1, x: 212, y: 114 },
  RE: { shortName: "Réunion", fontSize: 1.0, x: 210, y: 172 },
  YT: { shortName: "Mayotte", fontSize: 1.0, x: 194, y: 141 },
  SH: { shortName: "St. Helena", fontSize: 1.0, x: 60, y: 165 }
};

// Helper to compute bounding-box center of SVG paths for clean, high-clarity country labeling
function computePathCenter(d: string): { x: number; y: number } {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  let curX = 0, curY = 0;
  const tokens = d.match(/([a-df-z]|[-+]?[0-9]*\.?[0-9]+(?:[eE][-+]?[0-9]+)?)/gi) || [];
  let currentCmd = 'M';
  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i];
    if (/^[a-df-z]$/i.test(token)) {
      currentCmd = token;
      i++;
      continue;
    }
    const val1 = parseFloat(token);
    i++;
    if (i >= tokens.length) break;
    const val2 = parseFloat(tokens[i]);
    i++;

    if (currentCmd === 'm' || currentCmd === 'l' || currentCmd === 'c' || currentCmd === 's' || currentCmd === 'q' || currentCmd === 't') {
      curX += val1;
      curY += val2;
    } else if (currentCmd === 'M' || currentCmd === 'L' || currentCmd === 'C' || currentCmd === 'S' || currentCmd === 'Q' || currentCmd === 'T') {
      curX = val1;
      curY = val2;
    } else if (currentCmd === 'z' || currentCmd === 'Z') {
      continue;
    } else {
      if (currentCmd === currentCmd.toLowerCase()) {
        curX += val1;
        curY += val2;
      } else {
        curX = val1;
        curY = val2;
      }
    }
    if (curX < minX) minX = curX;
    if (curX > maxX) maxX = curX;
    if (curY < minY) minY = curY;
    if (curY > maxY) maxY = curY;
  }
  if (!isFinite(minX) || !isFinite(maxX)) return { x: 0, y: 0 };
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
}

const AfricaMap: React.FC<AfricaMapProps> = ({ shops, shopDensity, regionalLevels, theme, countries, onCountryClick, onCountryDoubleClick }) => {
  const [hoveredCountry, setHoveredCountry] = useState<{ id: string, name: string, density: number, color?: string } | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [profileModalCountry, setProfileModalCountry] = useState<{ id: string; name: string } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
      }
    };
  }, []);

  const handleCountryInteraction = (id: string, name: string) => {
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
      onCountryDoubleClick?.(id, name);
    } else {
      clickTimeoutRef.current = setTimeout(() => {
        onCountryClick?.(id, name);
        clickTimeoutRef.current = null;
      }, 250);
    }
  };


  // Motion values for smooth panning
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  
  // Springs for smooth transitions
  const springX = useSpring(x, { stiffness: 300, damping: 30 });
  const springY = useSpring(y, { stiffness: 300, damping: 30 });
  const springScale = useSpring(scale, { stiffness: 300, damping: 30 });

  const handleZoomIn = () => setScale(prev => Math.min(prev * 1.5, 10));
  const handleZoomOut = () => setScale(prev => Math.max(prev / 1.5, 0.5));
  const handleReset = () => {
    setScale(1);
    x.set(0);
    y.set(0);
  };

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  // Handle mouse wheel zoom
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey || e.shiftKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        setScale(prev => Math.max(0.5, Math.min(10, prev * delta)));
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, []);

  const getCountryRegion = useMemo(() => {
    const countriesList = countries && countries.length > 0 ? countries : allAfricanCountries;
    return (countryName: string): string | null => {
      // 1. Check dynamic list (ignoring case)
      const dynamicCountry = countriesList.find(c => c.name.toLowerCase() === countryName.toLowerCase());
      if (dynamicCountry) {
        const zones = dynamicCountry.economicZones || [];
        for (const zone of zones) {
          const normalized = zone.trim().toLowerCase();
          if (normalized === 'northern africa' || normalized === 'norther africa') return 'Northern Africa';
          if (normalized === 'western africa') return 'Western Africa';
          if (normalized === 'southern africa') return 'Southern Africa';
          if (normalized === 'central africa') return 'Central Africa';
          if (normalized === 'eastern africa') return 'Eastern Africa';
        }
      }

      // 2. Fallback to standard UN subregions
      const nameLower = countryName.toLowerCase();
      
      // Northern Africa
      if ([
        'egypt', 'libya', 'tunisia', 'algeria', 'morocco', 'sudan', 'western sahara', 'mauritania'
      ].includes(nameLower)) {
        return 'Northern Africa';
      }
      
      // Western Africa
      if ([
        'nigeria', 'niger', 'burkina faso', 'mali', 'senegal', 'gambia', 'guinea', 'guinea-bissau',
        'sierra leone', 'liberia', "côte d'ivoire", 'ghana', 'togo', 'benin', 'cape verde', 'cabo verde', 'cote d\'ivoire'
      ].includes(nameLower)) {
        return 'Western Africa';
      }
      
      // Central Africa
      if ([
        'chad', 'central african republic', 'cameroon', 'gabon', 'congo', 'republic of congo',
        'democratic republic of congo', 'democratic republic of the congo', 'dr congo', 'angola', 'equatorial guinea', 'sao tome and principe'
      ].includes(nameLower)) {
        return 'Central Africa';
      }
      
      // Eastern Africa
      if ([
        'uganda', 'kenya', 'tanzania', 'rwanda', 'burundi', 'somalia', 'djibouti', 'eritrea', 'ethiopia',
        'south sudan', 'seychelles', 'reunion', 'madagascar', 'mozambique', 'malawi', 'zambia', 'zimbabwe',
        'comoros', 'mauritius'
      ].includes(nameLower)) {
        return 'Eastern Africa';
      }
      
      // Southern Africa
      if ([
        'south africa', 'namibia', 'botswana', 'lesotho', 'eswatini', 'swaziland'
      ].includes(nameLower)) {
        return 'Southern Africa';
      }
      
      return null;
    };
  }, [countries]);

  const activeRegions = useMemo(() => {
    const list = countries && countries.length > 0 ? countries : allAfricanCountries;
    const active = new Set<string>();
    list.forEach(c => {
      (c.economicZones || []).forEach(zone => {
        const normalized = zone.trim().toLowerCase();
        if (normalized === 'northern africa' || normalized === 'norther africa') active.add('Northern Africa');
        if (normalized === 'western africa') active.add('Western Africa');
        if (normalized === 'southern africa') active.add('Southern Africa');
        if (normalized === 'central africa') active.add('Central Africa');
        if (normalized === 'eastern africa') active.add('Eastern Africa');
      });
    });
    return active;
  }, [countries]);

  const groupedCountryPaths = useMemo(() => {
    const groups: Record<string, typeof africaDetailedPaths> = {
      'Northern Africa': [],
      'Western Africa': [],
      'Central Africa': [],
      'Eastern Africa': [],
      'Southern Africa': [],
      'unassigned': []
    };

    africaDetailedPaths.forEach(country => {
      const region = getCountryRegion(country.name);
      if (region && groups[region]) {
        groups[region].push(country);
      } else {
        groups['unassigned'].push(country);
      }
    });

    return groups;
  }, [countries, getCountryRegion]);

  const maxDensity = useMemo(() => {
    const values = Object.values(shopDensity);
    return values.length > 0 ? Math.max(...values) : 1;
  }, [shopDensity]);

  const colorScale = (density: number, countryName: string) => {
    // Check if country belongs to a region with a custom color
    const region = regionalLevels.find(rl => rl.countries.includes(countryName));
    if (region && region.color) {
      return region.color;
    }

    if (density === 0) {
      return theme === 'dark' ? '#1e293b' : '#f1f5f9';
    }
    const intensity = Math.max(0.2, Math.min(1, density / maxDensity));
    if (theme === 'dark') {
      return `rgba(234, 179, 8, ${intensity})`; // yellow-500
    }
    return `rgba(202, 138, 4, ${intensity})`; // yellow-600
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setMousePos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
    }
  };

  // Projection for the dots (calibrated for the vectorized map)
  const project = (lat: number, lng: number) => {
    const [minLon, maxLat, maxLon, minLat] = africaGeoViewBox.split(' ').map(Number);
    
    const svgMinX = 0;
    const svgMinY = 0;
    const svgWidth = 239.05701;
    const svgHeight = 217.31789;

    const x = svgMinX + (lng - minLon) * (svgWidth / (maxLon - minLon));
    const y = svgMinY + (maxLat - lat) * (svgHeight / (maxLat - minLat));
    
    return { x, y };
  };

  // Precompute clean center coordinates for country labels
  const countryCenters = useMemo(() => {
    const centers: Record<string, { x: number; y: number }> = {};
    africaDetailedPaths.forEach(c => {
      centers[c.id] = computePathCenter(c.d);
    });
    return centers;
  }, []);

  return (
    <div 
      ref={containerRef}
      id="africa-map-container"
      className={`relative w-full h-full min-h-0 transition-all duration-500 ease-in-out overflow-hidden bg-transparent cursor-grab active:cursor-grabbing flex items-center justify-center p-1 sm:p-2`}
      onMouseMove={handleMouseMove}
    >
      {/* Zoom Controls */}
      <div className="absolute top-4 right-4 z-20 flex flex-col space-y-2">
        <div className={`flex flex-col border rounded-xl overflow-hidden shadow-xl backdrop-blur-md ${theme === 'dark' ? 'bg-slate-900/90 border-slate-700' : 'bg-white/90 border-slate-200'}`}>
          <button 
            onClick={handleZoomIn}
            id="zoom-in-btn"
            className={`p-2.5 transition-colors ${theme === 'dark' ? 'hover:bg-slate-800 text-slate-200' : 'hover:bg-slate-100 text-slate-700'} border-b ${theme === 'dark' ? 'border-slate-800' : 'border-slate-100'}`}
            title="Zoom In"
          >
            <ZoomIn size={18} />
          </button>
          <button 
            onClick={handleZoomOut}
            id="zoom-out-btn"
            className={`p-2.5 transition-colors ${theme === 'dark' ? 'hover:bg-slate-800 text-slate-200' : 'hover:bg-slate-100 text-slate-700'} border-b ${theme === 'dark' ? 'border-slate-800' : 'border-slate-100'}`}
            title="Zoom Out"
          >
            <ZoomOut size={18} />
          </button>
          <button 
            onClick={handleReset}
            id="reset-view-btn"
            className={`p-2.5 transition-colors ${theme === 'dark' ? 'hover:bg-slate-800 text-slate-200' : 'hover:bg-slate-100 text-slate-700'} border-b ${theme === 'dark' ? 'border-slate-800' : 'border-slate-100'}`}
            title="Reset View"
          >
            <RotateCcw size={18} />
          </button>
          <button 
            onClick={toggleExpand}
            id="toggle-expand-btn"
            className={`p-2.5 transition-colors ${theme === 'dark' ? 'hover:bg-slate-800 text-slate-200' : 'hover:bg-slate-100 text-slate-700'}`}
            title={isExpanded ? "Collapse Map" : "Expand Map"}
          >
            <Maximize2 size={18} className={isExpanded ? "rotate-180" : ""} />
          </button>
        </div>
      </div>

      <svg 
        id="africa-svg-map"
        viewBox="0 0 239.05701 217.31789" 
        className="w-full h-full max-w-full max-h-full select-none"
        preserveAspectRatio="xMidYMid meet"
        style={{ filter: 'drop-shadow(0 15px 25px rgba(0,0,0,0.15))', overflow: 'visible' }}
      >
        <motion.g
          id="map-transform-group"
          style={{ 
            x: springX,
            y: springY,
            scale: springScale,
            transformOrigin: 'center'
          }}
          drag
          dragMomentum={true}
          dragElastic={0.05}
        >
          <g id="countries-group">
            {/* First render ALL inactive regions in the background (only thin borders) */}
            {(() => {
              const allRegionNames = ['Northern Africa', 'Western Africa', 'Central Africa', 'Eastern Africa', 'Southern Africa', 'unassigned'];
              const inactiveRegionNames = allRegionNames.filter(r => !activeRegions.has(r));
              const activeRegionNames = allRegionNames.filter(r => activeRegions.has(r));

              return (
                <>
                  {/* Step 1: Render all inactive countries */}
                  {inactiveRegionNames.map(regionName => {
                    const countriesInThisRegion = groupedCountryPaths[regionName] || [];
                    return (
                      <g key={regionName} id={`inactive-region-group-${regionName.replace(/\s+/g, '-').toLowerCase()}`}>
                        {countriesInThisRegion.map(country => {
                          const countryId = (country as any).countryId || country.id;
                          const density = shopDensity[countryId] || 0;
                          const isHovered = hoveredCountry?.id === country.id;
                          const baseColor = colorScale(density, country.name);

                          return (
                            <motion.path
                              key={country.id}
                              id={`country-path-${country.id}`}
                              d={country.d}
                              fill={baseColor}
                              stroke={theme === 'dark' ? '#334155' : '#cbd5e1'}
                              strokeWidth="0.75"
                              strokeLinejoin="round"
                              strokeLinecap="round"
                              initial={false}
                              animate={{
                                fill: isHovered ? (theme === 'dark' ? '#f59e0b' : '#d97706') : baseColor,
                                stroke: isHovered ? '#f59e0b' : (theme === 'dark' ? '#475569' : '#94a3b8'),
                                strokeWidth: isHovered ? 1.4 : 0.75,
                                scale: isHovered ? 1.01 : 1,
                                transition: { duration: 0.15 }
                              }}
                              onMouseEnter={() => setHoveredCountry({ id: country.id, name: country.name, density, color: baseColor })}
                              onMouseLeave={() => setHoveredCountry(null)}
                              onClick={() => {
                                const normalizedId = countryId.split('-')[0];
                                handleCountryInteraction(normalizedId, country.name);
                              }}
                              onDoubleClick={() => {
                                const normalizedId = countryId.split('-')[0];
                                handleCountryInteraction(normalizedId, country.name);
                              }}
                              className="cursor-pointer outline-none"
                              style={{ transformOrigin: 'center', transformBox: 'fill-box' }}
                            />
                          );
                        })}
                      </g>
                    );
                  })}

                  {/* Step 2: Render all active countries normally on top (making borders beautifully crisp vector lines!) */}
                  {activeRegionNames.map(regionName => {
                    const countriesInThisRegion = groupedCountryPaths[regionName] || [];
                    return (
                      <g 
                        key={regionName} 
                        id={`active-region-group-${regionName.replace(/\s+/g, '-').toLowerCase()}`}
                      >
                        {countriesInThisRegion.map(country => {
                          const countryId = (country as any).countryId || country.id;
                          const density = shopDensity[countryId] || 0;
                          const isHovered = hoveredCountry?.id === country.id;
                          const baseColor = colorScale(density, country.name);

                          return (
                            <motion.path
                              key={country.id}
                              id={`country-path-${country.id}`}
                              d={country.d}
                              fill={baseColor}
                              stroke={theme === 'dark' ? '#475569' : '#94a3b8'}
                              strokeWidth="0.85"
                              strokeLinejoin="round"
                              strokeLinecap="round"
                              initial={false}
                              animate={{
                                fill: isHovered ? (theme === 'dark' ? '#f59e0b' : '#d97706') : baseColor,
                                stroke: isHovered ? '#f59e0b' : (theme === 'dark' ? '#64748b' : '#64748b'),
                                strokeWidth: isHovered ? 1.5 : 0.85,
                                scale: isHovered ? 1.01 : 1,
                                transition: { duration: 0.15 }
                              }}
                              onMouseEnter={() => setHoveredCountry({ id: country.id, name: country.name, density, color: baseColor })}
                              onMouseLeave={() => setHoveredCountry(null)}
                              onClick={() => {
                                const normalizedId = countryId.split('-')[0];
                                handleCountryInteraction(normalizedId, country.name);
                              }}
                              onDoubleClick={() => {
                                const normalizedId = countryId.split('-')[0];
                                handleCountryInteraction(normalizedId, country.name);
                              }}
                              className="cursor-pointer outline-none"
                              style={{ transformOrigin: 'center', transformBox: 'fill-box' }}
                            />
                          );
                        })}
                      </g>
                    );
                  })}
                </>
              );
            })()}
          </g>

          {/* High-Clarity Country Labels Directly on the Africa Map with Zero Overlaps */}
          <g id="africa-country-labels" className="pointer-events-none select-none">
            {africaDetailedPaths.map(country => {
              const labelConfig = AFRICA_COUNTRY_LABELS[country.id];
              const center = labelConfig 
                ? { x: labelConfig.x, y: labelConfig.y }
                : (countryCenters[country.id] || { x: 0, y: 0 });

              if (!center || center.x <= 0 || center.y <= 0) return null;
              
              const isHovered = hoveredCountry?.id === country.id;
              const displayName = labelConfig?.shortName || country.name;
              const fontSize = labelConfig?.fontSize || 2.0;
              const haloWidth = Math.max(0.7, fontSize * 0.55);

              return (
                <g key={`africa-label-${country.id}`} id={`label-${country.id}`}>
                  {/* Stroke halo for maximum readability on any background */}
                  <text
                    x={center.x}
                    y={center.y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    stroke={theme === 'dark' ? '#090d16' : '#ffffff'}
                    strokeWidth={haloWidth}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    fontSize={`${fontSize}px`}
                    className="font-black uppercase tracking-wider fill-none opacity-95"
                    style={{ fontFamily: 'var(--font-sans)', letterSpacing: '0.04em' }}
                  >
                    {displayName}
                  </text>
                  <text
                    x={center.x}
                    y={center.y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={`${fontSize}px`}
                    className={`font-black uppercase tracking-wider fill-current ${
                      isHovered
                        ? (theme === 'dark' ? 'text-yellow-300 font-extrabold' : 'text-yellow-900 font-extrabold')
                        : (theme === 'dark' ? 'text-slate-100' : 'text-slate-900')
                    }`}
                    style={{ fontFamily: 'var(--font-sans)', letterSpacing: '0.04em' }}
                  >
                    {displayName}
                  </text>
                </g>
              );
            })}
          </g>

          {/* Real Shop Geolocation Dots on Africa Map */}
          <g id="africa-shop-dots" pointerEvents="none">
            {shops.map(shop => {
              if (!shop.location?.lat || !shop.location?.lng) return null;
              const pt = project(shop.location.lat, shop.location.lng);
              if (pt.x < 0 || pt.x > 240 || pt.y < 0 || pt.y > 220) return null;

              return (
                <g key={`africa-shop-${shop.id}`}>
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r="2.2"
                    fill="#ef4444"
                    stroke="#ffffff"
                    strokeWidth="0.6"
                    style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.4))' }}
                  />
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r="0.9"
                    fill="#ffffff"
                  />
                </g>
              );
            })}
          </g>
        </motion.g>
      </svg>

      <AnimatePresence>
        {hoveredCountry && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            id="country-tooltip"
            className={`absolute pointer-events-none z-50 p-3 rounded-xl shadow-2xl border backdrop-blur-md ${
              theme === 'dark' 
                ? 'bg-slate-900/90 border-slate-700 text-white' 
                : 'bg-white/90 border-slate-200 text-slate-900'
            }`}
            style={{ 
              left: mousePos.x, 
              top: mousePos.y - 20,
              transform: 'translate(-50%, -100%)'
            }}
          >
            <div className="flex flex-col space-y-1">
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs font-bold uppercase tracking-wider opacity-60">{hoveredCountry.name}</span>
                {hoveredCountry.color && (
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: hoveredCountry.color }} />
                )}
              </div>
              
              {regionalLevels.find(rl => rl.countries.includes(hoveredCountry.name)) && (
                <div className="flex items-center space-x-1 mb-1">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${theme === 'dark' ? 'bg-slate-800 text-yellow-500' : 'bg-yellow-50 text-yellow-700'}`}>
                    {regionalLevels.find(rl => rl.countries.includes(hoveredCountry.name))?.abbreviation}
                  </span>
                </div>
              )}

              <div className="flex items-baseline space-x-1">
                <span className="text-lg font-black">{hoveredCountry.density}</span>
                <span className="text-[10px] uppercase font-bold opacity-60">Villages Mapped</span>
              </div>

              <div className="flex items-center space-x-1.5 pt-1.5 mt-1 border-t border-slate-200/50 dark:border-slate-700/50 text-[10px] text-yellow-500 font-bold">
                <Eye size={12} />
                <span>Click to explore & view country profile</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Map Legend */}
      <div className="absolute bottom-4 left-4 flex flex-col space-y-2 z-20">
        <div id="map-legend" className={`p-3 rounded-lg border backdrop-blur-sm shadow-lg ${theme === 'dark' ? 'bg-slate-900/80 border-slate-700' : 'bg-white/80 border-slate-200'}`}>
          <div className="flex flex-col space-y-1">
            <span className={`text-[8px] font-bold uppercase ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>Village density</span>
            <div className="flex h-1.5 w-32 rounded-full overflow-hidden">
              <div className="flex-1 bg-yellow-100" />
              <div className="flex-1 bg-yellow-300" />
              <div className="flex-1 bg-yellow-500" />
              <div className="flex-1 bg-yellow-700" />
            </div>
          </div>
        </div>
      </div>

      {profileModalCountry && (
        <CountryProfileModal
          theme={theme}
          countryId={profileModalCountry.id}
          countryName={profileModalCountry.name}
          onClose={() => setProfileModalCountry(null)}
        />
      )}
    </div>
  );
};

export default AfricaMap;
