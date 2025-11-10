
import React, { useState, useEffect, FormEvent } from 'react';
import { generateItinerary, diagnoseProblem, getMaintenanceTips } from './services/geminiService';
import { Itinerary, MaintenanceTips, GarageVehicle, AiMode, Day, SavedTrip, MaintenanceRecord, MaintenanceType, MaintenanceReminder } from './types';
import { MapPinIcon, WrenchScrewdriverIcon, CogIcon } from '@heroicons/react/24/outline';

import TripPlanner from './features/TripPlanner/TripPlanner';
import VirtualMechanic from './features/VirtualMechanic/VirtualMechanic';
import Garage from './features/Garage/Garage';
import TabButton from './components/TabButton';

// Declare jspdf from window for global access
declare global {
    interface Window {
        jspdf: any;
    }
}

const DRAFTS_STORAGE_KEY = 'motoMentorDrafts';

const App: React.FC = () => {
    const [mode, setMode] = useState<AiMode>(AiMode.TripPlanner);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    // Trip Planner State
    const [tripType, setTripType] = useState<'itinerary' | 'tour'>('itinerary');
    const [selectedTour, setSelectedTour] = useState('Tour della Scozia');
    const [departure, setDeparture] = useState('');
    const [destination, setDestination] = useState('');
    const [duration, setDuration] = useState('');
    const [tripPeriod, setTripPeriod] = useState('');
    const [roadPreference, setRoadPreference] = useState('Strade panoramiche e tortuose');
    const [customPrompt, setCustomPrompt] = useState('');
    const [itinerary, setItinerary] = useState<Itinerary | null>(null);
    const [activeTripId, setActiveTripId] = useState<string | null>(null);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [tripHistory, setTripHistory] = useState<SavedTrip[]>([]);
    const [tripMaintenanceAlerts, setTripMaintenanceAlerts] = useState<string[]>([]);

    // Virtual Mechanic State
    const [mechanicMode, setMechanicMode] = useState<'diagnose' | 'maintenance' | 'workshop'>('workshop');
    const [problemDescription, setProblemDescription] = useState('');
    const [problemImage, setProblemImage] = useState<File | null>(null);
    const [diagnosis, setDiagnosis] = useState<string | null>(null);
    const [maintenanceTips, setMaintenanceTips] = useState<MaintenanceTips | null>(null);
    const [maintenanceLog, setMaintenanceLog] = useState<MaintenanceRecord[]>([]);
    
    // Garage State
    const [garageVehicles, setGarageVehicles] = useState<GarageVehicle[]>([]);
    const [activeVehicle, setActiveVehicle] = useState<GarageVehicle | null>(null);
    const [savedConfirmation, setSavedConfirmation] = useState<string | null>(null);
    const [reminders, setReminders] = useState<MaintenanceReminder[]>([]);
    
    useEffect(() => {
        // Load saved data from localStorage
        const savedVehiclesJSON = localStorage.getItem('motoMentorGarage');
        if (savedVehiclesJSON) {
            try {
                const loadedVehicles = JSON.parse(savedVehiclesJSON) as GarageVehicle[];
                setGarageVehicles(loadedVehicles);

                const activeVehicleId = localStorage.getItem('motoMentorActiveVehicleId');
                if (activeVehicleId) {
                    const vehicleToActivate = loadedVehicles.find(v => v.id === activeVehicleId);
                    if (vehicleToActivate) {
                        setActiveVehicle(vehicleToActivate);
                    }
                }
            } catch (e) { console.error("Failed to parse saved vehicles", e); }
        }
        
        const savedLog = localStorage.getItem('motoMentorMaintenanceLog');
        if (savedLog) {
            try { setMaintenanceLog(JSON.parse(savedLog)); } catch (e) { console.error("Failed to parse maintenance log", e); }
        }
        
        const savedReminders = localStorage.getItem('motoMentorReminders');
        if (savedReminders) {
             try {
                const loadedReminders = JSON.parse(savedReminders) as MaintenanceReminder[];
                setReminders(loadedReminders);
            } catch (e) { console.error("Failed to parse reminders", e); }
        }

        const savedHistory = localStorage.getItem('motoMentorTripHistory');
        if (savedHistory) {
            try { setTripHistory(JSON.parse(savedHistory)); } catch (e) { console.error("Failed to parse trip history", e); }
        }

        // Load drafts
        const savedDraftsJSON = localStorage.getItem(DRAFTS_STORAGE_KEY);
        if (savedDraftsJSON) {
            try {
                const drafts = JSON.parse(savedDraftsJSON);
                if (drafts.tripPlanner) {
                    setTripType(drafts.tripPlanner.tripType || 'itinerary');
                    setSelectedTour(drafts.tripPlanner.selectedTour || 'Tour della Scozia');
                    setDeparture(drafts.tripPlanner.departure || '');
                    setDestination(drafts.tripPlanner.destination || '');
                    setDuration(drafts.tripPlanner.duration || '');
                    setTripPeriod(drafts.tripPlanner.tripPeriod || '');
                    setRoadPreference(drafts.tripPlanner.roadPreference || 'Strade panoramiche e tortuose');
                    setCustomPrompt(drafts.tripPlanner.customPrompt || '');
                }
                if (drafts.virtualMechanic) {
                    setProblemDescription(drafts.virtualMechanic.problemDescription || '');
                }
            } catch (e) {
                console.error("Failed to parse saved drafts", e);
                localStorage.removeItem(DRAFTS_STORAGE_KEY); // Clear corrupted data
            }
        }
    }, []);

    // Auto-save drafts to localStorage on change
    useEffect(() => {
        const drafts = {
            tripPlanner: {
                tripType,
                selectedTour,
                departure,
                destination,
                duration,
                tripPeriod,
                roadPreference,
                customPrompt,
            },
            virtualMechanic: {
                problemDescription,
            },
        };
        localStorage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify(drafts));
    }, [tripType, selectedTour, departure, destination, duration, tripPeriod, roadPreference, problemDescription, customPrompt]);


    const handleAddVehicle = (newVehicleData: Omit<GarageVehicle, 'id'>) => {
        const newVehicle: GarageVehicle = { ...newVehicleData, id: Date.now().toString() };
        const updatedVehicles = [...garageVehicles, newVehicle];
        setGarageVehicles(updatedVehicles);
        localStorage.setItem('motoMentorGarage', JSON.stringify(updatedVehicles));
        
        if (garageVehicles.length === 0) {
            handleSetActiveVehicle(newVehicle.id, updatedVehicles);
        }
        setSavedConfirmation("Veicolo aggiunto!");
        setTimeout(() => setSavedConfirmation(null), 3000);
    };

    const handleUpdateVehicle = (updatedVehicle: GarageVehicle) => {
        const updatedVehicles = garageVehicles.map(v => v.id === updatedVehicle.id ? updatedVehicle : v);
        setGarageVehicles(updatedVehicles);
        localStorage.setItem('motoMentorGarage', JSON.stringify(updatedVehicles));

        if (activeVehicle?.id === updatedVehicle.id) {
            setActiveVehicle(updatedVehicle);
        }

        setSavedConfirmation("Veicolo aggiornato!");
        setTimeout(() => setSavedConfirmation(null), 3000);
    };

    const handleDeleteVehicle = (id: string) => {
        const updatedVehicles = garageVehicles.filter(v => v.id !== id);
        setGarageVehicles(updatedVehicles);
        localStorage.setItem('motoMentorGarage', JSON.stringify(updatedVehicles));
        
        if (activeVehicle?.id === id) {
            setActiveVehicle(null);
            localStorage.removeItem('motoMentorActiveVehicleId');
        }
    };
    
    const handleSetActiveVehicle = (id: string, currentVehicles = garageVehicles) => {
        const vehicleToSet = currentVehicles.find(v => v.id === id);
        if (vehicleToSet) {
            setActiveVehicle(vehicleToSet);
            localStorage.setItem('motoMentorActiveVehicleId', id);
        }
    };

    const handleTripSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setItinerary(null);
        setTripMaintenanceAlerts([]);
        try {
            const options = {
                duration,
                roadPreference,
                period: tripPeriod,
                motorcycle: activeVehicle ?? undefined,
                customPrompt,
                ...(tripType === 'itinerary'
                    ? { departure, destination }
                    : { departure, tourName: selectedTour }
                )
            };
            const result = await generateItinerary(options);
            setItinerary(result);
            setActiveTripId(null); // This is a new, unsaved itinerary

            // Check for maintenance alerts after generating itinerary
            if (activeVehicle && result) {
                const totalTripKm = result.programma_giornaliero.reduce((total, day) => total + day.chilometri_tappa, 0);
                const currentKm = parseInt(activeVehicle.kilometers, 10);
                const endOfTripKm = currentKm + totalTripKm;
                const alerts: string[] = [];
                reminders.forEach(reminder => {
                    if (endOfTripKm >= reminder.targetKilometers && currentKm < reminder.targetKilometers) {
                        alerts.push(`Durante questo viaggio supererai la scadenza per "${reminder.description}" a ${reminder.targetKilometers.toLocaleString('it-IT')} km.`);
                    }
                });
                setTripMaintenanceAlerts(alerts);
            }

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Si è verificato un errore sconosciuto.');
        } finally {
            setLoading(false);
        }
    };
    
    const saveItinerary = () => {
        if (!itinerary) return;

        let updatedHistory: SavedTrip[];
        let confirmationMessage: string;

        const isUpdating = activeTripId && tripHistory.some(trip => trip.id === activeTripId);

        const currentInputs = {
            tripType,
            duration,
            roadPreference,
            period: tripPeriod,
            customPrompt,
            ...(tripType === 'itinerary'
                ? { departure, destination }
                : { departure, selectedTour }
            ),
        };

        if (isUpdating) {
            updatedHistory = tripHistory.map(trip => 
                trip.id === activeTripId 
                ? { ...trip, inputs: currentInputs, itinerary } 
                : trip
            );
            confirmationMessage = "Itinerario aggiornato!";
        } else {
            const newTripId = Date.now().toString();
            const tripToSave: SavedTrip = {
                id: newTripId,
                inputs: currentInputs,
                itinerary,
            };
            updatedHistory = [tripToSave, ...tripHistory];
            setActiveTripId(newTripId);
            confirmationMessage = "Itinerario salvato nello storico!";
        }

        setTripHistory(updatedHistory);
        localStorage.setItem('motoMentorTripHistory', JSON.stringify(updatedHistory));
        setSavedConfirmation(confirmationMessage);
        setTimeout(() => setSavedConfirmation(null), 3000);
    };

    const handleSaveAndReset = () => {
        if (itinerary) {
            saveItinerary();
            
            setItinerary(null);
            setActiveTripId(null);
            setTripMaintenanceAlerts([]);
            setDeparture('');
            setDestination('');
            setDuration('');
            setTripPeriod('');
            setCustomPrompt('');
            setTripType('itinerary');
            setSelectedTour('Tour della Scozia');
            setRoadPreference('Strade panoramiche e tortuose');
        }
    };

    const loadTripFromHistory = (tripId: string) => {
        const tripToLoad = tripHistory.find(trip => trip.id === tripId);
        if (tripToLoad) {
            const { inputs, itinerary: savedItinerary } = tripToLoad;
            setTripType(inputs.tripType);
            setDuration(inputs.duration);
            setRoadPreference(inputs.roadPreference);
            setTripPeriod(inputs.period || '');
            setCustomPrompt(inputs.customPrompt || '');
            setDeparture(inputs.departure || '');
            if (inputs.tripType === 'tour') {
                setSelectedTour(inputs.selectedTour || 'Tour della Scozia');
                setDestination('');
            } else {
                setDestination(inputs.destination || '');
            }
            setItinerary(savedItinerary);
            setActiveTripId(tripToLoad.id);
            setSavedConfirmation("Itinerario caricato!");
            setTripMaintenanceAlerts([]); // Clear old alerts
            setTimeout(() => setSavedConfirmation(null), 3000);
        }
    };

    const deleteTripFromHistory = (tripId: string) => {
        if (window.confirm("Sei sicuro di voler eliminare questo viaggio dallo storico?")) {
            if (activeTripId === tripId) {
                setItinerary(null);
                setActiveTripId(null);
                setTripMaintenanceAlerts([]);
            }
            setTripHistory(currentHistory => {
                const updatedHistory = currentHistory.filter(trip => trip.id !== tripId);
                localStorage.setItem('motoMentorTripHistory', JSON.stringify(updatedHistory));
                return updatedHistory;
            });
        }
    };

    const exportTripHistory = () => {
        const dataStr = JSON.stringify(tripHistory, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        const exportFileDefaultName = 'motomentor_viaggi.json';
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
    };

    const handleDownloadPdf = () => {
        if (!itinerary) return;
        setIsGeneratingPdf(true);
        setError(null);
        try {
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
            const margin = 15;
            const pageHeight = pdf.internal.pageSize.getHeight();
            const pageWidth = pdf.internal.pageSize.getWidth();
            let y = margin;
    
            const addText = (text: string, size: number, style: 'normal' | 'bold' | 'italic', spacing = 5) => {
                if (y + size / 2 > pageHeight - margin) {
                    pdf.addPage();
                    y = margin;
                }
                pdf.setFontSize(size).setFont('helvetica', style);
                const lines = pdf.splitTextToSize(text, pageWidth - margin * 2);
                pdf.text(lines, margin, y);
                y += (lines.length * size * 0.35) + spacing;
            };
    
            // Title
            addText(itinerary.titolo_viaggio, 22, 'bold', 8);
    
            // Description
            addText(itinerary.descrizione_generale, 11, 'italic', 10);
    
            // Daily program
            itinerary.programma_giornaliero.forEach(day => {
                const dayBlockHeight = 150; // Rough estimation
                if (y + dayBlockHeight > pageHeight - margin) {
                    pdf.addPage();
                    y = margin;
                }

                pdf.setDrawColor(200);

                addText(`Giorno ${day.giorno}: ${day.titolo_tappa}`, 16, 'bold', 4);
                
                const details = `${day.chilometri_tappa} km - Meteo: ${day.previsioni_meteo.condizioni}, ${day.previsioni_meteo.temperatura_min}°/${day.previsioni_meteo.temperatura_max}°C`;
                addText(details, 9, 'italic', 6);
                
                addText(day.descrizione_percorso, 10, 'normal', 6);
                
                addText('Attività e Luoghi di Interesse:', 11, 'bold', 4);
                day.attivita_luoghi_interesse.forEach(activity => {
                    addText(`- ${activity}`, 10, 'normal', 3);
                });
                y += 3;

                addText('Consigli di Guida:', 11, 'bold', 2);
                addText(day.consigli_di_guida, 10, 'normal', 4);
                
                addText('Ristoro:', 11, 'bold', 2);
                addText(day.opzione_ristoro, 10, 'normal', 4);
                
                addText('Alloggio:', 11, 'bold', 2);
                addText(day.alloggio_consigliato, 10, 'normal', 4);
                
                y += 5;
                pdf.line(margin, y, pageWidth - margin, y); // Separator line
                y += 5;
            });
    
            pdf.save(`itinerario-${itinerary.titolo_viaggio.replace(/\s/g, '_')}.pdf`);
        } catch (err) {
            console.error("Errore durante la generazione del PDF:", err);
            setError(err instanceof Error ? err.message : "Impossibile generare il PDF.");
        } finally {
            setIsGeneratingPdf(false);
        }
    };
    
    const handleMechanicSubmit = async (e: FormEvent) => {
        e.preventDefault();
        
        if (mechanicMode === 'maintenance' && tripHistory.length === 0) {
            setError("Per i consigli di manutenzione, devi prima generare e salvare almeno un itinerario nello storico.");
            return;
        }

        // Fix: Use 'mechanicMode' which is relevant to this handler, instead of the main app 'mode'.
        if (mechanicMode !== 'workshop' && !activeVehicle) {
            setError("Per favore, seleziona un veicolo attivo nel tuo Garage.");
            return;
        }

        setLoading(true);
        setError(null);
        setDiagnosis(null);
        setMaintenanceTips(null);

        try {
            if (mechanicMode === 'diagnose') {
                const result = await diagnoseProblem(problemDescription, activeVehicle!.model, activeVehicle!.year, activeVehicle!.kilometers, problemImage || undefined);
                setDiagnosis(result);
            } else if (mechanicMode === 'maintenance') {
                const latestTrip = tripHistory[0];
                const tips = await getMaintenanceTips(activeVehicle!, latestTrip.itinerary, maintenanceLog);
                setMaintenanceTips(tips);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Si è verificato un errore sconosciuto.');
        } finally {
            setLoading(false);
        }
    };
    
    const handleAddMaintenanceRecord = (newRecordData: Omit<MaintenanceRecord, 'id'>) => {
        const newRecord = { ...newRecordData, id: Date.now().toString() };
        const updatedLog = [...maintenanceLog, newRecord].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setMaintenanceLog(updatedLog);
        localStorage.setItem('motoMentorMaintenanceLog', JSON.stringify(updatedLog));
        
        // Auto-update vehicle kilometers if the new record is the highest
        if (activeVehicle && newRecordData.kilometers > parseInt(activeVehicle.kilometers, 10)) {
             const updatedVehicle = { ...activeVehicle, kilometers: newRecordData.kilometers.toString() };
             const updatedVehicles = garageVehicles.map(v => v.id === updatedVehicle.id ? updatedVehicle : v);
             setGarageVehicles(updatedVehicles);
             localStorage.setItem('motoMentorGarage', JSON.stringify(updatedVehicles));
             setActiveVehicle(updatedVehicle);
             setSavedConfirmation(`Chilometraggio aggiornato a ${newRecordData.kilometers.toLocaleString('it-IT')} km!`);
             setTimeout(() => setSavedConfirmation(null), 3000);
        }
    };

    const handleDeleteMaintenanceRecord = (id: string) => {
        if(window.confirm("Sei sicuro di voler eliminare questa registrazione?")) {
            const updatedLog = maintenanceLog.filter(r => r.id !== id);
            setMaintenanceLog(updatedLog);
            localStorage.setItem('motoMentorMaintenanceLog', JSON.stringify(updatedLog));
        }
    };
    
    const handleAddReminder = (newReminderData: Omit<MaintenanceReminder, 'id'>) => {
        const newReminder = { ...newReminderData, id: Date.now().toString() };
        const updatedReminders = [...reminders, newReminder];
        setReminders(updatedReminders);
        localStorage.setItem('motoMentorReminders', JSON.stringify(updatedReminders));
    };

    const handleDeleteReminder = (id: string) => {
        const updatedReminders = reminders.filter(r => r.id !== id);
        setReminders(updatedReminders);
        localStorage.setItem('motoMentorReminders', JSON.stringify(updatedReminders));
    };

    const loadLastItinerary = () => {
        if (tripHistory.length > 0) {
            loadTripFromHistory(tripHistory[0].id);
        }
    };

    const exportDayGpx = (day: Day) => {
        const gpx = `<gpx version="1.1" creator="MotoMentor AI">
<trk>
<name>${day.titolo_tappa}</name>
<trkseg>
${day.tracciato_gpx.map(p => `<trkpt lat="${p.lat}" lon="${p.lon}"></trkpt>`).join('\n')}
</trkseg>
</trk>
</gpx>`;
        const dataStr = 'data:text/xml;charset=utf-8,' + encodeURIComponent(gpx);
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `Giorno_${day.giorno}_${day.titolo_tappa.replace(/\s/g, '_')}.gpx`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    };

    const showFullMap = () => {
        if (!itinerary) return;
        const allPoints = itinerary.programma_giornaliero.flatMap(d => d.tracciato_gpx);
        if (allPoints.length > 0) {
            const firstPoint = allPoints[0];
            const lastPoint = allPoints[allPoints.length -1];
            // Create a route URL with waypoints
            const waypoints = allPoints.slice(1, -1).map(p => `${p.lat},${p.lon}`).join('|');
            const mapUrl = `https://www.google.com/maps/dir/?api=1&origin=${firstPoint.lat},${firstPoint.lon}&destination=${lastPoint.lat},${lastPoint.lon}&waypoints=${waypoints}&travelmode=driving`;
            window.open(mapUrl, '_blank');
        } else {
            alert("Nessun dato GPX da visualizzare sulla mappa.");
        }
    };

    return (
        <div className="bg-gray-900 text-white min-h-screen font-sans">
            <header className="bg-gray-800 shadow-md sticky top-0 z-10">
                <div className="container mx-auto px-4 py-4 flex justify-center items-center">
                    <h1 className="text-3xl font-bold tracking-tight text-white">MotoMentor AI</h1>
                </div>
            </header>

            <main className="container mx-auto p-4 md:p-6">
                <div className="bg-gray-800 rounded-lg shadow-xl overflow-hidden">
                    <div className="flex border-b border-gray-700">
                        <TabButton text="Planner Viaggi" icon={<MapPinIcon className="w-5 h-5"/>} active={mode === AiMode.TripPlanner} onClick={() => setMode(AiMode.TripPlanner)} />
                        <TabButton text="Meccanico Virtuale" icon={<WrenchScrewdriverIcon className="w-5 h-5"/>} active={mode === AiMode.VirtualMechanic} onClick={() => setMode(AiMode.VirtualMechanic)} />
                        <TabButton text="Il Mio Garage" icon={<CogIcon className="w-5 h-5"/>} active={mode === AiMode.Garage} onClick={() => setMode(AiMode.Garage)} />
                    </div>
                    <div className="p-4 md:p-6">
                        {error && <div className="bg-red-500/20 text-red-300 p-3 rounded-md mb-4 animate-fade-in" role="alert">{error}</div>}

                        {mode === AiMode.TripPlanner && (
                            <TripPlanner
                                handleSubmit={handleTripSubmit}
                                departure={departure}
                                setDeparture={setDeparture}
                                destination={destination}
                                setDestination={setDestination}
                                duration={duration}
                                setDuration={setDuration}
                                tripPeriod={tripPeriod}
                                setTripPeriod={setTripPeriod}
                                roadPreference={roadPreference}
                                setRoadPreference={setRoadPreference}
                                customPrompt={customPrompt}
                                setCustomPrompt={setCustomPrompt}
                                itinerary={itinerary}
                                loading={loading}
                                isGeneratingPdf={isGeneratingPdf}
                                saveItinerary={saveItinerary}
                                onSaveAndReset={handleSaveAndReset}
                                loadLastItinerary={loadLastItinerary}
                                downloadPdf={handleDownloadPdf}
                                exportDayGpx={exportDayGpx}
                                showFullMap={showFullMap}
                                savedConfirmation={savedConfirmation}
                                tripType={tripType}
                                setTripType={setTripType}
                                selectedTour={selectedTour}
                                setSelectedTour={setSelectedTour}
                                tripHistory={tripHistory}
                                onLoadFromHistory={loadTripFromHistory}
                                onDeleteFromHistory={deleteTripFromHistory}
                                onExportHistory={exportTripHistory}
                                tripMaintenanceAlerts={tripMaintenanceAlerts}
                            />
                        )}
                        {mode === AiMode.VirtualMechanic && (
                            <VirtualMechanic
                                handleSubmit={handleMechanicSubmit}
                                mode={mechanicMode}
                                setMode={setMechanicMode}
                                problemDescription={problemDescription}
                                setProblemDescription={setProblemDescription}
                                activeVehicle={activeVehicle}
                                setProblemImage={setProblemImage}
                                diagnosis={diagnosis}
                                maintenanceTips={maintenanceTips}
                                loading={loading}
                                maintenanceLog={maintenanceLog}
                                onAddRecord={handleAddMaintenanceRecord}
                                onDeleteRecord={handleDeleteMaintenanceRecord}
                                tripHistory={tripHistory}
                                reminders={reminders}
                                onAddReminder={handleAddReminder}
                                onDeleteReminder={handleDeleteReminder}
                                savedConfirmation={savedConfirmation}
                            />
                        )}
                        {mode === AiMode.Garage && (
                            <Garage
                                vehicles={garageVehicles}
                                activeVehicleId={activeVehicle?.id || null}
                                onAddVehicle={handleAddVehicle}
                                onUpdateVehicle={handleUpdateVehicle}
                                onDeleteVehicle={handleDeleteVehicle}
                                onSetActiveVehicle={handleSetActiveVehicle}
                                savedConfirmation={savedConfirmation}
                            />
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default App;
