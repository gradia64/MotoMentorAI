
import React, { useState, useEffect, useRef } from 'react';
import { SparklesIcon, BookOpenIcon, TrashIcon, ArchiveBoxIcon } from '@heroicons/react/24/outline';
import { PaperAirplaneIcon } from '@heroicons/react/24/solid';
import { useAppContext } from '../../state/AppContext';
import ChatHistoryModal from './ChatHistoryModal';
import { ConfirmationModal } from '../Garage/Garage';
import Tooltip from '../../components/Tooltip';

const AiChat: React.FC = () => {
    const { state, handleSendMessage, handleClearActiveChat, handleLoadChatHistory, handleSaveCurrentChat, handleDeleteSavedChat } = useAppContext();
    const { activeVehicle, chatHistory, isChatLoading, savedChats } = state;
    const [input, setInput] = useState('');
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [chatHistory, isChatLoading]);

    const submitMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (input.trim() && !isChatLoading) {
            handleSendMessage(input);
            setInput('');
        }
    };

    const handleConfirmClear = () => {
        handleClearActiveChat();
        setIsClearConfirmOpen(false); // Modal closes itself, but this syncs state
    };

    // Simple markdown-like renderer for bold text **text** and lists * item
    const renderText = (text: string) => {
        const lines = text.split('\n');
        return lines.map((line, lineIndex) => {
            const parts = line.split(/(\*\*.*?\*\*)/g);
            return (
                <p key={lineIndex} className={line.trim().startsWith('* ') ? 'ml-4' : ''}>
                    {parts.map((part, partIndex) => {
                        if (part.startsWith('**') && part.endsWith('**')) {
                            return <strong key={partIndex}>{part.slice(2, -2)}</strong>;
                        }
                        if (part.trim().startsWith('* ')) {
                             return <span key={partIndex}><span className="mr-2">•</span>{part.trim().substring(1)}</span>;
                        }
                        return part;
                    })}
                </p>
            );
        });
    };

    return (
        <div className="flex flex-col h-[70vh] animate-fade-in">
            <ConfirmationModal
                isOpen={isClearConfirmOpen}
                onClose={() => setIsClearConfirmOpen(false)}
                onConfirm={handleConfirmClear}
                title="Cancella Chat Corrente"
                message="Sei sicuro di voler cancellare la cronologia di questa chat? L'azione è irreversibile."
            />
            <ChatHistoryModal 
                show={showHistoryModal} 
                onClose={() => setShowHistoryModal(false)}
                history={savedChats}
                onLoad={handleLoadChatHistory}
                onDelete={handleDeleteSavedChat}
            />
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold mb-2">AI Chat</h2>
                    <p className="text-gray-400 mb-4">
                        {activeVehicle
                            ? `Stai chattando riguardo la tua ${activeVehicle.model}.`
                            : "Seleziona un veicolo nel Garage per una chat più personalizzata."}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Tooltip text="Salva la conversazione corrente nello storico">
                        <button 
                            onClick={handleSaveCurrentChat}
                            disabled={chatHistory.length === 0 || isChatLoading}
                            className="flex items-center gap-2 text-sm font-semibold text-white bg-green-700 hover:bg-green-600 px-3 py-2 rounded-md transition-colors disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed"
                            aria-label="Salva chat attiva"
                        >
                            <ArchiveBoxIcon className="w-5 h-5"/>
                            <span className="hidden sm:inline">Salva</span>
                        </button>
                    </Tooltip>
                    <Tooltip text="Visualizza le conversazioni salvate">
                        <button 
                            onClick={() => setShowHistoryModal(true)} 
                            className="flex items-center gap-2 text-sm font-semibold text-gray-300 bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded-md transition-colors"
                            aria-label="Apri storico chat"
                        >
                            <BookOpenIcon className="w-5 h-5"/>
                            <span className="hidden sm:inline">Storico</span>
                        </button>
                    </Tooltip>
                    <Tooltip text="Svuota la chat corrente (senza salvarla)">
                        <button
                            onClick={() => setIsClearConfirmOpen(true)}
                            disabled={chatHistory.length === 0 || isChatLoading}
                            className="flex items-center gap-2 text-sm font-semibold text-gray-300 bg-red-800/50 hover:bg-red-700/50 px-3 py-2 rounded-md transition-colors disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed"
                            aria-label="Cancella chat attiva"
                        >
                            <TrashIcon className="w-5 h-5" />
                            <span className="hidden sm:inline">Pulisci</span>
                        </button>
                    </Tooltip>
                </div>
            </div>
            
            <div className="flex-grow bg-gray-700/50 rounded-lg p-4 overflow-y-auto mb-4 relative">
                {chatHistory.length === 0 && !isChatLoading && (
                    <div className="text-center text-gray-400 h-full flex flex-col justify-center items-center">
                        <SparklesIcon className="w-12 h-12 text-blue-500 mb-2"/>
                        <p className="font-semibold">Ciao! Sono MotoMentor.</p>
                        <p>Chiedimi consigli sulla manutenzione, idee per viaggi o qualsiasi altra curiosità sulla tua moto.</p>
                    </div>
                )}

                <div className="space-y-4">
                    {chatHistory.map((msg, index) => (
                        <div key={index} className={`flex items-end gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            {msg.role === 'model' && <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0"><SparklesIcon className="w-5 h-5 text-white"/></div>}
                            <div className={`max-w-xl p-3 rounded-2xl whitespace-pre-wrap ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-gray-800 text-gray-300 rounded-bl-none'}`}>
                                {renderText(msg.parts.map(p => p.text).join(''))}
                            </div>
                        </div>
                    ))}
                     {isChatLoading && chatHistory.length > 0 && (
                        <div className="flex items-end gap-2 justify-start">
                            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0"><SparklesIcon className="w-5 h-5 text-white"/></div>
                            <div className="max-w-md p-3 rounded-2xl bg-gray-800 text-gray-300 rounded-bl-none">
                                <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse delay-0"></span>
                                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse delay-150"></span>
                                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse delay-300"></span>
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
            </div>

            <form onSubmit={submitMessage} className="flex items-center gap-2">
                <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            submitMessage(e);
                        }
                    }}
                    placeholder="Scrivi il tuo messaggio..."
                    rows={1}
                    className="flex-grow block w-full px-4 py-2.5 text-white bg-gray-700 border border-gray-600 rounded-full shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm resize-none"
                    disabled={isChatLoading}
                />
                <button type="submit" disabled={isChatLoading || !input.trim()} className="p-3 bg-blue-600 text-white rounded-full hover:bg-blue-500 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 focus:ring-offset-gray-800">
                    <PaperAirplaneIcon className="w-5 h-5"/>
                </button>
            </form>
        </div>
    );
};

export default AiChat;
