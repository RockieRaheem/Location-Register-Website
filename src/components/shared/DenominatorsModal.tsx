
import React, { useState, useEffect } from 'react';
import { Theme, Country, CurrencyDenominator } from '../../types';
import Icon from './Icon';
import { Banknote, Coins, Image as ImageIcon, Upload, Trash2, Eye, X } from 'lucide-react';

interface DenominatorsModalProps {
    isOpen: boolean;
    onClose: () => void;
    country: Country | null;
    onUpdate: (updatedCountry: Country) => void;
    theme: Theme;
    mode?: 'view' | 'edit';
}

const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const result = e.target?.result as string;
            resolve(result);
        };
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(file);
    });
};

const DenominatorsModal: React.FC<DenominatorsModalProps> = ({ 
    isOpen, 
    onClose, 
    country, 
    onUpdate, 
    theme,
    mode = 'edit'
}) => {
    const isView = mode === 'view';
    const [denominators, setDenominators] = useState<CurrencyDenominator[]>([]);
    const [newValue, setNewValue] = useState('');
    const [newLabel, setNewLabel] = useState('');
    const [newType, setNewType] = useState<'Note' | 'Coin'>('Note');
    const [newStatus, setNewStatus] = useState<'Active' | 'Inactive'>('Active');
    const [newFrontImage, setNewFrontImage] = useState<string | undefined>(undefined);
    const [newBackImage, setNewBackImage] = useState<string | undefined>(undefined);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);

    useEffect(() => {
        if (country) {
            setDenominators(country.currencyDenominators || []);
            setEditingId(null);
            setNewValue('');
            setNewLabel('');
            setNewFrontImage(undefined);
            setNewBackImage(undefined);
        }
    }, [country, isOpen]);

    if (!isOpen || !country) return null;

    const handleFrontFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            try {
                const b64 = await readFileAsBase64(e.target.files[0]);
                setNewFrontImage(b64);
            } catch (err) {
                console.error("Failed to read front image", err);
            }
        }
    };

    const handleBackFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            try {
                const b64 = await readFileAsBase64(e.target.files[0]);
                setNewBackImage(b64);
            } catch (err) {
                console.error("Failed to read back image", err);
            }
        }
    };

    const handleAdd = () => {
        if (!newValue || !newLabel) return;
        
        if (editingId !== null) {
            // Update existing
            const updated = denominators.map(d => 
                d.id === editingId 
                ? { 
                    ...d, 
                    value: parseFloat(newValue), 
                    label: newLabel, 
                    type: newType, 
                    status: newStatus,
                    frontImage: newFrontImage,
                    backImage: newBackImage
                } 
                : d
            ).sort((a, b) => b.value - a.value);
            setDenominators(updated);
            setEditingId(null);
        } else {
            // Add new
            const newDenominator: CurrencyDenominator = {
                id: denominators.length > 0 ? Math.max(...denominators.map(d => d.id)) + 1 : 1,
                value: parseFloat(newValue),
                label: newLabel,
                type: newType,
                status: newStatus,
                frontImage: newFrontImage,
                backImage: newBackImage
            };
    
            const updatedDenominators = [...denominators, newDenominator].sort((a, b) => b.value - a.value);
            setDenominators(updatedDenominators);
        }
        
        // Reset inputs
        setNewValue('');
        setNewLabel('');
        setNewFrontImage(undefined);
        setNewBackImage(undefined);
    };

    const handleEdit = (d: CurrencyDenominator) => {
        setEditingId(d.id);
        setNewValue(d.value.toString());
        setNewLabel(d.label);
        setNewType(d.type);
        setNewStatus(d.status || 'Active');
        setNewFrontImage(d.frontImage);
        setNewBackImage(d.backImage);
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setNewValue('');
        setNewLabel('');
        setNewStatus('Active');
        setNewFrontImage(undefined);
        setNewBackImage(undefined);
    };

    const handleDelete = (id: number) => {
        setDenominators(denominators.filter(d => d.id !== id));
        if (editingId === id) handleCancelEdit();
    };

    const handleSave = () => {
        onUpdate({
            ...country,
            currencyDenominators: denominators
        });
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className={`w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] ${theme === 'dark' ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}>
                {/* Header */}
                <div className={`flex justify-between items-center p-4 border-b ${theme === 'dark' ? 'border-slate-800 bg-slate-800/50' : 'border-slate-200 bg-slate-50'}`}>
                    <div className="flex items-center space-x-2">
                        <Coins className="w-5 h-5 text-yellow-500" />
                        <div>
                            <h2 className={`text-base font-bold ${theme === 'dark' ? 'text-slate-100' : 'text-slate-900'}`}>
                                {isView ? 'View' : 'Manage'} Currency Denominations: {country.name}
                            </h2>
                            <p className="text-xs text-slate-400 font-mono">
                                {country.currency} • {country.currencyCode} ({country.currencySymbol})
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className={`p-1.5 rounded-lg transition-colors ${theme === 'dark' ? 'text-slate-400 hover:bg-slate-800 hover:text-white' : 'text-slate-500 hover:bg-slate-200'}`}>
                        <Icon name="x-mark" className="h-5 w-5" />
                    </button>
                </div>

                <div className="p-5 flex-1 overflow-y-auto space-y-6">
                    {/* Add / Edit Form */}
                    {!isView && (
                        <div className={`p-4 rounded-xl border ${theme === 'dark' ? 'bg-slate-800/40 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                            <div className="flex justify-between items-center mb-3">
                                <h3 className={`text-xs font-bold uppercase tracking-wider flex items-center space-x-1.5 ${theme === 'dark' ? 'text-yellow-400' : 'text-slate-800'}`}>
                                    <Banknote className="w-4 h-4" />
                                    <span>{editingId !== null ? 'Edit Denomination Specimen' : 'Add New Denomination Specimen'}</span>
                                </h3>
                                {editingId !== null && (
                                    <button 
                                        onClick={handleCancelEdit}
                                        className="text-xs font-bold text-slate-400 hover:text-red-400 transition-colors"
                                    >
                                        Cancel Edit
                                    </button>
                                )}
                            </div>

                            <div className="space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end text-xs">
                                    <div className="space-y-1">
                                        <label className={`text-[11px] font-bold ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>Value (Numeric)</label>
                                        <input
                                            type="number"
                                            value={newValue}
                                            onChange={(e) => {
                                                setNewValue(e.target.value);
                                                if (!newLabel || newLabel === newValue) {
                                                    const parsed = parseFloat(e.target.value);
                                                    if (!isNaN(parsed)) setNewLabel(parsed.toLocaleString());
                                                }
                                            }}
                                            className={`w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-yellow-500 font-mono ${theme === 'dark' ? 'bg-slate-950 border-slate-700 text-slate-200' : 'bg-white border-slate-300 text-slate-900'}`}
                                            placeholder="e.g. 5000"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className={`text-[11px] font-bold ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>Label (Display)</label>
                                        <input
                                            type="text"
                                            value={newLabel}
                                            onChange={(e) => setNewLabel(e.target.value)}
                                            className={`w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-yellow-500 ${theme === 'dark' ? 'bg-slate-950 border-slate-700 text-slate-200' : 'bg-white border-slate-300 text-slate-900'}`}
                                            placeholder="e.g. 5,000"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className={`text-[11px] font-bold ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>Type</label>
                                        <select
                                            value={newType}
                                            onChange={(e) => setNewType(e.target.value as 'Note' | 'Coin')}
                                            className={`w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-yellow-500 font-bold ${theme === 'dark' ? 'bg-slate-950 border-slate-700 text-slate-200' : 'bg-white border-slate-300 text-slate-900'}`}
                                        >
                                            <option value="Note">Banknote (Note)</option>
                                            <option value="Coin">Mint Coin</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className={`text-[11px] font-bold ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>Status</label>
                                        <select
                                            value={newStatus}
                                            onChange={(e) => setNewStatus(e.target.value as 'Active' | 'Inactive')}
                                            className={`w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-yellow-500 font-bold ${theme === 'dark' ? 'bg-slate-950 border-slate-700 text-slate-200' : 'bg-white border-slate-300 text-slate-900'}`}
                                        >
                                            <option value="Active">Active Tender</option>
                                            <option value="Inactive">Inactive / Demonetized</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Front & Back Image Upload Areas */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-800/60">
                                    {/* Front Side Upload */}
                                    <div className={`p-3 rounded-lg border flex flex-col space-y-2 ${theme === 'dark' ? 'bg-slate-950/60 border-slate-800' : 'bg-white border-slate-200'}`}>
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="font-bold text-slate-300 flex items-center space-x-1">
                                                <ImageIcon className="w-3.5 h-3.5 text-yellow-400" />
                                                <span>Front Image (Obverse)</span>
                                            </span>
                                            {newFrontImage && (
                                                <button
                                                    type="button"
                                                    onClick={() => setNewFrontImage(undefined)}
                                                    className="text-[10px] text-red-400 hover:text-red-300 font-bold"
                                                >
                                                    Remove
                                                </button>
                                            )}
                                        </div>
                                        <div className="flex items-center space-x-3">
                                            {newFrontImage ? (
                                                <img
                                                    src={newFrontImage}
                                                    alt="Front preview"
                                                    className="w-16 h-10 object-cover rounded border border-slate-700"
                                                />
                                            ) : (
                                                <div className="w-16 h-10 rounded border border-dashed border-slate-700 flex items-center justify-center text-slate-600">
                                                    <Upload className="w-4 h-4" />
                                                </div>
                                            )}
                                            <label className="cursor-pointer px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center space-x-1 transition-colors">
                                                <Upload className="w-3 h-3 text-yellow-400" />
                                                <span>{newFrontImage ? 'Change Front' : 'Upload Front'}</span>
                                                <input type="file" accept="image/*" className="hidden" onChange={handleFrontFile} />
                                            </label>
                                        </div>
                                    </div>

                                    {/* Back Side Upload */}
                                    <div className={`p-3 rounded-lg border flex flex-col space-y-2 ${theme === 'dark' ? 'bg-slate-950/60 border-slate-800' : 'bg-white border-slate-200'}`}>
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="font-bold text-slate-300 flex items-center space-x-1">
                                                <ImageIcon className="w-3.5 h-3.5 text-yellow-400" />
                                                <span>Back Image (Reverse)</span>
                                            </span>
                                            {newBackImage && (
                                                <button
                                                    type="button"
                                                    onClick={() => setNewBackImage(undefined)}
                                                    className="text-[10px] text-red-400 hover:text-red-300 font-bold"
                                                >
                                                    Remove
                                                </button>
                                            )}
                                        </div>
                                        <div className="flex items-center space-x-3">
                                            {newBackImage ? (
                                                <img
                                                    src={newBackImage}
                                                    alt="Back preview"
                                                    className="w-16 h-10 object-cover rounded border border-slate-700"
                                                />
                                            ) : (
                                                <div className="w-16 h-10 rounded border border-dashed border-slate-700 flex items-center justify-center text-slate-600">
                                                    <Upload className="w-4 h-4" />
                                                </div>
                                            )}
                                            <label className="cursor-pointer px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center space-x-1 transition-colors">
                                                <Upload className="w-3 h-3 text-yellow-400" />
                                                <span>{newBackImage ? 'Change Back' : 'Upload Back'}</span>
                                                <input type="file" accept="image/*" className="hidden" onChange={handleBackFile} />
                                            </label>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex justify-end pt-2">
                                    <button
                                        type="button"
                                        onClick={handleAdd}
                                        className={`px-5 py-2 rounded-lg font-bold text-xs transition-all active:scale-95 flex items-center space-x-1.5 shadow ${
                                            editingId !== null 
                                            ? 'bg-blue-500 hover:bg-blue-600 text-white' 
                                            : 'bg-yellow-500 hover:bg-yellow-600 text-slate-950'
                                        }`}
                                    >
                                        <span>{editingId !== null ? 'Update Denomination' : 'Add Denomination'}</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Table of Denominators */}
                    <div className={`rounded-xl border overflow-hidden ${theme === 'dark' ? 'border-slate-800' : 'border-slate-200'}`}>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                    <tr className={`uppercase tracking-wider font-bold ${theme === 'dark' ? 'bg-slate-950 text-slate-400' : 'bg-slate-100 text-slate-600'}`}>
                                        <th className="px-4 py-3 w-24">Front Specimen</th>
                                        <th className="px-4 py-3 w-24">Back Specimen</th>
                                        <th className="px-4 py-3">Value</th>
                                        <th className="px-4 py-3">Label</th>
                                        <th className="px-4 py-3">Type</th>
                                        <th className="px-4 py-3">Status</th>
                                        {!isView && <th className="px-4 py-3 text-right">Actions</th>}
                                    </tr>
                                </thead>
                                <tbody className={`divide-y ${theme === 'dark' ? 'divide-slate-800/70' : 'divide-slate-200'}`}>
                                    {denominators.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                                                No currency denominations recorded yet.
                                            </td>
                                        </tr>
                                    ) : (
                                        denominators.map((d) => (
                                            <tr key={d.id} className={`${theme === 'dark' ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'} ${editingId === d.id ? (theme === 'dark' ? 'bg-yellow-500/10' : 'bg-yellow-50') : ''}`}>
                                                {/* Front Thumbnail */}
                                                <td className="px-4 py-2.5">
                                                    {d.frontImage ? (
                                                        <img
                                                            src={d.frontImage}
                                                            alt={`Front of ${d.label}`}
                                                            onClick={() => setPreviewImage({ url: d.frontImage!, title: `Front (Obverse) - ${country.currencySymbol} ${d.label}` })}
                                                            className="w-16 h-9 object-cover rounded border border-slate-700 cursor-pointer hover:opacity-80 transition-opacity shadow-sm"
                                                        />
                                                    ) : (
                                                        <span className="text-[10px] text-slate-500 italic">No image</span>
                                                    )}
                                                </td>

                                                {/* Back Thumbnail */}
                                                <td className="px-4 py-2.5">
                                                    {d.backImage ? (
                                                        <img
                                                            src={d.backImage}
                                                            alt={`Back of ${d.label}`}
                                                            onClick={() => setPreviewImage({ url: d.backImage!, title: `Back (Reverse) - ${country.currencySymbol} ${d.label}` })}
                                                            className="w-16 h-9 object-cover rounded border border-slate-700 cursor-pointer hover:opacity-80 transition-opacity shadow-sm"
                                                        />
                                                    ) : (
                                                        <span className="text-[10px] text-slate-500 italic">No image</span>
                                                    )}
                                                </td>

                                                {/* Numeric Value */}
                                                <td className={`px-4 py-2.5 font-mono font-bold ${theme === 'dark' ? 'text-slate-200' : 'text-slate-900'}`}>
                                                    {d.value.toLocaleString()}
                                                </td>

                                                {/* Display Label */}
                                                <td className={`px-4 py-2.5 font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-slate-800'}`}>
                                                    {country.currencySymbol} {d.label}
                                                </td>

                                                {/* Type */}
                                                <td className="px-4 py-2.5">
                                                    <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                                        d.type === 'Note' 
                                                            ? (theme === 'dark' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-emerald-100 text-emerald-700')
                                                            : (theme === 'dark' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' : 'bg-amber-100 text-amber-700')
                                                    }`}>
                                                        {d.type === 'Note' ? <Banknote className="w-3 h-3" /> : <Coins className="w-3 h-3" />}
                                                        <span>{d.type === 'Note' ? 'Banknote' : 'Coin'}</span>
                                                    </span>
                                                </td>

                                                {/* Status */}
                                                <td className="px-4 py-2.5">
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                        (d.status || 'Active') === 'Active' 
                                                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' 
                                                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                                                    }`}>
                                                        {(d.status || 'Active') === 'Active' ? 'Active' : 'Inactive'}
                                                    </span>
                                                </td>

                                                {/* Actions */}
                                                {!isView && (
                                                    <td className="px-4 py-2.5 text-right">
                                                        <div className="flex items-center justify-end gap-1.5">
                                                            <button 
                                                                onClick={() => handleEdit(d)}
                                                                className={`p-1.5 rounded-md transition-colors ${theme === 'dark' ? 'text-yellow-400 hover:bg-yellow-500/10' : 'text-yellow-600 hover:bg-yellow-50'}`}
                                                                title="Edit Denomination"
                                                            >
                                                                <Icon name="edit" className="h-3.5 w-3.5" />
                                                            </button>
                                                            <button 
                                                                onClick={() => handleDelete(d.id)}
                                                                className="p-1.5 text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
                                                                title="Delete Denomination"
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                )}
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className={`p-4 border-t flex justify-end gap-3 ${theme === 'dark' ? 'border-slate-800 bg-slate-800/30' : 'border-slate-200 bg-slate-50'}`}>
                    <button
                        onClick={onClose}
                        className={`px-4 py-2 text-xs font-bold rounded-lg border transition-all ${theme === 'dark' ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-300 text-slate-700 hover:bg-slate-100'}`}
                    >
                        {isView ? 'Close' : 'Cancel'}
                    </button>
                    {!isView && (
                        <button
                            onClick={handleSave}
                            className="px-5 py-2 text-xs font-bold rounded-lg bg-yellow-500 hover:bg-yellow-600 text-slate-950 transition-all shadow-md active:scale-95"
                        >
                            Save Denominations
                        </button>
                    )}
                </div>
            </div>

            {/* Quick Preview Lightbox */}
            {previewImage && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/85" onClick={() => setPreviewImage(null)}>
                    <div className="max-w-3xl w-full p-4 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center pb-2 border-b border-slate-800 mb-3">
                            <h4 className="text-sm font-bold text-white">{previewImage.title}</h4>
                            <button onClick={() => setPreviewImage(null)} className="text-slate-400 hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="flex items-center justify-center p-2">
                            <img src={previewImage.url} alt="Specimen Preview" className="max-h-[60vh] w-auto object-contain rounded-lg border border-slate-700" />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DenominatorsModal;

