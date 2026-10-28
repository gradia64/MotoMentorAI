
import React, { Suspense, lazy, useEffect } from 'react';
import { MapPinIcon, WrenchScrewdriverIcon, CogIcon, ChatBubbleLeftRightIcon, ExclamationTriangleIcon, BookOpenIcon, ArrowRightOnRectangleIcon, HomeIcon, KeyIcon } from '@heroicons/react/24/outline';

import { AiMode, SharedTrip } from './types';
import TabButton from './components/TabButton';
import Notification from './components/Notification';
import Logo from './components/Logo';
import Login from './components/Login';
import SettingsModal from './components/SettingsModal';
import { motion } from 'motion/react';

// Stores
import { useUIStore } from './src/store/useUIStore';
import { useAuthStore } from './src/store/useAuthStore';
import { useGarageStore } from './src/store/useGarageStore';
import { useTripStore } from './src/store/useTripStore';
import { useMechanicStore } from './src/store/useMechanicStore';
import { useChatStore } from './src/store/useChatStore';
import { onOpenSharedTrip, signalRendererReady } from './src/local/client';
import { normalizeItinerary } from './src/utils/itinerary';

// --- Lazy Loading of Feature Components ---
const TripPlanner = lazy(() => import('./features/TripPlanner/TripPlanner'));
const VirtualMechanic = lazy(() => import('./features/VirtualMechanic/VirtualMechanic'));
const Garage = lazy(() => import('./features/Garage/Garage'));
const AiChat = lazy(() => import('./features/AiChat/AiChat'));
const TripDiary = lazy(() => import('./features/TripDiary/TripDiary'));
const Dashboard = lazy(() => import('./features/Dashboard/Dashboard'));
const SharedTripView = lazy(() => import('./features/TripPlanner/SharedTripView'));

// --- Loading Component for Suspense ---
const SectionLoader: React.FC = () => (
    <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-gray-400 font-medium">Caricamento sezione...</p>
    </div>
);

const AppContent: React.FC = () => {
    const { mode, setMode, error, setSettingsOpen } = useUIStore();
    const { user, isAuthenticated, isCheckingAuth, bootstrap, logout } = useAuthStore();
    const { activeVehicle, deadlineAlerts, initGarage } = useGarageStore();
    const { initTrips } = useTripStore();
    const { initMechanic } = useMechanicStore();
    const { initChats } = useChatStore();
    
    const [sharedTripId, setSharedTripId] = React.useState<string | null>(null);
    // Viaggio condiviso aperto da FILE (.mmt.json): il main process invia
    // l'oggetto via IPC 'shared-trip:open' (menu File o doppio click sul file).
    const [sharedTripObject, setSharedTripObject] = React.useState<SharedTrip | null>(null);

    useEffect(() => {
        // Gli errori di rendering li gestisce l'ErrorBoundary (index.tsx); qui
        // arrivano quelli fuori dal rendering (es. un handler di click), che
        // non devono sostituire l'intera interfaccia.
        const handleError = (event: ErrorEvent) => {
            console.error('Uncaught error:', event.error ?? event.message);
            useUIStore.getState().showNotification(
                `Errore interno: ${event.message || 'operazione non riuscita'}`,
                'error'
            );
        };
        const handleRejection = (event: PromiseRejectionEvent) => {
            // Una rejection async non gestita non deve bloccare l'intera app:
            // si notifica e si continua.
            console.error('Unhandled promise rejection:', event.reason);
            useUIStore.getState().showNotification(
                `Errore interno: ${event.reason?.message || event.reason || 'operazione non riuscita'}`,
                'error'
            );
        };

        window.addEventListener('error', handleError);
        window.addEventListener('unhandledrejection', handleRejection);

        // Routing legacy per viaggi condivisi via URL (compatibilita' web/dev).
        const path = window.location.pathname;
        if (path.startsWith('/shared/')) {
            const id = path.split('/shared/')[1];
            if (id) setSharedTripId(id);
        }

        // Inizializza il DB locale e carica la sessione dell'utente.
        void bootstrap();

        // Apertura viaggio condiviso da file (dialog del main o file associato).
        let unsubOpenSharedTrip: (() => void) | undefined;
        try {
            unsubOpenSharedTrip = onOpenSharedTrip((trip) => {
                // Il file arriva dall'esterno: si normalizza prima di mostrarlo.
                const itinerary = normalizeItinerary(trip?.itinerary);
                if (!itinerary) {
                    useUIStore.getState().showNotification('Il file non contiene un viaggio MotoMentor valido.', 'error');
                    return;
                }
                setSharedTripObject({
                    ...trip,
                    tripTitle: String(trip.tripTitle || itinerary.tripTitle),
                    ownerName: String(trip.ownerName || 'Sconosciuto'),
                    itinerary,
                });
                setSharedTripId(null);
            });
            // Ora che i listener sono attivi, il main può consegnare eventuali
            // viaggio condiviso aperto prima del caricamento del renderer.
            signalRendererReady();
        } catch (e) {
            // Solo in contesto web (nessun bridge Electron): nessuna azione.
        }

        return () => {
            window.removeEventListener('error', handleError);
            window.removeEventListener('unhandledrejection', handleRejection);
            if (unsubOpenSharedTrip) unsubOpenSharedTrip();
        };
    }, [bootstrap]);

    // Initialize/Cleanup shop listeners based on user session
    useEffect(() => {
        if (user && isAuthenticated) {
            const unsubGarage = initGarage(user.id);
            const unsubTrips = initTrips(user.id);
            const unsubMechanic = initMechanic(user.id);
            const unsubChats = initChats(user.id);
            
            return () => {
                unsubGarage();
                unsubTrips();
                unsubMechanic();
                unsubChats();
                // Cambio utente o logout: i dati del profilo precedente non
                // devono restare in memoria per il prossimo utente.
                useGarageStore.getState().reset();
                useTripStore.getState().reset();
                useMechanicStore.getState().reset();
                useChatStore.getState().reset();
            };
        }
    }, [user, isAuthenticated, initGarage, initTrips, initMechanic, initChats]);

    if (sharedTripObject) {
        return (
            <div className="bg-slate-900 min-h-screen text-white">
                <Suspense fallback={<SectionLoader />}>
                    <SharedTripView trip={sharedTripObject} onBack={() => setSharedTripObject(null)} />
                </Suspense>
            </div>
        );
    }

    if (sharedTripId) {
        return (
            <div className="bg-slate-900 min-h-screen text-white">
                <Suspense fallback={<SectionLoader />}>
                    <SharedTripView id={sharedTripId} onBack={() => {
                        setSharedTripId(null);
                        window.history.pushState({}, '', '/');
                    }} />
                </Suspense>
            </div>
        );
    }

    if (isCheckingAuth) {
        return (
            <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
                <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="space-y-8"
                >
                    <div className="relative">
                        <div className="w-20 h-20 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mx-auto"></div>
                        <Logo className="w-10 h-10 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                    </div>
                    
                    <div className="space-y-2">
                        <h1 className="text-3xl font-bold text-white">MotoMentor AI</h1>
                        <p className="text-blue-400/60 font-medium animate-pulse tracking-wide uppercase text-xs">Inizializzazione sistema...</p>
                    </div>

                    <div className="flex flex-col gap-3 max-w-xs mx-auto">
                        <button 
                            onClick={() => window.location.reload()}
                            className="bg-white/5 hover:bg-white/10 text-white/70 px-6 py-2.5 rounded-xl text-sm font-medium transition-all"
                        >
                            Ricarica Pagina
                        </button>
                    </div>
                </motion.div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Login />;
    }

    return (
        <div className="bg-slate-900 text-white min-h-screen font-sans pb-20 md:pb-0">
            <header className="bg-gray-800/80 backdrop-blur-md shadow-lg sticky top-0 z-40 border-b border-gray-700/50">
                <div className="container mx-auto px-4 py-3 flex justify-between items-center">
                    <button 
                        onClick={() => setMode(AiMode.Dashboard)}
                        className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                    >
                        <Logo className="w-8 h-8 md:w-10 md:h-10" />
                        <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white hidden sm:block">MotoMentor AI</h1>
                    </button>

                    <div className="flex items-center gap-2 md:gap-5">
                        {activeVehicle && (
                            <div 
                                className="flex items-center gap-2 bg-gray-900/50 border border-gray-700 px-3 py-1.5 rounded-full cursor-pointer hover:bg-gray-700 transition-all"
                                onClick={() => setMode(AiMode.Garage)}
                            >
                                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                                <span className="text-[10px] md:text-xs font-bold truncate max-w-[80px] md:max-w-[150px]">
                                    {activeVehicle.model}
                                </span>
                            </div>
                        )}
                        
                        <div className="flex items-center gap-3 border-l border-gray-700 pl-3 md:pl-5">
                            <div className="text-right hidden md:block">
                                <p className="text-[10px] text-gray-500 uppercase font-bold">Utente</p>
                                <p className="text-xs font-medium text-white">{user?.username}</p>
                            </div>
                            <button 
                                onClick={() => setSettingsOpen(true)}
                                className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-full"
                                title="Impostazioni (chiave API Gemini)"
                            >
                                <KeyIcon className="w-5 h-5 md:w-6 md:h-6" />
                            </button>
                            <button 
                                onClick={logout}
                                className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-full"
                                title="Esci"
                            >
                                <ArrowRightOnRectangleIcon className="w-5 h-5 md:w-6 md:h-6" />
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <main className="container mx-auto p-4 md:p-8">
                {deadlineAlerts.length > 0 && mode !== AiMode.Dashboard && (
                    <div 
                        className="mb-6 bg-red-900/30 border border-red-500/50 p-3 rounded-xl flex items-center justify-between animate-fade-in cursor-pointer hover:bg-red-900/40 transition-colors"
                        onClick={() => setMode(AiMode.Dashboard)}
                    >
                        <div className="flex items-center gap-3">
                            <ExclamationTriangleIcon className="w-5 h-5 text-red-500" />
                            <p className="text-sm font-medium">Hai {deadlineAlerts.length} scadenze amministrative da verificare.</p>
                        </div>
                        <span className="text-[10px] bg-red-500 text-white font-bold px-2 py-0.5 rounded uppercase">Controlla</span>
                    </div>
                )}

                <div className="bg-gray-800/80 rounded-2xl shadow-2xl overflow-hidden border border-gray-700/50 min-h-[60vh]">
                    <div className="hidden md:flex bg-gray-900/50 border-b border-gray-700 px-2">
                        <TabButton text="Home" icon={<HomeIcon className="w-5 h-5"/>} active={mode === AiMode.Dashboard} onClick={() => setMode(AiMode.Dashboard)} />
                        <TabButton text="Planner" icon={<MapPinIcon className="w-5 h-5"/>} active={mode === AiMode.TripPlanner} onClick={() => setMode(AiMode.TripPlanner)} />
                        <TabButton text="Diario" icon={<BookOpenIcon className="w-5 h-5"/>} active={mode === AiMode.TripDiary} onClick={() => setMode(AiMode.TripDiary)} />
                        <TabButton text="Meccanico" icon={<WrenchScrewdriverIcon className="w-5 h-5"/>} active={mode === AiMode.VirtualMechanic} onClick={() => setMode(AiMode.VirtualMechanic)} />
                        <TabButton text="Garage" icon={<CogIcon className="w-5 h-5"/>} active={mode === AiMode.Garage} onClick={() => setMode(AiMode.Garage)} />
                        <TabButton text="Chat IA" icon={<ChatBubbleLeftRightIcon className="w-5 h-5"/>} active={mode === AiMode.AiChat} onClick={() => setMode(AiMode.AiChat)} />
                    </div>

                    <div className="p-4 md:p-8">
                        {error && (
                            <div 
                                className="bg-red-500/20 text-red-300 p-4 border-l-4 border-red-500 rounded-md mb-6 animate-fade-in flex items-center gap-3" 
                                role="alert"
                            >
                                <ExclamationTriangleIcon className="w-5 h-5" />
                                <span className="text-sm font-medium">{error}</span>
                            </div>
                        )}

                        <Suspense fallback={<SectionLoader />}>
                            {mode === AiMode.Dashboard && <Dashboard />}
                            {mode === AiMode.TripPlanner && <TripPlanner />}
                            {mode === AiMode.TripDiary && <TripDiary />}
                            {mode === AiMode.VirtualMechanic && <VirtualMechanic />}
                            {mode === AiMode.Garage && <Garage />}
                            {mode === AiMode.AiChat && <AiChat />}
                        </Suspense>
                    </div>
                </div>
            </main>

            <nav className="md:hidden fixed bottom-6 left-6 right-6 z-50 bg-gray-800/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl px-2 py-2 flex items-center justify-around">
                <NavIcon active={mode === AiMode.Dashboard} onClick={() => setMode(AiMode.Dashboard)} icon={<HomeIcon className="w-6 h-6" />} label="Home" />
                <NavIcon active={mode === AiMode.TripPlanner} onClick={() => setMode(AiMode.TripPlanner)} icon={<MapPinIcon className="w-6 h-6" />} label="Viaggi" />
                <NavIcon active={mode === AiMode.VirtualMechanic} onClick={() => setMode(AiMode.VirtualMechanic)} icon={<WrenchScrewdriverIcon className="w-6 h-6" />} label="Mecc" />
                <NavIcon active={mode === AiMode.Garage} onClick={() => setMode(AiMode.Garage)} icon={<CogIcon className="w-6 h-6" />} label="Garage" />
                <NavIcon active={mode === AiMode.AiChat} onClick={() => setMode(AiMode.AiChat)} icon={<ChatBubbleLeftRightIcon className="w-6 h-6" />} label="Chat" />
            </nav>

            <footer className="text-center py-10 px-4 text-sm text-gray-500">
                <p>&copy; {new Date().getFullYear()} MotoMentor AI. Rilasciato sotto licenza GPL-3.0 (vedi <a href="https://www.gnu.org/licenses/gpl-3.0.html" className="underline hover:text-gray-300" target="_blank" rel="noreferrer">LICENSE</a>).</p>
                <div className="mt-4 max-w-4xl mx-auto text-xs text-gray-600 flex items-start justify-center gap-2">
                    <ExclamationTriangleIcon className="w-4 h-4 flex-shrink-0 mt-0.5 text-yellow-600" />
                    <p className="text-left">
                        <strong>Avvertenza:</strong> MotoMentor è uno strumento basato sull'Intelligenza Artificiale e le informazioni fornite possono contenere errori o imprecisioni. I suggerimenti su itinerari, manutenzione e diagnosi sono generati automaticamente e devono essere considerati come un punto di partenza, non come un sostituto del giudizio professionale o della consultazione di un meccanico qualificato. L'autore non si assume alcuna responsabilità per danni diretti o indiretti, incidenti, o qualsiasi altra conseguenza derivante dall'uso delle informazioni fornite da questa applicazione. Utilizzare sempre il proprio giudizio e verificare le informazioni critiche.
                    </p>
                </div>
            </footer>
        </div>
    );
};

const NavIcon: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({ active, onClick, icon, label }) => (
    <button 
        onClick={onClick}
        className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all ${
            active ? 'bg-blue-600 text-white shadow-lg scale-110' : 'text-gray-400 hover:text-white'
        }`}
    >
        {icon}
        <span className="text-[9px] mt-1 font-bold uppercase tracking-tighter">{label}</span>
    </button>
);

const App: React.FC = () => {
    return (
        <>
            <AppContent />
            <SettingsModal />
            {/* Fuori da AppContent: le notifiche servono anche su Login,
                viaggio condiviso e Impostazioni, non solo nel layout principale. */}
            <Notification />
        </>
    );
};

export default App;
