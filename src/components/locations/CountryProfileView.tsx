import React, { useState, useMemo, useRef } from 'react';
import { Theme, Country, AdminLevel, CurrencyDenominator } from '../../types';
import Icon, { IconName } from '../shared/Icon';
import { formatDate } from '../../shared/utils';
import { 
  Coins, 
  Banknote, 
  Layers, 
  Globe, 
  Building2, 
  Vote, 
  Plus, 
  Trash2, 
  Edit, 
  Check, 
  X, 
  Filter, 
  LayoutGrid, 
  Table, 
  Sparkles,
  ArrowRight,
  TrendingUp,
  ShieldCheck,
  Award,
  Upload,
  Image as ImageIcon,
  Eye,
  ZoomIn,
  Camera,
  FileImage,
  RefreshCw,
  Download,
  HelpCircle,
  Maximize2
} from 'lucide-react';

interface CountryProfileViewProps {
    theme: Theme;
    country: Country;
    onBack: () => void;
    onSelectLevel?: (level: number) => void;
    onEditLevels?: () => void;
    onUpdateCountry?: (updatedCountry: Country) => Promise<void> | void;
}

type ProfileTab = 'overview' | 'currency-denominations' | 'hierarchy-tiers' | 'areas-directory' | 'electoral-economic';

// Helper to convert uploaded File into base64 with lightweight downscaling
const readFileAsBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Please select a valid image file.'));
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (file.size > 1.5 * 1024 * 1024) {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1200;
          const MAX_HEIGHT = 1200;
          let width = img.width;
          let height = img.height;
          if (width > height) {
            if (width > MAX_WIDTH) {
              height = Math.round((height * MAX_WIDTH) / width);
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width = Math.round((width * MAX_HEIGHT) / height);
              height = MAX_HEIGHT;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.onerror = () => resolve(result);
        img.src = result;
      } else {
        resolve(result);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });
};

// Reusable Image Upload Dropzone Component for Front and Back specimen images
interface ImageUploadDropzoneProps {
  label: string;
  side: 'front' | 'back';
  imageUrl?: string;
  onImageChange: (base64Url?: string) => void;
  type: 'Note' | 'Coin';
  theme: Theme;
  onInspect?: () => void;
}

const ImageUploadDropzone: React.FC<ImageUploadDropzoneProps> = ({
  label,
  side,
  imageUrl,
  onImageChange,
  type,
  theme,
  onInspect
}) => {
  const isDark = theme === 'dark';
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlValue, setUrlValue] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    try {
      setUploadError(null);
      const base64 = await readFileAsBase64(file);
      onImageChange(base64);
    } catch (err: any) {
      setUploadError(err.message || 'Error uploading image');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (urlValue.trim()) {
      onImageChange(urlValue.trim());
      setUrlValue('');
      setShowUrlInput(false);
    }
  };

  return (
    <div className="space-y-1.5 flex-1">
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-300 flex items-center space-x-1.5">
          <Camera className="w-3.5 h-3.5 text-yellow-400" />
          <span>{label}</span>
        </label>
        {imageUrl ? (
          <div className="flex items-center space-x-1">
            {onInspect && (
              <button
                type="button"
                onClick={onInspect}
                className="text-[10px] text-blue-400 hover:text-blue-300 font-bold px-1.5 py-0.5 rounded hover:bg-blue-500/10 flex items-center space-x-1"
                title="Inspect image"
              >
                <ZoomIn className="w-3 h-3" />
                <span>Zoom</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => onImageChange(undefined)}
              className="text-[10px] text-red-400 hover:text-red-300 font-bold px-1.5 py-0.5 rounded hover:bg-red-500/10 flex items-center space-x-1"
            >
              <Trash2 className="w-3 h-3" />
              <span>Remove</span>
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowUrlInput(!showUrlInput)}
            className="text-[10px] text-yellow-400 hover:underline font-semibold"
          >
            {showUrlInput ? 'Upload File' : 'Paste URL'}
          </button>
        )}
      </div>

      {showUrlInput && !imageUrl ? (
        <div className="flex space-x-1">
          <input
            type="url"
            placeholder="Paste image web link (https://...)"
            value={urlValue}
            onChange={(e) => setUrlValue(e.target.value)}
            className={`flex-1 px-2.5 py-1.5 rounded-lg border text-xs ${
              isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
            }`}
          />
          <button
            type="button"
            onClick={handleUrlSubmit}
            className="px-3 py-1.5 bg-yellow-500 hover:bg-yellow-600 text-slate-950 text-xs font-bold rounded-lg"
          >
            Apply
          </button>
        </div>
      ) : imageUrl ? (
        <div 
          className={`relative group overflow-hidden rounded-xl border flex items-center justify-center ${
            isDark ? 'bg-slate-950 border-slate-700' : 'bg-slate-100 border-slate-300'
          } ${type === 'Coin' ? 'h-32 w-32 mx-auto rounded-full' : 'h-32 w-full'}`}
        >
          <img
            src={imageUrl}
            alt={label}
            className={`w-full h-full ${type === 'Coin' ? 'object-cover rounded-full' : 'object-cover rounded-xl'}`}
          />
          <div className="absolute inset-0 bg-slate-950/70 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center space-y-2 p-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1 bg-yellow-500 hover:bg-yellow-600 text-slate-950 text-xs font-bold rounded-lg flex items-center space-x-1 shadow"
            >
              <Upload className="w-3 h-3" />
              <span>Change Image</span>
            </button>
            {onInspect && (
              <button
                type="button"
                onClick={onInspect}
                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg flex items-center space-x-1 border border-slate-600"
              >
                <Eye className="w-3 h-3" />
                <span>Full Specimen</span>
              </button>
            )}
          </div>
          <span className="absolute bottom-1.5 left-2 bg-slate-900/90 text-yellow-400 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border border-yellow-500/30">
            {side === 'front' ? 'OBVERSE' : 'REVERSE'}
          </span>
        </div>
      ) : (
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`cursor-pointer rounded-xl border-2 border-dashed p-4 text-center transition-all flex flex-col items-center justify-center space-y-1.5 ${
            isDragging 
              ? 'border-yellow-500 bg-yellow-500/10' 
              : isDark 
                ? 'border-slate-700/80 bg-slate-950/60 hover:border-yellow-500/50 hover:bg-slate-900/80' 
                : 'border-slate-300 bg-slate-50 hover:border-yellow-500/60 hover:bg-yellow-50/50'
          } ${type === 'Coin' ? 'h-32 w-32 mx-auto rounded-full' : 'h-32 w-full'}`}
        >
          <div className="p-2 rounded-full bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">
            <Upload className="w-4 h-4" />
          </div>
          <div className="space-y-0.5">
            <p className="text-xs font-bold text-slate-200">
              Drop {side === 'front' ? 'Front' : 'Back'} Image
            </p>
            <p className="text-[10px] text-slate-400">or click to browse local file</p>
          </div>
        </div>
      )}

      {uploadError && (
        <p className="text-[10px] text-red-400 font-semibold">{uploadError}</p>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFileSelect(e.target.files)}
      />
    </div>
  );
};

// Interactive Table Cell for Front / Back Specimen image with direct upload & thumbnail
interface TableSpecimenCellProps {
  denom: CurrencyDenominator;
  side: 'front' | 'back';
  theme: Theme;
  onUpload: (denomId: number, side: 'front' | 'back', file: File) => void;
  onRemove: (denomId: number, side: 'front' | 'back') => void;
  onInspect: (denom: CurrencyDenominator) => void;
}

const TableSpecimenCell: React.FC<TableSpecimenCellProps> = ({
  denom,
  side,
  theme,
  onUpload,
  onRemove,
  onInspect
}) => {
  const isDark = theme === 'dark';
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const imageUrl = side === 'front' ? denom.frontImage : denom.backImage;

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onUpload(denom.id, side, e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onUpload(denom.id, side, e.target.files[0]);
      e.target.value = '';
    }
  };

  return (
    <div className="relative">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {imageUrl ? (
        <div 
          className={`relative group rounded-lg overflow-hidden border transition-all cursor-pointer shadow-sm ${
            isDark ? 'bg-slate-950 border-slate-700' : 'bg-slate-100 border-slate-300'
          } ${denom.type === 'Coin' ? 'w-12 h-12 rounded-full mx-auto' : 'w-24 h-14'}`}
          onClick={() => onInspect(denom)}
          title={`Click to view ${side === 'front' ? 'Front' : 'Back'} Specimen Lightbox`}
        >
          <img
            src={imageUrl}
            alt={`${denom.label} ${side}`}
            className="w-full h-full object-cover"
          />
          {/* Side badge */}
          <span className="absolute bottom-0.5 right-0.5 bg-black/80 text-yellow-400 font-mono text-[8px] font-bold px-1 rounded">
            {side === 'front' ? 'OBV' : 'REV'}
          </span>

          {/* Hover overlay with action buttons */}
          <div className="absolute inset-0 bg-black/75 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-1 p-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onInspect(denom);
              }}
              className="p-1 rounded bg-blue-600 hover:bg-blue-500 text-white"
              title="Inspect"
            >
              <Eye className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              className="p-1 rounded bg-yellow-500 hover:bg-yellow-400 text-slate-950"
              title="Replace image"
            >
              <Upload className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(denom.id, side);
              }}
              className="p-1 rounded bg-red-600 hover:bg-red-500 text-white"
              title="Remove image"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      ) : (
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`cursor-pointer rounded-lg border border-dashed transition-all flex flex-col items-center justify-center space-y-0.5 p-1.5 ${
            isDragOver
              ? 'border-yellow-400 bg-yellow-500/20'
              : isDark
                ? 'border-slate-700 hover:border-yellow-500/60 bg-slate-900/60 hover:bg-slate-900'
                : 'border-slate-300 hover:border-yellow-500/80 bg-slate-50 hover:bg-yellow-50/50'
          } ${denom.type === 'Coin' ? 'w-12 h-12 rounded-full mx-auto' : 'w-24 h-14'}`}
          title={`Upload ${side === 'front' ? 'Front Side' : 'Back Side'} Image (Click or Drag File)`}
        >
          <Upload className="w-3.5 h-3.5 text-slate-400 group-hover:text-yellow-400" />
          <span className="text-[9px] font-bold text-slate-400">
            +{side === 'front' ? 'Front' : 'Back'}
          </span>
        </div>
      )}
    </div>
  );
};

const DEFAULT_DENOMINATIONS_MAP: Record<string, CurrencyDenominator[]> = {
  UG: [
    { id: 1, value: 50000, label: '50,000', type: 'Note', status: 'Active' },
    { id: 2, value: 20000, label: '20,000', type: 'Note', status: 'Active' },
    { id: 3, value: 10000, label: '10,000', type: 'Note', status: 'Active' },
    { id: 4, value: 5000, label: '5,000', type: 'Note', status: 'Active' },
    { id: 5, value: 2000, label: '2,000', type: 'Note', status: 'Active' },
    { id: 6, value: 1000, label: '1,000', type: 'Note', status: 'Active' },
    { id: 7, value: 1000, label: '1,000', type: 'Coin', status: 'Active' },
    { id: 8, value: 500, label: '500', type: 'Coin', status: 'Active' },
    { id: 9, value: 200, label: '200', type: 'Coin', status: 'Active' },
    { id: 10, value: 100, label: '100', type: 'Coin', status: 'Active' },
    { id: 11, value: 50, label: '50', type: 'Coin', status: 'Active' }
  ],
  KE: [
    { id: 1, value: 1000, label: '1,000', type: 'Note', status: 'Active' },
    { id: 2, value: 500, label: '500', type: 'Note', status: 'Active' },
    { id: 3, value: 200, label: '200', type: 'Note', status: 'Active' },
    { id: 4, value: 100, label: '100', type: 'Note', status: 'Active' },
    { id: 5, value: 50, label: '50', type: 'Note', status: 'Active' },
    { id: 6, value: 40, label: '40', type: 'Coin', status: 'Active' },
    { id: 7, value: 20, label: '20', type: 'Coin', status: 'Active' },
    { id: 8, value: 10, label: '10', type: 'Coin', status: 'Active' },
    { id: 9, value: 5, label: '5', type: 'Coin', status: 'Active' },
    { id: 10, value: 1, label: '1', type: 'Coin', status: 'Active' }
  ],
  TZ: [
    { id: 1, value: 10000, label: '10,000', type: 'Note', status: 'Active' },
    { id: 2, value: 5000, label: '5,000', type: 'Note', status: 'Active' },
    { id: 3, value: 2000, label: '2,000', type: 'Note', status: 'Active' },
    { id: 4, value: 1000, label: '1,000', type: 'Note', status: 'Active' },
    { id: 5, value: 500, label: '500', type: 'Note', status: 'Active' },
    { id: 6, value: 500, label: '500', type: 'Coin', status: 'Active' },
    { id: 7, value: 200, label: '200', type: 'Coin', status: 'Active' },
    { id: 8, value: 100, label: '100', type: 'Coin', status: 'Active' },
    { id: 9, value: 50, label: '50', type: 'Coin', status: 'Active' }
  ],
  RW: [
    { id: 1, value: 5000, label: '5,000', type: 'Note', status: 'Active' },
    { id: 2, value: 2000, label: '2,000', type: 'Note', status: 'Active' },
    { id: 3, value: 1000, label: '1,000', type: 'Note', status: 'Active' },
    { id: 4, value: 500, label: '500', type: 'Note', status: 'Active' },
    { id: 5, value: 100, label: '100', type: 'Coin', status: 'Active' },
    { id: 6, value: 50, label: '50', type: 'Coin', status: 'Active' },
    { id: 7, value: 20, label: '20', type: 'Coin', status: 'Active' },
    { id: 8, value: 10, label: '10', type: 'Coin', status: 'Active' },
    { id: 9, value: 5, label: '5', type: 'Coin', status: 'Active' },
    { id: 10, value: 1, label: '1', type: 'Coin', status: 'Active' }
  ],
  NG: [
    { id: 1, value: 1000, label: '1,000', type: 'Note', status: 'Active' },
    { id: 2, value: 500, label: '500', type: 'Note', status: 'Active' },
    { id: 3, value: 200, label: '200', type: 'Note', status: 'Active' },
    { id: 4, value: 100, label: '100', type: 'Note', status: 'Active' },
    { id: 5, value: 50, label: '50', type: 'Note', status: 'Active' },
    { id: 6, value: 20, label: '20', type: 'Note', status: 'Active' },
    { id: 7, value: 10, label: '10', type: 'Note', status: 'Active' },
    { id: 8, value: 5, label: '5', type: 'Note', status: 'Active' },
    { id: 9, value: 2, label: '2', type: 'Coin', status: 'Active' },
    { id: 10, value: 1, label: '1', type: 'Coin', status: 'Active' }
  ],
  ZA: [
    { id: 1, value: 200, label: '200', type: 'Note', status: 'Active' },
    { id: 2, value: 100, label: '100', type: 'Note', status: 'Active' },
    { id: 3, value: 50, label: '50', type: 'Note', status: 'Active' },
    { id: 4, value: 20, label: '20', type: 'Note', status: 'Active' },
    { id: 5, value: 10, label: '10', type: 'Note', status: 'Active' },
    { id: 6, value: 5, label: '5', type: 'Coin', status: 'Active' },
    { id: 7, value: 2, label: '2', type: 'Coin', status: 'Active' },
    { id: 8, value: 1, label: '1', type: 'Coin', status: 'Active' },
    { id: 9, value: 0.5, label: '50c', type: 'Coin', status: 'Active' },
    { id: 10, value: 0.2, label: '20c', type: 'Coin', status: 'Active' },
    { id: 11, value: 0.1, label: '10c', type: 'Coin', status: 'Active' }
  ],
  GH: [
    { id: 1, value: 200, label: '200', type: 'Note', status: 'Active' },
    { id: 2, value: 100, label: '100', type: 'Note', status: 'Active' },
    { id: 3, value: 50, label: '50', type: 'Note', status: 'Active' },
    { id: 4, value: 20, label: '20', type: 'Note', status: 'Active' },
    { id: 5, value: 10, label: '10', type: 'Note', status: 'Active' },
    { id: 6, value: 5, label: '5', type: 'Note', status: 'Active' },
    { id: 7, value: 2, label: '2', type: 'Coin', status: 'Active' },
    { id: 8, value: 1, label: '1', type: 'Coin', status: 'Active' },
    { id: 9, value: 0.5, label: '50p', type: 'Coin', status: 'Active' }
  ],
  ET: [
    { id: 1, value: 200, label: '200', type: 'Note', status: 'Active' },
    { id: 2, value: 100, label: '100', type: 'Note', status: 'Active' },
    { id: 3, value: 50, label: '50', type: 'Note', status: 'Active' },
    { id: 4, value: 10, label: '10', type: 'Note', status: 'Active' },
    { id: 5, value: 5, label: '5', type: 'Note', status: 'Active' },
    { id: 6, value: 1, label: '1', type: 'Coin', status: 'Active' },
    { id: 7, value: 0.5, label: '50 Santim', type: 'Coin', status: 'Active' },
    { id: 8, value: 0.25, label: '25 Santim', type: 'Coin', status: 'Active' }
  ],
  EG: [
    { id: 1, value: 200, label: '200', type: 'Note', status: 'Active' },
    { id: 2, value: 100, label: '100', type: 'Note', status: 'Active' },
    { id: 3, value: 50, label: '50', type: 'Note', status: 'Active' },
    { id: 4, value: 20, label: '20', type: 'Note', status: 'Active' },
    { id: 5, value: 10, label: '10', type: 'Note', status: 'Active' },
    { id: 6, value: 5, label: '5', type: 'Note', status: 'Active' },
    { id: 7, value: 1, label: '1', type: 'Coin', status: 'Active' },
    { id: 8, value: 0.5, label: '50 Pt', type: 'Coin', status: 'Active' }
  ]
};

const FlagIcon: React.FC<{ countryCode: string; countryName: string; className?: string }> = ({ countryCode, countryName, className = "w-16 h-11" }) => {
    return (
        <div className={`${className} flex-shrink-0 flex items-center justify-center rounded-lg overflow-hidden shadow-md bg-slate-800 border border-slate-700/80`}>
            <img 
                src={`https://flagcdn.com/w160/${countryCode.toLowerCase()}.png`} 
                alt={`Flag of ${countryName}`} 
                className="w-full h-full object-cover"
                onError={(e) => {
                    const target = e.currentTarget;
                    target.style.display = 'none';
                    if (target.parentElement) {
                        target.parentElement.innerHTML = `<span class="text-xs font-bold text-yellow-400 font-mono">${countryCode}</span>`;
                    }
                }}
            />
        </div>
    );
};

const StatCard: React.FC<{
    label: string;
    value: string | number;
    subtext?: string;
    icon: IconName;
    colorClass: string;
    theme: Theme;
}> = ({ label, value, subtext, icon, colorClass, theme }) => {
    const isDark = theme === 'dark';
    return (
        <div className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
            isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-slate-50 border-slate-200'
        }`}>
            <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
                <div className={`p-2 rounded-lg ${colorClass} bg-opacity-10`}>
                    <Icon name={icon} className="h-4 w-4" />
                </div>
            </div>
            <div className="mt-3">
                <span className={`text-xl sm:text-2xl font-extrabold font-mono ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{value}</span>
                {subtext && <p className="text-[11px] text-slate-400 mt-0.5">{subtext}</p>}
            </div>
        </div>
    );
};

// Banknote Realistic Card Component
const BanknoteCard: React.FC<{
    denominator: CurrencyDenominator;
    currencySymbol: string;
    currencyCode: string;
    theme: Theme;
    onToggleStatus?: () => void;
    onEdit?: () => void;
    onDelete?: () => void;
}> = ({ denominator, currencySymbol, currencyCode, theme, onToggleStatus, onEdit, onDelete }) => {
    const isDark = theme === 'dark';
    const isActive = denominator.status === 'Active';

    return (
        <div className={`relative p-4 rounded-xl border transition-all duration-200 overflow-hidden shadow-md flex flex-col justify-between ${
            isActive 
                ? isDark 
                    ? 'bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-950 border-emerald-500/40 hover:border-emerald-400' 
                    : 'bg-gradient-to-br from-emerald-50 via-white to-slate-50 border-emerald-300 hover:border-emerald-500'
                : isDark 
                    ? 'bg-slate-950/40 border-slate-800 opacity-60' 
                    : 'bg-slate-100 border-slate-300 opacity-60'
        }`}>
            {/* Holographic / Security Strip Accent */}
            <div className="absolute top-0 right-10 bottom-0 w-2.5 bg-gradient-to-b from-yellow-500/30 via-emerald-400/40 to-yellow-500/30 pointer-events-none opacity-50 border-x border-yellow-500/20" />

            <div className="flex items-start justify-between relative z-10">
                <div className="flex items-center space-x-2">
                    <div className={`p-1.5 rounded-lg ${isActive ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-400'}`}>
                        <Banknote className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-400 font-mono">
                        Banknote
                    </span>
                </div>

                <div className="flex items-center space-x-1.5">
                    <button
                        onClick={onToggleStatus}
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border transition-colors ${
                            isActive
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                                : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                        }`}
                        title="Click to toggle active status"
                    >
                        {isActive ? 'Active Tender' : 'Inactive'}
                    </button>
                    {onEdit && (
                        <button onClick={onEdit} className="p-1 text-slate-400 hover:text-yellow-400 transition-colors" title="Edit denomination">
                            <Edit className="w-3.5 h-3.5" />
                        </button>
                    )}
                    {onDelete && (
                        <button onClick={onDelete} className="p-1 text-slate-400 hover:text-red-400 transition-colors" title="Delete denomination">
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            </div>

            {/* Note Center Value Display */}
            <div className="my-4 relative z-10">
                <div className="flex items-baseline space-x-2">
                    <span className="text-xs font-bold text-slate-400 font-mono">{currencySymbol}</span>
                    <span className={`text-2xl sm:text-3xl font-black font-mono tracking-tight ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                        {denominator.label}
                    </span>
                </div>
                <div className="flex items-center space-x-2 mt-1 text-[11px] text-slate-400">
                    <span className="font-mono">{currencyCode}</span>
                    <span>•</span>
                    <span>Official Legal Tender Note</span>
                </div>
            </div>

            <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-slate-400 font-mono relative z-10">
                <span>SN: {currencyCode}-{denominator.value}</span>
                <span className="flex items-center space-x-1 text-emerald-400">
                    <ShieldCheck className="w-3 h-3" />
                    <span>Verified Spec</span>
                </span>
            </div>
        </div>
    );
};

// Coin Realistic Card Component
const CoinCard: React.FC<{
    denominator: CurrencyDenominator;
    currencySymbol: string;
    currencyCode: string;
    theme: Theme;
    onToggleStatus?: () => void;
    onEdit?: () => void;
    onDelete?: () => void;
}> = ({ denominator, currencySymbol, currencyCode, theme, onToggleStatus, onEdit, onDelete }) => {
    const isDark = theme === 'dark';
    const isActive = denominator.status === 'Active';

    return (
        <div className={`p-4 rounded-xl border transition-all duration-200 shadow-md flex flex-col justify-between ${
            isActive 
                ? isDark 
                    ? 'bg-gradient-to-br from-amber-950/30 via-slate-900 to-slate-950 border-amber-500/40 hover:border-amber-400' 
                    : 'bg-gradient-to-br from-amber-50 via-white to-slate-50 border-amber-300 hover:border-amber-500'
                : isDark 
                    ? 'bg-slate-950/40 border-slate-800 opacity-60' 
                    : 'bg-slate-100 border-slate-300 opacity-60'
        }`}>
            <div className="flex items-start justify-between">
                <div className="flex items-center space-x-2">
                    <div className={`p-1.5 rounded-lg ${isActive ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' : 'bg-slate-800 text-slate-400'}`}>
                        <Coins className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-400 font-mono">
                        Coin Spec
                    </span>
                </div>

                <div className="flex items-center space-x-1.5">
                    <button
                        onClick={onToggleStatus}
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border transition-colors ${
                            isActive
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                                : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                        }`}
                        title="Click to toggle active status"
                    >
                        {isActive ? 'Active Coin' : 'Inactive'}
                    </button>
                    {onEdit && (
                        <button onClick={onEdit} className="p-1 text-slate-400 hover:text-yellow-400 transition-colors" title="Edit coin">
                            <Edit className="w-3.5 h-3.5" />
                        </button>
                    )}
                    {onDelete && (
                        <button onClick={onDelete} className="p-1 text-slate-400 hover:text-red-400 transition-colors" title="Delete coin">
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            </div>

            {/* Embossed Metallic Coin Emblem */}
            <div className="my-4 flex items-center space-x-4">
                <div className="w-14 h-14 rounded-full flex-shrink-0 flex flex-col items-center justify-center border-2 border-amber-400/80 bg-gradient-to-tr from-amber-700 via-amber-500 to-yellow-200 text-slate-950 font-black shadow-inner shadow-amber-900/50">
                    <span className="text-xs leading-none font-mono">{currencySymbol}</span>
                    <span className="text-sm leading-tight font-extrabold">{denominator.label}</span>
                </div>

                <div>
                    <div className="flex items-baseline space-x-1.5">
                        <span className={`text-xl font-black font-mono ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                            {denominator.label}
                        </span>
                        <span className="text-xs font-bold text-slate-400">{currencySymbol}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">Metallic Fractional Tender</p>
                </div>
            </div>

            <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                <span>Type: Circulating Coin</span>
                <span className="text-amber-400 font-bold">Standard Mint</span>
            </div>
        </div>
    );
};

export const CountryProfileView: React.FC<CountryProfileViewProps> = ({
    theme,
    country,
    onBack,
    onSelectLevel,
    onEditLevels,
    onUpdateCountry
}) => {
    const isDarkMode = theme === 'dark';
    const [activeTab, setActiveTab] = useState<ProfileTab>('overview');

    // Denominations Tab States
    const [denominationsList, setDenominationsList] = useState<CurrencyDenominator[]>(() => {
        if (country.currencyDenominators && country.currencyDenominators.length > 0) {
            return country.currencyDenominators;
        }
        return DEFAULT_DENOMINATIONS_MAP[country.countryCode] || [
            { id: 1, value: 1000, label: '1,000', type: 'Note', status: 'Active' },
            { id: 2, value: 500, label: '500', type: 'Note', status: 'Active' },
            { id: 3, value: 200, label: '200', type: 'Note', status: 'Active' },
            { id: 4, value: 100, label: '100', type: 'Note', status: 'Active' },
            { id: 5, value: 50, label: '50', type: 'Coin', status: 'Active' },
            { id: 6, value: 20, label: '20', type: 'Coin', status: 'Active' },
            { id: 7, value: 10, label: '10', type: 'Coin', status: 'Active' }
        ];
    });

    const [denomViewMode, setDenomViewMode] = useState<'cards' | 'table'>('table');
    const [denomFilterType, setDenomFilterType] = useState<'All' | 'Note' | 'Coin'>('All');
    const [denomFilterStatus, setDenomFilterStatus] = useState<'All' | 'Active' | 'Inactive'>('All');
    const [denomSearchQuery, setDenomSearchQuery] = useState('');

    // Modal state for adding/editing denomination
    const [isDenomModalOpen, setIsDenomModalOpen] = useState(false);
    const [editingDenom, setEditingDenom] = useState<CurrencyDenominator | null>(null);
    const [denomFormValue, setDenomFormValue] = useState('');
    const [denomFormLabel, setDenomFormLabel] = useState('');
    const [denomFormType, setDenomFormType] = useState<'Note' | 'Coin'>('Note');
    const [denomFormStatus, setDenomFormStatus] = useState<'Active' | 'Inactive'>('Active');
    const [denomFormFrontImage, setDenomFormFrontImage] = useState<string | undefined>(undefined);
    const [denomFormBackImage, setDenomFormBackImage] = useState<string | undefined>(undefined);
    const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

    // Specimen Lightbox state for high-res dual side inspection
    const [specimenModalDenom, setSpecimenModalDenom] = useState<CurrencyDenominator | null>(null);

    // Administrative Areas Directory Filters
    const [selectedLevelFilter, setSelectedLevelFilter] = useState<number | 'all'>('all');
    const [searchTerm, setSearchTerm] = useState('');

    const cardBg = isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200';
    const cardInnerBg = isDarkMode ? 'bg-slate-950/60 border-slate-800/80' : 'bg-slate-50 border-slate-200/80';
    const textPrimary = isDarkMode ? 'text-slate-100' : 'text-slate-900';
    const textSecondary = isDarkMode ? 'text-slate-400' : 'text-slate-600';

    // Count areas per level
    const levelCounts = useMemo(() => {
        const counts: Record<number, number> = {};
        if (country.adminLevels) {
            country.adminLevels.forEach(area => {
                counts[area.level] = (counts[area.level] || 0) + 1;
            });
        }
        return counts;
    }, [country.adminLevels]);

    const filteredAreas = useMemo(() => {
        if (!country.adminLevels) return [];
        return country.adminLevels.filter(area => {
            const matchesLevel = selectedLevelFilter === 'all' || area.level === selectedLevelFilter;
            const matchesSearch = searchTerm.trim() === '' || 
                area.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                area.id.toString().includes(searchTerm);
            return matchesLevel && matchesSearch;
        });
    }, [country.adminLevels, selectedLevelFilter, searchTerm]);

    const numLevels = country.numberOfAdminLevels || (country.adminLevelNames ? country.adminLevelNames.length : 0);

    // Denomination calculations & filtering
    const filteredDenominations = useMemo(() => {
        return denominationsList.filter(d => {
            const matchesType = denomFilterType === 'All' || d.type === denomFilterType;
            const matchesStatus = denomFilterStatus === 'All' || (d.status || 'Active') === denomFilterStatus;
            const matchesSearch = denomSearchQuery.trim() === '' || 
                d.label.toLowerCase().includes(denomSearchQuery.toLowerCase()) ||
                d.value.toString().includes(denomSearchQuery);
            return matchesType && matchesStatus && matchesSearch;
        }).sort((a, b) => b.value - a.value);
    }, [denominationsList, denomFilterType, denomFilterStatus, denomSearchQuery]);

    const noteCount = useMemo(() => denominationsList.filter(d => d.type === 'Note').length, [denominationsList]);
    const coinCount = useMemo(() => denominationsList.filter(d => d.type === 'Coin').length, [denominationsList]);
    const activeDenomCount = useMemo(() => denominationsList.filter(d => (d.status || 'Active') === 'Active').length, [denominationsList]);

    const largestNote = useMemo(() => {
        const notes = denominationsList.filter(d => d.type === 'Note');
        if (notes.length === 0) return null;
        return notes.reduce((prev, curr) => curr.value > prev.value ? curr : prev);
    }, [denominationsList]);

    const smallestCoin = useMemo(() => {
        const coins = denominationsList.filter(d => d.type === 'Coin');
        if (coins.length === 0) return null;
        return coins.reduce((prev, curr) => curr.value < prev.value ? curr : prev);
    }, [denominationsList]);

    // Save and sync denominations back to country
    const handleSaveDenominations = async (updatedList: CurrencyDenominator[]) => {
        setDenominationsList(updatedList);
        const updatedCountry: Country = {
            ...country,
            currencyDenominators: updatedList,
            updatedBy: 'Paul Mboya',
            updatedAt: new Date().toISOString()
        };
        if (onUpdateCountry) {
            await onUpdateCountry(updatedCountry);
        }
        setSaveSuccessMsg('Currency denominations updated successfully');
        setTimeout(() => setSaveSuccessMsg(null), 3000);
    };

    const handleToggleStatus = (id: number) => {
        const updated = denominationsList.map(d => {
            if (d.id === id) {
                const newStatus = (d.status || 'Active') === 'Active' ? 'Inactive' : 'Active';
                return { ...d, status: newStatus as 'Active' | 'Inactive' };
            }
            return d;
        });
        handleSaveDenominations(updated);
    };

    const handleDeleteDenom = (id: number) => {
        const updated = denominationsList.filter(d => d.id !== id);
        handleSaveDenominations(updated);
    };

    const handleDirectImageUpload = async (denomId: number, side: 'front' | 'back', file: File) => {
        try {
            const base64 = await readFileAsBase64(file);
            const updated = denominationsList.map(d => {
                if (d.id === denomId) {
                    return {
                        ...d,
                        [side === 'front' ? 'frontImage' : 'backImage']: base64
                    };
                }
                return d;
            });
            handleSaveDenominations(updated);
            if (specimenModalDenom && specimenModalDenom.id === denomId) {
                setSpecimenModalDenom({
                    ...specimenModalDenom,
                    [side === 'front' ? 'frontImage' : 'backImage']: base64
                });
            }
        } catch (err: any) {
            console.error('Error uploading denomination image:', err);
        }
    };

    const handleDirectImageRemove = (denomId: number, side: 'front' | 'back') => {
        const updated = denominationsList.map(d => {
            if (d.id === denomId) {
                return {
                    ...d,
                    [side === 'front' ? 'frontImage' : 'backImage']: undefined
                };
            }
            return d;
        });
        handleSaveDenominations(updated);
        if (specimenModalDenom && specimenModalDenom.id === denomId) {
            setSpecimenModalDenom({
                ...specimenModalDenom,
                [side === 'front' ? 'frontImage' : 'backImage']: undefined
            });
        }
    };

    const handleOpenAddDenom = () => {
        setEditingDenom(null);
        setDenomFormValue('');
        setDenomFormLabel('');
        setDenomFormType('Note');
        setDenomFormStatus('Active');
        setDenomFormFrontImage(undefined);
        setDenomFormBackImage(undefined);
        setIsDenomModalOpen(true);
    };

    const handleOpenEditDenom = (d: CurrencyDenominator) => {
        setEditingDenom(d);
        setDenomFormValue(d.value.toString());
        setDenomFormLabel(d.label);
        setDenomFormType(d.type);
        setDenomFormStatus(d.status || 'Active');
        setDenomFormFrontImage(d.frontImage);
        setDenomFormBackImage(d.backImage);
        setIsDenomModalOpen(true);
    };

    const handleSubmitDenomForm = (e: React.FormEvent) => {
        e.preventDefault();
        const numVal = parseFloat(denomFormValue);
        if (isNaN(numVal) || numVal <= 0 || !denomFormLabel.trim()) return;

        let updated: CurrencyDenominator[];
        if (editingDenom) {
            updated = denominationsList.map(d => 
                d.id === editingDenom.id 
                    ? { 
                        ...d, 
                        value: numVal, 
                        label: denomFormLabel.trim(), 
                        type: denomFormType, 
                        status: denomFormStatus,
                        frontImage: denomFormFrontImage,
                        backImage: denomFormBackImage
                      }
                    : d
            );
        } else {
            const maxId = denominationsList.length > 0 ? Math.max(...denominationsList.map(d => d.id)) : 0;
            const newDenom: CurrencyDenominator = {
                id: maxId + 1,
                value: numVal,
                label: denomFormLabel.trim(),
                type: denomFormType,
                status: denomFormStatus,
                frontImage: denomFormFrontImage,
                backImage: denomFormBackImage
            };
            updated = [...denominationsList, newDenom];
        }

        handleSaveDenominations(updated);
        setIsDenomModalOpen(false);
    };

    const handleResetStandardDenominations = () => {
        const standard = DEFAULT_DENOMINATIONS_MAP[country.countryCode];
        if (standard) {
            handleSaveDenominations(standard);
        }
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Top Navigation Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
                <div className="space-y-1">
                    <button
                        onClick={onBack}
                        id="back-to-country-admin-levels-btn"
                        className={`inline-flex items-center space-x-2 text-sm font-semibold hover:opacity-80 transition-opacity ${
                            isDarkMode ? 'text-slate-300' : 'text-slate-700'
                        }`}
                    >
                        <div className="p-1 rounded-md bg-yellow-500/10 text-yellow-500 border border-yellow-500/30">
                            <Icon name="chevron-left" className="h-4 w-4" />
                        </div>
                        <span className="hover:underline">Back to Country Administrative Levels</span>
                    </button>

                    {/* Breadcrumbs */}
                    <div className="flex items-center space-x-2 text-xs text-slate-400 pt-1">
                        <span className="hover:text-yellow-500 cursor-pointer" onClick={onBack}>Country Admin Levels</span>
                        <Icon name="chevron-right" className="h-3 w-3 text-slate-600" />
                        <span className="font-bold text-yellow-400 flex items-center space-x-1.5">
                            <FlagIcon countryCode={country.countryCode} countryName={country.name} className="w-5 h-3.5" />
                            <span>{country.name} Sovereign Profile</span>
                        </span>
                    </div>
                </div>

                <div className="flex items-center space-x-2.5">
                    {onEditLevels && (
                        <button
                            onClick={onEditLevels}
                            id="edit-hierarchy-levels-btn"
                            className="px-4 py-2 text-xs font-bold rounded-lg bg-yellow-500 hover:bg-yellow-600 text-slate-950 flex items-center space-x-1.5 shadow transition-colors"
                        >
                            <Icon name="edit" className="h-3.5 w-3.5" />
                            <span>Edit Hierarchy & Levels</span>
                        </button>
                    )}
                    <button
                        onClick={onBack}
                        className={`px-3.5 py-2 text-xs font-bold rounded-lg border transition-colors ${
                            isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                        }`}
                    >
                        Directory View
                    </button>
                </div>
            </div>

            {/* Country Header Hero Card */}
            <div className={`p-6 rounded-2xl border ${cardBg} shadow-sm relative overflow-hidden`}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-start sm:items-center space-x-5">
                        <FlagIcon countryCode={country.countryCode} countryName={country.name} className="w-20 h-14" />
                        <div className="space-y-1">
                            <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-yellow-500/10 text-yellow-400 border border-yellow-500/30">
                                    {country.continent || 'Global'}
                                </span>
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-blue-500/10 text-blue-400 border border-blue-500/30">
                                    ISO: {country.countryCode}
                                </span>
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                                    Dial: {country.phoneCode}
                                </span>
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-purple-500/10 text-purple-400 border border-purple-500/30">
                                    {country.currencyCode} ({country.currencySymbol})
                                </span>
                            </div>
                            <h1 className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${textPrimary}`}>
                                {country.name}
                            </h1>
                            <p className={`text-xs ${textSecondary}`}>
                                Sovereign Nation Administrative Hierarchy & Monetary Profile • {numLevels} Administrative Tiers • {denominationsList.length} Denominations
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className={`p-3 rounded-xl border text-center min-w-[90px] ${cardInnerBg}`}>
                            <span className="block text-xl font-extrabold text-yellow-400">{country.adminLevels?.length || 0}</span>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Areas</span>
                        </div>
                        <div className={`p-3 rounded-xl border text-center min-w-[90px] ${cardInnerBg}`}>
                            <span className="block text-xl font-extrabold text-blue-400">{numLevels}</span>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Admin Tiers</span>
                        </div>
                        <div className={`p-3 rounded-xl border text-center min-w-[90px] ${cardInnerBg}`}>
                            <span className="block text-xl font-extrabold text-emerald-400">{denominationsList.length}</span>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Denominations</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Notification message if save happened */}
            {saveSuccessMsg && (
                <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center justify-between animate-fade-in">
                    <div className="flex items-center space-x-2">
                        <Check className="w-4 h-4 text-emerald-400" />
                        <span>{saveSuccessMsg}</span>
                    </div>
                    <button onClick={() => setSaveSuccessMsg(null)} className="text-emerald-400 hover:text-emerald-200">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* ------------------------------------------------------------- */}
            {/* TABS NAVIGATION HEADER */}
            {/* ------------------------------------------------------------- */}
            <div className="flex items-center space-x-2 border-b border-slate-800 overflow-x-auto pb-1 custom-scrollbar">
                <button
                    onClick={() => setActiveTab('overview')}
                    id="tab-country-overview"
                    className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 whitespace-nowrap ${
                        activeTab === 'overview'
                            ? 'border-yellow-500 text-yellow-400 bg-yellow-500/10'
                            : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                    }`}
                >
                    <Globe className="w-4 h-4" />
                    <span>Overview & Sovereign Details</span>
                </button>

                <button
                    onClick={() => setActiveTab('currency-denominations')}
                    id="tab-country-currency-denominations"
                    className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 whitespace-nowrap ${
                        activeTab === 'currency-denominations'
                            ? 'border-yellow-500 text-yellow-400 bg-yellow-500/10'
                            : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                    }`}
                >
                    <Coins className="w-4 h-4 text-emerald-400" />
                    <span>Currency & Denominations</span>
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/20 text-emerald-300">
                        {denominationsList.length}
                    </span>
                </button>

                <button
                    onClick={() => setActiveTab('hierarchy-tiers')}
                    id="tab-country-hierarchy-tiers"
                    className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 whitespace-nowrap ${
                        activeTab === 'hierarchy-tiers'
                            ? 'border-yellow-500 text-yellow-400 bg-yellow-500/10'
                            : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                    }`}
                >
                    <Layers className="w-4 h-4 text-blue-400" />
                    <span>Hierarchy Tiers ({numLevels})</span>
                </button>

                <button
                    onClick={() => setActiveTab('areas-directory')}
                    id="tab-country-areas-directory"
                    className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 whitespace-nowrap ${
                        activeTab === 'areas-directory'
                            ? 'border-yellow-500 text-yellow-400 bg-yellow-500/10'
                            : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                    }`}
                >
                    <Building2 className="w-4 h-4 text-purple-400" />
                    <span>Areas Directory ({country.adminLevels?.length || 0})</span>
                </button>

                <button
                    onClick={() => setActiveTab('electoral-economic')}
                    id="tab-country-electoral-economic"
                    className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 whitespace-nowrap ${
                        activeTab === 'electoral-economic'
                            ? 'border-yellow-500 text-yellow-400 bg-yellow-500/10'
                            : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                    }`}
                >
                    <Vote className="w-4 h-4 text-amber-400" />
                    <span>Electoral & Blocs</span>
                </button>
            </div>

            {/* ------------------------------------------------------------- */}
            {/* TAB 1: OVERVIEW & SOVEREIGN DETAILS */}
            {/* ------------------------------------------------------------- */}
            {activeTab === 'overview' && (
                <div className="space-y-6 animate-fade-in">
                    {/* Quick KPI Overview */}
                    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <StatCard 
                            label="Official Currency" 
                            value={`${country.currency} (${country.currencyCode})`} 
                            subtext={`Symbol: ${country.currencySymbol}`}
                            icon="currencies" 
                            colorClass="text-emerald-400" 
                            theme={theme} 
                        />
                        <StatCard 
                            label="VAT / Tax Rate" 
                            value={`${country.vat}%`} 
                            subtext="Standard Sales Tax"
                            icon="reports" 
                            colorClass="text-yellow-400" 
                            theme={theme} 
                        />
                        <StatCard 
                            label="Phone Dialing Code" 
                            value={country.phoneCode} 
                            subtext="International Country Calling Code"
                            icon="phone" 
                            colorClass="text-blue-400" 
                            theme={theme} 
                        />
                        <StatCard 
                            label="Created & Updated" 
                            value={country.createdBy || 'System'} 
                            subtext={formatDate(country.updatedAt || new Date().toISOString())}
                            icon="system-settings" 
                            colorClass="text-purple-400" 
                            theme={theme} 
                        />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        {/* Sovereign Identity Card */}
                        <div className="lg:col-span-6 space-y-6">
                            <div className={`p-6 rounded-2xl border ${cardBg} shadow-sm space-y-4`}>
                                <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
                                    <Globe className="w-5 h-5 text-yellow-400" />
                                    <h3 className={`text-sm font-bold uppercase tracking-wider ${textPrimary}`}>
                                        Sovereignty & Regional Parameters
                                    </h3>
                                </div>

                                <div className="grid grid-cols-2 gap-4 text-xs">
                                    <div className={`p-3 rounded-xl border ${cardInnerBg}`}>
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase">Country Name</label>
                                        <p className={`font-bold text-sm mt-0.5 ${textPrimary}`}>{country.name}</p>
                                    </div>
                                    <div className={`p-3 rounded-xl border ${cardInnerBg}`}>
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase">ISO Alpha-2 Code</label>
                                        <p className="font-mono font-bold text-sm text-yellow-400 mt-0.5">{country.countryCode}</p>
                                    </div>
                                    <div className={`p-3 rounded-xl border ${cardInnerBg}`}>
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase">Continent</label>
                                        <p className={`font-semibold text-sm mt-0.5 ${textPrimary}`}>{country.continent || 'Africa'}</p>
                                    </div>
                                    <div className={`p-3 rounded-xl border ${cardInnerBg}`}>
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase">Calling Prefix</label>
                                        <p className="font-mono font-bold text-sm text-blue-400 mt-0.5">{country.phoneCode}</p>
                                    </div>
                                    <div className={`p-3 rounded-xl border ${cardInnerBg}`}>
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase">SMS Local Rate</label>
                                        <p className={`font-semibold text-sm mt-0.5 ${textPrimary}`}>{country.smsLocalRate || 1} Credit/SMS</p>
                                    </div>
                                    <div className={`p-3 rounded-xl border ${cardInnerBg}`}>
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase">Decimal Precision</label>
                                        <p className="font-mono font-bold text-sm text-purple-400 mt-0.5">{country.decimalPlaces ?? 0} Places</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Quick Jump & Structure Overview */}
                        <div className="lg:col-span-6 space-y-6">
                            <div className={`p-6 rounded-2xl border ${cardBg} shadow-sm space-y-4`}>
                                <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
                                    <Sparkles className="w-5 h-5 text-emerald-400" />
                                    <h3 className={`text-sm font-bold uppercase tracking-wider ${textPrimary}`}>
                                        Quick Navigation & Monetary Summary
                                    </h3>
                                </div>

                                <div className="space-y-3 text-xs">
                                    <div 
                                        onClick={() => setActiveTab('currency-denominations')}
                                        className={`p-4 rounded-xl border cursor-pointer group transition-all flex items-center justify-between ${
                                            isDarkMode ? 'bg-slate-950/60 hover:bg-emerald-950/30 border-slate-800 hover:border-emerald-500/50' : 'bg-slate-50 hover:bg-emerald-50 border-slate-200 hover:border-emerald-400'
                                        }`}
                                    >
                                        <div className="flex items-center space-x-3">
                                            <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                                <Coins className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-sm group-hover:text-emerald-400 transition-colors">
                                                    Currency Denominations ({denominationsList.length})
                                                </h4>
                                                <p className="text-[11px] text-slate-400">
                                                    {noteCount} Banknotes • {coinCount} Coins • {country.currency} ({country.currencySymbol})
                                                </p>
                                            </div>
                                        </div>
                                        <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
                                    </div>

                                    <div 
                                        onClick={() => setActiveTab('hierarchy-tiers')}
                                        className={`p-4 rounded-xl border cursor-pointer group transition-all flex items-center justify-between ${
                                            isDarkMode ? 'bg-slate-950/60 hover:bg-blue-950/30 border-slate-800 hover:border-blue-500/50' : 'bg-slate-50 hover:bg-blue-50 border-slate-200 hover:border-blue-400'
                                        }`}
                                    >
                                        <div className="flex items-center space-x-3">
                                            <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                                <Layers className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-sm group-hover:text-blue-400 transition-colors">
                                                    Administrative Hierarchy ({numLevels} Tiers)
                                                </h4>
                                                <p className="text-[11px] text-slate-400">
                                                    {country.adminLevels?.length || 0} Registered administrative areas
                                                </p>
                                            </div>
                                        </div>
                                        <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ------------------------------------------------------------- */}
            {/* TAB 2: CURRENCY & DENOMINATIONS TAB (MAIN USER REQUIREMENT) */}
            {/* ------------------------------------------------------------- */}
            {activeTab === 'currency-denominations' && (
                <div className="space-y-6 animate-fade-in">
                    {/* Monetary Header Banner */}
                    <div className={`p-6 rounded-2xl border ${cardBg} shadow-sm`}>
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                            <div className="flex items-start sm:items-center space-x-4">
                                <div className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                                    <Coins className="w-8 h-8" />
                                </div>
                                <div>
                                    <div className="flex items-center space-x-2">
                                        <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-mono">
                                            ISO 4217: {country.currencyCode}
                                        </span>
                                        <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-yellow-500/10 text-yellow-400 border border-yellow-500/30">
                                            Symbol: {country.currencySymbol}
                                        </span>
                                    </div>
                                    <h2 className={`text-xl sm:text-2xl font-black mt-1 ${textPrimary}`}>
                                        {country.currency} ({country.currencyCode})
                                    </h2>
                                    <p className="text-xs text-slate-400 mt-0.5">
                                        Official legal tender denomination specifications, circulating banknotes, and mint coins for {country.name}.
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center space-x-2.5 flex-wrap gap-y-2">
                                <button
                                    onClick={handleOpenAddDenom}
                                    id="add-new-denomination-btn"
                                    className="px-3.5 py-2 text-xs font-bold rounded-lg bg-emerald-500 hover:bg-emerald-600 text-slate-950 flex items-center space-x-1.5 shadow transition-all"
                                >
                                    <Plus className="w-4 h-4" />
                                    <span>Add Denomination</span>
                                </button>

                                {DEFAULT_DENOMINATIONS_MAP[country.countryCode] && (
                                    <button
                                        onClick={handleResetStandardDenominations}
                                        id="reset-standard-denominations-btn"
                                        className={`px-3 py-2 text-xs font-bold rounded-lg border transition-all ${
                                            isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                                        }`}
                                        title="Restore official sovereign denominations"
                                    >
                                        Restore Defaults
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Denomination Metrics */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-800">
                            <div className={`p-3 rounded-xl border ${cardInnerBg}`}>
                                <span className="text-[10px] font-bold uppercase text-slate-400 block">Total Denominations</span>
                                <span className="text-xl font-black font-mono text-emerald-400 mt-0.5 block">{denominationsList.length}</span>
                                <span className="text-[10px] text-slate-500">{activeDenomCount} Active in circulation</span>
                            </div>
                            <div className={`p-3 rounded-xl border ${cardInnerBg}`}>
                                <span className="text-[10px] font-bold uppercase text-slate-400 block">Banknotes (Notes)</span>
                                <span className="text-xl font-black font-mono text-blue-400 mt-0.5 block">{noteCount} Notes</span>
                                <span className="text-[10px] text-slate-500">Highest: {largestNote ? `${country.currencySymbol} ${largestNote.label}` : 'None'}</span>
                            </div>
                            <div className={`p-3 rounded-xl border ${cardInnerBg}`}>
                                <span className="text-[10px] font-bold uppercase text-slate-400 block">Mint Coins</span>
                                <span className="text-xl font-black font-mono text-amber-400 mt-0.5 block">{coinCount} Coins</span>
                                <span className="text-[10px] text-slate-500">Smallest: {smallestCoin ? `${country.currencySymbol} ${smallestCoin.label}` : 'None'}</span>
                            </div>
                            <div className={`p-3 rounded-xl border ${cardInnerBg}`}>
                                <span className="text-[10px] font-bold uppercase text-slate-400 block">Decimal Precision</span>
                                <span className="text-xl font-black font-mono text-purple-400 mt-0.5 block">{country.decimalPlaces ?? 0} Places</span>
                                <span className="text-[10px] text-slate-500">Rounding: {country.roundingConfig?.condition || 'Nearest'}</span>
                            </div>
                        </div>
                    </div>

                    {/* Filter & View Controls */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        {/* Type & Status Filters */}
                        <div className="flex items-center space-x-2 flex-wrap gap-y-2">
                            <div className={`flex items-center p-1 rounded-xl border ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-300'}`}>
                                <button
                                    onClick={() => setDenomFilterType('All')}
                                    className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                                        denomFilterType === 'All'
                                            ? 'bg-yellow-500 text-slate-950 shadow-sm'
                                            : 'text-slate-400 hover:text-slate-200'
                                    }`}
                                >
                                    All ({denominationsList.length})
                                </button>
                                <button
                                    onClick={() => setDenomFilterType('Note')}
                                    className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                                        denomFilterType === 'Note'
                                            ? 'bg-emerald-500 text-slate-950 shadow-sm'
                                            : 'text-slate-400 hover:text-slate-200'
                                    }`}
                                >
                                    Banknotes ({noteCount})
                                </button>
                                <button
                                    onClick={() => setDenomFilterType('Coin')}
                                    className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                                        denomFilterType === 'Coin'
                                            ? 'bg-amber-500 text-slate-950 shadow-sm'
                                            : 'text-slate-400 hover:text-slate-200'
                                    }`}
                                >
                                    Coins ({coinCount})
                                </button>
                            </div>

                            <select
                                value={denomFilterStatus}
                                onChange={e => setDenomFilterStatus(e.target.value as any)}
                                className={`text-xs px-2.5 py-1.5 rounded-lg border font-medium ${
                                    isDarkMode ? 'bg-slate-950 border-slate-700 text-slate-200' : 'bg-white border-slate-300 text-slate-800'
                                }`}
                            >
                                <option value="All">All Statuses</option>
                                <option value="Active">Active Only</option>
                                <option value="Inactive">Inactive Only</option>
                            </select>
                        </div>

                        {/* Search & Layout toggle */}
                        <div className="flex items-center space-x-2">
                            <input
                                type="text"
                                placeholder="Search denominations..."
                                value={denomSearchQuery}
                                onChange={e => setDenomSearchQuery(e.target.value)}
                                className={`text-xs px-3 py-1.5 rounded-lg border w-44 sm:w-56 ${
                                    isDarkMode ? 'bg-slate-950 border-slate-700 text-slate-200 placeholder-slate-500' : 'bg-white border-slate-300 text-slate-800'
                                }`}
                            />

                            <div className={`flex items-center p-1 rounded-xl border ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-300'}`}>
                                <button
                                    onClick={() => setDenomViewMode('cards')}
                                    className={`p-1.5 rounded-lg transition-all ${
                                        denomViewMode === 'cards' ? 'bg-yellow-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
                                    }`}
                                    title="Gallery Cards View"
                                >
                                    <LayoutGrid className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => setDenomViewMode('table')}
                                    className={`p-1.5 rounded-lg transition-all ${
                                        denomViewMode === 'table' ? 'bg-yellow-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
                                    }`}
                                    title="Table Data View"
                                >
                                    <Table className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Denominations Display */}
                    {filteredDenominations.length === 0 ? (
                        <div className={`p-12 rounded-2xl border text-center ${cardBg}`}>
                            <Coins className="w-12 h-12 text-slate-500 mx-auto mb-3" />
                            <h3 className={`text-base font-bold ${textPrimary}`}>No Denominations Found</h3>
                            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                                No currency notes or coins match your search query. You can add new denominations or restore sovereign defaults.
                            </p>
                            <button
                                onClick={handleOpenAddDenom}
                                className="mt-4 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-lg text-xs"
                            >
                                Add Denomination
                            </button>
                        </div>
                    ) : denomViewMode === 'cards' ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {filteredDenominations.map(denom => (
                                denom.type === 'Note' ? (
                                    <BanknoteCard
                                        key={denom.id}
                                        denominator={denom}
                                        currencySymbol={country.currencySymbol}
                                        currencyCode={country.currencyCode}
                                        theme={theme}
                                        onToggleStatus={() => handleToggleStatus(denom.id)}
                                        onEdit={() => handleOpenEditDenom(denom)}
                                        onDelete={() => handleDeleteDenom(denom.id)}
                                    />
                                ) : (
                                    <CoinCard
                                        key={denom.id}
                                        denominator={denom}
                                        currencySymbol={country.currencySymbol}
                                        currencyCode={country.currencyCode}
                                        theme={theme}
                                        onToggleStatus={() => handleToggleStatus(denom.id)}
                                        onEdit={() => handleOpenEditDenom(denom)}
                                        onDelete={() => handleDeleteDenom(denom.id)}
                                    />
                                )
                            ))}
                        </div>
                    ) : (
                        /* Table Mode */
                        <div className={`rounded-2xl border overflow-hidden shadow-sm ${cardBg}`}>
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-slate-800 text-xs">
                                    <thead className={isDarkMode ? 'bg-slate-950/80' : 'bg-slate-100'}>
                                        <tr>
                                            <th className="px-4 py-3 text-left font-bold text-slate-400 w-28">Front (Obverse)</th>
                                            <th className="px-4 py-3 text-left font-bold text-slate-400 w-28">Back (Reverse)</th>
                                            <th className="px-4 py-3 text-left font-bold text-slate-400">Classification</th>
                                            <th className="px-4 py-3 text-left font-bold text-slate-400">Denomination Label</th>
                                            <th className="px-4 py-3 text-left font-bold text-slate-400">Numeric Value</th>
                                            <th className="px-4 py-3 text-left font-bold text-slate-400">Currency</th>
                                            <th className="px-4 py-3 text-left font-bold text-slate-400">Circulation Status</th>
                                            <th className="px-4 py-3 text-right font-bold text-slate-400 w-36">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/60">
                                        {filteredDenominations.map(denom => (
                                            <tr key={denom.id} className="hover:bg-slate-800/30 transition-colors">
                                                {/* Front Side Thumbnail / Upload dropzone */}
                                                <td className="px-4 py-3">
                                                    <TableSpecimenCell
                                                        denom={denom}
                                                        side="front"
                                                        theme={theme}
                                                        onUpload={handleDirectImageUpload}
                                                        onRemove={handleDirectImageRemove}
                                                        onInspect={setSpecimenModalDenom}
                                                    />
                                                </td>

                                                {/* Back Side Thumbnail / Upload dropzone */}
                                                <td className="px-4 py-3">
                                                    <TableSpecimenCell
                                                        denom={denom}
                                                        side="back"
                                                        theme={theme}
                                                        onUpload={handleDirectImageUpload}
                                                        onRemove={handleDirectImageRemove}
                                                        onInspect={setSpecimenModalDenom}
                                                    />
                                                </td>

                                                {/* Classification */}
                                                <td className="px-4 py-3">
                                                    <span className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                                                        denom.type === 'Note'
                                                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                                            : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                                    }`}>
                                                        {denom.type === 'Note' ? <Banknote className="w-3.5 h-3.5" /> : <Coins className="w-3.5 h-3.5" />}
                                                        <span>{denom.type === 'Note' ? 'Banknote' : 'Mint Coin'}</span>
                                                    </span>
                                                </td>

                                                {/* Label */}
                                                <td className="px-4 py-3 font-mono font-bold text-sm text-slate-100">
                                                    {country.currencySymbol} {denom.label}
                                                </td>

                                                {/* Numeric Value */}
                                                <td className="px-4 py-3 font-mono text-slate-300 font-semibold">
                                                    {denom.value.toLocaleString()}
                                                </td>

                                                {/* ISO & Currency Name */}
                                                <td className="px-4 py-3 text-slate-400 font-mono">
                                                    <div className="flex items-center space-x-1">
                                                        <span className="text-yellow-400 font-bold">{country.currencyCode}</span>
                                                        <span>•</span>
                                                        <span className="text-[11px] truncate max-w-[100px]" title={country.currency}>{country.currency}</span>
                                                    </div>
                                                </td>

                                                {/* Status with quick toggle */}
                                                <td className="px-4 py-3">
                                                    <button
                                                        onClick={() => handleToggleStatus(denom.id)}
                                                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition-colors flex items-center space-x-1 ${
                                                            (denom.status || 'Active') === 'Active'
                                                                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/25'
                                                                : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                                                        }`}
                                                        title="Click to toggle circulation status"
                                                    >
                                                        <span className={`w-1.5 h-1.5 rounded-full ${
                                                            (denom.status || 'Active') === 'Active' ? 'bg-emerald-400' : 'bg-slate-500'
                                                        }`} />
                                                        <span>{(denom.status || 'Active') === 'Active' ? 'Active Tender' : 'Inactive'}</span>
                                                    </button>
                                                </td>

                                                {/* Action Column */}
                                                <td className="px-4 py-3 text-right">
                                                    <div className="flex items-center justify-end space-x-1.5">
                                                        <button
                                                            onClick={() => setSpecimenModalDenom(denom)}
                                                            className="p-1.5 rounded-lg border border-blue-500/40 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 hover:text-white transition-colors"
                                                            title="Inspect Front & Back Specimen Lightbox"
                                                        >
                                                            <Eye className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleOpenEditDenom(denom)}
                                                            className="p-1.5 rounded-lg border border-yellow-500/40 bg-yellow-500/10 text-yellow-300 hover:bg-yellow-500/20 hover:text-white transition-colors"
                                                            title="Edit Details & Upload Images"
                                                        >
                                                            <Edit className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteDenom(denom.id)}
                                                            className="p-1.5 rounded-lg border border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20 hover:text-white transition-colors"
                                                            title="Delete Denomination"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ------------------------------------------------------------- */}
            {/* TAB 3: ADMINISTRATIVE HIERARCHY TIERS */}
            {/* ------------------------------------------------------------- */}
            {activeTab === 'hierarchy-tiers' && (
                <div className="space-y-6 animate-fade-in">
                    <div className={`p-6 rounded-2xl border ${cardBg} shadow-sm space-y-4`}>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                            <div className="flex items-center space-x-2">
                                <div className="p-2 rounded-lg bg-yellow-500/10 text-yellow-500">
                                    <Icon name="lookup-values" className="h-5 w-5" />
                                </div>
                                <div>
                                    <h2 className={`text-sm font-bold uppercase tracking-wider ${textPrimary}`}>
                                        Administrative Hierarchy Tiers ({numLevels} Levels)
                                    </h2>
                                    <p className="text-[11px] text-slate-400">Click any tier card below to jump to that level&apos;s records table</p>
                                </div>
                            </div>

                            {onEditLevels && (
                                <button
                                    onClick={onEditLevels}
                                    className="px-3 py-1.5 text-xs font-bold rounded-lg bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 hover:bg-yellow-500/20 transition-all flex items-center space-x-1.5"
                                >
                                    <Icon name="edit" className="h-3.5 w-3.5" />
                                    <span>Configure Tier Structure</span>
                                </button>
                            )}
                        </div>

                        {country.adminLevelNames && country.adminLevelNames.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {country.adminLevelNames.sort((a, b) => a.level - b.level).map(lvl => {
                                    const count = levelCounts[lvl.level] || 0;
                                    return (
                                        <button
                                            key={lvl.level}
                                            onClick={() => onSelectLevel && onSelectLevel(lvl.level)}
                                            className={`p-5 rounded-2xl border text-left transition-all group flex flex-col justify-between ${
                                                isDarkMode 
                                                    ? 'bg-slate-950/70 hover:bg-yellow-500/10 border-slate-800 hover:border-yellow-500/60 shadow-md' 
                                                    : 'bg-slate-50 hover:bg-yellow-50 border-slate-200 hover:border-yellow-400 shadow-sm'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between w-full mb-3">
                                                <span className="px-2.5 py-1 rounded-md text-[10px] font-extrabold uppercase tracking-wider bg-yellow-500/15 text-yellow-400 border border-yellow-500/30">
                                                    Tier Level {lvl.level}
                                                </span>
                                                <Icon name="chevron-right" className="h-4 w-4 text-slate-500 group-hover:text-yellow-400 group-hover:translate-x-1 transition-all" />
                                            </div>
                                            <div>
                                                <h3 className={`text-base font-bold group-hover:text-yellow-400 transition-colors ${textPrimary}`}>
                                                    {lvl.name}
                                                </h3>
                                                <div className="flex items-center space-x-2 mt-3 pt-2 border-t border-slate-800/60">
                                                    <span className="text-2xl font-extrabold font-mono text-yellow-400">{count}</span>
                                                    <span className="text-xs text-slate-400">registered units</span>
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="py-8 text-center text-xs text-slate-400">
                                No administrative hierarchy level names defined for this country yet.
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ------------------------------------------------------------- */}
            {/* TAB 4: ADMINISTRATIVE AREAS DIRECTORY */}
            {/* ------------------------------------------------------------- */}
            {activeTab === 'areas-directory' && (
                <div className="space-y-6 animate-fade-in">
                    <div className={`p-6 rounded-2xl border ${cardBg} shadow-sm space-y-4`}>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                            <div>
                                <h3 className={`text-sm font-bold uppercase tracking-wider ${textPrimary}`}>
                                    Administrative Units Directory ({filteredAreas.length})
                                </h3>
                                <p className="text-[11px] text-slate-400">All registered administrative areas under {country.name}</p>
                            </div>

                            <div className="flex items-center space-x-2">
                                <select
                                    value={selectedLevelFilter}
                                    onChange={e => setSelectedLevelFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                                    className={`text-xs px-2.5 py-1.5 rounded-lg border font-medium ${
                                        isDarkMode ? 'bg-slate-950 border-slate-700 text-slate-200' : 'bg-white border-slate-300 text-slate-800'
                                    }`}
                                >
                                    <option value="all">All Levels</option>
                                    {country.adminLevelNames?.map(lvl => (
                                        <option key={lvl.level} value={lvl.level}>Level {lvl.level}: {lvl.name}</option>
                                    ))}
                                </select>

                                <input
                                    type="text"
                                    placeholder="Search area name..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className={`text-xs px-2.5 py-1.5 rounded-lg border w-40 sm:w-48 ${
                                        isDarkMode ? 'bg-slate-950 border-slate-700 text-slate-200 placeholder-slate-500' : 'bg-white border-slate-300 text-slate-800'
                                    }`}
                                />
                            </div>
                        </div>

                        {filteredAreas.length === 0 ? (
                            <div className="py-8 text-center text-xs text-slate-400">
                                No administrative areas match your filter criteria.
                            </div>
                        ) : (
                            <div className="max-h-96 overflow-y-auto rounded-xl border border-slate-800">
                                <table className="min-w-full divide-y divide-slate-800 text-xs">
                                    <thead className={isDarkMode ? 'bg-slate-950' : 'bg-slate-100'}>
                                        <tr>
                                            <th className="px-4 py-2.5 text-left font-bold text-slate-400">Area Name</th>
                                            <th className="px-4 py-2.5 text-left font-bold text-slate-400">Tier Level</th>
                                            <th className="px-4 py-2.5 text-left font-bold text-slate-400">Classification</th>
                                            <th className="px-4 py-2.5 text-left font-bold text-slate-400">Leaders</th>
                                            <th className="px-4 py-2.5 text-right font-bold text-slate-400">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/60">
                                        {filteredAreas.map(area => {
                                            const levelName = country.adminLevelNames?.find(n => n.level === area.level)?.name || `Level ${area.level}`;
                                            const numLeaders = area.leaders ? area.leaders.length : 0;
                                            return (
                                                <tr key={area.id} className="hover:bg-slate-800/30 transition-colors">
                                                    <td className="px-4 py-2.5 font-bold text-slate-200">
                                                        {area.name}
                                                    </td>
                                                    <td className="px-4 py-2.5">
                                                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                                                            Level {area.level}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-2.5 text-slate-400">
                                                        {levelName}
                                                    </td>
                                                    <td className="px-4 py-2.5 text-slate-400 font-mono">
                                                        {numLeaders} {numLeaders === 1 ? 'Official' : 'Officials'}
                                                    </td>
                                                    <td className="px-4 py-2.5 text-right">
                                                        <button
                                                            onClick={() => onSelectLevel && onSelectLevel(area.level)}
                                                            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-yellow-500 hover:text-slate-950 text-slate-300 font-bold transition-colors text-[11px]"
                                                        >
                                                            View in Level {area.level}
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
                </div>
            )}

            {/* ------------------------------------------------------------- */}
            {/* TAB 5: ELECTORAL & ECONOMIC BLOCS */}
            {/* ------------------------------------------------------------- */}
            {activeTab === 'electoral-economic' && (
                <div className="space-y-6 animate-fade-in">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Electoral Tiers */}
                        <div className={`p-6 rounded-2xl border ${cardBg} shadow-sm space-y-4`}>
                            <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
                                <Vote className="w-5 h-5 text-amber-400" />
                                <h3 className={`text-sm font-bold uppercase tracking-wider ${textPrimary}`}>
                                    Electoral & Parliamentary Divisions
                                </h3>
                            </div>

                            <div className="space-y-3 text-xs">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                                        Electoral Levels Defined ({country.numberOfElectoralLevels || country.electoralLevelNames?.length || 0})
                                    </label>
                                    <div className="space-y-2">
                                        {country.electoralLevelNames && country.electoralLevelNames.length > 0 ? (
                                            country.electoralLevelNames.map(el => (
                                                <div key={el.level} className={`p-3 rounded-xl border flex items-center justify-between ${cardInnerBg}`}>
                                                    <span className="font-bold">{el.name}</span>
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                                        Electoral Tier {el.level}
                                                    </span>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="p-3 rounded-xl border text-slate-500 italic">No specific electoral tiers defined</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Regional & Trade Blocs */}
                        <div className={`p-6 rounded-2xl border ${cardBg} shadow-sm space-y-4`}>
                            <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
                                <Globe className="w-5 h-5 text-blue-400" />
                                <h3 className={`text-sm font-bold uppercase tracking-wider ${textPrimary}`}>
                                    Regional Trade Blocs & Loyalty Program
                                </h3>
                            </div>

                            <div className="space-y-4 text-xs">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Economic Blocs</label>
                                    <div className="flex flex-wrap gap-1.5 pt-1">
                                        {country.economicZones && country.economicZones.length > 0 ? (
                                            country.economicZones.map(zone => (
                                                <span key={zone} className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800 text-slate-200 border border-slate-700">
                                                    {zone}
                                                </span>
                                            ))
                                        ) : (
                                            <span className="text-slate-500 italic">None specified</span>
                                        )}
                                    </div>
                                </div>

                                <div className="pt-3 border-t border-slate-800">
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Commerce Loyalty System</label>
                                    <div className={`p-3 rounded-xl border space-y-2 ${cardInnerBg}`}>
                                        <div className="flex items-center justify-between">
                                            <span className="font-bold">Loyalty Points Program</span>
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${country.loyaltyProgram?.enabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
                                                {country.loyaltyProgram?.enabled ? 'Enabled' : 'Disabled'}
                                            </span>
                                        </div>
                                        {country.loyaltyProgram && (
                                            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400 pt-1">
                                                <div>Earning Threshold: <span className="font-mono text-yellow-400">{country.currencySymbol} {country.loyaltyProgram.earningThreshold}</span></div>
                                                <div>Redemption: <span className="font-mono text-emerald-400">{country.currencySymbol} {country.loyaltyProgram.redemptionValue} / pt</span></div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Bottom Bar */}
            <div className={`p-4 rounded-xl border flex items-center justify-between ${cardBg}`}>
                <button
                    onClick={onBack}
                    className={`px-4 py-2 text-xs font-bold rounded-lg border flex items-center space-x-2 transition-all hover:scale-102 ${
                        isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
                    }`}
                >
                    <Icon name="chevron-left" className="h-4 w-4 text-yellow-500" />
                    <span>Back to Country Administrative Levels</span>
                </button>

                <p className="text-xs text-slate-400">
                    Sovereign Country Register for {country.name}
                </p>
            </div>

            {/* ------------------------------------------------------------- */}
            {/* ADD / EDIT DENOMINATION MODAL WITH FRONT & BACK UPLOAD AREAS */}
            {/* ------------------------------------------------------------- */}
            {isDenomModalOpen && (
                <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
                    <div className={`w-full max-w-2xl rounded-2xl border p-6 shadow-2xl my-8 ${cardBg}`} onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                            <div className="flex items-center space-x-2">
                                <Coins className="w-5 h-5 text-yellow-400" />
                                <div>
                                    <h3 className={`text-base font-bold ${textPrimary}`}>
                                        {editingDenom ? 'Edit Denomination Specimen' : 'Add New Denomination Specimen'}
                                    </h3>
                                    <p className="text-[11px] text-slate-400">
                                        Configure denomination parameters and upload Front & Back specimen images
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setIsDenomModalOpen(false)} className="text-slate-400 hover:text-white p-1">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmitDenomForm} className="mt-4 space-y-4 text-xs">
                            {/* Classification Type Selection */}
                            <div>
                                <label className="block font-bold text-slate-300 mb-1">Denomination Classification</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setDenomFormType('Note')}
                                        className={`p-2.5 rounded-xl border flex items-center justify-center space-x-2 font-bold transition-all ${
                                            denomFormType === 'Note'
                                                ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md'
                                                : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-800'
                                        }`}
                                    >
                                        <Banknote className="w-4 h-4" />
                                        <span>Banknote (Paper / Polymer)</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setDenomFormType('Coin')}
                                        className={`p-2.5 rounded-xl border flex items-center justify-center space-x-2 font-bold transition-all ${
                                            denomFormType === 'Coin'
                                                ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md'
                                                : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-800'
                                        }`}
                                    >
                                        <Coins className="w-4 h-4" />
                                        <span>Mint Coin (Metallic)</span>
                                    </button>
                                </div>
                            </div>

                            {/* Front and Back Image Upload Areas */}
                            <div className={`p-4 rounded-xl border ${cardInnerBg} space-y-3`}>
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-yellow-400 flex items-center space-x-1.5">
                                        <ImageIcon className="w-4 h-4" />
                                        <span>Denomination Specimen Images (Front & Back)</span>
                                    </span>
                                    <span className="text-[10px] text-slate-400">PNG, JPG, WebP supported</span>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {/* Front Image Upload Dropzone */}
                                    <ImageUploadDropzone
                                        label="Front (Obverse) Image"
                                        side="front"
                                        imageUrl={denomFormFrontImage}
                                        onImageChange={setDenomFormFrontImage}
                                        type={denomFormType}
                                        theme={theme}
                                        onInspect={() => {}}
                                    />

                                    {/* Back Image Upload Dropzone */}
                                    <ImageUploadDropzone
                                        label="Back (Reverse) Image"
                                        side="back"
                                        imageUrl={denomFormBackImage}
                                        onImageChange={setDenomFormBackImage}
                                        type={denomFormType}
                                        theme={theme}
                                        onInspect={() => {}}
                                    />
                                </div>
                            </div>

                            {/* Numeric Value and Display Label */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-bold text-slate-300 mb-1">
                                        Numeric Value ({country.currencyCode}) <span className="text-red-400">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        step="any"
                                        required
                                        placeholder="e.g. 50000 or 500"
                                        value={denomFormValue}
                                        onChange={e => {
                                            setDenomFormValue(e.target.value);
                                            if (!denomFormLabel || denomFormLabel === denomFormValue) {
                                                const val = parseFloat(e.target.value);
                                                if (!isNaN(val)) {
                                                    setDenomFormLabel(val.toLocaleString());
                                                }
                                            }
                                        }}
                                        className={`w-full px-3 py-2 rounded-xl border ${
                                            isDarkMode ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                                        }`}
                                    />
                                </div>

                                <div>
                                    <label className="block font-bold text-slate-300 mb-1">
                                        Display Label <span className="text-red-400">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g. 50,000 or 500"
                                        value={denomFormLabel}
                                        onChange={e => setDenomFormLabel(e.target.value)}
                                        className={`w-full px-3 py-2 rounded-xl border ${
                                            isDarkMode ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                                        }`}
                                    />
                                </div>
                            </div>

                            {/* Circulation Status */}
                            <div>
                                <label className="block font-bold text-slate-300 mb-1">Circulation Status</label>
                                <select
                                    value={denomFormStatus}
                                    onChange={e => setDenomFormStatus(e.target.value as any)}
                                    className={`w-full px-3 py-2 rounded-xl border font-bold ${
                                        isDarkMode ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                                    }`}
                                >
                                    <option value="Active">Active (Official Circulating Legal Tender)</option>
                                    <option value="Inactive">Inactive / Demonetized / Historical Specimen</option>
                                </select>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setIsDenomModalOpen(false)}
                                    className="px-4 py-2 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 font-bold hover:bg-slate-700 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2 rounded-xl bg-yellow-500 hover:bg-yellow-600 text-slate-950 font-bold shadow-md transition-transform hover:scale-102 flex items-center space-x-1.5"
                                >
                                    <Check className="w-4 h-4" />
                                    <span>{editingDenom ? 'Update Denomination' : 'Save Denomination'}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ------------------------------------------------------------- */}
            {/* SPECIMEN LIGHTBOX DUAL-SIDE HIGH RES INSPECTION MODAL */}
            {/* ------------------------------------------------------------- */}
            {specimenModalDenom && (
                <div className="fixed inset-0 z-[140] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
                    <div className={`w-full max-w-4xl rounded-2xl border p-6 shadow-2xl my-8 ${cardBg}`} onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                            <div className="flex items-center space-x-3">
                                <div className={`p-2.5 rounded-xl ${
                                    specimenModalDenom.type === 'Note' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                }`}>
                                    {specimenModalDenom.type === 'Note' ? <Banknote className="w-5 h-5" /> : <Coins className="w-5 h-5" />}
                                </div>
                                <div>
                                    <div className="flex items-center space-x-2">
                                        <h3 className={`text-lg font-black font-mono ${textPrimary}`}>
                                            {country.currencySymbol} {specimenModalDenom.label} {country.currencyCode}
                                        </h3>
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                            (specimenModalDenom.status || 'Active') === 'Active'
                                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                                : 'bg-slate-800 text-slate-400 border-slate-700'
                                        }`}>
                                            {specimenModalDenom.status || 'Active'}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-400">
                                        {country.name} • {country.currency} ({specimenModalDenom.type === 'Note' ? 'Official Banknote' : 'Mint Coin'})
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center space-x-2">
                                <button
                                    onClick={() => {
                                        const denomToEdit = specimenModalDenom;
                                        setSpecimenModalDenom(null);
                                        handleOpenEditDenom(denomToEdit);
                                    }}
                                    className="px-3 py-1.5 rounded-lg border border-yellow-500/40 bg-yellow-500/10 text-yellow-300 hover:bg-yellow-500/20 text-xs font-bold flex items-center space-x-1"
                                >
                                    <Edit className="w-3.5 h-3.5" />
                                    <span>Edit</span>
                                </button>
                                <button onClick={() => setSpecimenModalDenom(null)} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Side by Side Dual View */}
                        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Front Side View */}
                            <div className={`p-4 rounded-xl border flex flex-col justify-between space-y-3 ${cardInnerBg}`}>
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-extrabold uppercase tracking-wider text-yellow-400 flex items-center space-x-1.5">
                                        <Eye className="w-4 h-4" />
                                        <span>Obverse Side (Front)</span>
                                    </span>
                                    <span className="text-[10px] font-mono text-slate-400">SIDE A</span>
                                </div>

                                <div className="flex items-center justify-center p-2 min-h-[180px]">
                                    {specimenModalDenom.frontImage ? (
                                        <img
                                            src={specimenModalDenom.frontImage}
                                            alt="Obverse Front"
                                            className={`max-h-56 w-auto object-contain rounded-xl border border-slate-700 shadow-xl ${
                                                specimenModalDenom.type === 'Coin' ? 'rounded-full max-h-44' : ''
                                            }`}
                                        />
                                    ) : (
                                        <div className="text-center p-6 space-y-2">
                                            <FileImage className="w-10 h-10 text-slate-600 mx-auto" />
                                            <p className="text-xs text-slate-400 font-semibold">No Front Image Uploaded</p>
                                        </div>
                                    )}
                                </div>

                                <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                                    <label className="cursor-pointer px-3 py-1.5 rounded-lg bg-yellow-500 hover:bg-yellow-600 text-slate-950 font-bold text-xs flex items-center space-x-1 shadow">
                                        <Upload className="w-3 h-3" />
                                        <span>{specimenModalDenom.frontImage ? 'Replace Front' : 'Upload Front'}</span>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={e => {
                                                if (e.target.files && e.target.files[0]) {
                                                    handleDirectImageUpload(specimenModalDenom.id, 'front', e.target.files[0]);
                                                }
                                            }}
                                        />
                                    </label>
                                    {specimenModalDenom.frontImage && (
                                        <button
                                            type="button"
                                            onClick={() => handleDirectImageRemove(specimenModalDenom.id, 'front')}
                                            className="text-xs text-red-400 hover:text-red-300 font-bold px-2 py-1"
                                        >
                                            Remove
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Back Side View */}
                            <div className={`p-4 rounded-xl border flex flex-col justify-between space-y-3 ${cardInnerBg}`}>
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-extrabold uppercase tracking-wider text-yellow-400 flex items-center space-x-1.5">
                                        <Eye className="w-4 h-4" />
                                        <span>Reverse Side (Back)</span>
                                    </span>
                                    <span className="text-[10px] font-mono text-slate-400">SIDE B</span>
                                </div>

                                <div className="flex items-center justify-center p-2 min-h-[180px]">
                                    {specimenModalDenom.backImage ? (
                                        <img
                                            src={specimenModalDenom.backImage}
                                            alt="Reverse Back"
                                            className={`max-h-56 w-auto object-contain rounded-xl border border-slate-700 shadow-xl ${
                                                specimenModalDenom.type === 'Coin' ? 'rounded-full max-h-44' : ''
                                            }`}
                                        />
                                    ) : (
                                        <div className="text-center p-6 space-y-2">
                                            <FileImage className="w-10 h-10 text-slate-600 mx-auto" />
                                            <p className="text-xs text-slate-400 font-semibold">No Back Image Uploaded</p>
                                        </div>
                                    )}
                                </div>

                                <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                                    <label className="cursor-pointer px-3 py-1.5 rounded-lg bg-yellow-500 hover:bg-yellow-600 text-slate-950 font-bold text-xs flex items-center space-x-1 shadow">
                                        <Upload className="w-3 h-3" />
                                        <span>{specimenModalDenom.backImage ? 'Replace Back' : 'Upload Back'}</span>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={e => {
                                                if (e.target.files && e.target.files[0]) {
                                                    handleDirectImageUpload(specimenModalDenom.id, 'back', e.target.files[0]);
                                                }
                                            }}
                                        />
                                    </label>
                                    {specimenModalDenom.backImage && (
                                        <button
                                            type="button"
                                            onClick={() => handleDirectImageRemove(specimenModalDenom.id, 'back')}
                                            className="text-xs text-red-400 hover:text-red-300 font-bold px-2 py-1"
                                        >
                                            Remove
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Bottom Specifications strip */}
                        <div className="mt-6 pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-2">
                            <div className="flex items-center space-x-2 font-mono">
                                <span>Denomination Value: <strong className="text-slate-200">{country.currencySymbol} {specimenModalDenom.value.toLocaleString()}</strong></span>
                                <span>•</span>
                                <span>Code: <strong className="text-yellow-400">{country.currencyCode}</strong></span>
                            </div>
                            <button
                                onClick={() => setSpecimenModalDenom(null)}
                                className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold"
                            >
                                Close Inspection
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CountryProfileView;
