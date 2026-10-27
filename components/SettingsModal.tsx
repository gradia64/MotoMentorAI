import React, { useEffect, useState } from 'react';
import { KeyIcon, XMarkIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { useUIStore } from '../src/store/useUIStore';
import { getGeminiKey, setGeminiKey } from '../src/local/client';

// Finestra Impostazioni: gestisce la chiave API Gemini come secret LOCALE
// (salvata dal main process in ~/.config/MotoMentorAI/gemini.key, mai nel bundle).
export const SettingsModal: React.FC = () => {
    const { settingsOpen, setSettingsOpen, showNotification } = useUIStore();
    const [key, setKey] = useState('');
    const [current, setCurrent] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (settingsOpen) {
            setKey('');
            getGeminiKey()
                .then((k) => setCurrent(k || ''))
                .catch(() => setCurrent(''));
        }
    }, [settingsOpen]);

    if (!settingsOpen) return null;

    const handleSave = async () => {
        const trimmed = key.trim();
        if (!trimmed) {
            showNotification('Inserisci una chiave API valida.', 'warning');
            return;
        }
        setLoading(true);
        try {
            await setGeminiKey(trimmed);
            // Aggiorna anche il runtime corrente, senza riavviare l'app.
            window.GEMINI_API_KEY = trimmed;
            showNotification('Chiave API Gemini salvata sul dispositivo.');
            setSettingsOpen(false);
        } catch (e: any) {
            showNotification(e?.message || 'Errore durante il salvataggio della chiave.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const masked = current ? `••••••••••••${current.slice(-4)}` : '';

    return (
        <div className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-gray-800 w-full max-w-md rounded-2xl shadow-2xl border border-gray-700 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 bg-gray-900/50">
                    <div className="flex items-center gap-2">
                        <KeyIcon className="w-5 h-5 text-blue-400" />
                        <h3 className="text-lg font-bold text-white">Impostazioni</h3>
                    </div>
                    <button
                        onClick={() => setSettingsOpen(false)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all"
                        title="Chiudi"
                    >
                        <XMarkIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-5">
                    <div>
                        <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wide">
                            Chiave API Google Gemini
                        </label>
                        <input
                            type="password"
                            value={key}
                            onChange={(e) => setKey(e.target.value)}
                            placeholder={masked || 'AIza...'}
                            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2.5 text-sm text-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            autoComplete="off"
                        />
                        {masked && (
                            <p className="mt-2 text-[11px] text-green-400 flex items-center gap-1">
                                <ArrowDownTrayIcon className="w-3 h-3" />
                                Chiave attualmente configurata: {masked}
                            </p>
                        )}
                    </div>

                    <div className="bg-gray-900/60 border border-gray-700 rounded-xl p-4 text-[11px] text-gray-400 space-y-2">
                        <p>
                            La chiave serve alle funzioni IA (itinerari, diagnosi meccanico, chat, scansione scontrini) e resta
                            <strong className="text-gray-300"> solo sul tuo dispositivo</strong>, salvata con permessi restrittivi in
                            <code className="text-blue-300"> ~/.config/MotoMentorAI/gemini.key</code>. Non viene mai incorporata nell'app né inviata ad altri server.
                        </p>
                        <p>
                            Puoi ottenere una chiave gratuita da <strong className="text-gray-300">Google AI Studio</strong> (aistudio.google.com → “Get API key”).
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-gray-900/50 border-t border-gray-700 flex justify-end gap-3">
                    <button
                        onClick={() => setSettingsOpen(false)}
                        className="px-4 py-2 rounded-lg text-sm font-medium text-gray-300 hover:text-white bg-gray-700 hover:bg-gray-600 transition-all"
                    >
                        Annulla
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className="px-5 py-2 rounded-lg text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 transition-all flex items-center gap-2"
                    >
                        {loading ? (
                            <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        ) : (
                            <ArrowDownTrayIcon className="w-4 h-4" />
                        )}
                        {loading ? 'Salvataggio...' : 'Salva chiave'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;
