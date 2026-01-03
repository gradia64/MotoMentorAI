
import React from 'react';
import { XMarkIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useEscapeKey } from '../../utils/hooks';
import { SavedChat } from '../../types';

interface ChatHistoryModalProps {
    show: boolean;
    onClose: () => void;
    history: SavedChat[];
    onLoad: (id: string) => void;
    onDelete: (id: string) => void;
}

const ChatHistoryModal: React.FC<ChatHistoryModalProps> = ({ show, onClose, history, onLoad, onDelete }) => {
    useEscapeKey(onClose, show);

    if (!show) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in" onClick={onClose}>
            <div className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-gray-700 flex justify-between items-center">
                    <h3 className="text-xl font-bold text-white">Storico Chat</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white" aria-label="Chiudi storico chat"><XMarkIcon className="w-6 h-6"/></button>
                </div>
                <div className="p-4 overflow-y-auto">
                    {history.length === 0 ? (
                        <p className="text-gray-400 text-center py-8">Nessuna cronologia di chat trovata.</p>
                    ) : (
                        <div className="space-y-3">
                            {history.map(item => (
                                <div key={item.id} className="bg-gray-700/50 p-3 rounded-lg flex items-center justify-between gap-3 group">
                                    <button
                                        onClick={() => { onLoad(item.id); onClose(); }}
                                        className="flex-grow text-left hover:bg-gray-700/50 transition-colors rounded-md p-1"
                                    >
                                        <p className="font-semibold text-white">{item.vehicleName}</p>
                                        <p className="text-sm text-gray-400">
                                            {new Date(item.timestamp).toLocaleString('it-IT', { 
                                                day: '2-digit', 
                                                month: 'short', 
                                                year: 'numeric', 
                                                hour: '2-digit', 
                                                minute: '2-digit' 
                                            })}
                                        </p>
                                        <p className="text-xs text-blue-400 mt-1">{item.history.length} messaggi</p>
                                    </button>
                                    <button 
                                        onClick={() => onDelete(item.id)}
                                        className="text-gray-500 hover:text-red-500 p-2 transition-colors flex-shrink-0"
                                        title="Elimina chat dallo storico"
                                    >
                                        <TrashIcon className="w-5 h-5"/>
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ChatHistoryModal;
