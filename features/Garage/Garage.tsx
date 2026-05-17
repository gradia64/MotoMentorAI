
import React, { useState, FormEvent, ChangeEvent } from 'react';
import { GarageVehicle } from '../../types';
import { TrashIcon, XMarkIcon, PencilSquareIcon, PhotoIcon, ExclamationTriangleIcon, CalendarDaysIcon, DocumentTextIcon, ClipboardDocumentListIcon, TruckIcon, SparklesIcon } from '@heroicons/react/24/outline';
import ActionButton from '../../components/ActionButton';
import InputField from '../../components/InputField';

// Stores
import { useGarageStore } from '../../src/store/useGarageStore';
import { useUIStore } from '../../src/store/useUIStore';

import { useEscapeKey } from '../../src/utils/hooks';
import Tooltip from '../../components/Tooltip';

// Helper to convert file to base64
const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });
};

// Helper to check deadline status
const getDeadlineStatus = (dateString?: string) => {
    if (!dateString) return 'none';
    const today = new Date();
    const expiry = new Date(dateString);
    const diffTime = expiry.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'expired';
    if (diffDays <= 30) return 'warning';
    return 'ok';
};

const DeadlineBadge: React.FC<{ label: string; date?: string }> = ({ label, date }) => {
    if (!date) return null;
    const status = getDeadlineStatus(date);
    let colorClass = 'bg-gray-600 text-gray-300';
    let icon = null;

    if (status === 'expired') {
        colorClass = 'bg-red-900/50 text-red-200 border border-red-700';
        icon = <ExclamationTriangleIcon className="w-3 h-3" />;
    } else if (status === 'warning') {
        colorClass = 'bg-yellow-900/50 text-yellow-200 border border-yellow-700';
        icon = <ExclamationTriangleIcon className="w-3 h-3" />;
    } else {
        colorClass = 'bg-green-900/50 text-green-200 border border-green-700';
    }

    return (
        <div className={`text-xs px-2 py-1 rounded-full flex items-center gap-1.5 ${colorClass}`}>
            {icon}
            <span>{label}: {new Date(date).toLocaleDateString('it-IT')}</span>
        </div>
    );
};


// Confirmation Modal Component
export interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ isOpen, onClose, onConfirm, title, message }) => {
    useEscapeKey(onClose, isOpen);
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in" onClick={onClose}>
            <div className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
                <div className="p-6">
                    <div className="flex items-start gap-4">
                        <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-900/50 sm:mx-0 sm:h-10 sm:w-10">
                             <ExclamationTriangleIcon className="h-6 w-6 text-red-400" aria-hidden="true" />
                        </div>
                        <div className="mt-0 text-left">
                            <h3 className="text-lg leading-6 font-bold text-white" id="modal-title">
                                {title}
                            </h3>
                            <div className="mt-2">
                                <p className="text-sm text-gray-400">
                                    {message}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="p-4 bg-gray-700/50 flex flex-row-reverse gap-3">
                    <ActionButton
                        type="button"
                        className="bg-red-600 hover:bg-red-500"
                        onClick={() => { onConfirm(); onClose(); }}
                    >
                        Elimina
                    </ActionButton>
                    <ActionButton
                        type="button"
                        className="bg-gray-600 hover:bg-gray-500"
                        onClick={onClose}
                    >
                        Annulla
                    </ActionButton>
                </div>
            </div>
        </div>
    );
};


// Edit Vehicle Modal Component (Digital Garage)
const EditVehicleModal: React.FC<{
    vehicle: GarageVehicle;
    onSave: (updatedVehicle: GarageVehicle) => void;
    onClose: () => void;
}> = ({ vehicle, onSave, onClose }) => {
    const { handleGenerateSpecs } = useGarageStore();
    const [formData, setFormData] = useState<GarageVehicle>(vehicle);
    const [photoPreview, setPhotoPreview] = useState<string | undefined>(vehicle.photo);
    const [activeTab, setActiveTab] = useState<'info' | 'specs' | 'docs' | 'notes'>('info');
    const [isAutoFilling, setIsAutoFilling] = useState(false);

    useEscapeKey(onClose);

    const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { id, value } = e.target;
        setFormData(prev => ({ ...prev, [id]: value }));
    };

    const handlePhotoChange = async (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (file.size > 2 * 1024 * 1024) { 
                alert("L'immagine è troppo grande (max 2MB). Scegli un file più piccolo.");
                if (e.target) e.target.value = '';
                return;
            }
            const base64 = await fileToBase64(file);
            setFormData(prev => ({ ...prev, photo: base64 }));
            setPhotoPreview(base64);
        }
    };
    
    const handleAutoFill = async () => {
        if (!formData.model || !formData.year) {
            alert("Per favore, compila prima Modello e Anno.");
            return;
        }
        setIsAutoFilling(true);
        const specs = await handleGenerateSpecs(formData.model, formData.year);
        if (specs) {
            setFormData(prev => ({
                ...prev,
                displacement: specs.displacement || prev.displacement,
                power: specs.power || prev.power,
                frontTire: specs.frontTire || prev.frontTire,
                rearTire: specs.rearTire || prev.rearTire
            }));
        }
        setIsAutoFilling(false);
    };

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        onSave(formData);
        onClose();
    };

    const TabButton = ({ id, label, icon: Icon }: { id: typeof activeTab, label: string, icon: React.ElementType }) => (
        <button
            type="button"
            onClick={() => setActiveTab(id)}
            className={`flex-1 py-3 px-2 text-sm font-medium border-b-2 flex items-center justify-center gap-2 transition-colors ${
                activeTab === id ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
        >
            <Icon className="w-5 h-5" />
            <span className="hidden sm:inline">{label}</span>
        </button>
    );

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in" onClick={onClose}>
            <div className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <form onSubmit={handleSubmit} className="flex flex-col h-full">
                    <div className="p-4 border-b border-gray-700 flex justify-between items-center flex-shrink-0">
                        <h3 className="text-xl font-bold text-white flex items-center gap-2">
                            <TruckIcon className="w-6 h-6 text-blue-500"/>
                            Garage Digitale
                        </h3>
                        <button type="button" onClick={onClose} className="text-gray-400 hover:text-white" aria-label="Chiudi"><XMarkIcon className="w-6 h-6"/></button>
                    </div>

                    <div className="flex border-b border-gray-700 bg-gray-700/30 flex-shrink-0">
                        <TabButton id="info" label="Generale" icon={TruckIcon} />
                        <TabButton id="specs" label="Tecnica" icon={ClipboardDocumentListIcon} />
                        <TabButton id="docs" label="Scadenze" icon={CalendarDaysIcon} />
                        <TabButton id="notes" label="Note" icon={DocumentTextIcon} />
                    </div>

                    <div className="p-6 space-y-4 overflow-y-auto flex-grow">
                        {activeTab === 'info' && (
                            <div className="space-y-4 animate-fade-in">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <InputField id="model" label="Modello" value={formData.model} onChange={handleChange} required />
                                    <InputField id="year" label="Anno" value={formData.year} onChange={handleChange} required />
                                </div>
                                <InputField id="kilometers" label="Chilometri" type="number" value={formData.kilometers} onChange={handleChange} required />
                                <InputField id="purchaseDate" label="Data di Acquisto" type="date" value={formData.purchaseDate || ''} onChange={handleChange} />
                                <InputField id="vin" label="Numero di Telaio (VIN)" value={formData.vin || ''} onChange={handleChange} />
                                <div>
                                     <label className="block text-sm font-medium text-gray-300">Foto Veicolo</label>
                                     <div className="mt-2 flex items-center gap-4">
                                        {photoPreview ? (
                                            <img src={photoPreview} alt="Anteprima" className="w-20 h-20 rounded-md object-cover"/>
                                        ) : (
                                            <div className="w-20 h-20 rounded-md bg-gray-700 flex items-center justify-center">
                                                <PhotoIcon className="w-10 h-10 text-gray-500"/>
                                            </div>
                                        )}
                                         <input type="file" id="photo" accept="image/*" onChange={handlePhotoChange} className="hidden"/>
                                         <label htmlFor="photo" className="cursor-pointer text-sm font-semibold text-blue-400 hover:text-blue-300">
                                            Cambia foto...
                                        </label>
                                     </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'specs' && (
                             <div className="space-y-4 animate-fade-in">
                                 <div className="flex justify-between items-center mb-2">
                                     <p className="text-sm text-gray-400">Dati tecnici standard.</p>
                                     <Tooltip text="Usa l'IA per cercare e compilare automaticamente i dati tecnici in base a modello e anno.">
                                        <button 
                                            type="button" 
                                            onClick={handleAutoFill} 
                                            disabled={isAutoFilling}
                                            className="text-xs flex items-center gap-1 bg-purple-600 hover:bg-purple-500 text-white px-3 py-1.5 rounded-full transition-colors disabled:opacity-50"
                                        >
                                            <SparklesIcon className={`w-3 h-3 ${isAutoFilling ? 'animate-spin' : ''}`} /> 
                                            {isAutoFilling ? 'Cercando...' : 'Compila con AI'}
                                        </button>
                                     </Tooltip>
                                 </div>
                                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <InputField id="displacement" label="Cilindrata (cc)" value={formData.displacement || ''} onChange={handleChange} placeholder="Es. 1250" />
                                    <InputField id="power" label="Potenza (CV o kW)" value={formData.power || ''} onChange={handleChange} placeholder="Es. 136 CV" />
                                    <InputField id="frontTire" label="Pneumatico Anteriore" value={formData.frontTire || ''} onChange={handleChange} placeholder="Es. 120/70 R19" />
                                    <InputField id="rearTire" label="Pneumatico Posteriore" value={formData.rearTire || ''} onChange={handleChange} placeholder="Es. 170/60 R17" />
                                 </div>
                             </div>
                        )}

                        {activeTab === 'docs' && (
                            <div className="space-y-6 animate-fade-in">
                                <p className="text-sm text-gray-400 mb-4">Gestione delle scadenze burocratiche. Il sistema ti avviserà quando si avvicinano.</p>
                                
                                <div className="bg-gray-700/30 p-4 rounded-lg border border-gray-600/50">
                                    <h4 className="font-semibold text-blue-300 mb-3 flex items-center gap-2">
                                        <DocumentTextIcon className="w-4 h-4"/> Assicurazione
                                    </h4>
                                    <InputField id="insuranceExpiry" label="Scadenza Polizza" type="date" value={formData.insuranceExpiry || ''} onChange={handleChange} />
                                </div>

                                <div className="bg-gray-700/30 p-4 rounded-lg border border-gray-600/50">
                                    <h4 className="font-semibold text-blue-300 mb-3 flex items-center gap-2">
                                        <DocumentTextIcon className="w-4 h-4"/> Tassa di Proprietà (Bollo)
                                    </h4>
                                    <InputField id="taxExpiry" label="Scadenza Bollo" type="date" value={formData.taxExpiry || ''} onChange={handleChange} />
                                </div>

                                <div className="bg-gray-700/30 p-4 rounded-lg border border-gray-600/50">
                                    <h4 className="font-semibold text-blue-300 mb-3 flex items-center gap-2">
                                        <DocumentTextIcon className="w-4 h-4"/> Revisione Ministeriale
                                    </h4>
                                    <InputField id="inspectionExpiry" label="Scadenza Revisione" type="date" value={formData.inspectionExpiry || ''} onChange={handleChange} />
                                </div>
                            </div>
                        )}

                        {activeTab === 'notes' && (
                            <div className="space-y-4 animate-fade-in">
                                <label htmlFor="notes" className="block text-sm font-medium text-gray-300">Note e Appunti</label>
                                <textarea
                                    id="notes"
                                    value={formData.notes || ''}
                                    onChange={handleChange}
                                    rows={8}
                                    className="block w-full px-3 py-2 text-white bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                    placeholder="Codice colore, misure pneumatici, pressione gomme, tipo olio preferito..."
                                />
                            </div>
                        )}
                    </div>
                    <div className="p-4 bg-gray-700/50 flex justify-end gap-3 flex-shrink-0">
                         <ActionButton type="button" onClick={onClose} className="bg-gray-600 hover:bg-gray-500">Annulla</ActionButton>
                        <ActionButton type="submit">Salva nel Garage</ActionButton>
                    </div>
                </form>
            </div>
        </div>
    );
};


const Garage: React.FC = () => {
    const { garageVehicles, activeVehicle, addVehicle, updateVehicle, deleteVehicle, setActiveVehicle } = useGarageStore();
    
    const [newVehicle, setNewVehicle] = useState({ model: '', year: '', kilometers: '' });
    const [editingVehicle, setEditingVehicle] = useState<GarageVehicle | null>(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [vehicleToDelete, setVehicleToDelete] = useState<string | null>(null);

    const openDeleteConfirmation = (id: string) => {
        setVehicleToDelete(id);
        setIsDeleteModalOpen(true);
    };

    const confirmDelete = () => {
        if (vehicleToDelete) {
            deleteVehicle(vehicleToDelete);
        }
    };

    const handleAddVehicleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if(!newVehicle.model.trim() || !newVehicle.year.trim() || !newVehicle.kilometers.trim()) {
            alert("Compila almeno Modello, Anno e Chilometri.");
            return;
        }
        addVehicle(newVehicle);
        setNewVehicle({ model: '', year: '', kilometers: '' });
    };

    const handleNewVehicleChange = (e: ChangeEvent<HTMLInputElement>) => {
        setNewVehicle(prev => ({...prev, [e.target.id]: e.target.value}));
    };
    
    return (
    <div className="animate-fade-in">
        {editingVehicle && <EditVehicleModal vehicle={editingVehicle} onSave={updateVehicle} onClose={() => setEditingVehicle(null)} />}
        <ConfirmationModal
            isOpen={isDeleteModalOpen}
            onClose={() => setIsDeleteModalOpen(false)}
            onConfirm={confirmDelete}
            title="Conferma Eliminazione"
            message="Sei sicuro di voler rimuovere questo veicolo dal garage? Questa azione è irreversibile."
        />

        <div className="flex items-center justify-between mb-2">
            <h2 className="text-2xl font-bold">Garage Digitale</h2>
            <div className="bg-blue-900/30 text-blue-300 text-xs px-2 py-1 rounded border border-blue-800 hidden sm:block">
                Gestione Documenti & Scadenze Attiva
            </div>
        </div>
        <p className="text-gray-400 mb-6">Gestisci le tue moto, le scadenze (Assicurazione, Bollo, Revisione) e i dati tecnici.</p>
        
        <div className="bg-gray-700/50 p-4 rounded-lg mb-8">
            <h3 className="text-lg font-semibold mb-3 text-white">Inserimento Rapido</h3>
            <form onSubmit={handleAddVehicleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <InputField id="model" label="Modello Moto" value={newVehicle.model} onChange={handleNewVehicleChange} placeholder="Es. BMW R1250GS" required />
                    <InputField id="year" label="Anno Moto" value={newVehicle.year} onChange={handleNewVehicleChange} placeholder="Es. 2022" required />
                    <InputField id="kilometers" label="Chilometri Attuali" type="number" value={newVehicle.kilometers} onChange={handleNewVehicleChange} placeholder="Es. 15000" required />
                </div>
                <div className="flex items-center gap-4">
                    <ActionButton type="submit">Aggiungi al Garage</ActionButton>
                    <span className="text-xs text-gray-500 italic">Potrai aggiungere foto e documenti successivamente cliccando su modifica.</span>
                </div>
            </form>
        </div>

        <div>
            <h3 className="text-xl font-bold mb-4 text-white">I Tuoi Veicoli</h3>
            {garageVehicles.length === 0 ? (
                <p className="text-gray-400">Nessun veicolo nel garage.</p>
            ) : (
                <div className="grid grid-cols-1 gap-6">
                    {garageVehicles.map((v: any) => {
                        const isActive = v.id === activeVehicle?.id;
                        return (
                            <div key={v.id} className={`rounded-lg flex flex-col md:flex-row overflow-hidden transition-all duration-300 ${isActive ? 'bg-blue-900/20 ring-2 ring-blue-500 shadow-lg shadow-blue-900/20' : 'bg-gray-800 opacity-90 hover:opacity-100 hover:bg-gray-700'}`}>
                                {/* Image Section */}
                                <div className="w-full md:w-48 h-48 md:h-auto flex-shrink-0 bg-gray-900 relative">
                                    {v.photo ? (
                                        <img src={v.photo} alt={v.model} className="w-full h-full object-cover"/>
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-600">
                                            <PhotoIcon className="w-12 h-12"/>
                                        </div>
                                    )}
                                    {isActive && (
                                        <div className="absolute top-2 left-2 bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded shadow">
                                            ATTIVO
                                        </div>
                                    )}
                                </div>
                                
                                {/* Content Section */}
                                <div className="p-4 flex-grow flex flex-col justify-between">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h4 className="text-xl font-bold text-white">{v.model}</h4>
                                            <p className="text-sm text-gray-400">{v.year} • {Number(v.kilometers).toLocaleString('it-IT')} km</p>
                                            
                                            {/* Tech Specs Badges */}
                                            {(v.displacement || v.power) && (
                                                <div className="mt-2 flex gap-2">
                                                    {v.displacement && <span className="text-xs bg-gray-700 px-2 py-0.5 rounded text-gray-300">{v.displacement.toLowerCase().includes('cc') ? v.displacement : `${v.displacement} cc`}</span>}
                                                    {v.power && <span className="text-xs bg-gray-700 px-2 py-0.5 rounded text-gray-300">{v.power}</span>}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Deadlines Status Row */}
                                    <div className="mt-4 flex flex-wrap gap-2">
                                        {v.insuranceExpiry ? <DeadlineBadge label="Assic." date={v.insuranceExpiry} /> : <span className="text-xs text-gray-600 border border-gray-700 px-2 py-1 rounded-full border-dashed">No Assic.</span>}
                                        {v.taxExpiry ? <DeadlineBadge label="Bollo" date={v.taxExpiry} /> : <span className="text-xs text-gray-600 border border-gray-700 px-2 py-1 rounded-full border-dashed">No Bollo</span>}
                                        {v.inspectionExpiry ? <DeadlineBadge label="Rev." date={v.inspectionExpiry} /> : <span className="text-xs text-gray-600 border border-gray-700 px-2 py-1 rounded-full border-dashed">No Rev.</span>}
                                    </div>

                                    {/* Actions Row */}
                                    <div className="mt-4 pt-4 border-t border-gray-700 flex items-center justify-between gap-2">
                                        <div className="flex gap-2">
                                            <Tooltip text={isActive ? "Questo veicolo è già attivo per le funzioni AI" : "Usa questo veicolo per Planner, Meccanico e Chat"}>
                                                <button onClick={() => setActiveVehicle(v.id)} disabled={isActive} className="text-xs py-1.5 px-4 rounded-md font-semibold transition-colors bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-default text-white">
                                                    {isActive ? 'In Uso' : 'Seleziona'}
                                                </button>
                                            </Tooltip>
                                        </div>
                                        <div className="flex gap-2">
                                            <Tooltip text="Apri Garage Digitale: Dati, Scadenze, Note">
                                                <button onClick={() => setEditingVehicle(v)} className="flex items-center gap-1 text-sm text-gray-300 hover:text-white px-3 py-1.5 rounded-md hover:bg-gray-600 transition-colors bg-gray-700/50">
                                                    <PencilSquareIcon className="w-4 h-4" /> Gestisci
                                                </button>
                                            </Tooltip>
                                            <Tooltip text="Elimina veicolo">
                                                <button onClick={() => openDeleteConfirmation(v.id)} className="text-gray-400 hover:text-red-400 p-1.5 rounded-md transition-colors hover:bg-gray-700/50">
                                                    <TrashIcon className="w-5 h-5" />
                                                </button>
                                            </Tooltip>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    </div>
    );
};

export default Garage;
