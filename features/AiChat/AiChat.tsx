
import React, { useState, useEffect, useRef } from 'react';
import { SparklesIcon, BookOpenIcon, TrashIcon, ArchiveBoxIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { PaperAirplaneIcon } from '@heroicons/react/24/solid';

// Stores
import { useChatStore } from '../../src/store/useChatStore';
import { useGarageStore } from '../../src/store/useGarageStore';
import { useUIStore } from '../../src/store/useUIStore';

import ChatHistoryModal from './ChatHistoryModal';
import { ConfirmationModal } from '../Garage/Garage';
import Tooltip from '../../components/Tooltip';

const AiChat: React.FC = () => {
    const { 
        chatHistory, 
        savedChats, 
        activeChatId, 
        sendMessage, 
        clearActiveChat, 
        loadChatHistory, 
        saveCurrentChat, 
        deleteSavedChat 
    } = useChatStore();
    const { activeVehicle } = useGarageStore();
    const { isChatLoading } = useUIStore();

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

    const submitMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        const messageText = input.trim();
        if (messageText && !isChatLoading) {
            setInput(''); // Clear immediately for UX, but we can restore if it fails
            const success = await sendMessage(messageText);
            if (!success) {
                setInput(messageText); // Restore input if it failed
            }
        }
    };

    const handleConfirmClear = () => {
        clearActiveChat();
        setIsClearConfirmOpen(false);
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
                title="Svuota Chat"
                message="Sei sicuro di voler svuotare la chat attuale? Se non l'hai salvata, i messaggi andranno persi."
            />
            <ChatHistoryModal 
                show={showHistoryModal} 
                onClose={() => setShowHistoryModal(false)}
                history={savedChats}
                onLoad={loadChatHistory}
                onDelete={deleteSavedChat}
            />
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h2 className="text-2xl font-bold">AI Chat</h2>
                    <p className="text-gray-400 text-sm">
                        {activeVehicle
                            ? `Assistente per ${activeVehicle.model}.`
                            : "Seleziona un veicolo nel Garage per consigli specifici."}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Tooltip text={activeChatId ? "Sovrascrivi questa chat nello storico" : "Salva questa sessione nello storico"}>
                        <button 
                            onClick={saveCurrentChat}
                            disabled={chatHistory.length === 0 || isChatLoading}
                            className={`flex items-center gap-2 text-sm font-semibold text-white px-3 py-2 rounded-md transition-colors disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed ${activeChatId ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-green-700 hover:bg-green-600'}`}
                        >
                            {activeChatId ? <ArrowPathIcon className="w-5 h-5"/> : <ArchiveBoxIcon className="w-5 h-5"/>}
                            <span className="hidden sm:inline">{activeChatId ? 'Aggiorna' : 'Salva'}</span>
                        </button>
                    </Tooltip>
                    <Tooltip text="Cronologia chat salvate">
                        <button 
                            onClick={() => setShowHistoryModal(true)} 
                            className="flex items-center gap-2 text-sm font-semibold text-gray-300 bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded-md transition-colors"
                        >
                            <BookOpenIcon className="w-5 h-5"/>
                            <span className="hidden sm:inline">Storico</span>
                        </button>
                    </Tooltip>
                    <Tooltip text="Nuova chat">
                        <button
                            onClick={() => setIsClearConfirmOpen(true)}
                            disabled={chatHistory.length === 0 || isChatLoading}
                            className="flex items-center gap-2 text-sm font-semibold text-gray-300 bg-gray-700 hover:bg-red-900/40 px-3 py-2 rounded-md transition-colors disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed"
                        >
                            <TrashIcon className="w-5 h-5" />
                            <span className="hidden sm:inline">Nuova</span>
                        </button>
                    </Tooltip>
                </div>
            </div>
            
            <div className="flex-grow bg-gray-700/50 rounded-lg p-4 overflow-y-auto mb-4 relative shadow-inner">
                {chatHistory.length === 0 && !isChatLoading && (
                    <div className="text-center text-gray-400 h-full flex flex-col justify-center items-center">
                        <SparklesIcon className="w-12 h-12 text-blue-500 mb-2 opacity-50"/>
                        <p className="font-semibold text-white">Chiedi a MotoMentor</p>
                        <p className="text-sm">Manutenzione, itinerari, o curiosità tecniche.</p>
                    </div>
                )}

                <div className="space-y-4">
                    {chatHistory.map((msg: any, index: number) => (
                        <div key={index} className={`flex items-end gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            {msg.role === 'model' && <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0"><SparklesIcon className="w-5 h-5 text-white"/></div>}
                            <div className={`max-w-[85%] p-3 rounded-2xl whitespace-pre-wrap ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-br-none shadow-md' : 'bg-gray-800 text-gray-300 rounded-bl-none border border-gray-700 shadow-sm'}`}>
                                {renderText(msg.parts.map((p: any) => p.text).join(''))}
                            </div>
                        </div>
                    ))}
                     {isChatLoading && chatHistory.length > 0 && (
                        <div className="flex items-end gap-2 justify-start">
                            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0"><SparklesIcon className="w-5 h-5 text-white"/></div>
                            <div className="max-w-md p-3 rounded-2xl bg-gray-800 text-gray-300 rounded-bl-none border border-gray-700">
                                <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce delay-0"></span>
                                    <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce delay-150"></span>
                                    <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce delay-300"></span>
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
                    placeholder="Invia un messaggio..."
                    rows={1}
                    className="flex-grow block w-full px-4 py-3 text-white bg-gray-700 border border-gray-600 rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent sm:text-sm resize-none"
                    disabled={isChatLoading}
                />
                <button type="submit" disabled={isChatLoading || !input.trim()} className="p-3 bg-blue-600 text-white rounded-full hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed transition-all transform active:scale-95 shadow-lg">
                    <PaperAirplaneIcon className="w-5 h-5"/>
                </button>
            </form>
        </div>
    );
};

export default AiChat;
