import React, { useState, useMemo, useRef } from 'react';
import { Theme, Country, AdminLevel, AdminLevelName } from '../../types';
import { 
  Upload, FileText, Download, CheckCircle, AlertTriangle, 
  MapPin, Globe, ChevronRight, ChevronDown, Plus, Trash2, 
  RefreshCw, Check, ArrowRight, Layers, FileSpreadsheet, Eye, 
  Building2, Sparkles, Filter, Search, ShieldCheck, Database
} from 'lucide-react';
import Icon from '../shared/Icon';

interface CountryLocationsUploadPageProps {
  theme: Theme;
  countries: Country[];
  onUpdateCountry: (country: Country) => Promise<void>;
  onNavigate?: (view: any) => void;
}

interface ParsedLocationRow {
  id: string;
  name: string;
  targetLevel: number;
  parentName: string;
  parentLevel: number;
  matchedParentId?: number;
  regionName?: string;
  matchedGrandparentId?: number;
  latitude?: number;
  longitude?: number;
  code?: string;
  population?: number;
  status: 'valid' | 'warning' | 'new_parent' | 'duplicate';
  statusMessage?: string;
  selected: boolean;
}

const FlagIcon: React.FC<{ countryCode: string; countryName: string }> = ({ countryCode, countryName }) => {
  return (
    <img 
      src={`https://flagcdn.com/w40/${countryCode.toLowerCase()}.png`}
      alt={`Flag of ${countryName}`}
      className="w-6 h-4.5 rounded shadow-sm object-cover border border-slate-300 dark:border-slate-700 inline-block"
      title={countryName}
    />
  );
};

export const CountryLocationsUploadPage: React.FC<CountryLocationsUploadPageProps> = ({
  theme,
  countries,
  onUpdateCountry,
  onNavigate
}) => {
  // Selected Country
  const [selectedCountryCode, setSelectedCountryCode] = useState<string>('UG');
  
  // Selected Country object
  const selectedCountry = useMemo(() => {
    return countries.find(c => c.countryCode === selectedCountryCode) || countries[0] || null;
  }, [countries, selectedCountryCode]);

  // Target Admin Level to upload (default to lowest or level 3 Village if exists)
  const [targetLevel, setTargetLevel] = useState<number>(3);

  // Alignment Mode: 'by-column' | 'single-parent' | 'multi-tier'
  const [alignmentMode, setAlignmentMode] = useState<'by-column' | 'single-parent' | 'multi-tier'>('by-column');
  
  // Single Parent Selection (for 'single-parent' mode, e.g., District = Mukono or Kampala)
  const [selectedSingleParentId, setSelectedSingleParentId] = useState<string>('');

  // Input Method Tab: 'file' | 'paste' | 'manual'
  const [inputTab, setInputTab] = useState<'file' | 'paste' | 'manual'>('file');

  // Text for paste tab
  const [pasteContent, setPasteContent] = useState<string>('');

  // Auto-create missing parent districts
  const [autoCreateMissingParents, setAutoCreateMissingParents] = useState<boolean>(true);
  const [defaultMissingParentRegionId, setDefaultMissingParentRegionId] = useState<string>('');

  // Parsed rows state
  const [parsedRows, setParsedRows] = useState<ParsedLocationRow[]>([]);
  const [dragOver, setDragOver] = useState<boolean>(false);
  const [fileName, setFileName] = useState<string>('');
  const [fileSize, setFileSize] = useState<string>('');

  // Filter & Search in parsed table
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [parentFilter, setParentFilter] = useState<string>('all');

  // Submission / Loading / Success status
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [successSummary, setSuccessSummary] = useState<{
    count: number;
    parentDistrictsCount: number;
    countryName: string;
    newParentsCreated: number;
  } | null>(null);

  // Tree View Expansion
  const [expandedRegions, setExpandedRegions] = useState<Record<number, boolean>>({});
  const [expandedDistricts, setExpandedDistricts] = useState<Record<number, boolean>>({});
  const [showHierarchyTree, setShowHierarchyTree] = useState<boolean>(true);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Available level options for selected country
  const levelDefinitions = useMemo(() => {
    if (!selectedCountry) return [];
    const count = selectedCountry.numberOfAdminLevels || 3;
    return Array.from({ length: count }, (_, i) => {
      const lvl = i + 1;
      const customName = selectedCountry.adminLevelNames?.find(n => n.level === lvl)?.name;
      return {
        level: lvl,
        name: customName || (lvl === 1 ? 'Region' : lvl === 2 ? 'District' : lvl === 3 ? 'Village' : `Level ${lvl}`)
      };
    });
  }, [selectedCountry]);

  // Target level name
  const targetLevelName = useMemo(() => {
    return levelDefinitions.find(l => l.level === targetLevel)?.name || `Level ${targetLevel}`;
  }, [levelDefinitions, targetLevel]);

  // Parent level number and name (targetLevel - 1)
  const parentLevelNum = targetLevel > 1 ? targetLevel - 1 : 1;
  const parentLevelName = useMemo(() => {
    return levelDefinitions.find(l => l.level === parentLevelNum)?.name || `Level ${parentLevelNum}`;
  }, [levelDefinitions, parentLevelNum]);

  // Existing Parent Areas in Country (e.g. Districts at Level 2, or Regions at Level 1)
  const existingParentAreas = useMemo(() => {
    if (!selectedCountry) return [];
    return selectedCountry.adminLevels.filter(al => al.level === parentLevelNum);
  }, [selectedCountry, parentLevelNum]);

  // Existing Level 1 Regions (Grandparents)
  const existingRegions = useMemo(() => {
    if (!selectedCountry) return [];
    return selectedCountry.adminLevels.filter(al => al.level === 1);
  }, [selectedCountry]);

  // Existing target locations in country (e.g. Villages)
  const existingTargetLocations = useMemo(() => {
    if (!selectedCountry) return [];
    return selectedCountry.adminLevels.filter(al => al.level === targetLevel);
  }, [selectedCountry, targetLevel]);

  // Auto-initialize single parent if empty
  React.useEffect(() => {
    if (existingParentAreas.length > 0 && !selectedSingleParentId) {
      setSelectedSingleParentId(existingParentAreas[0].id.toString());
    }
    if (existingRegions.length > 0 && !defaultMissingParentRegionId) {
      setDefaultMissingParentRegionId(existingRegions[0].id.toString());
    }
  }, [existingParentAreas, existingRegions, selectedSingleParentId, defaultMissingParentRegionId]);

  // Preset Sample Data for Uganda (and other countries)
  const ugandaSampleVillages = useMemo(() => [
    { name: "Kiwanga A", district: "Mukono", region: "Central", lat: 0.352, lng: 32.731 },
    { name: "Kiwanga B", district: "Mukono", region: "Central", lat: 0.354, lng: 32.735 },
    { name: "Seeta Central", district: "Mukono", region: "Central", lat: 0.364, lng: 32.705 },
    { name: "Bajjo Village", district: "Mukono", region: "Central", lat: 0.370, lng: 32.715 },
    { name: "Goma Town Council", district: "Mukono", region: "Central", lat: 0.360, lng: 32.720 },
    { name: "Kyampisi North", district: "Mukono", region: "Central", lat: 0.420, lng: 32.810 },
    { name: "Nama Sub-village", district: "Mukono", region: "Central", lat: 0.395, lng: 32.770 },
    { name: "Komamboga Parish", district: "Kampala", region: "Central", lat: 0.380, lng: 32.585 },
    { name: "Kikaaya Central", district: "Kampala", region: "Central", lat: 0.365, lng: 32.600 },
    { name: "Kyebando Kisalosalo", district: "Kampala", region: "Central", lat: 0.355, lng: 32.580 },
    { name: "Kalerwe Market Area", district: "Kampala", region: "Central", lat: 0.350, lng: 32.570 },
    { name: "Mulago II Village", district: "Kampala", region: "Central", lat: 0.340, lng: 32.578 },
    { name: "Bwaise III Zone", district: "Kampala", region: "Central", lat: 0.352, lng: 32.560 },
    { name: "Kira Town", district: "Wakiso", region: "Central", lat: 0.398, lng: 32.645 },
    { name: "Nansana East", district: "Wakiso", region: "Central", lat: 0.378, lng: 32.525 },
    { name: "Entebbe Central", district: "Wakiso", region: "Central", lat: 0.059, lng: 32.463 },
    { name: "Kasangati Ward", district: "Wakiso", region: "Central", lat: 0.438, lng: 32.604 },
    { name: "Bugembe Trading Center", district: "Jinja", region: "Eastern", lat: 0.460, lng: 33.240 },
    { name: "Kakira Estate", district: "Jinja", region: "Eastern", lat: 0.505, lng: 33.280 },
    { name: "Walukuba East", district: "Jinja", region: "Eastern", lat: 0.435, lng: 33.225 },
    { name: "Kakoba Village", district: "Mbarara", region: "Western", lat: -0.612, lng: 30.665 },
    { name: "Kamukuzi Hill", district: "Mbarara", region: "Western", lat: -0.605, lng: 30.648 },
    { name: "Bardege Zone", district: "Gulu", region: "Northern", lat: 2.782, lng: 32.285 },
    { name: "Layibi Center", district: "Gulu", region: "Northern", lat: 2.755, lng: 32.295 }
  ], []);

  // Matcher helper function
  const matchParentArea = (parentName: string, country: Country, parentLvl: number) => {
    if (!parentName || !country) return undefined;
    const clean = parentName.trim().toLowerCase();
    return country.adminLevels.find(
      al => al.level === parentLvl && al.name.toLowerCase() === clean
    );
  };

  // Process and convert raw data items into ParsedLocationRow
  const processRawItems = (items: Array<{ name: string; parent?: string; region?: string; lat?: number; lng?: number; code?: string }>) => {
    if (!selectedCountry) return;

    const existingNamesSet = new Set(
      selectedCountry.adminLevels
        .filter(al => al.level === targetLevel)
        .map(al => al.name.toLowerCase().trim())
    );

    const singleParentObj = existingParentAreas.find(p => p.id.toString() === selectedSingleParentId);

    const processed: ParsedLocationRow[] = items.map((item, index) => {
      const cleanName = item.name.trim();
      const resolvedParentName = alignmentMode === 'single-parent' 
        ? (singleParentObj?.name || 'Selected Parent')
        : (item.parent || singleParentObj?.name || '');
      
      const matchedParent = alignmentMode === 'single-parent'
        ? singleParentObj
        : matchParentArea(resolvedParentName, selectedCountry, parentLevelNum);

      const isDuplicate = existingNamesSet.has(cleanName.toLowerCase());
      
      let status: 'valid' | 'warning' | 'new_parent' | 'duplicate' = 'valid';
      let statusMessage = `Aligned to ${parentLevelName}: ${resolvedParentName}`;

      if (isDuplicate) {
        status = 'duplicate';
        statusMessage = `Already exists in ${selectedCountry.name} (${targetLevelName})`;
      } else if (!matchedParent) {
        if (resolvedParentName) {
          status = 'new_parent';
          statusMessage = `New ${parentLevelName} "${resolvedParentName}" will be auto-created under Region`;
        } else {
          status = 'warning';
          statusMessage = `Missing parent ${parentLevelName} assignment`;
        }
      }

      return {
        id: `row-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 4)}`,
        name: cleanName,
        targetLevel,
        parentName: resolvedParentName,
        parentLevel: parentLevelNum,
        matchedParentId: matchedParent?.id,
        regionName: item.region || (matchedParent?.parentAdminLevelId ? existingRegions.find(r => r.id === matchedParent.parentAdminLevelId)?.name : undefined),
        latitude: item.lat,
        longitude: item.lng,
        code: item.code,
        status,
        statusMessage,
        selected: status !== 'duplicate'
      };
    });

    setParsedRows(processed);
  };

  // Load Uganda sample preset
  const handleLoadUgandaPreset = () => {
    setSelectedCountryCode('UG');
    setTargetLevel(3);
    setAlignmentMode('by-column');
    processRawItems(ugandaSampleVillages.map(v => ({
      name: v.name,
      parent: v.district,
      region: v.region,
      lat: v.lat,
      lng: v.lng
    })));
    setFileName('uganda_sample_villages_districts.csv');
    setFileSize('1.4 KB');
  };

  // Parse text / CSV content
  const parseCSVText = (text: string) => {
    if (!text.trim()) return;
    const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length === 0) return;

    // Detect delimiter
    const firstLine = lines[0];
    const delimiter = firstLine.includes('\t') ? '\t' : (firstLine.includes(',') ? ',' : (firstLine.includes(';') ? ';' : '|'));

    const parsedData: Array<{ name: string; parent?: string; region?: string; lat?: number; lng?: number }> = [];

    // Check if first line is header
    const firstLineLower = firstLine.toLowerCase();
    const hasHeader = firstLineLower.includes('village') || 
                      firstLineLower.includes('name') || 
                      firstLineLower.includes('district') || 
                      firstLineLower.includes('location') ||
                      firstLineLower.includes('area');

    const startIndex = hasHeader ? 1 : 0;

    let colNameIdx = 0;
    let colParentIdx = 1;
    let colRegionIdx = -1;
    let colLatIdx = -1;
    let colLngIdx = -1;

    if (hasHeader) {
      const headers = firstLine.split(delimiter).map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
      headers.forEach((h, idx) => {
        if (h.includes('village') || h.includes('location') || h.includes('name') || h.includes('area')) {
          colNameIdx = idx;
        } else if (h.includes('district') || h.includes('parent') || h.includes('subcounty') || h.includes('county')) {
          colParentIdx = idx;
        } else if (h.includes('region') || h.includes('zone') || h.includes('province')) {
          colRegionIdx = idx;
        } else if (h.includes('lat')) {
          colLatIdx = idx;
        } else if (h.includes('lon') || h.includes('lng')) {
          colLngIdx = idx;
        }
      });
    }

    for (let i = startIndex; i < lines.length; i++) {
      const rawCols = lines[i].split(delimiter).map(c => c.trim().replace(/^["']|["']$/g, ''));
      if (rawCols.length === 0 || !rawCols[colNameIdx]) continue;

      const locName = rawCols[colNameIdx];
      const parentName = rawCols.length > colParentIdx && rawCols[colParentIdx] ? rawCols[colParentIdx] : undefined;
      const regionName = colRegionIdx !== -1 && rawCols[colRegionIdx] ? rawCols[colRegionIdx] : undefined;
      const lat = colLatIdx !== -1 && rawCols[colLatIdx] ? parseFloat(rawCols[colLatIdx]) : undefined;
      const lng = colLngIdx !== -1 && rawCols[colLngIdx] ? parseFloat(rawCols[colLngIdx]) : undefined;

      parsedData.push({
        name: locName,
        parent: parentName,
        region: regionName,
        lat: isNaN(lat as number) ? undefined : lat,
        lng: isNaN(lng as number) ? undefined : lng
      });
    }

    processRawItems(parsedData);
  };

  // Handle file drop / input
  const handleFileUpload = (file: File) => {
    setFileName(file.name);
    setFileSize(`${(file.size / 1024).toFixed(1)} KB`);

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        parseCSVText(content);
      }
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  // Download CSV Template customized to chosen Country & Level
  const handleDownloadTemplate = () => {
    if (!selectedCountry) return;
    const isUganda = selectedCountry.countryCode === 'UG';
    
    let csvHeader = `${targetLevelName}_Name,${parentLevelName}_Name,Region_Name,Latitude,Longitude,Notes\n`;
    let sampleRows = '';

    if (isUganda) {
      sampleRows = 
        `Kiwanga Central,Mukono,Central,0.352,32.731,"Primary trade center"\n` +
        `Seeta Ward 1,Mukono,Central,0.364,32.705,"Residential and commercial"\n` +
        `Goma Village,Mukono,Central,0.360,32.720,"Agricultural sector"\n` +
        `Komamboga Central,Kampala,Central,0.380,32.585,"Kawempe division parish"\n` +
        `Kikaaya Parish,Kampala,Central,0.365,32.600,"Urban zone"\n` +
        `Kira Center,Wakiso,Central,0.398,32.645,"Town municipality"\n` +
        `Bugembe Town,Jinja,Eastern,0.460,33.240,"Eastern corridor"\n` +
        `Kakoba Ward,Mbarara,Western,-0.612,30.665,"Western hub"\n`;
    } else {
      sampleRows = 
        `Sample ${targetLevelName} 1,${existingParentAreas[0]?.name || `Sample ${parentLevelName}`},${existingRegions[0]?.name || 'Sample Region'},0.000,0.000,"Location notes"\n` +
        `Sample ${targetLevelName} 2,${existingParentAreas[0]?.name || `Sample ${parentLevelName}`},${existingRegions[0]?.name || 'Sample Region'},0.000,0.000,"Location notes"\n`;
    }

    const blob = new Blob([csvHeader + sampleRows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${selectedCountry.name.toLowerCase()}_${targetLevelName.toLowerCase()}_district_alignment_template.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export existing locations to CSV
  const handleExportExistingData = () => {
    if (!selectedCountry) return;
    const header = "ID,Location_Name,Level,Level_Name,Parent_ID,Parent_Name,Country_Code\n";
    const rows = selectedCountry.adminLevels.map(al => {
      const levelObj = levelDefinitions.find(l => l.level === al.level);
      const parentObj = al.parentAdminLevelId ? selectedCountry.adminLevels.find(p => p.id === al.parentAdminLevelId) : null;
      return `${al.id},"${al.name}",${al.level},"${levelObj?.name || `Level ${al.level}`}",${al.parentAdminLevelId || ''},"${parentObj?.name || ''}",${al.countryCode}`;
    }).join('\n');

    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${selectedCountry.name.toLowerCase()}_administrative_locations_export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Row update helpers
  const handleUpdateRowParent = (rowId: string, newParentId: string) => {
    const parentObj = existingParentAreas.find(p => p.id.toString() === newParentId);
    setParsedRows(prev => prev.map(r => {
      if (r.id === rowId) {
        return {
          ...r,
          parentName: parentObj?.name || '',
          matchedParentId: parentObj?.id,
          status: parentObj ? 'valid' : 'warning',
          statusMessage: parentObj ? `Aligned to ${parentLevelName}: ${parentObj.name}` : `Unassigned ${parentLevelName}`
        };
      }
      return r;
    }));
  };

  const handleUpdateRowName = (rowId: string, newName: string) => {
    setParsedRows(prev => prev.map(r => {
      if (r.id === rowId) {
        return { ...r, name: newName };
      }
      return r;
    }));
  };

  const handleDeleteRow = (rowId: string) => {
    setParsedRows(prev => prev.filter(r => r.id !== rowId));
  };

  const handleToggleRowSelection = (rowId: string) => {
    setParsedRows(prev => prev.map(r => {
      if (r.id === rowId) {
        return { ...r, selected: !r.selected };
      }
      return r;
    }));
  };

  const handleToggleAllSelection = (select: boolean) => {
    setParsedRows(prev => prev.map(r => ({ ...r, selected: select })));
  };

  // Filtered rows for the preview table
  const filteredRows = useMemo(() => {
    return parsedRows.filter(row => {
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchesName = row.name.toLowerCase().includes(term);
        const matchesParent = row.parentName.toLowerCase().includes(term);
        const matchesRegion = row.regionName?.toLowerCase().includes(term);
        if (!matchesName && !matchesParent && !matchesRegion) return false;
      }
      if (statusFilter !== 'all') {
        if (statusFilter === 'valid' && row.status !== 'valid') return false;
        if (statusFilter === 'new_parent' && row.status !== 'new_parent') return false;
        if (statusFilter === 'warning' && row.status !== 'warning') return false;
        if (statusFilter === 'duplicate' && row.status !== 'duplicate') return false;
      }
      if (parentFilter !== 'all') {
        if (row.parentName !== parentFilter) return false;
      }
      return true;
    });
  }, [parsedRows, searchTerm, statusFilter, parentFilter]);

  // Unique parents in parsed data for filter
  const uniqueParsedParents = useMemo(() => {
    return Array.from(new Set(parsedRows.map(r => r.parentName).filter(Boolean)));
  }, [parsedRows]);

  // Stats
  const stats = useMemo(() => {
    const total = parsedRows.length;
    const selected = parsedRows.filter(r => r.selected).length;
    const valid = parsedRows.filter(r => r.status === 'valid').length;
    const newParents = parsedRows.filter(r => r.status === 'new_parent').length;
    const warnings = parsedRows.filter(r => r.status === 'warning').length;
    const duplicates = parsedRows.filter(r => r.status === 'duplicate').length;
    return { total, selected, valid, newParents, warnings, duplicates };
  }, [parsedRows]);

  // Final Commit & Save to Country
  const handleCommitUpload = async () => {
    if (!selectedCountry) return;
    const selectedRows = parsedRows.filter(r => r.selected);
    if (selectedRows.length === 0) return;

    setIsSubmitting(true);

    try {
      let currentAdminLevels = [...selectedCountry.adminLevels];
      let maxId = currentAdminLevels.length > 0 ? Math.max(...currentAdminLevels.map(al => al.id)) : 0;
      
      const newParentMap = new Map<string, number>();
      let newParentsCount = 0;

      // 1. If autoCreateMissingParents is true, create missing parent districts first
      if (autoCreateMissingParents) {
        const uniqueMissingParents = Array.from(
          new Set(
            selectedRows
              .filter(r => !r.matchedParentId && r.parentName)
              .map(r => r.parentName.trim())
          )
        );

        const defaultRegionId = defaultMissingParentRegionId ? parseInt(defaultMissingParentRegionId, 10) : existingRegions[0]?.id;

        uniqueMissingParents.forEach(parentName => {
          // Check if already in currentAdminLevels
          const existing = currentAdminLevels.find(
            al => al.level === parentLevelNum && al.name.toLowerCase() === parentName.toLowerCase()
          );

          if (existing) {
            newParentMap.set(parentName.toLowerCase(), existing.id);
          } else {
            maxId += 1;
            const newParentLevelObj: AdminLevel = {
              id: maxId,
              name: parentName,
              level: parentLevelNum,
              countryCode: selectedCountry.countryCode,
              parentAdminLevelId: defaultRegionId
            };
            currentAdminLevels.push(newParentLevelObj);
            newParentMap.set(parentName.toLowerCase(), maxId);
            newParentsCount++;
          }
        });
      }

      // 2. Add target locations (e.g. Villages) aligned to their parent district ID
      const newTargetLocations: AdminLevel[] = [];
      const distinctDistrictsSet = new Set<string>();

      selectedRows.forEach(row => {
        maxId += 1;
        let resolvedParentId = row.matchedParentId;
        if (!resolvedParentId && row.parentName) {
          resolvedParentId = newParentMap.get(row.parentName.toLowerCase());
        }

        if (row.parentName) {
          distinctDistrictsSet.add(row.parentName);
        }

        newTargetLocations.push({
          id: maxId,
          name: row.name.trim(),
          level: targetLevel,
          countryCode: selectedCountry.countryCode,
          parentAdminLevelId: resolvedParentId
        });
      });

      const updatedCountry: Country = {
        ...selectedCountry,
        adminLevels: [...currentAdminLevels, ...newTargetLocations],
        updatedBy: 'Paul Mboya',
        updatedAt: new Date().toISOString()
      };

      await onUpdateCountry(updatedCountry);

      setSuccessSummary({
        count: newTargetLocations.length,
        parentDistrictsCount: distinctDistrictsSet.size,
        countryName: selectedCountry.name,
        newParentsCreated: newParentsCount
      });

      // Clear rows after commit
      setParsedRows([]);
      setFileName('');
      setPasteContent('');
    } catch (error) {
      console.error("Failed to commit administrative locations:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClasses = theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-900';
  const focusClasses = 'focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500';

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      
      {/* Top Banner / Header */}
      <div className={`p-6 rounded-xl border shadow-sm transition-all duration-300 ${
        theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
      }`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <span className="p-2.5 rounded-lg bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">
                <Upload className="w-6 h-6" />
              </span>
              <div>
                <h1 className={`text-2xl font-black tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                  Upload Administrative Locations & Align Hierarchy
                </h1>
                <p className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                  Bulk upload village, parish, sub-county, and district locations and align them to the administrative tiers for any country.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleDownloadTemplate}
              className={`flex items-center space-x-2 px-3.5 py-2 text-xs font-bold rounded-lg border transition-all ${
                theme === 'dark' 
                  ? 'bg-slate-800/80 border-slate-700 text-slate-200 hover:bg-slate-700' 
                  : 'bg-slate-50 border-slate-300 text-slate-700 hover:bg-slate-100'
              }`}
              title="Download customized CSV template with columns"
            >
              <Download className="w-4 h-4 text-yellow-500" />
              <span>Download CSV Template</span>
            </button>

            <button
              onClick={handleExportExistingData}
              className={`flex items-center space-x-2 px-3.5 py-2 text-xs font-bold rounded-lg border transition-all ${
                theme === 'dark' 
                  ? 'bg-slate-800/80 border-slate-700 text-slate-200 hover:bg-slate-700' 
                  : 'bg-slate-50 border-slate-300 text-slate-700 hover:bg-slate-100'
              }`}
              title="Export all current location records for this country"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
              <span>Export Existing Hierarchy</span>
            </button>

            {onNavigate && (
              <button
                onClick={() => onNavigate('country-admin-levels')}
                className="flex items-center space-x-1.5 px-3.5 py-2 text-xs font-bold rounded-lg bg-yellow-500 text-slate-950 hover:bg-yellow-600 shadow-sm"
              >
                <Layers className="w-4 h-4" />
                <span>Manage Level Config</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Success Notification Banner */}
      {successSummary && (
        <div className={`p-5 rounded-xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4 duration-300 ${
          theme === 'dark' ? 'bg-emerald-950/40 border-emerald-800/50 text-emerald-200' : 'bg-emerald-50 border-emerald-200 text-emerald-900'
        }`}>
          <div className="flex items-center space-x-3.5">
            <span className="p-2 rounded-full bg-emerald-500/20 text-emerald-500">
              <CheckCircle className="w-6 h-6" />
            </span>
            <div>
              <h3 className="font-black text-sm">
                Locations Successfully Uploaded & Aligned to {successSummary.countryName}!
              </h3>
              <p className="text-xs opacity-90">
                Added <span className="font-bold">{successSummary.count} new locations</span> aligned across <span className="font-bold">{successSummary.parentDistrictsCount} {parentLevelName}s</span>.
                {successSummary.newParentsCreated > 0 && ` (Auto-created ${successSummary.newParentsCreated} new parent ${parentLevelName}s)`}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2.5 self-end md:self-auto">
            {onNavigate && (
              <button
                onClick={() => onNavigate('countries-map')}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold flex items-center space-x-1.5 shadow"
              >
                <Globe className="w-3.5 h-3.5" />
                <span>View on Map</span>
              </button>
            )}
            <button
              onClick={() => setSuccessSummary(null)}
              className="px-3 py-1.5 bg-slate-800/20 hover:bg-slate-800/40 rounded text-xs font-bold"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Step 1: Country & Target Admin Level Selection Card */}
      <div className={`p-6 rounded-xl border shadow-sm transition-all duration-300 ${
        theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
      }`}>
        <div className="flex items-center space-x-2.5 mb-5 pb-3 border-b border-slate-200 dark:border-slate-800">
          <span className="w-6 h-6 rounded-full bg-yellow-500 text-slate-950 flex items-center justify-center text-xs font-black">1</span>
          <h2 className="font-bold text-base">Select Target Country & Administrative Tier</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Select Country */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Target Country
            </label>
            <div className="relative">
              <select
                value={selectedCountryCode}
                onChange={(e) => {
                  setSelectedCountryCode(e.target.value);
                  setParsedRows([]);
                }}
                className={`w-full text-sm font-semibold rounded-lg px-3.5 py-2.5 appearance-none cursor-pointer border ${inputClasses} ${focusClasses}`}
              >
                {countries.map(c => (
                  <option key={c.countryCode} value={c.countryCode}>
                    {c.name} ({c.countryCode}) - {c.numberOfAdminLevels || 3} Levels
                  </option>
                ))}
              </select>
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none flex items-center space-x-2">
                {selectedCountry && <FlagIcon countryCode={selectedCountry.countryCode} countryName={selectedCountry.name} />}
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </div>
            </div>
          </div>

          {/* Select Target Admin Level (e.g. Village Level 3 in Uganda) */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Target Upload Level
            </label>
            <div className="relative">
              <select
                value={targetLevel}
                onChange={(e) => {
                  setTargetLevel(parseInt(e.target.value, 10));
                  setParsedRows([]);
                }}
                className={`w-full text-sm font-semibold rounded-lg px-3.5 py-2.5 appearance-none cursor-pointer border ${inputClasses} ${focusClasses}`}
              >
                {levelDefinitions.map(lvl => (
                  <option key={lvl.level} value={lvl.level}>
                    Level {lvl.level}: {lvl.name} {lvl.level === 3 ? '(e.g. Village in Uganda)' : ''}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Currently {existingTargetLocations.length} locations defined at this level.
            </p>
          </div>

          {/* Alignment Strategy */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Parent Tier Alignment Strategy
            </label>
            <div className="relative">
              <select
                value={alignmentMode}
                onChange={(e) => {
                  setAlignmentMode(e.target.value as any);
                  if (parsedRows.length > 0) {
                    // Re-run matching on existing rows
                    processRawItems(parsedRows.map(r => ({
                      name: r.name,
                      parent: r.parentName,
                      region: r.regionName,
                      lat: r.latitude,
                      lng: r.longitude,
                      code: r.code
                    })));
                  }
                }}
                className={`w-full text-sm font-semibold rounded-lg px-3.5 py-2.5 appearance-none cursor-pointer border ${inputClasses} ${focusClasses}`}
              >
                <option value="by-column">Auto-Match by {parentLevelName} Column in File</option>
                <option value="single-parent">Assign All to a Specific {parentLevelName}</option>
                <option value="multi-tier">Multi-Tier Hierarchy (Region -&gt; District -&gt; Village)</option>
              </select>
              <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              {alignmentMode === 'by-column' && `Matches each village to the district named in the file.`}
              {alignmentMode === 'single-parent' && `Attaches all rows directly to the chosen ${parentLevelName}.`}
              {alignmentMode === 'multi-tier' && `Imports complete Region, District, and Village tree.`}
            </p>
          </div>
        </div>

        {/* Specific Single Parent District Selector (if mode is 'single-parent') */}
        {alignmentMode === 'single-parent' && (
          <div className={`mt-4 p-4 rounded-lg border ${
            theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center space-x-2">
                <Building2 className="w-5 h-5 text-yellow-500" />
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Target Parent {parentLevelName}:</span>
                  <p className="text-xs text-slate-500">Every village uploaded will be assigned directly under this {parentLevelName}.</p>
                </div>
              </div>

              <select
                value={selectedSingleParentId}
                onChange={(e) => {
                  setSelectedSingleParentId(e.target.value);
                  if (parsedRows.length > 0) {
                    processRawItems(parsedRows.map(r => ({
                      name: r.name,
                      parent: r.parentName,
                      region: r.regionName,
                      lat: r.latitude,
                      lng: r.longitude
                    })));
                  }
                }}
                className={`text-sm font-bold rounded-lg px-4 py-2 border min-w-[240px] ${inputClasses} ${focusClasses}`}
              >
                {existingParentAreas.map(p => (
                  <option key={p.id} value={p.id.toString()}>
                    {p.name} (#{p.id})
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Auto Create Missing Parent Configuration */}
        {alignmentMode !== 'single-parent' && (
          <div className={`mt-4 p-4 rounded-lg border flex flex-col md:flex-row md:items-center justify-between gap-4 ${
            theme === 'dark' ? 'bg-slate-800/30 border-slate-800' : 'bg-slate-50/80 border-slate-200'
          }`}>
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={autoCreateMissingParents}
                onChange={e => setAutoCreateMissingParents(e.target.checked)}
                className="w-4 h-4 text-yellow-500 rounded focus:ring-yellow-500 bg-slate-900 border-slate-700"
              />
              <div>
                <span className="text-xs font-bold text-slate-200">Auto-create new {parentLevelName}s if not already existing in {selectedCountry?.name}</span>
                <p className="text-[11px] text-slate-400">Example: If file contains village for "Gulu" and Gulu is not in the system, automatically create Gulu district.</p>
              </div>
            </label>

            {autoCreateMissingParents && existingRegions.length > 0 && (
              <div className="flex items-center space-x-2">
                <span className="text-xs text-slate-400 whitespace-nowrap">Default Region:</span>
                <select
                  value={defaultMissingParentRegionId}
                  onChange={e => setDefaultMissingParentRegionId(e.target.value)}
                  className={`text-xs font-semibold rounded px-2.5 py-1.5 border ${inputClasses}`}
                >
                  {existingRegions.map(r => (
                    <option key={r.id} value={r.id.toString()}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Step 2: Upload / Paste / Sample Loader Card */}
      <div className={`p-6 rounded-xl border shadow-sm transition-all duration-300 ${
        theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
      }`}>
        <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center space-x-2.5">
            <span className="w-6 h-6 rounded-full bg-yellow-500 text-slate-950 flex items-center justify-center text-xs font-black">2</span>
            <h2 className="font-bold text-base">Provide Location Data</h2>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleLoadUgandaPreset}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 border border-yellow-500/30 rounded-md text-xs font-black transition-all"
              title="Load 24+ sample villages across Mukono, Kampala, Wakiso, Jinja, Mbarara, Gulu"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Load Uganda Sample Preset</span>
            </button>
          </div>
        </div>

        {/* Channel Tabs */}
        <div className="flex border-b border-slate-700 mb-5">
          <button
            onClick={() => setInputTab('file')}
            className={`py-2.5 px-5 font-bold text-xs flex items-center space-x-2 border-b-2 -mb-px transition-all ${
              inputTab === 'file'
                ? 'border-yellow-500 text-yellow-500'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>Upload File (CSV, Excel TSV, TXT)</span>
          </button>

          <button
            onClick={() => setInputTab('paste')}
            className={`py-2.5 px-5 font-bold text-xs flex items-center space-x-2 border-b-2 -mb-px transition-all ${
              inputTab === 'paste'
                ? 'border-yellow-500 text-yellow-500'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Paste Spreadsheet Rows</span>
          </button>
        </div>

        {/* Tab 1: File Drop Zone */}
        {inputTab === 'file' && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${
              dragOver 
                ? 'border-yellow-500 bg-yellow-500/10' 
                : (theme === 'dark' ? 'border-slate-700 bg-slate-800/30 hover:border-slate-600 hover:bg-slate-800/50' : 'border-slate-300 bg-slate-50 hover:border-slate-400')
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleFileUpload(e.target.files[0]);
                }
              }}
              accept=".csv,.txt,.tsv,.json"
              className="hidden"
            />
            
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-yellow-500/10 text-yellow-500 flex items-center justify-center">
              <Upload className="w-6 h-6" />
            </div>

            {fileName ? (
              <div>
                <span className="font-bold text-sm text-yellow-500 flex items-center justify-center space-x-1.5">
                  <Check className="w-4 h-4" />
                  <span>{fileName}</span>
                </span>
                <p className="text-xs text-slate-400 mt-0.5">{fileSize} • Click to replace file</p>
              </div>
            ) : (
              <div>
                <p className="font-bold text-sm text-slate-200">
                  Drop your CSV or spreadsheet file here, or <span className="text-yellow-500 underline">browse</span>
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Supports comma, tab, or semicolon delimited files (.csv, .tsv, .txt)
                </p>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Paste Rows Text Area */}
        {inputTab === 'paste' && (
          <div className="space-y-3">
            <textarea
              rows={6}
              value={pasteContent}
              onChange={e => setPasteContent(e.target.value)}
              placeholder={`Village Name, District Name, Region Name, Latitude, Longitude\nKiwanga Central, Mukono, Central, 0.352, 32.731\nSeeta Ward 1, Mukono, Central, 0.364, 32.705\nKomamboga Central, Kampala, Central, 0.380, 32.585\nKira Town, Wakiso, Central, 0.398, 32.645`}
              className={`w-full font-mono text-xs rounded-lg p-3 border ${inputClasses} ${focusClasses}`}
            />
            <div className="flex justify-between items-center">
              <span className="text-[11px] text-slate-400">Copy & paste rows directly from Excel or Google Sheets.</span>
              <button
                type="button"
                onClick={() => parseCSVText(pasteContent)}
                disabled={!pasteContent.trim()}
                className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-lg flex items-center space-x-1.5 transition-all shadow"
              >
                <Check className="w-4 h-4" />
                <span>Parse Pasted Content</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Step 3: Interactive Alignment Matrix & Preview Table (Shows after parsing) */}
      {parsedRows.length > 0 && (
        <div className={`p-6 rounded-xl border shadow-sm transition-all duration-300 ${
          theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
        }`}>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-5 pb-3 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center space-x-2.5">
              <span className="w-6 h-6 rounded-full bg-yellow-500 text-slate-950 flex items-center justify-center text-xs font-black">3</span>
              <div>
                <h2 className="font-bold text-base">Location Alignment Matrix & Data Verification</h2>
                <p className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                  Review how each village is aligned to its parent {parentLevelName}. Edit or override assignments row-by-row before committing.
                </p>
              </div>
            </div>

            {/* Summary Badges */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 text-xs font-bold font-mono">
                Total: {stats.total}
              </span>
              <span className="px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-400 text-xs font-bold font-mono flex items-center space-x-1">
                <CheckCircle className="w-3 h-3" />
                <span>Valid: {stats.valid}</span>
              </span>
              {stats.newParents > 0 && (
                <span className="px-2.5 py-1 rounded bg-blue-500/20 text-blue-400 text-xs font-bold font-mono">
                  + {stats.newParents} New {parentLevelName}s
                </span>
              )}
              {stats.duplicates > 0 && (
                <span className="px-2.5 py-1 rounded bg-yellow-500/20 text-yellow-400 text-xs font-bold font-mono">
                  {stats.duplicates} Existing (Skipped)
                </span>
              )}
              {stats.warnings > 0 && (
                <span className="px-2.5 py-1 rounded bg-red-500/20 text-red-400 text-xs font-bold font-mono flex items-center space-x-1">
                  <AlertTriangle className="w-3 h-3" />
                  <span>{stats.warnings} Missing Parent</span>
                </span>
              )}
            </div>
          </div>

          {/* Filter & Batch Actions Bar */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 mb-4">
            <div className="flex flex-wrap items-center gap-2.5 flex-1">
              <div className="relative min-w-[200px] flex-1 max-w-xs">
                <input
                  type="text"
                  placeholder="Search parsed locations or districts..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className={`w-full text-xs rounded-lg pl-8 pr-3 py-2 border ${inputClasses} ${focusClasses}`}
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              </div>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className={`text-xs rounded-lg px-2.5 py-2 border ${inputClasses}`}
              >
                <option value="all">All Statuses ({parsedRows.length})</option>
                <option value="valid">Aligned & Ready ({stats.valid})</option>
                <option value="new_parent">New Parent Districts ({stats.newParents})</option>
                <option value="warning">Unassigned Parents ({stats.warnings})</option>
                <option value="duplicate">Duplicates ({stats.duplicates})</option>
              </select>

              {/* Parent Filter */}
              {uniqueParsedParents.length > 1 && (
                <select
                  value={parentFilter}
                  onChange={e => setParentFilter(e.target.value)}
                  className={`text-xs rounded-lg px-2.5 py-2 border ${inputClasses}`}
                >
                  <option value="all">All Parent {parentLevelName}s</option>
                  {uniqueParsedParents.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex items-center space-x-2 self-end md:self-auto">
              <button
                type="button"
                onClick={() => handleToggleAllSelection(true)}
                className="text-xs font-bold px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                Select All
              </button>
              <button
                type="button"
                onClick={() => handleToggleAllSelection(false)}
                className="text-xs font-bold px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                Deselect All
              </button>
            </div>
          </div>

          {/* Preview Table */}
          <div className="border border-slate-800 rounded-lg overflow-hidden mb-6">
            <div className="overflow-x-auto max-h-96">
              <table className={`min-w-full divide-y ${theme === 'dark' ? 'divide-slate-800' : 'divide-slate-200'}`}>
                <thead className={`sticky top-0 z-10 ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-100'}`}>
                  <tr>
                    <th scope="col" className="px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-slate-400 w-10">
                      <input
                        type="checkbox"
                        checked={stats.selected === stats.total && stats.total > 0}
                        onChange={e => handleToggleAllSelection(e.target.checked)}
                        className="rounded text-yellow-500 focus:ring-yellow-500 bg-slate-900 border-slate-700"
                      />
                    </th>
                    <th scope="col" className="px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-slate-400">
                      #
                    </th>
                    <th scope="col" className="px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-slate-400">
                      {targetLevelName} Name
                    </th>
                    <th scope="col" className="px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-slate-400">
                      Parent {parentLevelName} Alignment
                    </th>
                    <th scope="col" className="px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-slate-400">
                      Region / Coordinates
                    </th>
                    <th scope="col" className="px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-slate-400">
                      Alignment Status
                    </th>
                    <th scope="col" className="px-3 py-2.5 text-right text-xs font-bold uppercase tracking-wider text-slate-400">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${theme === 'dark' ? 'divide-slate-800 bg-slate-900/40' : 'divide-slate-200 bg-white'}`}>
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-500 text-xs">
                        No locations match the current search or filter.
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((row, idx) => (
                      <tr 
                        key={row.id} 
                        className={`transition-colors ${
                          !row.selected 
                            ? 'opacity-40 bg-slate-900/10' 
                            : (row.status === 'valid' ? 'hover:bg-slate-800/20' : row.status === 'new_parent' ? 'bg-blue-950/10 hover:bg-blue-950/20' : 'bg-red-950/10 hover:bg-red-950/20')
                        }`}
                      >
                        {/* Checkbox */}
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={row.selected}
                            onChange={() => handleToggleRowSelection(row.id)}
                            className="rounded text-yellow-500 focus:ring-yellow-500 bg-slate-900 border-slate-700"
                          />
                        </td>

                        {/* Index */}
                        <td className="px-3 py-2.5 text-xs font-mono text-slate-500 whitespace-nowrap">
                          {idx + 1}
                        </td>

                        {/* Location Name (Editable) */}
                        <td className="px-3 py-2.5">
                          <input
                            type="text"
                            value={row.name}
                            onChange={e => handleUpdateRowName(row.id, e.target.value)}
                            className={`w-full max-w-xs text-xs font-bold rounded px-2 py-1 border ${inputClasses}`}
                          />
                        </td>

                        {/* Parent District Dropdown */}
                        <td className="px-3 py-2.5">
                          <div className="flex items-center space-x-1.5">
                            <select
                              value={row.matchedParentId ? row.matchedParentId.toString() : ''}
                              onChange={e => handleUpdateRowParent(row.id, e.target.value)}
                              className={`text-xs rounded px-2 py-1 border max-w-xs ${inputClasses} ${
                                row.matchedParentId ? 'font-semibold text-emerald-400' : 'text-yellow-400 font-bold'
                              }`}
                            >
                              <option value="">
                                {row.parentName ? `-- Create New: "${row.parentName}" --` : `-- Unassigned --`}
                              </option>
                              {existingParentAreas.map(p => (
                                <option key={p.id} value={p.id.toString()}>
                                  {p.name} (#{p.id})
                                </option>
                              ))}
                            </select>
                          </div>
                        </td>

                        {/* Region / Lat / Lng */}
                        <td className="px-3 py-2.5 text-xs text-slate-400 whitespace-nowrap">
                          <div className="flex items-center space-x-2">
                            {row.regionName && (
                              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[11px] font-mono text-slate-300">
                                {row.regionName}
                              </span>
                            )}
                            {row.latitude !== undefined && row.longitude !== undefined && (
                              <span className="text-[10px] font-mono text-slate-500" title={`Lat: ${row.latitude}, Lng: ${row.longitude}`}>
                                📍 {row.latitude.toFixed(2)}, {row.longitude.toFixed(2)}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Status Badge */}
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          {row.status === 'valid' && (
                            <span className="inline-flex items-center space-x-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                              <CheckCircle className="w-3 h-3" />
                              <span>{row.statusMessage}</span>
                            </span>
                          )}
                          {row.status === 'new_parent' && (
                            <span className="inline-flex items-center space-x-1 text-[11px] font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                              <Plus className="w-3 h-3" />
                              <span>{row.statusMessage}</span>
                            </span>
                          )}
                          {row.status === 'duplicate' && (
                            <span className="inline-flex items-center space-x-1 text-[11px] font-bold text-yellow-400 bg-yellow-500/10 px-2 py-0.5 rounded border border-yellow-500/20">
                              <AlertTriangle className="w-3 h-3" />
                              <span>Duplicate (Will be skipped)</span>
                            </span>
                          )}
                          {row.status === 'warning' && (
                            <span className="inline-flex items-center space-x-1 text-[11px] font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">
                              <AlertTriangle className="w-3 h-3" />
                              <span>{row.statusMessage}</span>
                            </span>
                          )}
                        </td>

                        {/* Delete Row */}
                        <td className="px-3 py-2.5 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleDeleteRow(row.id)}
                            className="p-1 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded transition-colors"
                            title="Remove row"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Commit Actions & Summary Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-4 border-t border-slate-800">
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-5 h-5 text-yellow-500" />
              <div>
                <span className="text-xs font-bold text-slate-200">
                  Ready to Commit {stats.selected} Locations into {selectedCountry?.name}
                </span>
                <p className="text-[11px] text-slate-400">
                  Locations will be assigned permanent IDs and aligned to administrative boundaries.
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={() => setParsedRows([])}
                className="px-4 py-2 rounded-lg text-xs font-bold border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors"
              >
                Clear All
              </button>

              <button
                type="button"
                onClick={handleCommitUpload}
                disabled={isSubmitting || stats.selected === 0}
                className="px-6 py-2.5 bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 text-slate-950 font-black text-xs rounded-lg flex items-center space-x-2 shadow-lg transition-all"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Saving Locations...</span>
                  </>
                ) : (
                  <>
                    <Database className="w-4 h-4" />
                    <span>Commit &amp; Save to {selectedCountry?.name}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 4: Live Country Hierarchy Visualizer (Tree View) */}
      <div className={`p-6 rounded-xl border shadow-sm transition-all duration-300 ${
        theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
      }`}>
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center space-x-2.5">
            <span className="p-1.5 rounded bg-yellow-500/10 text-yellow-500">
              <Layers className="w-5 h-5" />
            </span>
            <div>
              <h2 className="font-bold text-base">
                Current {selectedCountry?.name} Administrative Hierarchy Tree
              </h2>
              <p className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                Interactive structural breakdown of Regions, Districts, and Mapped Villages.
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowHierarchyTree(!showHierarchyTree)}
            className="text-xs font-bold text-slate-400 hover:text-slate-200 flex items-center space-x-1"
          >
            <span>{showHierarchyTree ? 'Collapse Tree' : 'Expand Tree'}</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${showHierarchyTree ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {showHierarchyTree && selectedCountry && (
          <div className="space-y-3 font-mono text-xs">
            {existingRegions.length === 0 ? (
              <div className="p-4 text-center text-slate-500">
                No administrative levels defined yet for {selectedCountry.name}. Use Country Admin Levels page to define custom levels.
              </div>
            ) : (
              existingRegions.map(region => {
                const isRegionExpanded = expandedRegions[region.id] !== false; // Default open
                const childDistricts = selectedCountry.adminLevels.filter(
                  al => al.level === 2 && al.parentAdminLevelId === region.id
                );

                return (
                  <div key={region.id} className="border border-slate-800 rounded-lg overflow-hidden bg-slate-950/30">
                    {/* Region Level 1 Header */}
                    <div 
                      onClick={() => setExpandedRegions(prev => ({ ...prev, [region.id]: !isRegionExpanded }))}
                      className="p-3 bg-slate-800/40 hover:bg-slate-800/60 cursor-pointer flex items-center justify-between transition-colors"
                    >
                      <div className="flex items-center space-x-2">
                        <ChevronRight className={`w-4 h-4 text-yellow-500 transition-transform ${isRegionExpanded ? 'rotate-90' : ''}`} />
                        <span className="font-black text-slate-200">{region.name} Region</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400 font-bold">
                          Level 1
                        </span>
                      </div>
                      <span className="text-xs text-slate-400">
                        {childDistricts.length} Districts
                      </span>
                    </div>

                    {/* Districts Level 2 List */}
                    {isRegionExpanded && (
                      <div className="p-3 pl-8 space-y-2.5 border-t border-slate-800/60">
                        {childDistricts.length === 0 ? (
                          <div className="text-slate-500 text-[11px]">
                            No districts defined in {region.name} yet.
                          </div>
                        ) : (
                          childDistricts.map(district => {
                            const isDistrictExpanded = expandedDistricts[district.id] !== false;
                            const childVillages = selectedCountry.adminLevels.filter(
                              al => al.level === 3 && al.parentAdminLevelId === district.id
                            );

                            return (
                              <div key={district.id} className="border border-slate-800/80 rounded bg-slate-900/50 p-2.5">
                                <div 
                                  onClick={() => setExpandedDistricts(prev => ({ ...prev, [district.id]: !isDistrictExpanded }))}
                                  className="flex items-center justify-between cursor-pointer"
                                >
                                  <div className="flex items-center space-x-2">
                                    <ChevronRight className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isDistrictExpanded ? 'rotate-90' : ''}`} />
                                    <span className="font-bold text-slate-300">{district.name} District</span>
                                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                                      Level 2 (#{district.id})
                                    </span>
                                  </div>
                                  <span className="text-[11px] font-bold text-slate-400">
                                    {childVillages.length} Villages
                                  </span>
                                </div>

                                {/* Villages Level 3 Pills */}
                                {isDistrictExpanded && childVillages.length > 0 && (
                                  <div className="mt-2.5 pt-2 border-t border-slate-800 flex flex-wrap gap-1.5">
                                    {childVillages.map(village => (
                                      <span
                                        key={village.id}
                                        className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px]"
                                      >
                                        <MapPin className="w-2.5 h-2.5 text-yellow-500" />
                                        <span>{village.name}</span>
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

    </div>
  );
};

export default CountryLocationsUploadPage;
