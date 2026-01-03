
import React, { useState } from 'react';
import { XMarkIcon, TrashIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { useEscapeKey } from '../../utils/hooks';
import { SavedChat } from '../../types';
import ActionButton from '../../components/ActionButton';

interface ChatHistoryModalProps {
    show: boolean;
    onClose: () => void;
    history: SavedChat[];
    onLoad: (id: string) => void;
    onDelete: (id: string) => void;
}

const ChatHistoryModal: React.FC<ChatHistoryModalProps> = ({ show, onClose, history, onLoad, onDelete }) => {
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    useEscapeKey(onClose, show);

    if (!show) return null;

    const handleDeleteClick = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setConfirmDeleteId(id);
    };

    const confirmDelete = () => {
        if (confirmDeleteId) {
            onDelete(confirmDeleteId);
            setConfirmDeleteId(null);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in" onClick={onClose}>
            <div className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-gray-700 flex justify-between items-center">
                    <h3 className="text-xl font-bold text-white">Storico Chat</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white"><XMarkIcon className="w-6 h-6"/></button>
                </div>
                
                <div className="p-4 overflow-y-auto">
                    {confirmDeleteId ? (
                        <div className="p-6 text-center animate-fade-in">
                            <ExclamationTriangleIcon className="w-12 h-12 text-red-500 mx-auto mb-4" />
                            <h4 className="text-lg font-bold text-white mb-2">Confermi l'eliminazione?</h4>
                            <p className="text-gray-400 mb-6">Questa conversazione verrà rimossa definitivamente dallo storico.</p>
                            <div className="flex gap-3 justify-center">
                                <ActionButton onClick={() => setConfirmDeleteId(null)} className="bg-gray-600 hover:bg-gray-500">Annulla</ActionButton>
                                <ActionButton onClick={confirmDelete} className="bg-red-600 hover:bg-red-500">Elimina</ActionButton>
                            </div>
                        </div>
                    ) : history.length === 0 ? (
                        <p className="text-gray-400 text-center py-8">Nessuna cronologia salvata.</p>
                    ) : (
                        <div className="space-y-3">
                            {history.map(item => (
                                <div 
                                    key={item.id} 
                                    onClick={() => { onLoad(item.id); onClose(); }}
                                    className="bg-gray-700/50 hover:bg-gray-700 p-4 rounded-xl flex items-center justify-between gap-3 group cursor-pointer border border-transparent hover:border-blue-500/50 transition-all"
                                >
                                    <div className="flex-grow">
                                        <p className="font-bold text-white">{item.vehicleName}</p>
                                        <p className="text-xs text-gray-400 mb-1">
                                            {new Date(item.timestamp).toLocaleString('it-IT', { 
                                                day: '2-digit', month: 'short', year: 'numeric',
                                                hour: '2-digit', minute: '2-digit' 
                                            })}
                                        </p>
                                        <p className="text-xs text-blue-400">{item.history.length} messaggi</p>
                                    </div>
                                    <button 
                                        onClick={(e) => handleDeleteClick(e, item.id)}
                                        className="text-gray-500 hover:text-red-500 p-2 transition-colors flex-shrink-0"
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
