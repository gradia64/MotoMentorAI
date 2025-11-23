import React from 'react';
import { MapPinIcon, WrenchScrewdriverIcon, CogIcon, ChatBubbleLeftRightIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

import { AiMode } from './types';
import { AppProvider, useAppContext } from './state/AppContext';
import TripPlanner from './features/TripPlanner/TripPlanner';
import VirtualMechanic from './features/VirtualMechanic/VirtualMechanic';
import Garage from './features/Garage/Garage';
import AiChat from './features/AiChat/AiChat';
import TabButton from './components/TabButton';
import Notification from './components/Notification';
import Logo from './components/Logo';

// Declare jspdf from window for global access
declare global {
    interface Window {
        jspdf: any;
    }
}

// --- Memoized Components for Performance ---
// These components will only re-render if their props change. Since they don't
// take any props and get all their data from context, this prevents them from
// re-rendering every time *any* part of the context state changes.
const MemoizedTripPlanner = React.memo(TripPlanner);
const MemoizedVirtualMechanic = React.memo(VirtualMechanic);
const MemoizedGarage = React.memo(Garage);
const MemoizedAiChat = React.memo(AiChat);

const AppContent: React.FC = () => {
    const { state, dispatch } = useAppContext();

    const setMode = (mode: AiMode) => dispatch({ type: 'SET_MODE', payload: mode });

    return (
        <div className="bg-gray-900 text-white min-h-screen font-sans">
            <Notification />
            <header className="bg-gray-800 shadow-md sticky top-0 z-10">
                <div className="container mx-auto px-4 py-4 flex justify-center items-center gap-4">
                    <Logo className="w-10 h-10 md:w-12 md:h-12 drop-shadow-md" />
                    <h1 className="text-3xl font-bold tracking-tight text-white">MotoMentor AI</h1>
                </div>
            </header>

            <main className="container mx-auto p-4 md:p-6">
                <div className="bg-gray-800 rounded-lg shadow-xl overflow-hidden">
                    <div className="flex border-b border-gray-700">
                        <TabButton text="Planner Viaggi" icon={<MapPinIcon className="w-5 h-5"/>} active={state.mode === AiMode.TripPlanner} onClick={() => setMode(AiMode.TripPlanner)} />
                        <TabButton text="Meccanico Virtuale" icon={<WrenchScrewdriverIcon className="w-5 h-5"/>} active={state.mode === AiMode.VirtualMechanic} onClick={() => setMode(AiMode.VirtualMechanic)} />
                        <TabButton text="Il Mio Garage" icon={<CogIcon className="w-5 h-5"/>} active={state.mode === AiMode.Garage} onClick={() => setMode(AiMode.Garage)} />
                        <TabButton text="AI Chat" icon={<ChatBubbleLeftRightIcon className="w-5 h-5"/>} active={state.mode === AiMode.AiChat} onClick={() => setMode(AiMode.AiChat)} />
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

                        {state.mode === AiMode.TripPlanner && <MemoizedTripPlanner />}
                        {state.mode === AiMode.VirtualMechanic && <MemoizedVirtualMechanic />}
                        {state.mode === AiMode.Garage && <MemoizedGarage />}
                        {state.mode === AiMode.AiChat && <MemoizedAiChat />}
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
        </AppProvider>
    );
};

export default App;