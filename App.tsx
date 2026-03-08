
import React, { Suspense, lazy, useEffect } from 'react';
import { MapPinIcon, WrenchScrewdriverIcon, CogIcon, ChatBubbleLeftRightIcon, ExclamationTriangleIcon, ClockIcon, BookOpenIcon, ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline';
import { SpeedInsights } from '@vercel/speed-insights/react';

import { AiMode } from './types';
import { AppProvider, useAppContext } from './state/AppContext';
import TabButton from './components/TabButton';
import Notification from './components/Notification';
import Logo from './components/Logo';
import Login from './components/Login';

// --- Lazy Loading of Feature Components ---
// This enables Code Splitting: each feature is bundled separately and 
// only downloaded when the user switches to that specific tab.
const TripPlanner = lazy(() => import('./features/TripPlanner/TripPlanner'));
const VirtualMechanic = lazy(() => import('./features/VirtualMechanic/VirtualMechanic'));
const Garage = lazy(() => import('./features/Garage/Garage'));
const AiChat = lazy(() => import('./features/AiChat/AiChat'));
const TripDiary = lazy(() => import('./features/TripDiary/TripDiary'));

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

    useEffect(() => {
        checkAuth();
    }, []);

    const setMode = (mode: AiMode) => dispatch({ type: 'SET_MODE', payload: mode });

    if (state.isCheckingAuth) {
        return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">Caricamento...</div>;
    }

    if (!state.isAuthenticated) {
        return <Login />;
    }

    return (
        <div className="bg-gray-900 text-white min-h-screen font-sans">
            <Notification />
            <header className="bg-gray-800 shadow-md sticky top-0 z-10">
                <div className="container mx-auto px-4 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <Logo className="w-10 h-10 md:w-12 md:h-12 drop-shadow-md" />
                        <h1 className="text-3xl font-bold tracking-tight text-white">MotoMentor AI</h1>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="text-sm text-gray-400 hidden sm:block">
                            Ciao, {state.user?.username}
                        </div>
                        <button 
                            onClick={logout}
                            className="text-gray-400 hover:text-white transition-colors"
                            title="Esci"
                        >
                            <ArrowRightOnRectangleIcon className="w-6 h-6" />
                        </button>
                    </div>
                </div>
            </header>

            <main className="container mx-auto p-4 md:p-6">
                {/* GLOBAL ALERTS SECTION */}
                {state.deadlineAlerts.length > 0 && (
                     <div className="mb-6 space-y-2 animate-fade-in-up">
                        {state.deadlineAlerts.map((alert, index) => (
                            <div 
                                key={`${alert.vehicleId}-${alert.type}`} 
                                className={`p-3 rounded-lg flex items-center gap-3 border ${
                                    alert.status === 'expired' 
                                        ? 'bg-red-900/50 border-red-700 text-red-200' 
                                        : 'bg-orange-900/50 border-orange-700 text-orange-200'
                                }`}
                            >
                                {alert.status === 'expired' ? <ExclamationTriangleIcon className="w-6 h-6 flex-shrink-0" /> : <ClockIcon className="w-6 h-6 flex-shrink-0" />}
                                <div className="flex-grow">
                                    <p className="font-bold text-sm">
                                        {alert.status === 'expired' ? 'SCADUTO: ' : 'IN SCADENZA: '}
                                        {alert.vehicleName} - {alert.type}
                                    </p>
                                    <p className="text-xs opacity-90">
                                        Data: {new Date(alert.date).toLocaleDateString('it-IT')} 
                                        {alert.daysRemaining < 0 
                                            ? ` (Scaduto da ${Math.abs(alert.daysRemaining)} giorni)` 
                                            : ` (Mancano ${alert.daysRemaining} giorni)`}
                                    </p>
                                </div>
                                <button onClick={() => setMode(AiMode.Garage)} className="text-xs bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded transition-colors whitespace-nowrap">
                                    Gestisci
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                <div className="bg-gray-800 rounded-lg shadow-xl overflow-hidden">
                    <div className="flex border-b border-gray-700 overflow-x-auto scrollbar-hide">
                        <TabButton text="Planner" icon={<MapPinIcon className="w-5 h-5"/>} active={state.mode === AiMode.TripPlanner} onClick={() => setMode(AiMode.TripPlanner)} />
                        <TabButton text="Diario" icon={<BookOpenIcon className="w-5 h-5"/>} active={state.mode === AiMode.TripDiary} onClick={() => setMode(AiMode.TripDiary)} />
                        <TabButton text="Meccanico" icon={<WrenchScrewdriverIcon className="w-5 h-5"/>} active={state.mode === AiMode.VirtualMechanic} onClick={() => setMode(AiMode.VirtualMechanic)} />
                        <TabButton text="Garage" icon={<CogIcon className="w-5 h-5"/>} active={state.mode === AiMode.Garage} onClick={() => setMode(AiMode.Garage)} />
                        <TabButton text="Chat" icon={<ChatBubbleLeftRightIcon className="w-5 h-5"/>} active={state.mode === AiMode.AiChat} onClick={() => setMode(AiMode.AiChat)} />
                    </div>
                    <div className="p-4 md:p-6">
                        {state.error && (
                            <div 
                                className="bg-red-500/20 text-red-300 p-3 rounded-md mb-4 animate-fade-in" 
                                role="alert"
                                aria-live="assertive"
                            >
                                {state.error}
                            </div>
                        )}

                        {/* Suspense handles the asynchronous loading of the components above */}
                        <Suspense fallback={<SectionLoader />}>
                            {state.mode === AiMode.TripPlanner && <TripPlanner />}
                            {state.mode === AiMode.TripDiary && <TripDiary />}
                            {state.mode === AiMode.VirtualMechanic && <VirtualMechanic />}
                            {state.mode === AiMode.Garage && <Garage />}
                            {state.mode === AiMode.AiChat && <AiChat />}
                        </Suspense>
                    </div>
                </div>
            </main>
            <footer className="text-center py-4 px-4 text-sm text-gray-500">
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


const App: React.FC = () => {
    return (
        <AppProvider>
            <AppContent />
            <SpeedInsights />
        </AppProvider>
    );
};

export default App;
