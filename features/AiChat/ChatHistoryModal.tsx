import React, { useState } from 'react';
import { XMarkIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useAppContext } from '../../state/AppContext';
import { useEscapeKey } from '../../utils/hooks';
import { ConfirmationModal } from '../../features/Garage/Garage';

interface ChatHistoryModalProps {
    show: boolean;
    onClose: () => void;
}

const ChatHistoryModal: React.FC<ChatHistoryModalProps> = ({ show, onClose }) => {
    const { state, handleDeleteChatHistory } = useAppContext();
    const { chatHistoryList } = state;
    const [confirmState, setConfirmState] = useState<{ isOpen: boolean; key: string | null }>({ isOpen: false, key: null });

    useEscapeKey(onClose, show);

    if (!show) return null;

    const handleDeleteClick = (key: string) => {
        setConfirmState({ isOpen: true, key: key });
    };

    const handleConfirmDelete = () => {
        if (confirmState.key) {
            handleDeleteChatHistory(confirmState.key);
        }
        // The modal will close itself via its onConfirm prop, no need to set state here.
    };

    return (
        <>
            <ConfirmationModal
                isOpen={confirmState.isOpen}
                onClose={() => setConfirmState({ isOpen: false, key: null })}
                onConfirm={handleConfirmDelete}
                title="Elimina Cronologia Chat"
                message="Sei sicuro di voler eliminare questa cronologia di chat? L'azione è irreversibile."
            />
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in" onClick={onClose}>
                <div className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                    <div className="p-4 border-b border-gray-700 flex justify-between items-center">
                        <h3 className="text-xl font-bold text-white">Storico Chat</h3>
                        <button onClick={onClose} className="text-gray-400 hover:text-white" aria-label="Chiudi storico chat"><XMarkIcon className="w-6 h-6"/></button>
                    </div>
                    <div className="p-4 overflow-y-auto">
                        {chatHistoryList.length === 0 ? (
                            <p className="text-gray-400 text-center py-8">Nessuna cronologia di chat trovata.</p>
                        ) : (
                            <div className="space-y-3">
                                {chatHistoryList.map(item => (
                                    <div key={item.key} className="bg-gray-700/50 p-3 rounded-lg flex items-center justify-between gap-3">
                                        <div>
                                            <p className="font-semibold text-white">{item.vehicleName}</p>
                                            {item.lastUpdated && (
                                                <p className="text-sm text-gray-400">
                                                    {new Date(item.lastUpdated).toLocaleString('it-IT', { 
                                                        day: '2-digit', 
                                                        month: 'short', 
                                                        year: 'numeric', 
                                                        hour: '2-digit', 
                                                        minute: '2-digit' 
                                                    })}
                                                </p>
                                            )}
                                        </div>
                                        <button 
                                            onClick={() => handleDeleteClick(item.key)} 
                                            className="text-gray-500 hover:text-red-400 p-1 rounded-full transition-colors"
                                            aria-label={`Elimina ${item.vehicleName}`}
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
        </>
    );
};

export default ChatHistoryModal;