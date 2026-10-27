
import React, { useState, useRef } from 'react';
import { XMarkIcon, CameraIcon, PhotoIcon, ArrowPathIcon, CheckIcon } from '@heroicons/react/24/outline';
import ActionButton from '../../components/ActionButton';
import InputField from '../../components/InputField';
import SelectField from '../../components/SelectField';
import { MaintenanceType, ScannedReceiptData } from '../../types';
import { useMechanicStore } from '../../src/store/useMechanicStore';
import { useUIStore } from '../../src/store/useUIStore';

interface ReceiptScannerProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (data: ScannedReceiptData) => void;
}

const ReceiptScanner: React.FC<ReceiptScannerProps> = ({ isOpen, onClose, onSuccess }) => {
    const { scanReceipt } = useMechanicStore();
    const { isScanningReceipt } = useUIStore();
    
    const [step, setStep] = useState<'upload' | 'scanning' | 'review'>('upload');
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [scannedData, setScannedData] = useState<ScannedReceiptData | null>(null);
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        // Resetta l'input: riselezionare lo stesso file deve riattivare onChange.
        e.target.value = '';

        // Preview
        const reader = new FileReader();
        reader.onloadend = () => setImagePreview(reader.result as string);
        reader.readAsDataURL(file);

        setStep('scanning');
        const data = await scanReceipt(file);
        
        if (data) {
            setScannedData(data);
            setStep('review');
        } else {
            setStep('upload');
            setImagePreview(null);
        }
    };

    const handleSave = () => {
        if (scannedData) {
            onSuccess(scannedData);
            onClose();
            // Reset for next time
            setTimeout(() => {
                setStep('upload');
                setScannedData(null);
                setImagePreview(null);
            }, 300);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
            <div className="bg-gray-800 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-gray-700">
                <div className="p-4 border-b border-gray-700 flex justify-between items-center">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <CameraIcon className="w-6 h-6 text-blue-400" />
                        Scansione Scontrino IA
                    </h3>
                    <button onClick={onClose} className="p-1 hover:bg-gray-700 rounded-full transition-colors">
                        <XMarkIcon className="w-6 h-6 text-gray-400" />
                    </button>
                </div>

                <div className="p-6">
                    {step === 'upload' && (
                        <div className="space-y-6">
                            <p className="text-gray-400 text-center">
                                Carica una foto della ricevuta o dello scontrino. L'IA estrarrà automaticamente i dati per il tuo log di manutenzione.
                            </p>
                            
                            <div 
                                onClick={() => fileInputRef.current?.click()}
                                className="border-2 border-dashed border-gray-600 rounded-xl p-10 flex flex-col items-center justify-center gap-4 hover:border-blue-500 hover:bg-blue-500/5 transition-all cursor-pointer group"
                            >
                                <div className="bg-gray-700 p-4 rounded-full group-hover:scale-110 transition-transform">
                                    <PhotoIcon className="w-10 h-10 text-gray-400 group-hover:text-blue-400" />
                                </div>
                                <div className="text-center">
                                    <p className="text-white font-semibold">Trascina o clicca per caricare</p>
                                    <p className="text-gray-500 text-sm">PNG, JPG fino a 10MB</p>
                                </div>
                                <input 
                                    type="file" 
                                    ref={fileInputRef} 
                                    className="hidden" 
                                    accept="image/*" 
                                    onChange={handleFileChange}
                                />
                            </div>

                            <div className="flex gap-4">
                                <ActionButton 
                                    onClick={() => cameraInputRef.current?.click()}
                                    className="flex-1 bg-gray-700 hover:bg-gray-600 border border-gray-600"
                                >
                                    <div className="flex items-center justify-center gap-2">
                                        <CameraIcon className="w-5 h-5" />
                                        Scatta Foto
                                    </div>
                                    <input 
                                        type="file" 
                                        ref={cameraInputRef} 
                                        className="hidden" 
                                        accept="image/*" 
                                        capture="environment"
                                        onChange={handleFileChange}
                                    />
                                </ActionButton>
                            </div>
                        </div>
                    )}

                    {step === 'scanning' && (
                        <div className="py-12 flex flex-col items-center justify-center space-y-6">
                            <div className="relative">
                                {imagePreview && (
                                    <img src={imagePreview} alt="Scontrino" className="w-48 h-48 object-cover rounded-xl blur-[2px] grayscale opacity-50" />
                                )}
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <ArrowPathIcon className="w-12 h-12 text-blue-500 animate-spin" />
                                </div>
                            </div>
                            <div className="text-center">
                                <h4 className="text-lg font-bold text-white">Analisi in corso...</h4>
                                <p className="text-gray-400 text-sm">L'IA MotoMentor sta leggendo i dettagli dello scontrino.</p>
                            </div>
                        </div>
                    )}

                    {step === 'review' && scannedData && (
                        <div className="space-y-6 animate-fade-in">
                            <div className="flex gap-4 items-start">
                                {imagePreview && (
                                    <img src={imagePreview} alt="Preview" className="w-24 h-32 object-cover rounded-lg border border-gray-600 flex-shrink-0" />
                                )}
                                <div className="flex-1">
                                    <p className="text-sm font-semibold text-green-400 flex items-center gap-1 mb-2">
                                        <CheckIcon className="w-4 h-4" /> Dati estratti con successo
                                    </p>
                                    <p className="text-xs text-gray-500 uppercase tracking-wider">Verifica i dettagli estratti dall'IA e correggi eventuali errori.</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <InputField 
                                    id="scanDate" 
                                    label="Data" 
                                    type="date" 
                                    value={scannedData.date} 
                                    onChange={(e) => setScannedData({...scannedData, date: e.target.value})} 
                                />
                                <SelectField 
                                    id="scanType" 
                                    label="Tipo" 
                                    value={scannedData.type} 
                                    onChange={(e) => setScannedData({...scannedData, type: e.target.value as MaintenanceType})}
                                >
                                    {Object.values(MaintenanceType).map(t => <option key={t} value={t}>{t}</option>)}
                                </SelectField>
                                <InputField 
                                    id="scanKm" 
                                    label="Chilometri" 
                                    type="number" 
                                    value={scannedData.kilometers} 
                                    onChange={(e) => setScannedData({...scannedData, kilometers: parseInt(e.target.value) || 0})} 
                                />
                                <InputField 
                                    id="scanCost" 
                                    label="Costo (€)" 
                                    type="number" 
                                    value={scannedData.cost} 
                                    onChange={(e) => setScannedData({...scannedData, cost: parseFloat(e.target.value) || 0})} 
                                />
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-gray-300 mb-1">Descrizione Lavori</label>
                                    <textarea 
                                        className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        rows={3}
                                        value={scannedData.description}
                                        onChange={(e) => setScannedData({...scannedData, description: e.target.value})}
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button 
                                    onClick={() => setStep('upload')}
                                    className="flex-1 py-2 px-4 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors font-semibold"
                                >
                                    Riprova
                                </button>
                                <ActionButton 
                                    onClick={handleSave}
                                    className="flex-1"
                                >
                                    Conferma e Salva
                                </ActionButton>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ReceiptScanner;
