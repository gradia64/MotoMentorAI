import React from 'react';
import { XMarkIcon, TrashIcon } from '@heroicons/react/24/outline';
import { SavedDiagnosis } from '../../types';
import { useEscapeKey } from '../../src/utils/hooks';

interface DiagnosisHistoryModalProps {
    show: boolean;
    onClose: () => void;
    history: SavedDiagnosis[];
    onLoad: (id: string) => void;
    onDelete: (id: string) => void;
}

const DiagnosisHistoryModal: React.FC<DiagnosisHistoryModalProps> = ({ show, onClose, history, onLoad, onDelete }) => {
    useEscapeKey(onClose, show);
    
    if (!show) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in" onClick={onClose}>
            <div className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-gray-700 flex justify-between items-center">
                    <h3 className="text-xl font-bold text-white">Storico Diagnosi</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white" aria-label="Chiudi storico diagnosi"><XMarkIcon className="w-6 h-6"/></button>
                </div>
                <div className="p-4 overflow-y-auto">
                    {history.length === 0 ? (
                        <p className="text-gray-400 text-center py-8">Nessuna diagnosi salvata per questo veicolo.</p>
                    ) : (
                        <div className="space-y-3">
                            {history.map(item => (
                                <div key={item.id} className="bg-gray-700/50 p-3 rounded-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                    <div>
                                        <p className="font-semibold text-white truncate max-w-xs" title={item.problemDescription}>
                                            {item.problemDescription}
                                        </p>
                                        <p className="text-sm text-gray-400">
                                            {new Date(item.date).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-center">
                                        <button 
                                            onClick={() => { onLoad(item.id); onClose(); }} 
                                            className="text-xs py-1 px-3 rounded-full font-semibold transition-colors bg-blue-600 hover:bg-blue-500 text-white"
                                            aria-label={`Carica diagnosi del ${new Date(item.date).toLocaleDateString('it-IT')}`}
                                        >
                                            Carica
                                        </button>
                                        <button 
                                            onClick={() => onDelete(item.id)} 
                                            className="text-gray-500 hover:text-red-400 p-1 rounded-full transition-colors"
                                            aria-label={`Elimina diagnosi del ${new Date(item.date).toLocaleDateString('it-IT')}`}
                                        >
                                            <TrashIcon className="w-5 h-5"/>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DiagnosisHistoryModal;
