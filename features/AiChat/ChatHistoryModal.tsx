import React from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useEscapeKey } from '../../utils/hooks';
import { ChatHistoryItem } from '../../state/AppContext';

interface ChatHistoryModalProps {
    show: boolean;
    onClose: () => void;
    history: ChatHistoryItem[];
    onLoad: (key: string) => void;
}

const ChatHistoryModal: React.FC<ChatHistoryModalProps> = ({ show, onClose, history, onLoad }) => {
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
                                <button
                                    key={item.key}
                                    onClick={() => { onLoad(item.key); onClose(); }}
                                    className="bg-gray-700/50 p-3 rounded-lg w-full text-left hover:bg-gray-700 transition-colors"
                                >
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
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ChatHistoryModal;