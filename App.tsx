
import React, { Suspense, lazy, useEffect } from 'react';
import { MapPinIcon, WrenchScrewdriverIcon, CogIcon, ChatBubbleLeftRightIcon, ExclamationTriangleIcon, ClockIcon, BookOpenIcon, ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline';

import { AiMode } from './types';
import { AppProvider, useAppContext } from './state/AppContext';
import TabButton from './components/TabButton';
import Notification from './components/Notification';
import Logo from './components/Logo';
import Login from './components/Login';
import { motion } from 'motion/react';

// --- Lazy Loading of Feature Components ---
// This enables Code Splitting: each feature is bundled separately and 
// only downloaded when the user switches to that specific tab.
const TripPlanner = lazy(() => import('./features/TripPlanner/TripPlanner'));
const VirtualMechanic = lazy(() => import('./features/VirtualMechanic/VirtualMechanic'));
const Garage = lazy(() => import('./features/Garage/Garage'));
const AiChat = lazy(() => import('./features/AiChat/AiChat'));
const TripDiary = lazy(() => import('./features/TripDiary/TripDiary'));
const Dashboard = lazy(() => import('./features/Dashboard/Dashboard'));

// Declare jspdf from window for global access
declare global {
    interface Window {
        jspdf: any;
    }
}

// --- Loading Component for Suspense ---
const SectionLoader: React.FC = () => (
    <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-gray-400 font-medium">Caricamento sezione...</p>
    </div>
);

const AppContent: React.FC = () => {
    const { state, dispatch, checkAuth, logout } = useAppContext();
    const [fatalError, setFatalError] = React.useState<string | null>(null);

    useEffect(() => {
        const handleError = (event: ErrorEvent) => {
            setFatalError(`Runtime Error: ${event.message}`);
        };
        const handleRejection = (event: PromiseRejectionEvent) => {
            setFatalError(`Promise Error: ${event.reason?.message || event.reason}`);
        };

        window.addEventListener('error', handleError);
        window.addEventListener('unhandledrejection', handleRejection);

        checkAuth();

        // Safety redundancy: ensure we don't stay in loading forever
        const backupTimer = setTimeout(() => {
            if (state.isCheckingAuth) {
                console.warn("AppContent: forcing isCheckingAuth to false as backup");
                dispatch({ type: 'SET_CHECKING_AUTH', payload: false });
            }
        }, 12000);

        return () => {
            window.removeEventListener('error', handleError);
            window.removeEventListener('unhandledrejection', handleRejection);
            clearTimeout(backupTimer);
        };
    }, []);

    const setMode = (mode: AiMode) => dispatch({ type: 'SET_MODE', payload: mode });

    if (fatalError) {
        return (
            <div className="min-h-screen bg-red-900 flex items-center justify-center text-white p-8">
                <div className="max-w-md w-full bg-black/40 p-6 rounded-xl border border-red-500 shadow-2xl">
                    <h1 className="text-2xl font-bold mb-4 text-red-400">Si è verificato un errore fatale</h1>
                    <p className="mb-6 text-sm opacity-90">{fatalError}</p>
                    <button 
                        onClick={() => window.location.reload()}
                        className="w-full bg-red-600 hover:bg-red-500 py-3 rounded-lg font-bold transition-colors"
                    >
                        Ricarica applicazione
                    </button>
                    <button 
                        onClick={() => setFatalError(null)}
                        className="w-full mt-2 text-xs opacity-50 underline"
                    >
                        Ignora e prosegui (Sperimentale)
                    </button>
                </div>
            </div>
        );
    }

    if (state.isCheckingAuth) {
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
                        <button 
                            onClick={() => dispatch({ type: 'SET_CHECKING_AUTH', payload: false })}
                            className="text-[10px] text-white/20 hover:text-white/40 underline uppercase tracking-widest"
                        >
                            Forza avvio sessione
                        </button>
                    </div>
                </motion.div>
            </div>
        );
    }

    if (!state.isAuthenticated) {
        return <Login />;
    }
    return (
        <div className="bg-slate-900 text-white min-h-screen font-sans pb-20 md:pb-0">
            <Notification />
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
                        {state.activeVehicle && (
                            <div 
                                className="flex items-center gap-2 bg-gray-900/50 border border-gray-700 px-3 py-1.5 rounded-full cursor-pointer hover:bg-gray-700 transition-all"
                                onClick={() => setMode(AiMode.Garage)}
                            >
                                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                                <span className="text-[10px] md:text-xs font-bold truncate max-w-[80px] md:max-w-[150px]">
                                    {state.activeVehicle.model}
                                </span>
                            </div>
                        )}
                        
                        <div className="flex items-center gap-3 border-l border-gray-700 pl-3 md:pl-5">
                            <div className="text-right hidden md:block">
                                <p className="text-[10px] text-gray-500 uppercase font-bold">Utente</p>
                                <p className="text-xs font-medium text-white">{state.user?.username}</p>
                            </div>
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
                {/* Global Alert Indicator (Simple badge if there are alerts and not on Dashboard) */}
                {state.deadlineAlerts.length > 0 && state.mode !== AiMode.Dashboard && (
                    <div 
                        className="mb-6 bg-red-900/30 border border-red-500/50 p-3 rounded-xl flex items-center justify-between animate-fade-in cursor-pointer hover:bg-red-900/40 transition-colors"
                        onClick={() => setMode(AiMode.Dashboard)}
                    >
                        <div className="flex items-center gap-3">
                            <ExclamationTriangleIcon className="w-5 h-5 text-red-500" />
                            <p className="text-sm font-medium">Hai {state.deadlineAlerts.length} scadenze amministrative da verificare.</p>
                        </div>
                        <span className="text-[10px] bg-red-500 text-white font-bold px-2 py-0.5 rounded uppercase">Controlla</span>
                    </div>
                )}

                <div className="bg-gray-800/80 rounded-2xl shadow-2xl overflow-hidden border border-gray-700/50 min-h-[60vh]">
                    {/* Desktop Navigation Tabs */}
                    <div className="hidden md:flex bg-gray-900/50 border-b border-gray-700 px-2">
                        <TabButton text="Home" icon={<CogIcon className="w-5 h-5"/>} active={state.mode === AiMode.Dashboard} onClick={() => setMode(AiMode.Dashboard)} />
                        <TabButton text="Planner" icon={<MapPinIcon className="w-5 h-5"/>} active={state.mode === AiMode.TripPlanner} onClick={() => setMode(AiMode.TripPlanner)} />
                        <TabButton text="Diario" icon={<BookOpenIcon className="w-5 h-5"/>} active={state.mode === AiMode.TripDiary} onClick={() => setMode(AiMode.TripDiary)} />
                        <TabButton text="Meccanico" icon={<WrenchScrewdriverIcon className="w-5 h-5"/>} active={state.mode === AiMode.VirtualMechanic} onClick={() => setMode(AiMode.VirtualMechanic)} />
                        <TabButton text="Garage" icon={<CogIcon className="w-5 h-5"/>} active={state.mode === AiMode.Garage} onClick={() => setMode(AiMode.Garage)} />
                        <TabButton text="Chat IA" icon={<ChatBubbleLeftRightIcon className="w-5 h-5"/>} active={state.mode === AiMode.AiChat} onClick={() => setMode(AiMode.AiChat)} />
                    </div>

                    <div className="p-4 md:p-8">
                        {state.error && (
                            <div 
                                className="bg-red-500/20 text-red-300 p-4 border-l-4 border-red-500 rounded-md mb-6 animate-fade-in flex items-center gap-3" 
                                role="alert"
                            >
                                <ExclamationTriangleIcon className="w-5 h-5" />
                                <span className="text-sm font-medium">{state.error}</span>
                            </div>
                        )}

                        <Suspense fallback={<SectionLoader />}>
                            {state.mode === AiMode.Dashboard && <Dashboard />}
                            {state.mode === AiMode.TripPlanner && <TripPlanner />}
                            {state.mode === AiMode.TripDiary && <TripDiary />}
                            {state.mode === AiMode.VirtualMechanic && <VirtualMechanic />}
                            {state.mode === AiMode.Garage && <Garage />}
                            {state.mode === AiMode.AiChat && <AiChat />}
                        </Suspense>
                    </div>
                </div>
            </main>

            {/* Mobile Bottom Navigation */}
            <nav className="md:hidden fixed bottom-6 left-6 right-6 z-50 bg-gray-800/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl px-2 py-2 flex items-center justify-around">
                <NavIcon active={state.mode === AiMode.Dashboard} onClick={() => setMode(AiMode.Dashboard)} icon={<CogIcon className="w-6 h-6" />} label="Home" />
                <NavIcon active={state.mode === AiMode.TripPlanner} onClick={() => setMode(AiMode.TripPlanner)} icon={<MapPinIcon className="w-6 h-6" />} label="Viaggi" />
                <NavIcon active={state.mode === AiMode.VirtualMechanic} onClick={() => setMode(AiMode.VirtualMechanic)} icon={<WrenchScrewdriverIcon className="w-6 h-6" />} label="Mecc" />
                <NavIcon active={state.mode === AiMode.Garage} onClick={() => setMode(AiMode.Garage)} icon={<CogIcon className="w-6 h-6" />} label="Garage" />
                <NavIcon active={state.mode === AiMode.AiChat} onClick={() => setMode(AiMode.AiChat)} icon={<ChatBubbleLeftRightIcon className="w-6 h-6" />} label="Chat" />
            </nav>

            <footer className="text-center py-10 px-4 text-sm text-gray-500">
                <p>&copy; {new Date().getFullYear()} MotoMentor AI. Tutti i diritti riservati.</p>
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
        <AppProvider>
            <AppContent />
        </AppProvider>
    );
};

export default App;
