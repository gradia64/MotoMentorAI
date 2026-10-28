import React, { useEffect, useMemo, useState } from 'react';
import { KeyIcon, XMarkIcon, ArrowDownTrayIcon, MapPinIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useUIStore } from '../src/store/useUIStore';
import { useChatStore } from '../src/store/useChatStore';
import {
    getGeminiKey, setGeminiKey, getPlanningStatus, savePlanning, disablePlanning, clearPlanningKey, listPlanningModels,
} from '../src/local/client';
import type { PlanningModel, PlanningProvider, PlanningStatus } from '../src/local/types';
import { useEscapeKey } from '../src/utils/hooks';

const modelLabel = (m: PlanningModel) => {
    const prices = m.promptPerM !== null && m.completionPerM !== null
        ? ` — $${m.promptPerM.toFixed(2)} / $${m.completionPerM.toFixed(2)}`
        : '';
    return `${m.name}${prices}${m.vision ? '' : ' · niente immagini'}`;
};

const PROVIDERS: { id: PlanningProvider; label: string; keyHint: string; keyHelp: string; listNeedsKey: boolean }[] = [
    { id: 'openrouter', label: 'OpenRouter', keyHint: 'sk-or-...', keyHelp: 'openrouter.ai → “Keys”', listNeedsKey: false },
    { id: 'deepseek', label: 'DeepSeek', keyHint: 'sk-...', keyHelp: 'platform.deepseek.com → “API keys”', listNeedsKey: true },
];

// Finestra Impostazioni: chiave Gemini (funzioni IA di base, piano gratuito) e,
// facoltativo, un fornitore a pagamento (OpenRouter o DeepSeek) per la sola
// pianificazione dei viaggi. Le chiavi restano nel main process in
// ~/.config/MotoMentorAI, mai nel bundle né nel renderer (tranne quella appena digitata).
export const SettingsModal: React.FC = () => {
    const { settingsOpen, setSettingsOpen, showNotification } = useUIStore();
    const [key, setKey] = useState('');
    const [current, setCurrent] = useState('');
    const [loading, setLoading] = useState(false);

    const [planStatus, setPlanStatus] = useState<PlanningStatus | null>(null);
    const [prov, setProv] = useState<PlanningProvider>('openrouter');
    const [provKey, setProvKey] = useState('');
    const [provModel, setProvModel] = useState('');
    const [modelFilter, setModelFilter] = useState('');
    const [models, setModels] = useState<PlanningModel[]>([]);
    const [modelsError, setModelsError] = useState('');
    const [modelsLoading, setModelsLoading] = useState(false);
    const [provSaving, setProvSaving] = useState(false);

    const close = () => setSettingsOpen(false);
    useEscapeKey(close, settingsOpen);

    useEffect(() => {
        if (!settingsOpen) return;
        setKey('');
        getGeminiKey()
            .then((k) => setCurrent(k || ''))
            .catch(() => setCurrent(''));

        setProvKey('');
        setModelFilter('');
        getPlanningStatus()
            .then((st) => {
                setPlanStatus(st);
                if (st.provider) setProv(st.provider);
            })
            .catch(() => setPlanStatus(null));
    }, [settingsOpen]);

    const provInfo = PROVIDERS.find(p => p.id === prov)!;
    const provHasKey = !!planStatus?.keys?.[prov];

    const loadModels = (key?: string) => {
        setModelsError('');
        setModelsLoading(true);
        listPlanningModels(prov, key)
            .then(setModels)
            .catch((e) => { setModels([]); setModelsError(e?.message || 'Elenco modelli non disponibile.'); })
            .finally(() => setModelsLoading(false));
    };

    // Cambiando fornitore: modello attivo (se è lo stesso) ed elenco dei suoi
    // modelli. DeepSeek elenca i modelli solo con una chiave.
    useEffect(() => {
        if (!settingsOpen || !planStatus) return;
        setProvModel(planStatus.provider === prov ? planStatus.model || '' : '');
        setModels([]);
        setModelsError('');
        if (!provInfo.listNeedsKey || provHasKey) loadModels();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [settingsOpen, prov, planStatus]);

    const visibleModels = useMemo(() => {
        const q = modelFilter.trim().toLowerCase();
        const list = q ? models.filter(m => m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q)) : models;
        // Il modello già scelto resta selezionabile anche se il filtro lo esclude
        // o se il fornitore non lo elenca più.
        if (provModel && !list.some(m => m.id === provModel)) {
            const chosen = models.find(m => m.id === provModel)
                ?? { id: provModel, name: planStatus?.modelName || provModel, vision: !!planStatus?.vision, promptPerM: null, completionPerM: null };
            return [chosen, ...list];
        }
        return list;
    }, [models, modelFilter, provModel, planStatus]);

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
            // La sessione chat aperta ha la vecchia chiave: al prossimo messaggio
            // viene ricreata dallo storico con quella nuova.
            useChatStore.setState({ chatSession: null });
            setCurrent(trimmed);
            setKey('');
            showNotification('Chiave API Gemini salvata sul dispositivo.');
        } catch (e: any) {
            showNotification(e?.message || 'Errore durante il salvataggio della chiave.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const refreshStatus = async () => setPlanStatus(await getPlanningStatus());

    const handleSavePlanning = async () => {
        if (!provHasKey && !provKey.trim()) {
            showNotification(`Inserisci la chiave ${provInfo.label}.`, 'warning');
            return;
        }
        const model = visibleModels.find(m => m.id === provModel);
        if (!model) {
            showNotification('Scegli il modello per la pianificazione dei viaggi.', 'warning');
            return;
        }
        setProvSaving(true);
        try {
            await savePlanning(prov, provKey.trim(), model);
            await refreshStatus();
            setProvKey('');
            showNotification(`I viaggi verranno pianificati con ${model.name} (${provInfo.label}).`);
        } catch (e: any) {
            showNotification(e?.message || 'Errore durante il salvataggio.', 'error');
        } finally {
            setProvSaving(false);
        }
    };

    const handleDisablePlanning = async () => {
        setProvSaving(true);
        try {
            await disablePlanning();
            await refreshStatus();
            showNotification('Pianificazione a pagamento disattivata: i viaggi useranno Gemini.');
        } catch (e: any) {
            showNotification(e?.message || 'Errore durante la disattivazione.', 'error');
        } finally {
            setProvSaving(false);
        }
    };

    const handleClearKey = async () => {
        if (!window.confirm(`Eliminare da questo computer la chiave ${provInfo.label}?`)) return;
        setProvSaving(true);
        try {
            await clearPlanningKey(prov);
            await refreshStatus();
            setModels(provInfo.listNeedsKey ? [] : models);
            showNotification(`Chiave ${provInfo.label} eliminata.`);
        } catch (e: any) {
            showNotification(e?.message || "Errore durante l'eliminazione della chiave.", 'error');
        } finally {
            setProvSaving(false);
        }
    };

    const masked = current ? `••••••••••••${current.slice(-4)}` : '';
    const activeProvider = PROVIDERS.find(p => p.id === planStatus?.provider);

    return (
        <div className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={close}>
            <div
                className="bg-gray-800 w-full max-w-lg max-h-[90vh] rounded-2xl shadow-2xl border border-gray-700 overflow-hidden flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 bg-gray-900/50">
                    <div className="flex items-center gap-2">
                        <KeyIcon className="w-5 h-5 text-blue-400" />
                        <h3 className="text-lg font-bold text-white">Impostazioni</h3>
                    </div>
                    <button
                        onClick={close}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all"
                        title="Chiudi"
                    >
                        <XMarkIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-5 overflow-y-auto">
                    <div>
                        <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wide">
                            Chiave API Google Gemini
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="password"
                                value={key}
                                onChange={(e) => setKey(e.target.value)}
                                placeholder={masked || 'AIza...'}
                                className="flex-1 min-w-0 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2.5 text-sm text-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                autoComplete="off"
                            />
                            <button
                                onClick={handleSave}
                                disabled={loading}
                                className="px-4 py-2 rounded-lg text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 transition-all flex items-center gap-2"
                            >
                                {loading ? (
                                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <ArrowDownTrayIcon className="w-4 h-4" />
                                )}
                                {loading ? 'Salvataggio...' : 'Salva chiave'}
                            </button>
                        </div>
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

                    {/* Fornitore a pagamento: solo pianificazione viaggi */}
                    <div className="pt-5 border-t border-gray-700 space-y-3">
                        <div className="flex items-center gap-2">
                            <MapPinIcon className="w-4 h-4 text-purple-400" />
                            <h4 className="text-sm font-bold text-white">Pianificazione viaggi con un modello a pagamento <span className="font-normal text-gray-400">(facoltativo)</span></h4>
                        </div>
                        <p className="text-[11px] text-gray-400 leading-relaxed">
                            Usa un modello di OpenRouter (Claude, GPT, Gemini Pro…) o di DeepSeek <strong className="text-gray-300">solo per “Crea Itinerario”</strong>.
                            Chat, diagnosi e le altre funzioni restano su Gemini gratuito. Se il fornitore non risponde, o se alleghi screenshot a un modello
                            che non legge le immagini, il viaggio viene pianificato con Gemini.
                        </p>
                        <div className="flex items-center justify-between gap-2">
                            <p className={`text-[11px] ${planStatus?.provider ? 'text-green-400' : 'text-gray-500'}`}>
                                {planStatus?.provider
                                    ? `Attivo: ${planStatus.modelName || planStatus.model} (${activeProvider?.label}).`
                                    : 'Non attivo: i viaggi usano Gemini.'}
                            </p>
                            {planStatus?.provider && (
                                <button
                                    onClick={handleDisablePlanning}
                                    disabled={provSaving}
                                    className="text-[11px] text-gray-400 hover:text-white underline disabled:opacity-50"
                                >
                                    Torna a Gemini
                                </button>
                            )}
                        </div>

                        <div className="flex gap-1 bg-gray-900/60 rounded-lg p-1" role="tablist" aria-label="Fornitore">
                            {PROVIDERS.map(p => (
                                <button
                                    key={p.id}
                                    role="tab"
                                    aria-selected={prov === p.id}
                                    onClick={() => { setProv(p.id); setProvKey(''); setModelFilter(''); }}
                                    className={`flex-1 px-3 py-1.5 rounded-md text-sm font-semibold transition-colors ${
                                        prov === p.id ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'
                                    }`}
                                >
                                    {p.label}{planStatus?.keys?.[p.id] ? ' ✓' : ''}
                                </button>
                            ))}
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wide">Chiave API {provInfo.label}</label>
                            <div className="flex gap-2">
                                <input
                                    type="password"
                                    value={provKey}
                                    onChange={(e) => setProvKey(e.target.value)}
                                    placeholder={provHasKey ? 'Chiave salvata (lascia vuoto per non cambiarla)' : provInfo.keyHint}
                                    className="flex-1 min-w-0 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2.5 text-sm text-white font-mono focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                    autoComplete="off"
                                />
                                {provInfo.listNeedsKey && (
                                    <button
                                        onClick={() => loadModels(provKey.trim() || undefined)}
                                        disabled={modelsLoading || (!provKey.trim() && !provHasKey)}
                                        className="px-3 py-2 rounded-lg text-sm font-medium text-gray-200 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 transition-all"
                                    >
                                        Carica modelli
                                    </button>
                                )}
                            </div>
                            <p className="mt-1.5 text-[11px] text-gray-500">La chiave si crea su {provInfo.keyHelp}.</p>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wide">Modello per la pianificazione</label>
                            {models.length > 10 && (
                                <input
                                    type="search"
                                    value={modelFilter}
                                    onChange={(e) => setModelFilter(e.target.value)}
                                    placeholder="Cerca (es. claude, gpt, gemini pro)…"
                                    className="w-full mb-2 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                />
                            )}
                            {modelsLoading ? (
                                <p className="text-[11px] text-gray-500">Caricamento dei modelli da {provInfo.label}…</p>
                            ) : modelsError ? (
                                <p className="text-[11px] text-red-400">{modelsError}</p>
                            ) : visibleModels.length === 0 ? (
                                <p className="text-[11px] text-gray-500">
                                    {provInfo.listNeedsKey ? 'Inserisci la chiave e premi “Carica modelli”.' : 'Nessun modello trovato.'}
                                </p>
                            ) : (
                                <select
                                    value={provModel}
                                    onChange={(e) => setProvModel(e.target.value)}
                                    size={Math.min(6, Math.max(2, visibleModels.length))}
                                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-2 py-1 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                >
                                    {visibleModels.map(m => (
                                        <option key={m.id} value={m.id}>{modelLabel(m)}</option>
                                    ))}
                                </select>
                            )}
                            <p className="mt-1.5 text-[11px] text-gray-500">
                                {prov === 'openrouter'
                                    ? 'Prezzi in dollari per milione di token (ingresso / uscita). Sono elencati i modelli che restituiscono JSON strutturato.'
                                    : 'I prezzi di DeepSeek sono su api-docs.deepseek.com.'}
                                {' '}I modelli segnati “niente immagini” non leggono gli screenshot di Maps.
                            </p>
                        </div>

                        <div className="flex justify-end gap-2">
                            {provHasKey && (
                                <button
                                    onClick={handleClearKey}
                                    disabled={provSaving}
                                    className="px-4 py-2 rounded-lg text-sm font-medium text-gray-300 hover:text-white bg-gray-700 hover:bg-gray-600 disabled:opacity-50 transition-all flex items-center gap-2"
                                >
                                    <TrashIcon className="w-4 h-4" /> Elimina chiave
                                </button>
                            )}
                            <button
                                onClick={handleSavePlanning}
                                disabled={provSaving}
                                className="px-4 py-2 rounded-lg text-sm font-bold text-white bg-purple-600 hover:bg-purple-500 disabled:opacity-50 transition-all flex items-center gap-2"
                            >
                                <ArrowDownTrayIcon className="w-4 h-4" />
                                {provSaving ? 'Salvataggio...' : 'Usa per i viaggi'}
                            </button>
                        </div>

                        <p className="text-[11px] text-gray-500">
                            Le chiavi restano solo su questo computer (<code className="text-blue-300">~/.config/MotoMentorAI/</code>) e le richieste
                            partono dal processo principale dell'app. Ogni viaggio consuma credito del fornitore: il costo compare al termine (esatto con OpenRouter, stimato dal listino con DeepSeek).
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-gray-900/50 border-t border-gray-700 flex justify-end">
                    <button
                        onClick={close}
                        className="px-4 py-2 rounded-lg text-sm font-medium text-gray-300 hover:text-white bg-gray-700 hover:bg-gray-600 transition-all"
                    >
                        Chiudi
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;
