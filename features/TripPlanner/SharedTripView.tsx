import React, { useEffect, useState } from 'react';
import { 
    MapPinIcon, 
    CalendarIcon, 
    ClockIcon, 
    ArrowDownTrayIcon, 
    ChevronLeftIcon,
    ExclamationTriangleIcon,
    ShieldCheckIcon,
    BuildingStorefrontIcon,
    HomeIcon,
    ArrowsRightLeftIcon
} from '@heroicons/react/24/outline';
import { useTripStore } from '../../src/store/useTripStore';
import { SharedTrip, Day } from '../../types';
import WeatherIcon from '../../components/WeatherIcon';
import InfoBlock from '../../components/InfoBlock';
import { downloadFile, generateGpxFile } from '../../src/utils/mapsHelpers';
import ActionButton from '../../components/ActionButton';
import { formatModelName } from '../../src/utils/itinerary';
import { motion } from 'motion/react';

interface SharedTripViewProps {
    // Id del viaggio condiviso salvato localmente (apertura da archivio).
    id?: string;
    // Oggetto viaggio completo (apertura da file .mmt.json condiviso).
    trip?: SharedTrip;
    onBack: () => void;
}

const SharedTripView: React.FC<SharedTripViewProps> = ({ id, trip, onBack }) => {
    const { getSharedTrip } = useTripStore();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [obj, setObj] = useState<SharedTrip | null>(trip ?? null);

    useEffect(() => {
        const fetchTrip = async () => {
            setLoading(true);
            if (trip) {
                // Apertura da file condiviso: i dati sono gia' disponibili.
                setObj(trip);
                setLoading(false);
                return;
            }
            if (!id) {
                setError("Viaggio non trovato.");
                setLoading(false);
                return;
            }
            const data = await getSharedTrip(id);
            if (data) {
                setObj(data);
            } else {
                setError("Viaggio non trovato o non più disponibile.");
            }
            setLoading(false);
        };
        fetchTrip();
    }, [id, trip, getSharedTrip]);

    const handleDownloadAllGpx = () => {
        if (!obj) return;
        // Simple implementation: download individual files if many, or one big. 
        // For now, let's just use the first day or logic from the planner
        obj.itinerary.dailySchedule.forEach(day => {
            const gpx = generateGpxFile(day);
            downloadFile(gpx, `tappa_${day.day}.gpx`, 'application/gpx+xml');
        });
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-white">
                <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p>Caricamento itinerario condiviso...</p>
            </div>
        );
    }

    if (error || !obj) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6 bg-red-500/10 rounded-2xl border border-red-500/20">
                <ExclamationTriangleIcon className="w-16 h-16 text-red-500 mb-4" />
                <h2 className="text-2xl font-bold text-white mb-2 underline decoration-red-500">Ops! Qualcosa è andato storto</h2>
                <p className="text-gray-400 mb-6">{error}</p>
                <ActionButton onClick={onBack}>Torna alla Home</ActionButton>
            </div>
        );
    }

    const totalKm = obj.itinerary.dailySchedule.reduce((acc, day) => acc + day.stageKilometers, 0);

    return (
        <div className="max-w-4xl mx-auto p-4 md:p-8 animate-fade-in">
            <div className="bg-gray-800/80 backdrop-blur-md rounded-3xl overflow-hidden shadow-2xl border border-gray-700/50">
                {/* Header Section */}
                <div className="relative h-64 bg-gradient-to-br from-blue-900 to-indigo-900 flex flex-col items-center justify-center text-center p-6 overflow-hidden">
                    <div className="absolute top-4 left-4">
                         <button onClick={onBack} className="p-2 bg-black/30 hover:bg-black/50 rounded-full text-white transition-all">
                            <ChevronLeftIcon className="w-6 h-6" />
                        </button>
                    </div>
                    
                    <div className="mb-2 bg-blue-500/20 text-blue-300 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest border border-blue-500/30">
                        Itinerario Condiviso
                    </div>
                    <h1 className="text-3xl md:text-5xl font-black text-white mb-3 tracking-tighter drop-shadow-lg">
                        {obj.tripTitle}
                    </h1>
                    <div className="flex flex-wrap items-center justify-center gap-4 text-white/80 text-sm font-medium">
                        <span className="flex items-center gap-1"><MapPinIcon className="w-4 h-4" /> {obj.itinerary.dailySchedule.length} Giorni</span>
                        <span className="flex items-center gap-1 font-bold text-blue-300"><ClockIcon className="w-4 h-4" /> {totalKm} Km Totali</span>
                        <span className="flex items-center gap-1 border-l border-white/20 pl-4"><CalendarIcon className="w-4 h-4" /> Creato da {obj.ownerName}</span>
                    </div>

                    {/* Background Accents */}
                    <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-blue-400/10 blur-3xl rounded-full"></div>
                    <div className="absolute -top-12 -left-12 w-48 h-48 bg-indigo-400/10 blur-3xl rounded-full"></div>
                </div>

                {/* Content Section */}
                <div className="p-6 md:p-10">
                    <div className="mb-12">
                        <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                             L'Avventura
                        </h2>
                        <p className="text-gray-300 leading-relaxed text-lg italic bg-gray-900/40 p-6 rounded-2xl border border-gray-700/30">
                            "{obj.itinerary.generalDescription}"
                        </p>
                    </div>

                    <div className="flex justify-between items-center mb-8">
                        <h2 className="text-2xl font-bold text-white">Programma Giornaliero</h2>
                        <button 
                            onClick={handleDownloadAllGpx}
                            className="text-blue-400 hover:text-blue-300 text-sm font-bold flex items-center gap-1 px-3 py-1 bg-blue-400/10 rounded-lg border border-blue-400/20 transition-all"
                        >
                            <ArrowDownTrayIcon className="w-4 h-4" /> Scarica Tutti GPX
                        </button>
                    </div>

                    <div className="space-y-10 relative">
                        {/* Timeline Connector */}
                        <div className="absolute left-6 top-8 bottom-8 w-0.5 bg-gray-700 md:left-8"></div>

                        {obj.itinerary.dailySchedule.map((day: Day, index: number) => (
                            <motion.div 
                                key={day.day}
                                initial={{ opacity: 0, x: -20 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.1 }}
                                className="relative bg-gray-900/50 rounded-2xl p-6 border border-gray-700/50 hover:border-blue-500/30 transition-all"
                            >
                                {/* Timeline DOT */}
                                <div className="absolute -left-[30px] top-8 w-5 h-5 bg-blue-500 rounded-full border-4 border-gray-800 md:-left-[41px] md:w-6 md:h-6"></div>

                                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-sm font-black text-blue-400 uppercase tracking-tighter">Giorno {day.day}</span>
                                            <span className="bg-gray-800 text-gray-400 text-[10px] px-2 py-0.5 rounded-full font-bold">{day.stageKilometers} Km</span>
                                        </div>
                                        <h3 className="text-2xl font-bold text-white tracking-tight">{day.stageTitle}</h3>
                                    </div>
                                    
                                    <div className="bg-gray-800/80 p-3 rounded-xl border border-gray-700 flex items-center gap-4">
                                        <WeatherIcon iconName={day.weatherForecast.icon} className="w-8 h-8 text-blue-400" />
                                        <div>
                                            <div className="text-white font-bold leading-none">{day.weatherForecast.temperatureMax}°C / {day.weatherForecast.temperatureMin}°C</div>
                                            <div className="text-gray-500 text-xs mt-1">{day.weatherForecast.conditions}</div>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <section>
                                        <p className="text-gray-300 leading-relaxed">{day.routeDescription}</p>
                                    </section>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <InfoBlock icon={ShieldCheckIcon} title="Consigli di Guida" content={day.drivingTips} />
                                        <InfoBlock icon={BuildingStorefrontIcon} title="Opzione Ristoro" content={day.restaurantOption} />
                                        <InfoBlock icon={HomeIcon} title="Alloggio Consigliato" content={day.accommodation} />
                                        {day.alternativeRouteSuggestion && (
                                            <InfoBlock icon={ArrowsRightLeftIcon} title="Suggerimento Alternativo" content={day.alternativeRouteSuggestion} />
                                        )}
                                    </div>

                                    <div className="pt-4 border-t border-gray-800 flex justify-end">
                                        <button 
                                            onClick={() => {
                                                const gpx = generateGpxFile(day);
                                                downloadFile(gpx, `tappa_${day.day}.gpx`, 'application/gpx+xml');
                                            }}
                                            className="text-white hover:text-blue-400 transition-colors flex items-center gap-2 text-sm font-semibold"
                                        >
                                            <ArrowDownTrayIcon className="w-4 h-4" /> Scarica GPX Tappa
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>

                {/* Footer Section */}
                <div className="p-8 bg-black/20 border-t border-gray-700/50 text-center">
                    <p className="text-gray-500 text-xs mb-4">
                        Itinerario generato con MotoMentor AI assistant
                        {obj.itinerary.generatedBy ? ` · pianificato da ${formatModelName(obj.itinerary.generatedBy)}` : ''}.
                    </p>
                    <ActionButton onClick={onBack}>Crea il tuo Itinerario Personalizzato</ActionButton>
                </div>
            </div>
        </div>
    );
};

export default SharedTripView;
