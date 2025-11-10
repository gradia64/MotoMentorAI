import React, { useState, FormEvent } from 'react';
import { Itinerary, Day, SavedTrip } from '../../types';
import { ArchiveBoxIcon, GlobeAltIcon, ArrowDownOnSquareIcon, BookOpenIcon, ClockIcon, BellAlertIcon, ShieldCheckIcon, BuildingStorefrontIcon, HomeIcon, ArrowDownTrayIcon, DocumentPlusIcon } from '@heroicons/react/24/outline';
import ActionButton from '../../components/ActionButton';
import InputField from '../../components/InputField';
import SelectField from '../../components/SelectField';
import WeatherIcon from '../../components/WeatherIcon';
import InfoBlock from '../../components/InfoBlock';
import TripHistoryModal from './TripHistoryModal';

export interface TripPlannerProps {
    handleSubmit: (e: FormEvent) => Promise<void>;
    departure: string;
    setDeparture: React.Dispatch<React.SetStateAction<string>>;
    destination: string;
    setDestination: React.Dispatch<React.SetStateAction<string>>;
    duration: string;
    setDuration: React.Dispatch<React.SetStateAction<string>>;
    tripPeriod: string;
    setTripPeriod: React.Dispatch<React.SetStateAction<string>>;
    roadPreference: string;
    setRoadPreference: React.Dispatch<React.SetStateAction<string>>;
    customPrompt: string;
    setCustomPrompt: React.Dispatch<React.SetStateAction<string>>;
    itinerary: Itinerary | null;
    loading: boolean;
    isGeneratingPdf: boolean;
    saveItinerary: () => void;
    onSaveAndReset: () => void;
    loadLastItinerary: () => void;
    downloadPdf: () => void;
    exportDayGpx: (day: Day) => void;
    showFullMap: () => void;
    savedConfirmation: string | null;
    tripType: 'itinerary' | 'tour';
    setTripType: React.Dispatch<React.SetStateAction<'itinerary' | 'tour'>>;
    selectedTour: string;
    setSelectedTour: React.Dispatch<React.SetStateAction<string>>;
    tripHistory: SavedTrip[];
    onLoadFromHistory: (tripId: string) => void;
    onDeleteFromHistory: (tripId: string) => void;
    onExportHistory: () => void;
    tripMaintenanceAlerts: string[];
}

const TripPlanner: React.FC<TripPlannerProps> = ({ handleSubmit, departure, setDeparture, destination, setDestination, duration, setDuration, tripPeriod, setTripPeriod, roadPreference, setRoadPreference, customPrompt, setCustomPrompt, itinerary, loading, isGeneratingPdf, saveItinerary, onSaveAndReset, loadLastItinerary, downloadPdf, exportDayGpx, showFullMap, savedConfirmation, tripType, setTripType, selectedTour, setSelectedTour, tripHistory, onLoadFromHistory, onDeleteFromHistory, onExportHistory, tripMaintenanceAlerts }) => {
    
    const TOURS = [
        "Tour della Scozia", "Avventura in Marocco", "Giro della Penisola Iberica", "Esplorazione della Turchia", "Le strade alpine della Svizzera", "Coste e fiordi della Norvegia", "Le Alpi Francesi", "Auschwitz Il viaggio della memoria"
    ];

    const ROAD_PREFERENCES = [
        "Strade panoramiche e tortuose",
        "Strade di montagna con tornanti",
        "Percorsi costieri con vista mare",
        "Superstrade veloci per trasferimenti",
        "Mix avventura (asfalto e sterrato leggero)",
        "Strade secondarie poco trafficate",
        "Percorso più diretto e veloce",
        "Evita completamente le autostrade",
    ];

    const [showHistory, setShowHistory] = useState(false);

    return (
        <div>
            <TripHistoryModal show={showHistory} onClose={() => setShowHistory(false)} history={tripHistory} onLoad={onLoadFromHistory} onDelete={onDeleteFromHistory} onExport={onExportHistory}/>

            <div className="flex justify-center bg-gray-700 rounded-full p-1 mb-6 max-w-sm mx-auto">
                <button onClick={() => setTripType('itinerary')} className={`px-4 py-1.5 w-1/2 rounded-full text-sm font-semibold transition ${tripType === 'itinerary' ? 'bg-blue-600 text-white' : 'text-gray-300'}`}>Itinerario A/R</button>
                <button onClick={() => setTripType('tour')} className={`px-4 py-1.5 w-1/2 rounded-full text-sm font-semibold transition ${tripType === 'tour' ? 'bg-blue-600 text-white' : 'text-gray-300'}`}>Tour</button>
            </div>

            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {tripType === 'itinerary' ? (
                    <>
                        <InputField id="departure" label="Luogo di Partenza" value={departure} onChange={(e) => setDeparture(e.target.value)} placeholder="Es. Milano" required />
                        <InputField id="destination" label="Destinazione" value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Es. Costiera Amalfitana" required />
                    </>
                ) : (
                    <>
                        <InputField id="departure" label="Il tuo Luogo di Partenza" value={departure} onChange={(e) => setDeparture(e.target.value)} placeholder="Es. Milano" required />
                        <SelectField id="tour" label="Scegli un Tour" value={selectedTour} onChange={(e) => setSelectedTour(e.target.value)}>
                            {TOURS.map(tour => <option key={tour} value={tour}>{tour}</option>)}
                        </SelectField>
                    </>
                )}
                <InputField id="duration" label="Durata (giorni)" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="Es. 7" required />
                <InputField id="period" label="Periodo del Viaggio" value={tripPeriod} onChange={(e) => setTripPeriod(e.target.value)} placeholder="Es. Metà Luglio" required />
                <div className="md:col-span-2">
                    <SelectField id="roadPreference" label="Tipo di Strade Preferite" value={roadPreference} onChange={(e) => setRoadPreference(e.target.value)}>
                        {ROAD_PREFERENCES.map(pref => <option key={pref} value={pref}>{pref}</option>)}
                    </SelectField>
                </div>
                 <div className="md:col-span-2">
                    <label htmlFor="customPrompt" className="block text-sm font-medium text-gray-300">Richieste Specifiche (opzionale)</label>
                    <div className="mt-1">
                        <textarea
                            id="customPrompt"
                            value={customPrompt}
                            onChange={(e) => setCustomPrompt(e.target.value)}
                            rows={3}
                            placeholder="Es. 'Includi una sosta alle terme di Bormio', 'Voglio percorrere il passo dello Stelvio', 'Evita strade sterrate'..."
                            className="block w-full px-3 py-2 text-white bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        />
                    </div>
                </div>
                <div className="md:col-span-2 flex flex-wrap gap-4">
                    <ActionButton type="submit" disabled={loading}>{loading ? 'Generazione...' : 'Crea Itinerario'}</ActionButton>
                    <ActionButton onClick={loadLastItinerary} disabled={loading || tripHistory.length === 0}><ClockIcon className="w-5 h-5"/>Carica Ultimo</ActionButton>
                    <ActionButton onClick={() => setShowHistory(true)} disabled={loading} className="bg-gray-600 hover:bg-gray-500"><BookOpenIcon className="w-5 h-5"/>Storico Viaggi</ActionButton>
                </div>
            </form>
            {loading && <div className="text-center p-8"> <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div> <p className="mt-2">L'IA sta pianificando il tuo viaggio...</p> </div>}
            
            {itinerary && (
                <div className="mt-6 animate-fade-in">

                    {tripMaintenanceAlerts.length > 0 && (
                        <div className="bg-yellow-500/20 text-yellow-300 p-4 rounded-md mb-6 shadow-lg">
                            <h4 className="font-bold flex items-center gap-2 text-yellow-200"><BellAlertIcon className="w-6 h-6"/> Attenzione Manutenzione!</h4>
                            <ul className="list-disc list-inside mt-2 ml-2 text-sm">
                                {tripMaintenanceAlerts.map((alert, i) => <li key={i}>{alert}</li>)}
                            </ul>
                        </div>
                    )}

                    <div id="itinerary-content">
                        <div className="flex justify-between items-start mb-4 flex-wrap gap-2">
                            <div className="flex-1">
                                <h2 className="text-2xl font-bold text-white">{itinerary.titolo_viaggio}</h2>
                                <p className="text-gray-400 mt-1">{itinerary.descrizione_generale}</p>
                            </div>
                            <div className="flex gap-2 items-center flex-wrap self-start">
                                {savedConfirmation && <span className="text-green-400 text-sm animate-pulse mr-2">{savedConfirmation}</span>}
                                <ActionButton onClick={saveItinerary}><ArchiveBoxIcon className="w-5 h-5"/> Salva</ActionButton>
                                <ActionButton onClick={onSaveAndReset} className="bg-indigo-600 hover:bg-indigo-500"><DocumentPlusIcon className="w-5 h-5"/> Salva e Nuovo</ActionButton>
                                <ActionButton onClick={downloadPdf} disabled={isGeneratingPdf} className="bg-teal-600 hover:bg-teal-500">
                                    {isGeneratingPdf ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <ArrowDownTrayIcon className="w-5 h-5"/>}
                                    {isGeneratingPdf ? 'Creando...' : 'Scarica PDF'}
                                </ActionButton>
                                <ActionButton onClick={showFullMap} className="bg-green-600 hover:bg-green-500"><GlobeAltIcon className="w-5 h-5"/> Mappa</ActionButton>
                            </div>
                        </div>
                        <div className="space-y-4">
                            {itinerary.programma_giornaliero.map((day, index) => (
                                <div key={index} className={`day-container ${index % 2 === 0 ? 'bg-gray-700/50' : 'bg-gray-600/50'} p-4 rounded-lg`}>
                                    <div className="flex justify-between items-start">
                                        <h3 className="text-xl font-semibold text-blue-400">Giorno {day.giorno}: {day.titolo_tappa}</h3>
                                        <ActionButton onClick={() => exportDayGpx(day)} className="bg-gray-600 hover:bg-gray-500 text-xs py-1 px-2"><ArrowDownOnSquareIcon className="w-4 h-4"/> GPX</ActionButton>
                                    </div>
                                    <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-sm font-medium text-gray-400 my-2">
                                        <span>{day.chilometri_tappa} km stimati</span>
                                        {day.previsioni_meteo && (
                                            <div className="flex items-center gap-1.5 border-l border-gray-600 pl-4">
                                                <WeatherIcon iconName={day.previsioni_meteo.icona} />
                                                <span>{day.previsioni_meteo.temperatura_min}° / {day.previsioni_meteo.temperatura_max}°C</span>
                                                <span className="hidden sm:inline">- {day.previsioni_meteo.condizioni}</span>
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-gray-300 my-2">{day.descrizione_percorso}</p>
                                    <h4 className="font-semibold text-gray-300 mt-3">Attività e Luoghi di Interesse:</h4>
                                    <ul className="list-disc list-inside text-gray-400 space-y-1 mt-1">
                                        {day.attivita_luoghi_interesse.map((activity, i) => <li key={i}>{activity}</li>)}
                                    </ul>
                                    <div className="mt-4 pt-4 border-t border-gray-600/50 space-y-2">
                                        <InfoBlock icon={ShieldCheckIcon} title="Consigli di Guida" content={day.consigli_di_guida} />
                                        <InfoBlock icon={BuildingStorefrontIcon} title="Opzione Ristoro" content={day.opzione_ristoro} />
                                        <InfoBlock icon={HomeIcon} title="Alloggio Consigliato" content={day.alloggio_consigliato} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TripPlanner;