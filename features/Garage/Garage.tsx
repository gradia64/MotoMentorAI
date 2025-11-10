import React, { useState, FormEvent, useEffect, ChangeEvent } from 'react';
import { GarageVehicle } from '../../types';
import { TrashIcon, XMarkIcon, PencilSquareIcon, PhotoIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import ActionButton from '../../components/ActionButton';
import InputField from '../../components/InputField';

// Helper to convert file to base64
const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });
};

// Confirmation Modal Component
interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ isOpen, onClose, onConfirm, title, message }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 animate-fade-in" onClick={onClose}>
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


// Edit Vehicle Modal Component
const EditVehicleModal: React.FC<{
    vehicle: GarageVehicle;
    onSave: (updatedVehicle: GarageVehicle) => void;
    onClose: () => void;
}> = ({ vehicle, onSave, onClose }) => {
    const [formData, setFormData] = useState<GarageVehicle>(vehicle);
    const [photoPreview, setPhotoPreview] = useState<string | undefined>(vehicle.photo);

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        const { id, value } = e.target;
        setFormData(prev => ({ ...prev, [id]: value }));
    };

    const handlePhotoChange = async (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const base64 = await fileToBase64(file);
            setFormData(prev => ({ ...prev, photo: base64 }));
            setPhotoPreview(base64);
        }
    };

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        onSave(formData);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 animate-fade-in" onClick={onClose}>
            <div className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-2xl" onClick={e => e.stopPropagation()}>
                <form onSubmit={handleSubmit}>
                    <div className="p-4 border-b border-gray-700 flex justify-between items-center">
                        <h3 className="text-xl font-bold text-white">Modifica Veicolo</h3>
                        <button type="button" onClick={onClose} className="text-gray-400 hover:text-white"><XMarkIcon className="w-6 h-6"/></button>
                    </div>
                    <div className="p-6 space-y-4">
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
                    <div className="p-4 bg-gray-700/50 flex justify-end gap-3">
                         <ActionButton type="button" onClick={onClose} className="bg-gray-600 hover:bg-gray-500">Annulla</ActionButton>
                        <ActionButton type="submit">Salva Modifiche</ActionButton>
                    </div>
                </form>
            </div>
        </div>
    );
};


export interface GarageProps {
    vehicles: GarageVehicle[];
    activeVehicleId: string | null;
    onAddVehicle: (vehicle: Omit<GarageVehicle, 'id'>) => void;
    onUpdateVehicle: (vehicle: GarageVehicle) => void;
    onDeleteVehicle: (id: string) => void;
    onSetActiveVehicle: (id: string) => void;
    savedConfirmation: string | null;
}

const Garage: React.FC<GarageProps> = ({ vehicles, activeVehicleId, onAddVehicle, onUpdateVehicle, onDeleteVehicle, onSetActiveVehicle, savedConfirmation }) => {
    
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
            onDeleteVehicle(vehicleToDelete);
        }
    };

    const handleAddVehicleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if(!newVehicle.model.trim() || !newVehicle.year.trim() || !newVehicle.kilometers.trim()) {
            alert("Compila almeno Modello, Anno e Chilometri.");
            return;
        }
        onAddVehicle(newVehicle);
        setNewVehicle({ model: '', year: '', kilometers: '' });
    };

    const handleNewVehicleChange = (e: ChangeEvent<HTMLInputElement>) => {
        setNewVehicle(prev => ({...prev, [e.target.id]: e.target.value}));
    };
    
    return (
    <div className="animate-fade-in">
        {editingVehicle && <EditVehicleModal vehicle={editingVehicle} onSave={onUpdateVehicle} onClose={() => setEditingVehicle(null)} />}
        <ConfirmationModal
            isOpen={isDeleteModalOpen}
            onClose={() => setIsDeleteModalOpen(false)}
            onConfirm={confirmDelete}
            title="Conferma Eliminazione"
            message="Sei sicuro di voler rimuovere questo veicolo dal garage? Questa azione è irreversibile."
        />

        <h2 className="text-2xl font-bold mb-2">Il Mio Garage</h2>
        <p className="text-gray-400 mb-6">Aggiungi e gestisci le tue moto per ottenere suggerimenti più precisi e personalizzati.</p>
        
        <div className="bg-gray-700/50 p-4 rounded-lg mb-8">
            <h3 className="text-lg font-semibold mb-3 text-white">Aggiungi Nuovo Veicolo</h3>
            <form onSubmit={handleAddVehicleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <InputField id="model" label="Modello Moto" value={newVehicle.model} onChange={handleNewVehicleChange} placeholder="Es. BMW R1250GS" required />
                    <InputField id="year" label="Anno Moto" value={newVehicle.year} onChange={handleNewVehicleChange} placeholder="Es. 2022" required />
                    <InputField id="kilometers" label="Chilometri Attuali" type="number" value={newVehicle.kilometers} onChange={handleNewVehicleChange} placeholder="Es. 15000" required />
                </div>
                <div className="flex items-center gap-4">
                    <ActionButton type="submit">Aggiungi Veicolo</ActionButton>
                    {savedConfirmation && <span className="text-green-400 animate-pulse">{savedConfirmation}</span>}
                </div>
            </form>
        </div>

        <div>
            <h3 className="text-xl font-bold mb-4 text-white">Veicoli Salvati</h3>
            {vehicles.length === 0 ? (
                <p className="text-gray-400">Nessun veicolo nel garage.</p>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {vehicles.map(v => (
                        <div key={v.id} className={`rounded-lg flex flex-col transition-all ${v.id === activeVehicleId ? 'bg-blue-600/20 ring-2 ring-blue-500' : 'bg-gray-700/50'}`}>
                            <div className="flex p-3 gap-4 items-center">
                                {v.photo ? (
                                    <img src={v.photo} alt={v.model} className="w-20 h-20 object-cover rounded-md flex-shrink-0 bg-gray-800"/>
                                ) : (
                                     <div className="w-20 h-20 rounded-md bg-gray-800 flex items-center justify-center flex-shrink-0">
                                        <PhotoIcon className="w-10 h-10 text-gray-500"/>
                                    </div>
                                )}
                                <div className="flex-grow">
                                    <p className="font-bold text-white">{v.model}</p>
                                    <p className="text-sm text-gray-400">{v.year} - {Number(v.kilometers).toLocaleString('it-IT')} km</p>
                                    {v.purchaseDate && <p className="text-xs text-gray-500 mt-1">Acquistata il: {new Date(v.purchaseDate).toLocaleDateString('it-IT')}</p>}
                                </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0 mt-auto bg-black/20 p-2 rounded-b-lg">
                                <button onClick={() => onSetActiveVehicle(v.id)} disabled={v.id === activeVehicleId} className="text-xs py-1 px-3 rounded-full font-semibold transition-colors bg-gray-600 hover:bg-gray-500 disabled:bg-blue-600 disabled:opacity-100 disabled:cursor-default text-white flex-grow text-center">
                                    {v.id === activeVehicleId ? 'Attivo' : 'Seleziona'}
                                </button>
                                <button onClick={() => setEditingVehicle(v)} className="text-gray-400 hover:text-white p-1.5 rounded-full transition-colors bg-gray-600 hover:bg-gray-500"><PencilSquareIcon className="w-4 h-4" /></button>
                                <button onClick={() => openDeleteConfirmation(v.id)} className="text-gray-400 hover:text-red-400 p-1.5 rounded-full transition-colors bg-gray-600 hover:bg-gray-500">
                                    <TrashIcon className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    </div>
    );
};

export default Garage;