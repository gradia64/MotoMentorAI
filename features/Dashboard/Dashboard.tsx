
import React from 'react';
import { AiMode } from '../../types';
import { 
    MapPinIcon, 
    WrenchScrewdriverIcon, 
    CogIcon, 
    ChatBubbleLeftRightIcon, 
    BookOpenIcon,
    ExclamationTriangleIcon,
    ChevronRightIcon,
    PlusIcon
} from '@heroicons/react/24/outline';
import { motion } from 'motion/react';

// Stores
import { useUIStore } from '../../src/store/useUIStore';
import { useGarageStore } from '../../src/store/useGarageStore';
import { useTripStore } from '../../src/store/useTripStore';

const Dashboard: React.FC = () => {
    const { setMode } = useUIStore();
    const { activeVehicle, deadlineAlerts } = useGarageStore();
    const { tripHistory } = useTripStore();

    const lastTrip = tripHistory.length > 0 ? tripHistory[0] : null;

    return (
        <div className="space-y-10 animate-fade-in max-w-6xl mx-auto">
            {/* Header / Active Vehicle Summary */}
            <section className="relative overflow-hidden bg-slate-950 rounded-3xl p-8 border border-white/5 shadow-2xl">
                <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-8">
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <span className="h-px w-8 bg-blue-500"></span>
                            <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-400">Status Veicolo</h2>
                        </div>
                        {activeVehicle ? (
                            <div>
                                <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight uppercase italic font-serif">
                                    {activeVehicle.model}
                                </h1>
                                <div className="flex flex-wrap items-center gap-6 mt-4 font-mono text-sm">
                                    <div className="flex flex-col">
                                        <span className="text-[9px] uppercase text-gray-500 font-sans font-bold tracking-wider">Percorso</span>
                                        <span className="text-blue-300 text-lg">{activeVehicle.kilometers} <span className="text-[10px]">KM</span></span>
                                    </div>
                                    <div className="w-px h-8 bg-white/10 hidden sm:block"></div>
                                    <div className="flex flex-col">
                                        <span className="text-[9px] uppercase text-gray-500 font-sans font-bold tracking-wider">Immatricolazione</span>
                                        <span className="text-white text-lg">{activeVehicle.year}</span>
                                    </div>
                                    <div className="w-px h-8 bg-white/10 hidden sm:block"></div>
                                    <div className="flex flex-col">
                                        <span className="text-[9px] uppercase text-gray-500 font-sans font-bold tracking-wider">Prossima Revisione</span>
                                        <span className={`text-lg ${deadlineAlerts.some((a: any) => a.type === 'Revisione') ? 'text-red-400' : 'text-emerald-400'}`}>
                                            {activeVehicle.inspectionExpiry ? new Date(activeVehicle.inspectionExpiry).toLocaleDateString('it-IT') : 'N/D'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <h1 className="text-3xl font-light text-gray-500 italic">Nessun veicolo attivo nel garage</h1>
                                <button 
                                    onClick={() => setMode(AiMode.Garage)}
                                    className="flex items-center gap-2 text-white bg-blue-600 hover:bg-blue-500 px-6 py-3 rounded-full transition-all shadow-lg font-bold text-sm uppercase tracking-wider"
                                >
                                    <PlusIcon className="w-5 h-5" /> Configura Garage
                                </button>
                            </div>
                        )}
                    </div>
                    {activeVehicle?.photo && (
                        <motion.div 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="relative group"
                        >
                            <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
                            <img 
                                src={activeVehicle.photo} 
                                alt={activeVehicle.model} 
                                className="relative w-64 h-36 object-cover rounded-2xl border border-white/10 shadow-2xl grayscale hover:grayscale-0 transition-all duration-500"
                            />
                        </motion.div>
                    )}
                </div>
                {/* Hardware Grid Aesthetic */}
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.03] pointer-events-none"></div>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Content Area (2/3) */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Quick Tools - Brutalist Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 bg-gray-700/20 border border-gray-700 rounded-3xl overflow-hidden p-1 shadow-inner">
                        <QuickAction 
                            icon={<MapPinIcon className="w-8 h-8" />} 
                            title="Planner" 
                            subtitle="Vai al viaggio" 
                            color="text-emerald-400"
                            onClick={() => setMode(AiMode.TripPlanner)} 
                        />
                        <QuickAction 
                            icon={<WrenchScrewdriverIcon className="w-8 h-8" />} 
                            title="Meccanico" 
                            subtitle="Analisi Tecnica" 
                            color="text-amber-400"
                            onClick={() => setMode(AiMode.VirtualMechanic)} 
                        />
                        <QuickAction 
                            icon={<ChatBubbleLeftRightIcon className="w-8 h-8" />} 
                            title="Chat IA" 
                            subtitle="Moto-Assistant" 
                            color="text-purple-400"
                            onClick={() => setMode(AiMode.AiChat)} 
                        />
                    </div>

                    {/* Last Trip Card - Editorial Style */}
                    <div className="group bg-gray-900/40 border border-white/5 rounded-3xl p-6 transition-all hover:bg-gray-800/40">
                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                <h3 className="text-xs font-black uppercase tracking-[0.3em] text-gray-500 italic font-serif">Road Book</h3>
                            </div>
                            {tripHistory.length > 1 && (
                                <button onClick={() => setMode(AiMode.TripDiary)} className="text-[10px] font-bold text-gray-400 uppercase tracking-widest hover:text-white transition-colors">
                                    Archivio Completo
                                </button>
                            )}
                        </div>
                        {lastTrip ? (
                            <div className="flex flex-col md:flex-row gap-8">
                                <div className="flex-grow space-y-4">
                                    <h4 className="text-3xl font-serif italic text-white leading-tight">{lastTrip.itinerary.tripTitle}</h4>
                                    <p className="text-gray-400 leading-relaxed text-sm max-w-xl">{lastTrip.itinerary.generalDescription}</p>
                                    <div className="flex flex-wrap gap-4 pt-4">
                                        <div className="flex flex-col bg-white/5 px-4 py-2 rounded-xl border border-white/5">
                                            <span className="text-[8px] uppercase text-gray-500 font-bold mb-1">Durata</span>
                                            <span className="text-xs font-mono font-bold text-blue-300">{lastTrip.itinerary.dailySchedule.length} GIORNI</span>
                                        </div>
                                        <div className="flex flex-col bg-white/5 px-4 py-2 rounded-xl border border-white/5">
                                            <span className="text-[8px] uppercase text-gray-500 font-bold mb-1">Distanza</span>
                                            <span className="text-xs font-mono font-bold text-emerald-300">{lastTrip.itinerary.dailySchedule.reduce((acc: number, d: any) => acc + d.stageKilometers, 0)} KM</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center">
                                    <button 
                                        onClick={() => setMode(AiMode.TripDiary)}
                                        className="w-16 h-16 rounded-full border border-white/10 flex items-center justify-center hover:bg-blue-600 hover:border-blue-600 transition-all group-hover:scale-110"
                                    >
                                        <ChevronRightIcon className="w-6 h-6 text-white" />
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-10 border border-dashed border-gray-700/50 rounded-2xl">
                                <p className="text-gray-600 text-sm italic font-serif">Il tuo diario è pronto per accogliere la prima avventura.</p>
                                <button onClick={() => setMode(AiMode.TripPlanner)} className="mt-4 text-blue-500 text-xs font-bold uppercase tracking-[0.2em] hover:text-blue-400">
                                    Pianifica Ora
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Sidebar (1/3) */}
                <div className="space-y-8">
                    {/* Alerts - Hardware Warning Panel Style */}
                    <div className="bg-red-500/5 border border-red-500/20 rounded-3xl p-6 shadow-inner relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-red-500/30"></div>
                        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-red-500 mb-6 flex items-center gap-2">
                            <ExclamationTriangleIcon className="w-4 h-4" /> System Alerts
                        </h3>
                        {deadlineAlerts.length > 0 ? (
                            <div className="space-y-4">
                                {deadlineAlerts.map((alert: any) => (
                                    <motion.div 
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        key={`${alert.vehicleId}-${alert.type}`}
                                        className="group"
                                    >
                                        <div className="flex justify-between items-end mb-2">
                                            <span className="text-[9px] font-bold text-gray-500 uppercase">{alert.type}</span>
                                            <span className={`text-[9px] font-bold font-mono ${alert.status === 'expired' ? 'text-red-500' : 'text-orange-500'}`}>
                                                {alert.status === 'expired' ? '[SCADUTO]' : `${alert.daysRemaining}d REMAINING`}
                                            </span>
                                        </div>
                                        <div className="bg-white/5 p-3 rounded-xl border border-white/5 group-hover:border-red-500/30 transition-colors">
                                            <p className="text-xs font-bold text-white uppercase tracking-wider">{alert.vehicleName}</p>
                                            <p className="text-[10px] font-mono text-gray-500 mt-1">{new Date(alert.date).toLocaleDateString('it-IT')}</p>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-10 opacity-30 grayscale">
                                <span className="text-[8px] font-bold uppercase tracking-widest text-emerald-500">All systems go</span>
                                <div className="mt-4 w-12 h-px bg-emerald-500/50"></div>
                                <p className="text-[10px] italic mt-4 text-emerald-500">Nessuna criticità rilevata</p>
                            </div>
                        )}
                    </div>

                    {/* Quick Access to Garage */}
                    <div className="bg-gray-800/40 border border-white/5 rounded-3xl p-6">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 mb-6 italic font-serif">Quick Access</h3>
                        <div className="space-y-4">
                            <button 
                                onClick={() => setMode(AiMode.Garage)}
                                className="w-full flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/5 transition-all text-left"
                            >
                                <div className="flex items-center gap-3">
                                    <CogIcon className="w-5 h-5 text-gray-400" />
                                    <span className="text-xs font-bold uppercase tracking-wider text-gray-200">Il Tuo Garage</span>
                                </div>
                                <ChevronRightIcon className="w-4 h-4 text-gray-600" />
                            </button>
                            <button 
                                onClick={() => setMode(AiMode.TripDiary)}
                                className="w-full flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/5 transition-all text-left"
                            >
                                <div className="flex items-center gap-3">
                                    <BookOpenIcon className="w-5 h-5 text-gray-400" />
                                    <span className="text-xs font-bold uppercase tracking-wider text-gray-200">Diario di Bordo</span>
                                </div>
                                <ChevronRightIcon className="w-4 h-4 text-gray-600" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

interface QuickActionProps {
    icon: React.ReactNode;
    title: string;
    subtitle: string;
    color: string;
    onClick: () => void;
}

const QuickAction: React.FC<QuickActionProps> = ({ icon, title, subtitle, color, onClick }) => (
    <button 
        onClick={onClick}
        className="flex flex-col items-center justify-center py-8 px-4 bg-transparent hover:bg-white/5 transition-all group"
    >
        <div className={`${color} mb-3 transition-transform group-hover:scale-110 duration-300`}>
            {icon}
        </div>
        <span className="text-xs font-black uppercase tracking-widest text-white mb-1">{title}</span>
        <span className="text-[8px] text-gray-600 font-bold uppercase tracking-tighter">{subtitle}</span>
    </button>
);

export default Dashboard;

