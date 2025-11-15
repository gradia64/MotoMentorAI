import React, { useRef } from 'react';
import { XMarkIcon, TrashIcon, ArrowDownTrayIcon, ArrowUpTrayIcon } from '@heroicons/react/24/outline';
import { SavedTrip } from '../../types';
import ActionButton from '../../components/ActionButton';
import { useEscapeKey } from '../../utils/hooks';

interface TripHistoryModalProps {
    show: boolean;
    onClose: () => void;
    history: SavedTrip[];
    onLoad: (id: string) => void;
    onDelete: (id: string) => void;
    onExport: () => void;
    onImport: (file: File) => void;
}

const TripHistoryModal: React.FC<TripHistoryModalProps> = ({ show, onClose, history, onLoad, onDelete, onExport, onImport }) => {
    useEscapeKey(onClose, show);
    const importInputRef = useRef<HTMLInputElement>(null);

    const handleImportClick = () => {
        importInputRef.current?.click();
    };

    const handleFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files[0]) {
            onImport(event.target.files[0]);
            onClose(); // Close modal after selection
        }
    };
    
    if (!show) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in" onClick={onClose}>
            <div className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-gray-700 flex justify-between items-center">
                    <h3 className="text-xl font-bold text-white">Storico Viaggi</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white" aria-label="Chiudi storico viaggi"><XMarkIcon className="w-6 h-6"/></button>
                </div>
                <div className="p-4 overflow-y-auto">
                    {history.length === 0 ? (
                        <p className="text-gray-400 text-center py-8">Nessun viaggio salvato nello storico.</p>
                    ) : (
                        <div className="space-y-3">
                            {history.map(trip => (
                                <div key={trip.id} className="bg-gray-700/50 p-3 rounded-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                    <div>
                                        <p className="font-bold text-white">{trip.itinerary.tripTitle}</p>
                                        <p className="text-sm text-gray-400">{trip.inputs.duration} giorni - {trip.inputs.period} - {trip.inputs.tripType === 'tour' ? trip.inputs.selectedTour : `${trip.inputs.departure} -> ${trip.inputs.destination}`}</p>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-center">
                                        <button 
                                            onClick={() => { onLoad(trip.id); onClose(); }} 
                                            className="text-xs py-1 px-3 rounded-full font-semibold transition-colors bg-blue-600 hover:bg-blue-500 text-white"
                                            aria-label={`Carica ${trip.itinerary.tripTitle}`}
                                        >
                                            Carica
                                        </button>
                                        <button 
                                            onClick={() => onDelete(trip.id)} 
                                            className="text-gray-500 hover:text-red-400 p-1 rounded-full transition-colors"
                                            aria-label={`Elimina ${trip.itinerary.tripTitle}`}
                                        >
                                            <TrashIcon className="w-5 h-5"/>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div className="p-4 border-t border-gray-700 mt-auto flex gap-3">
                     <input
                        type="file"
                        ref={importInputRef}
                        onChange={handleFileSelected}
                        accept=".json"
                        className="hidden"
                    />
                    <ActionButton onClick={handleImportClick} className="w-full bg-gray-600 hover:bg-gray-500">
                        <ArrowUpTrayIcon className="w-5 h-5"/> Importa Storico (.json)
                    </ActionButton>
                    <ActionButton onClick={onExport} disabled={history.length === 0} className="w-full">
                        <ArrowDownTrayIcon className="w-5 h-5"/> Esporta Storico (.json)
                    </ActionButton>
                </div>
            </div>
        </div>
    );
};

export default TripHistoryModal;