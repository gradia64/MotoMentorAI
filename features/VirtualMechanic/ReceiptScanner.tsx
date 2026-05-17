import React, { useState, useRef, useCallback } from 'react';
import { CameraIcon, PhotoIcon, XMarkIcon, SparklesIcon, CheckCircleIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { MaintenanceRecord, MaintenanceType } from '../../types';
import InputField from '../../components/InputField';
import SelectField from '../../components/SelectField';
import ActionButton from '../../components/ActionButton';
import { useMechanicStore } from '../../src/store/useMechanicStore';
import { useUIStore } from '../../src/store/useUIStore';

interface ReceiptScannerProps {
    onClose: () => void;
    onConfirm: (record: Omit<MaintenanceRecord, 'id'>) => void;
    activeVehicleKilometers?: string;
}

type ScannerStep = 'upload' | 'scanning' | 'review';

const ReceiptScanner: React.FC<ReceiptScannerProps> = ({ onClose, onConfirm, activeVehicleKilometers }) => {
    const { scanReceipt } = useMechanicStore();
    const { isScanningReceipt } = useUIStore();

    const [step, setStep] = useState<ScannerStep>('upload');
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);

    // Form state (pre-filled by AI)
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [type, setType] = useState<MaintenanceType>(MaintenanceType.Ordinary);
    const [description, setDescription] = useState('');
    const [cost, setCost] = useState('');
    const [kilometers, setKilometers] = useState(activeVehicleKilometers || '');

    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelected = useCallback((file: File) => {
        if (!file.type.startsWith('image/')) return;
        setImageFile(file);
        const url = URL.createObjectURL(file);
        setImagePreview(url);
    }, []);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) handleFileSelected(file);
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        const file = e.dataTransfer.files?.[0];
        if (file) handleFileSelected(file);
    };

    const handleScan = async () => {
        if (!imageFile) return;
        setStep('scanning');
        const result = await scanReceipt(imageFile);
        if (result) {
            if (result.date) setDate(result.date);
            if (result.type) setType(result.type);
            if (result.description) setDescription(result.description);
            if (result.cost != null) setCost(String(result.cost));
            if (result.kilometers != null) setKilometers(String(result.kilometers));
            setStep('review');
        } else {
            // Error already shown via notification, go back to upload
            setStep('upload');
        }
    };

    const handleConfirm = () => {
        if (!description.trim() || !cost || !kilometers) {
            alert('Compila tutti i campi obbligatori: descrizione, costo e chilometri.');
            return;
        }
        onConfirm({
            date,
            type,
            description,
            cost: parseFloat(cost),
            kilometers: parseInt(kilometers, 10),
        });
        onClose();
    };

    const handleReset = () => {
        setStep('upload');
        setImageFile(null);
        if (imagePreview) URL.revokeObjectURL(imagePreview);
        setImagePreview(null);
        setDate(new Date().toISOString().split('T')[0]);
        setType(MaintenanceType.Ordinary);
        setDescription('');
        setCost('');
        setKilometers(activeVehicleKilometers || '');
    };

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-2xl shadow-2xl border border-gray-700 w-full max-w-lg max-h-[90vh] overflow-y-auto">

                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-gray-700">
                    <div className="flex items-center gap-3">
                        <SparklesIcon className="w-6 h-6 text-blue-400" />
                        <h2 className="text-lg font-bold text-white">Scansiona Scontrino</h2>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <XMarkIcon className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-5 space-y-5">

                    {/* STEP: UPLOAD */}
                    {(step === 'upload') && (
                        <>
                            {/* Drop zone */}
                            {!imagePreview ? (
                                <div
                                    onDrop={handleDrop}
                                    onDragOver={(e) => e.preventDefault()}
                                    className="border-2 border-dashed border-gray-600 hover:border-blue-500 rounded-xl p-8 text-center transition-colors cursor-pointer"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <PhotoIcon className="w-12 h-12 text-gray-500 mx-auto mb-3" />
                                    <p className="text-gray-300 font-medium mb-1">Trascina lo scontrino qui</p>
                                    <p className="text-gray-500 text-sm mb-4">oppure seleziona un file</p>
                                    <div className="flex justify-center gap-3">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                                            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                                        >
                                            <PhotoIcon className="w-4 h-4" /> Galleria
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); cameraInputRef.current?.click(); }}
                                            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                                        >
                                            <CameraIcon className="w-4 h-4" /> Fotocamera
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="relative rounded-xl overflow-hidden">
                                    <img src={imagePreview} alt="Scontrino" className="w-full object-contain max-h-64 rounded-xl" />
                                    <button
                                        onClick={handleReset}
                                        className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full p-1.5 transition-colors"
                                    >
                                        <XMarkIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            )}

                            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />

                            {imagePreview && (
                                <ActionButton onClick={handleScan} className="w-full" disabled={isScanningReceipt}>
                                    <SparklesIcon className="w-5 h-5 mr-2" />
                                    Analizza con AI
                                </ActionButton>
                            )}
                        </>
                    )}

                    {/* STEP: SCANNING */}
                    {step === 'scanning' && (
                        <div className="flex flex-col items-center justify-center py-12 gap-4">
                            {imagePreview && (
                                <img src={imagePreview} alt="Scontrino" className="w-32 h-32 object-cover rounded-xl opacity-50 mb-2" />
                            )}
                            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                            <p className="text-gray-300 font-medium">Analisi in corso...</p>
                            <p className="text-gray-500 text-sm text-center">Gemini sta leggendo lo scontrino</p>
                        </div>
                    )}

                    {/* STEP: REVIEW */}
                    {step === 'review' && (
                        <>
                            <div className="flex items-center gap-2 text-green-400 text-sm font-medium bg-green-400/10 rounded-lg px-3 py-2">
                                <CheckCircleIcon className="w-5 h-5 flex-shrink-0" />
                                Dati estratti — verifica e correggi se necessario
                            </div>

                            {imagePreview && (
                                <img src={imagePreview} alt="Scontrino" className="w-full object-contain max-h-40 rounded-xl opacity-80" />
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <InputField
                                    id="scanDate"
                                    label="Data"
                                    type="date"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    required
                                />
                                <SelectField
                                    id="scanType"
                                    label="Tipo Intervento"
                                    value={type}
                                    onChange={(e) => setType(e.target.value as MaintenanceType)}
                                >
                                    {Object.values(MaintenanceType).map(t => (
                                        <option key={t} value={t}>{t}</option>
                                    ))}
                                </SelectField>
                                <InputField
                                    id="scanKilometers"
                                    label="Chilometri"
                                    type="number"
                                    value={kilometers}
                                    onChange={(e) => setKilometers(e.target.value)}
                                    required
                                    placeholder="Es. 15500"
                                />
                                <InputField
                                    id="scanCost"
                                    label="Costo (€)"
                                    type="number"
                                    value={cost}
                                    onChange={(e) => setCost(e.target.value)}
                                    required
                                    placeholder="Es. 80.50"
                                />
                                <div className="sm:col-span-2">
                                    <label htmlFor="scanDesc" className="block text-sm font-medium text-gray-300 mb-1">
                                        Descrizione Lavori
                                    </label>
                                    <textarea
                                        id="scanDesc"
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        rows={3}
                                        className="block w-full px-3 py-2 text-white bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={handleReset}
                                    className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm font-medium transition-colors"
                                >
                                    <ArrowPathIcon className="w-4 h-4" /> Riprova
                                </button>
                                <ActionButton onClick={handleConfirm} className="flex-1">
                                    <CheckCircleIcon className="w-5 h-5 mr-2" />
                                    Salva Intervento
                                </ActionButton>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ReceiptScanner;
