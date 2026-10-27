
import React, { useState } from 'react';
import { Day, GpxPoint } from '../../types';
import { ArchiveBoxIcon, GlobeAltIcon, ArrowDownOnSquareIcon, BookOpenIcon, ClockIcon, BellAlertIcon, ShieldCheckIcon, BuildingStorefrontIcon, HomeIcon, ArrowDownTrayIcon, DocumentPlusIcon, MapIcon, QueueListIcon, ArrowsRightLeftIcon, ArrowPathIcon, PhotoIcon, XCircleIcon, ShareIcon, CheckIcon } from '@heroicons/react/24/outline';
import ActionButton from '../../components/ActionButton';
import InputField from '../../components/InputField';
import SelectField from '../../components/SelectField';
import WeatherIcon from '../../components/WeatherIcon';
import InfoBlock from '../../components/InfoBlock';

// Stores
import { useTripStore } from '../../src/store/useTripStore';
import { useUIStore } from '../../src/store/useUIStore';

import TripHistoryModal from './TripHistoryModal';
import { createNavigationSegments, generateGpxFile, generateFullTripGpx, downloadFile } from '../../src/utils/mapsHelpers';
import { useEscapeKey } from '../../src/utils/hooks';
import SegmentNavigator from './SegmentNavigator';
import Tooltip from '../../components/Tooltip';
import { MAX_AI_IMAGES_BYTES, imagesTooLargeMessage } from '../../services/geminiService';

// --- CONSTANTS ---
const MAX_MAP_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB, come promesso dalla UI

const TOURS = [
    "Tour della Scozia", 
    "Avventura in Marocco", 
    "Giro della Penisola Iberica", 
    "Esplorazione della Turchia", 
    "Le strade alpine della Svizzera", 
    "Coste e fiordi della Norvegia", 
    "La Route des Grandes Alpes e le Gole del Verdon", 
    "Auschwitz Il viaggio della memoria",
    "Tour in Normandia"
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
    "Percorso personalizzato",
];


// --- NEW NAVIGATION OPTIONS MODAL ---
const TripMapOptionsModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onQuickView: () => void;
    onDetailedNav: () => void;
    onDownloadGpx: () => void;
}> = ({ isOpen, onClose, onQuickView, onDetailedNav, onDownloadGpx }) => {
    useEscapeKey(onClose, isOpen);
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in" onClick={onClose}>
            <div className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
                <div className="p-6">
                    <div className="flex items-start gap-4">
                        <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-blue-900/50 sm:mx-0 sm:h-10 sm:w-10">
                            <GlobeAltIcon className="h-6 w-6 text-blue-400" aria-hidden="true" />
                        </div>
                        <div className="mt-0 text-left">
                            <h3 className="text-lg leading-6 font-bold text-white" id="modal-title">
                                Opzioni Mappa Viaggio
                            </h3>
                            <p className="text-sm text-gray-400 mt-2">
                                Scegli come visualizzare o esportare il tuo itinerario completo.
                            </p>
                        </div>
                    </div>
                </div>
                <div className="p-6 pt-0 space-y-3">
                    <button onClick={onQuickView} className="w-full text-left p-4 rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors flex items-center gap-4 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 focus:ring-offset-gray-800">
                        <MapIcon className="w-6 h-6 text-cyan-400 flex-shrink-0" />
                        <div>
                            <h4 className="font-bold text-white">Panoramica Veloce</h4>
                            <p className="text-sm text-gray-400">Apri una singola mappa Google con le tappe principali del viaggio.</p>
                        </div>
                    </button>
                    <button onClick={onDetailedNav} className="w-full text-left p-4 rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors flex items-center gap-4 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 focus:ring-offset-gray-800">
                         <QueueListIcon className="w-6 h-6 text-indigo-400 flex-shrink-0" />
                        <div>
                            <h4 className="font-bold text-white">Navigazione Dettagliata</h4>
                            <p className="text-sm text-gray-400">Apri il percorso diviso in segmenti per la navigazione web.</p>
                        </div>
                    </button>
                    <button onClick={onDownloadGpx} className="w-full text-left p-4 rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors flex items-center gap-4 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 focus:ring-offset-gray-800">
                        <ArrowDownTrayIcon className="w-6 h-6 text-teal-400 flex-shrink-0" />
                        <div>
                            <h4 className="font-bold text-white">Scarica File GPX</h4>
                            <p className="text-sm text-gray-400">Esporta il tracciato completo per il tuo navigatore GPS.</p>
                        </div>
                    </button>
                </div>
                <div className="p-4 bg-gray-700/50 flex flex-row-reverse">
                    <ActionButton
                        type="button"
                        className="bg-gray-600 hover:bg-gray-500"
                        onClick={onClose}
                    >
                        Chiudi
                    </ActionButton>
                </div>
            </div>
        </div>
    );
};


const TripPlanner: React.FC = () => {
    const { 
        tripHistory,
        itinerary,
        draft,
        updateDraft,
        generateTrip,
        saveItinerary,
        resetPlanner,
        loadTripFromHistory,
        deleteTrip,
        exportHistory,
        importHistory,
        downloadPdf,
        shareTrip
    } = useTripStore();

    const { 
        isGeneratingItinerary, 
        isGeneratingPdf, 
        notification 
    } = useUIStore();

    const {
        tripType,
        selectedTour,
        departure,
        destination,
        returnPoint,
        duration,
        period,
        roadPreference,
        customRoadPreferenceText,
        customPrompt,
        mapImages,
    } = draft;

    const [imagePreviews, setImagePreviews] = useState<string[]>([]);
    const [isSharing, setIsSharing] = useState(false);
    const [recentShareId, setRecentShareId] = useState<string | null>(null);

    // Sync image previews with draft state
    React.useEffect(() => {
        if (!mapImages || mapImages.length === 0) {
            setImagePreviews([]);
            return;
        }

        let cancelled = false;
        const loadPreviews = async () => {
            const previews = await Promise.all(mapImages.map((file: File) => {
                return new Promise<string>((resolve) => {
                    const reader = new FileReader();
                    reader.onerror = () => resolve('');
                    reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : '');
                    reader.readAsDataURL(file);
                });
            }));
            // Cambi rapidi a mapImages non devono sovrascrivere anteprime più recenti.
            if (!cancelled) setImagePreviews(previews.filter(Boolean));
        };

        loadPreviews();
        return () => { cancelled = true; };
    }, [mapImages]);

    const setDraftValue = (field: string, value: any) => {
        updateDraft({ [field]: value });
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement> | React.DragEvent) => {
        e.preventDefault();
        let files: FileList | null = null;

        if ('files' in e.target && e.target.files) {
            files = e.target.files;
        } else if ('dataTransfer' in e && e.dataTransfer.files) {
            files = e.dataTransfer.files;
        }

        if (files && files.length > 0) {
            const oversized = Array.from(files).filter(file => file.type.startsWith('image/') && file.size > MAX_MAP_IMAGE_SIZE);
            if (oversized.length > 0) {
                useUIStore.getState().showNotification(
                    `${oversized.length} immagini superano i 5MB e sono state ignorate.`,
                    'warning'
                );
            }
            const newFiles = Array.from(files).filter(file => file.type.startsWith('image/') && file.size <= MAX_MAP_IMAGE_SIZE);
            const total = [...mapImages, ...newFiles].reduce((sum, f) => sum + f.size, 0);
            if (total > MAX_AI_IMAGES_BYTES) {
                useUIStore.getState().showNotification(imagesTooLargeMessage(), 'warning');
            } else if (newFiles.length > 0) {
                setDraftValue('mapImages', [...mapImages, ...newFiles]);
            }
        }
        // Azzera l'input: dopo aver rimosso un'immagine deve poter essere riselezionata.
        if ('value' in e.target && e.target instanceof HTMLInputElement) {
            e.target.value = '';
        }
    };

    const removeImage = (index: number) => {
        const updatedImages = [...mapImages];
        updatedImages.splice(index, 1);
        setDraftValue('mapImages', updatedImages);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };
    
    const [showHistory, setShowHistory] = useState(false);
    const [isMapOptionsModalOpen, setIsMapOptionsModalOpen] = useState(false);
    const [mapOptions, setMapOptions] = useState<{ onQuickView: () => void; onDetailedNav: () => void; onDownloadGpx: () => void; } | null>(null);
    const [showSegmentNav, setShowSegmentNav] = useState(false);
    const [selectedDayForNav, setSelectedDayForNav] = useState<Day | null>(null);

    const handleQuickDownloadGpx = (day: Day) => {
        const gpx = generateGpxFile(day);
        downloadFile(
            gpx,
            `Giorno_${day.day}_${day.stageTitle.replace(/\s/g, '_')}.gpx`,
            'application/gpx+xml'
        );
    };
    
    const handleShowDayMap = (day: Day) => {
        const points = day.gpxTrack || [];
        if (points.length < 2) {
            alert('Dati GPS insufficienti per visualizzare la mappa.');
            return;
        }
        const segments = createNavigationSegments(points, { maxWaypointsPerSegment: 9 });
        if (segments.length === 1 && segments[0]) {
            window.open(segments[0].mapUrl, '_blank');
        } else if (segments.length > 1) {
            setSelectedDayForNav(day);
            setShowSegmentNav(true);
        }
    };
    
    const handleShowFullMap = () => {
        if (!itinerary) return;
        const quickViewAction = () => {
             const dailyDestinations = itinerary.dailySchedule
                .map((day: any) => day.gpxTrack?.[day.gpxTrack.length - 1])
                .filter((p: any): p is GpxPoint => !!p);
            if (dailyDestinations.length === 0) { alert("Dati GPS insufficienti."); return; }
            const origin = itinerary.dailySchedule[0]?.gpxTrack?.[0];
            if (!origin) { alert("Punto di partenza non trovato."); return; }
            const destination = dailyDestinations[dailyDestinations.length - 1];
            const intermediateWaypoints = dailyDestinations.slice(0, -1);
            const waypointsStr = intermediateWaypoints.map((p: any) => `${p.lat},${p.lon}`).join('|');
            const url = `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lon}&destination=${destination.lat},${destination.lon}&waypoints=${waypointsStr}&travelmode=driving`;
            window.open(url, '_blank');
        };
        const detailedNavAction = () => {
            const allSegmentsRaw = itinerary.dailySchedule.flatMap((day: any) => {
                const points = day.gpxTrack || [];
                if (points.length < 2) return [];
                return createNavigationSegments(points, { maxWaypointsPerSegment: 9 });
            });
            const allSegments = allSegmentsRaw.map((segment: any, index: number) => ({ ...segment, segmentNumber: index + 1 }));
            if (allSegments.length === 0) { alert("Nessun dato GPS navigabile."); return; }
            if (allSegments.length === 1 && allSegments[0]) {
                window.open(allSegments[0].mapUrl, '_blank');
            } else {
                allSegments.forEach((segment: any, index: number) => {
                    setTimeout(() => window.open(segment.mapUrl, '_blank'), index * 500);
                });
            }
        };
        const downloadGpxAction = () => {
            const gpx = generateFullTripGpx(itinerary.dailySchedule, itinerary.tripTitle);
            downloadFile(gpx, `${itinerary.tripTitle.replace(/\s/g, '_')}_Completo.gpx`, 'application/gpx+xml');
        };
        setMapOptions({
            onQuickView: () => { quickViewAction(); setIsMapOptionsModalOpen(false); },
            onDetailedNav: () => { detailedNavAction(); setIsMapOptionsModalOpen(false); },
            onDownloadGpx: () => { downloadGpxAction(); setIsMapOptionsModalOpen(false); },
        });
        setIsMapOptionsModalOpen(true);
    };

    const handleTripSubmitLocal = (e: React.FormEvent) => {
        e.preventDefault();
        generateTrip();
    };

    const handleShare = async () => {
        setIsSharing(true);
        const id = await shareTrip();
        if (id) {
            setRecentShareId(id);
        }
        setIsSharing(false);
    };

    return (
        <div>
            {mapOptions && (
                <TripMapOptionsModal
                    isOpen={isMapOptionsModalOpen}
                    onClose={() => setIsMapOptionsModalOpen(false)}
                    onQuickView={mapOptions.onQuickView}
                    onDetailedNav={mapOptions.onDetailedNav}
                    onDownloadGpx={mapOptions.onDownloadGpx}
                />
            )}
            <TripHistoryModal 
                show={showHistory} 
                onClose={() => setShowHistory(false)} 
                history={tripHistory} 
                onLoad={loadTripFromHistory} 
                onDelete={deleteTrip} 
                onExport={exportHistory} 
                onImport={importHistory}
            />
            {showSegmentNav && selectedDayForNav && (
                <SegmentNavigator
                    day={selectedDayForNav}
                    onClose={() => { setShowSegmentNav(false); setSelectedDayForNav(null); }}
                />
            )}

            <div className="flex justify-center bg-gray-700 rounded-full p-1 mb-6 max-w-sm mx-auto">
                <button type="button" onClick={() => setDraftValue('tripType', 'itinerary')} className={`px-4 py-1.5 w-1/2 rounded-full text-sm font-semibold transition ${tripType === 'itinerary' ? 'bg-blue-600 text-white' : 'text-gray-300'}`}>Itinerario A/R</button>
                <button type="button" onClick={() => setDraftValue('tripType', 'tour')} className={`px-4 py-1.5 w-1/2 rounded-full text-sm font-semibold transition ${tripType === 'tour' ? 'bg-blue-600 text-white' : 'text-gray-300'}`}>Tour</button>
            </div>

            <form onSubmit={handleTripSubmitLocal} className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {tripType === 'itinerary' ? (
                    <>
                        <InputField id="departure" label="Luogo di Partenza" value={departure} onChange={(e) => setDraftValue('departure', e.target.value)} placeholder="Es. Milano" required />
                        <InputField id="destination" label="Destinazione / Giro di Boa" value={destination} onChange={(e) => setDraftValue('destination', e.target.value)} placeholder="Es. Costiera Amalfitana" required />
                        <InputField id="returnPoint" label="Luogo di Ritorno" value={returnPoint} onChange={(e) => setDraftValue('returnPoint', e.target.value)} placeholder="Es. Milano (stesso punto o altro)" required />
                    </>
                ) : (
                    <>
                        <InputField id="departure" label="Il tuo Luogo di Partenza" value={departure} onChange={(e) => setDraftValue('departure', e.target.value)} placeholder="Es. Milano" required />
                        <SelectField id="tour" label="Scegli un Tour" value={selectedTour} onChange={(e) => setDraftValue('selectedTour', e.target.value)}>
                            <option value="" disabled>Es. Tour della Scozia</option>
                            {TOURS.map(tour => <option key={tour} value={tour}>{tour}</option>)}
                        </SelectField>
                    </>
                )}
                <InputField id="duration" label="Durata (giorni)" value={duration} onChange={(e) => setDraftValue('duration', e.target.value)} placeholder="Es. 7" required />
                <InputField id="period" label="Periodo del Viaggio" value={period} onChange={(e) => setDraftValue('period', e.target.value)} placeholder="Es. Metà Luglio" required />
                <div className="md:col-span-2">
                    <SelectField id="roadPreference" label="Tipo di Strade Preferite" value={roadPreference} onChange={(e) => setDraftValue('roadPreference', e.target.value)}>
                        <option value="" disabled>Es. Strade panoramiche e tortuose</option>
                        {ROAD_PREFERENCES.map(pref => <option key={pref} value={pref}>{pref}</option>)}
                    </SelectField>
                </div>
                {roadPreference === 'Percorso personalizzato' && (
                    <div className="md:col-span-2 animate-fade-in">
                        <label htmlFor="customRoadPreferenceText" className="block text-sm font-medium text-gray-300">Descrivi il tuo percorso ideale</label>
                        <div className="mt-1">
                            <textarea
                                id="customRoadPreferenceText"
                                value={customRoadPreferenceText}
                                onChange={(e) => setDraftValue('customRoadPreferenceText', e.target.value)}
                                rows={2}
                                placeholder="Es. 'Voglio strade con molte curve ma con un buon asfalto...'"
                                className="block w-full px-3 py-2 text-white bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                required
                            />
                        </div>
                    </div>
                )}
                 <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                        Screenshot Google Maps (opzionale)
                        <Tooltip text="Carica uno o più screenshot di percorsi da Google Maps per farli analizzare all'IA">
                            <span className="ml-2 text-xs text-blue-400 cursor-help underline">Come funziona?</span>
                        </Tooltip>
                    </label>
                    <div className="space-y-4">
                        <label 
                            className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-600 border-dashed rounded-lg cursor-pointer bg-gray-700/50 hover:bg-gray-700 transition-colors"
                            onDragOver={handleDragOver}
                            onDrop={handleImageChange}
                        >
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                <PhotoIcon className="w-8 h-8 mb-3 text-gray-400" />
                                <p className="mb-2 text-sm text-gray-400"><span className="font-semibold">Clicca per caricare</span> o trascina più immagini</p>
                                <p className="text-xs text-gray-500">PNG, JPG o WEBP (MAX. 5MB ciascuna)</p>
                            </div>
                            <input type="file" className="hidden" accept="image/*" multiple onChange={handleImageChange} />
                        </label>

                        {imagePreviews.length > 0 && (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                                {imagePreviews.map((preview, index) => (
                                    <div key={index} className="relative aspect-video rounded-lg overflow-hidden border-2 border-blue-500/50 group">
                                        <img src={preview} alt={`Preview Mappa ${index + 1}`} className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <button 
                                                type="button"
                                                onClick={() => removeImage(index)}
                                                className="p-1.5 bg-red-600 rounded-full text-white hover:bg-red-700 transition-colors"
                                            >
                                                <XCircleIcon className="w-5 h-5" />
                                            </button>
                                        </div>
                                        <div className="absolute bottom-1 left-1 bg-blue-600 text-white text-[8px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                                            Mappa {index + 1}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="md:col-span-2">
                    <label htmlFor="customPrompt" className="block text-sm font-medium text-gray-300">Richieste Specifiche (opzionale)</label>
                    <div className="mt-1">
                        <textarea
                            id="customPrompt"
                            value={customPrompt}
                            onChange={(e) => setDraftValue('customPrompt', e.target.value)}
                            rows={3}
                            placeholder="Es. 'Includi una sosta alle terme di Bormio'..."
                            className="block w-full px-3 py-2 text-white bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        />
                    </div>
                </div>
                <div className="md:col-span-2 flex flex-wrap gap-4">
                    <Tooltip text="Genera un nuovo itinerario in base ai parametri inseriti">
                        <ActionButton type="submit" loading={isGeneratingItinerary} loadingText="Generazione...">Crea Itinerario</ActionButton>
                    </Tooltip>
                    <Tooltip text="Pulisce tutti i campi e l'itinerario corrente per iniziare una nuova pianificazione">
                        <ActionButton onClick={resetPlanner} disabled={isGeneratingItinerary} className="bg-gray-700 hover:bg-gray-600">
                            <ArrowPathIcon className="w-5 h-5"/> Nuovo
                        </ActionButton>
                    </Tooltip>
                    <Tooltip text="Visualizza, carica o elimina i viaggi salvati in precedenza">
                        <ActionButton onClick={() => setShowHistory(true)} disabled={isGeneratingItinerary} className="bg-gray-600 hover:bg-gray-500">
                            <BookOpenIcon className="w-5 h-5"/>Storico Viaggi
                        </ActionButton>
                    </Tooltip>
                </div>
            </form>
            
            {isGeneratingItinerary && (
                <div className="mt-6 bg-gray-700/50 p-4 rounded-lg text-center animate-pulse" aria-live="polite">
                    <p className="font-semibold text-white">L'IA sta generando il tuo itinerario personalizzato...</p>
                    <p className="text-gray-400 text-sm mt-1">Questa operazione potrebbe richiedere alcuni istanti.</p>
                </div>
            )}
            
            {itinerary && !isGeneratingItinerary && (
                <div className="mt-6 animate-fade-in">
                    {recentShareId && (
                        <div className="mb-6 bg-green-500/10 border border-green-500/30 p-4 rounded-2xl animate-bounce-subtle flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="bg-green-500 p-2 rounded-full">
                                    <CheckIcon className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <p className="text-green-400 font-bold">Viaggio esportato!</p>
                                    <p className="text-green-500/70 text-xs">File .mmt.json salvato: condividilo e apribile con "File → Apri viaggio condiviso…".</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setRecentShareId(null)}
                                className="text-white hover:text-green-400 transition-colors"
                            >
                                Chiudi
                            </button>
                        </div>
                    )}
                    <div id="itinerary-content">
                        <div className="flex justify-between items-start mb-4 flex-wrap gap-2">
                            <div className="flex-1">
                                <h2 className="text-2xl font-bold text-white">{itinerary.tripTitle}</h2>
                                <p className="text-gray-400 mt-1">{itinerary.generalDescription}</p>
                            </div>
                            <div className="flex gap-2 items-center flex-wrap self-start">
                                {notification?.message?.toLowerCase().includes('salvato') && <span className="text-green-400 text-sm animate-pulse mr-2">{notification.message}</span>}
                                <Tooltip text="Esporta questo itinerario come file .mmt.json da condividere (niente link cloud)">
                                    <ActionButton onClick={handleShare} loading={isSharing} className="bg-purple-600 hover:bg-purple-500">
                                        <ShareIcon className="w-5 h-5"/> Condividi
                                    </ActionButton>
                                </Tooltip>
                                <Tooltip text="Salva le modifiche all'itinerario corrente o aggiungilo allo storico">
                                    <ActionButton onClick={saveItinerary}><ArchiveBoxIcon className="w-5 h-5"/> Salva</ActionButton>
                                </Tooltip>
                                <Tooltip text="Esporta l'itinerario in un file PDF stampabile">
                                    <ActionButton onClick={downloadPdf} loading={isGeneratingPdf} loadingText="Creando..." className="bg-teal-600 hover:bg-teal-500">
                                        <ArrowDownTrayIcon className="w-5 h-5"/> Scarica PDF
                                    </ActionButton>
                                </Tooltip>
                                <Tooltip text="Visualizza la mappa dell'intero viaggio o scarica il file GPX">
                                    <ActionButton onClick={handleShowFullMap} className="bg-green-600 hover:bg-green-500"><GlobeAltIcon className="w-5 h-5"/> Mappa Viaggio</ActionButton>
                                </Tooltip>
                            </div>
                        </div>
                        <div className="space-y-4">
                            {itinerary.dailySchedule.map((day: any, index: number) => (
                                <div key={index} className={`day-container ${index % 2 === 0 ? 'bg-gray-700/50' : 'bg-gray-600/50'} p-4 rounded-lg`}>
                                    <div className="flex justify-between items-start">
                                        <h3 className="text-xl font-semibold text-blue-400">Giorno {day.day}: {day.stageTitle}</h3>
                                        <div className="flex gap-2">
                                            <Tooltip text="Apri la mappa di questa tappa in Google Maps">
                                                <ActionButton onClick={() => handleShowDayMap(day)} className="bg-gray-600 hover:bg-gray-500 text-xs py-1 px-2"><GlobeAltIcon className="w-4 h-4"/> Mappa Tappa</ActionButton>
                                            </Tooltip>
                                            <Tooltip text="Scarica il file GPX di questa tappa">
                                                <ActionButton onClick={() => handleQuickDownloadGpx(day)} className="bg-gray-600 hover:bg-gray-500 text-xs py-1 px-2"><ArrowDownOnSquareIcon className="w-4 h-4"/> GPX</ActionButton>
                                            </Tooltip>
                                        </div>
                                    </div>
                                    <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-sm font-medium text-gray-400 my-2">
                                        <span>{day.stageKilometers} km stimati</span>
                                        {day.weatherForecast && (
                                            <div className="flex items-center gap-1.5 border-l border-gray-600 pl-4">
                                                <WeatherIcon iconName={day.weatherForecast.icon} />
                                                <span>{day.weatherForecast.temperatureMin}° / {day.weatherForecast.temperatureMax}°C</span>
                                                <span className="hidden sm:inline">- {day.weatherForecast.conditions}</span>
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-gray-300 my-2">{day.routeDescription}</p>
                                    <h4 className="font-semibold text-gray-300 mt-3">Attività e Luoghi di Interesse:</h4>
                                    <ul className="list-disc list-inside text-gray-400 space-y-1 mt-1">
                                        {day.activities.map((activity: any, i: number) => <li key={i}>{activity}</li>)}
                                    </ul>
                                    <div className="mt-4 pt-4 border-t border-gray-600/50 space-y-2">
                                        <InfoBlock icon={ArrowsRightLeftIcon} title="Suggerimento Alternativo" content={day.alternativeRouteSuggestion} />
                                        <InfoBlock icon={ShieldCheckIcon} title="Consigli di Guida" content={day.drivingTips} />
                                        <InfoBlock icon={BuildingStorefrontIcon} title="Opzione Ristoro" content={day.restaurantOption} />
                                        <InfoBlock icon={HomeIcon} title="Alloggio Consigliato" content={day.accommodation} />
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
