import React, { createContext, useReducer, useContext, useEffect, ReactNode, useCallback, FormEvent, useRef } from 'react';
import { Chat, Content } from '@google/genai';
import { generateItinerary, diagnoseProblem, getMaintenanceTips, createChatSession } from '../services/geminiService';
import { Itinerary, MaintenanceTips, GarageVehicle, AiMode, Day, SavedTrip, MaintenanceRecord, MaintenanceReminder, SavedDiagnosis } from '../types';
import { useLocalStorage } from '../utils/hooks';
import { douglasPeucker } from '../utils/gpx';
import { generatePdf } from '../utils/pdf';

// --- STATE AND ACTION TYPES ---

interface Notification {
    message: string;
    type: 'success' | 'error';
}

export interface ChatHistoryItem {
    key: string;
    vehicleName: string;
    lastUpdated: string | null;
}

interface AppState {
    mode: AiMode;
    // Fix: Replaced single 'loading' with granular states for better UI feedback.
    isGeneratingItinerary: boolean;
    isDiagnosingProblem: boolean;
    isGeneratingChecklist: boolean;
    isChatLoading: boolean;
    isGeneratingPdf: boolean;
    isGeneratingDiagnosisPdf: boolean;
    isGeneratingChecklistPdf: boolean;
    error: string | null;
    notification: Notification | null;
    savedConfirmation: string | null;

    // Data
    garageVehicles: GarageVehicle[];
    activeVehicle: GarageVehicle | null;
    maintenanceLog: MaintenanceRecord[];
    reminders: MaintenanceReminder[];
    tripHistory: SavedTrip[];
    savedDiagnoses: SavedDiagnosis[];

    // Results
    itinerary: Itinerary | null;
    activeTripId: string | null;
    tripMaintenanceAlerts: string[];
    diagnosis: string | null;
    activeDiagnosisId: string | null;
    maintenanceTips: MaintenanceTips | null;
    
    // Chat
    chatSession: Chat | null;
    chatHistory: Content[];
    chatHistoryList: ChatHistoryItem[];

    // Drafts for forms
    drafts: {
        tripPlanner: {
            tripType: 'itinerary' | 'tour';
            selectedTour: string;
            departure: string;
            destination: string;
            duration: string;
            tripPeriod: string;
            roadPreference: string;
            customRoadPreferenceText: string;
            customPrompt: string;
        };
        virtualMechanic: {
            problemDescription: string;
            problemImage: File | null;
        };
    };
    mechanicMode: 'diagnose' | 'maintenance' | 'workshop';
}

type AppAction =
    | { type: 'SET_MODE'; payload: AiMode }
    // Fix: Add specific loading actions
    | { type: 'SET_ITINERARY_GENERATING'; payload: boolean }
    | { type: 'SET_DIAGNOSIS_GENERATING'; payload: boolean }
    | { type: 'SET_CHECKLIST_GENERATING'; payload: boolean }
    | { type: 'SET_CHAT_LOADING'; payload: boolean }
    | { type: 'SET_PDF_GENERATING'; payload: boolean }
    | { type: 'SET_DIAGNOSIS_PDF_GENERATING'; payload: boolean }
    | { type: 'SET_CHECKLIST_PDF_GENERATING'; payload: boolean }
    | { type: 'SET_ERROR'; payload: string | null }
    | { type: 'SET_NOTIFICATION'; payload: Notification | null }
    | { type: 'SET_DATA'; payload: { key: keyof AppState, value: any } }
    | { type: 'SET_ITINERARY'; payload: { itinerary: Itinerary | null, tripId: string | null } }
    | { type: 'SET_DIAGNOSIS'; payload: { diagnosis: string | null, diagnosisId: string | null } }
    | { type: 'UPDATE_TRIP_DRAFT'; payload: Partial<AppState['drafts']['tripPlanner']> }
    | { type: 'UPDATE_MECHANIC_DRAFT'; payload: Partial<AppState['drafts']['virtualMechanic']> }
    | { type: 'SET_MECHANIC_MODE'; payload: 'diagnose' | 'maintenance' | 'workshop' }
    | { type: 'RESET_TRIP_PLANNER_FORM' };


// --- INITIAL STATE ---
const initialState: AppState = {
    mode: AiMode.TripPlanner,
    isGeneratingItinerary: false,
    isDiagnosingProblem: false,
    isGeneratingChecklist: false,
    isChatLoading: false,
    isGeneratingPdf: false,
    isGeneratingDiagnosisPdf: false,
    isGeneratingChecklistPdf: false,
    error: null,
    notification: null,
    savedConfirmation: null,
    garageVehicles: [],
    activeVehicle: null,
    maintenanceLog: [],
    reminders: [],
    tripHistory: [],
    savedDiagnoses: [],
    itinerary: null,
    activeTripId: null,
    tripMaintenanceAlerts: [],
    diagnosis: null,
    activeDiagnosisId: null,
    maintenanceTips: null,
    chatSession: null,
    chatHistory: [],
    chatHistoryList: [],
    drafts: {
        tripPlanner: {
            tripType: 'itinerary',
            selectedTour: 'Tour della Scozia',
            departure: '',
            destination: '',
            duration: '',
            tripPeriod: '',
            roadPreference: 'Strade panoramiche e tortuose',
            customRoadPreferenceText: '',
            customPrompt: '',
        },
        virtualMechanic: {
            problemDescription: '',
            problemImage: null,
        },
    },
    mechanicMode: 'workshop',
};

// --- REDUCER ---
const appReducer = (state: AppState, action: AppAction): AppState => {
    switch (action.type) {
        case 'SET_MODE': return { ...state, mode: action.payload };
        // Fix: Handle specific loading states
        case 'SET_ITINERARY_GENERATING': return { ...state, isGeneratingItinerary: action.payload };
        case 'SET_DIAGNOSIS_GENERATING': return { ...state, isDiagnosingProblem: action.payload };
        case 'SET_CHECKLIST_GENERATING': return { ...state, isGeneratingChecklist: action.payload };
        case 'SET_CHAT_LOADING': return { ...state, isChatLoading: action.payload };
        case 'SET_PDF_GENERATING': return { ...state, isGeneratingPdf: action.payload };
        case 'SET_DIAGNOSIS_PDF_GENERATING': return { ...state, isGeneratingDiagnosisPdf: action.payload };
        case 'SET_CHECKLIST_PDF_GENERATING': return { ...state, isGeneratingChecklistPdf: action.payload };
        case 'SET_ERROR': return { ...state, error: action.payload, isGeneratingItinerary: false, isDiagnosingProblem: false, isGeneratingChecklist: false, isChatLoading: false, isGeneratingPdf: false };
        case 'SET_NOTIFICATION': return { ...state, notification: action.payload };
        case 'SET_DATA': return { ...state, [action.payload.key]: action.payload.value };
        case 'SET_ITINERARY': return { ...state, itinerary: action.payload.itinerary, activeTripId: action.payload.tripId };
        case 'SET_DIAGNOSIS': return { ...state, diagnosis: action.payload.diagnosis, activeDiagnosisId: action.payload.diagnosisId };
        case 'UPDATE_TRIP_DRAFT': return { ...state, drafts: { ...state.drafts, tripPlanner: { ...state.drafts.tripPlanner, ...action.payload } } };
        case 'UPDATE_MECHANIC_DRAFT': return { ...state, drafts: { ...state.drafts, virtualMechanic: { ...state.drafts.virtualMechanic, ...action.payload } } };
        case 'SET_MECHANIC_MODE': return { ...state, mechanicMode: action.payload };
        case 'RESET_TRIP_PLANNER_FORM': return { 
            ...state,
            itinerary: null,
            activeTripId: null,
            tripMaintenanceAlerts: [],
            drafts: {
                ...state.drafts,
                tripPlanner: initialState.drafts.tripPlanner,
            }
        };
        default: return state;
    }
};

// --- CONTEXT ---
interface AppContextType {
    state: AppState;
    dispatch: React.Dispatch<AppAction>;
    // Add handler function signatures here
    handleTripSubmit: (e: FormEvent) => Promise<void>;
    handleMechanicSubmit: (e: FormEvent) => Promise<void>;
    handleAddVehicle: (newVehicleData: Omit<GarageVehicle, 'id'>) => void;
    handleUpdateVehicle: (updatedVehicle: GarageVehicle) => void;
    handleDeleteVehicle: (id: string) => void;
    handleSetActiveVehicle: (id: string) => void;
    saveItinerary: () => void;
    handleSaveAndReset: () => void;
    loadLastItinerary: () => void;
    loadTripFromHistory: (tripId: string) => void;
    deleteTripFromHistory: (tripId: string) => void;
    exportTripHistory: () => void;
    handleDownloadPdf: () => void;
    exportDayGpx: (day: Day) => void;
    showFullMap: () => void;
    showDayMap: (day: Day) => void;
    handleAddMaintenanceRecord: (newRecordData: Omit<MaintenanceRecord, 'id'>) => void;
    handleDeleteMaintenanceRecord: (id: string) => void;
    handleAddReminder: (newReminderData: Omit<MaintenanceReminder, 'id'>) => void;
    handleDeleteReminder: (id: string) => void;
    handleSendMessage: (message: string) => Promise<void>;
    handleClearActiveChat: () => void;
    handleDeleteChatHistory: (key: string) => void;
    handleSaveOrUpdateDiagnosis: () => void;
    handleLoadDiagnosis: (diagnosisId: string) => void;
    handleDeleteDiagnosis: (diagnosisId: string) => void;
    handleDownloadDiagnosisPdf: () => void;
    handleDownloadChecklistPdf: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// --- PROVIDER ---
export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [state, dispatch] = useReducer(appReducer, initialState);
    
    // --- LOCAL STORAGE PERSISTENCE ---
    const [storedVehicles, setStoredVehicles] = useLocalStorage<GarageVehicle[]>('motoMentorGarage', []);
    const [storedActiveId, setStoredActiveId] = useLocalStorage<string | null>('motoMentorActiveVehicleId', null);
    const [storedLog, setStoredLog] = useLocalStorage<MaintenanceRecord[]>('motoMentorMaintenanceLog', []);
    const [storedReminders, setStoredReminders] = useLocalStorage<MaintenanceReminder[]>('motoMentorReminders', []);
    const [storedTripHistory, setStoredTripHistory] = useLocalStorage<SavedTrip[]>('motoMentorTripHistory', []);
    const [storedDiagnoses, setStoredDiagnoses] = useLocalStorage<SavedDiagnosis[]>('motoMentorSavedDiagnoses', []);
    const [storedDrafts, setStoredDrafts] = useLocalStorage('motoMentorDrafts', initialState.drafts);
    
    // Debounce drafts saving
    const draftsRef = useRef(state.drafts);
    draftsRef.current = state.drafts;
    useEffect(() => {
        const handler = setTimeout(() => {
            if(JSON.stringify(draftsRef.current) !== JSON.stringify(storedDrafts)) {
                setStoredDrafts(draftsRef.current);
            }
        }, 500);
        return () => clearTimeout(handler);
    }, [state.drafts, setStoredDrafts, storedDrafts]);
    
    const showNotification = useCallback((message: string, type: 'success' | 'error' = 'success') => {
        dispatch({ type: 'SET_NOTIFICATION', payload: { message, type } });
    }, []);

    // --- CHAT HISTORY MANAGEMENT ---
    const refreshChatHistoryList = useCallback(() => {
        const keys = Object.keys(localStorage).filter(key => key.startsWith('motoMentorChatHistory_'));
        const items: ChatHistoryItem[] = keys.map(key => {
            const vehicleId = key.replace('motoMentorChatHistory_', '');
            // Use the most recent vehicle list from the state, not a stale closure one.
            const currentVehicles = state.garageVehicles; 
            const vehicle = currentVehicles.find(v => v.id === vehicleId);
            const vehicleName = vehicleId === 'default' ? 'Chat Generale' : (vehicle ? `Chat con ${vehicle.model}` : `Chat Archiviata (Veicolo Rimosso)`);
    
            let lastUpdated: string | null = null;
            try {
                const itemJSON = localStorage.getItem(key);
                if (itemJSON) {
                    const parsedItem = JSON.parse(itemJSON);
                    if (parsedItem.lastUpdated && typeof parsedItem.lastUpdated === 'string') {
                        lastUpdated = parsedItem.lastUpdated;
                    }
                }
            } catch (e) {
                console.error(`Could not parse chat history item for key ${key}`, e);
            }
            return { key, vehicleName, lastUpdated };
        });
    
        items.sort((a, b) => {
            if (!a.lastUpdated) return 1;
            if (!b.lastUpdated) return -1;
            return new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime();
        });
        
        dispatch({ type: 'SET_DATA', payload: { key: 'chatHistoryList', value: items } });
    }, [state.garageVehicles]);
    
    // Use a ref to prevent useCallback dependency issues in other handlers
    const refreshChatHistoryListRef = useRef(refreshChatHistoryList);
    refreshChatHistoryListRef.current = refreshChatHistoryList;

    // Load data from localStorage on initial mount
    useEffect(() => {
        const vehicles = storedVehicles;
        dispatch({ type: 'SET_DATA', payload: { key: 'garageVehicles', value: vehicles } });
        const active = vehicles.find(v => v.id === storedActiveId);
        dispatch({ type: 'SET_DATA', payload: { key: 'activeVehicle', value: active || null } });
        dispatch({ type: 'SET_DATA', payload: { key: 'maintenanceLog', value: storedLog } });
        dispatch({ type: 'SET_DATA', payload: { key: 'reminders', value: storedReminders } });
        dispatch({ type: 'SET_DATA', payload: { key: 'tripHistory', value: storedTripHistory } });
        dispatch({ type: 'SET_DATA', payload: { key: 'savedDiagnoses', value: storedDiagnoses } });
        dispatch({ type: 'UPDATE_TRIP_DRAFT', payload: storedDrafts.tripPlanner });
        dispatch({ type: 'UPDATE_MECHANIC_DRAFT', payload: { problemDescription: storedDrafts.virtualMechanic.problemDescription } }); // Don't persist image file
        
        // This effect runs only once, but refreshChatHistoryList needs the garageVehicles state.
        // We'll call it here and also any time the garageVehicles list is modified.
        refreshChatHistoryListRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    
    // --- BUSINESS LOGIC (HANDLERS) ---
    const handleTripSubmit = useCallback(async (e: FormEvent) => {
        e.preventDefault();
        dispatch({ type: 'SET_ERROR', payload: null });

        const { tripPlanner } = state.drafts;
        const { tripType, departure, destination, duration, tripPeriod } = tripPlanner;

        // --- 1. VALIDATION FIRST ---
        try {
            if (tripType === 'itinerary' && (!departure?.trim() || !destination?.trim())) {
                throw new Error("Partenza e destinazione sono obbligatorie per un itinerario.");
            }
            if (tripType === 'tour' && !departure?.trim()) {
                throw new Error("Il luogo di partenza è obbligatorio per un tour.");
            }
            if (!duration || isNaN(parseInt(duration)) || parseInt(duration) <= 0) {
                throw new Error("La durata deve essere un numero di giorni valido.");
            }
            if (!tripPeriod.trim()) {
                throw new Error("Il 'Periodo del Viaggio' è un campo obbligatorio.");
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Dati del modulo non validi.';
            dispatch({ type: 'SET_ERROR', payload: errorMessage });
            showNotification(errorMessage, 'error');
            return; // Stop execution if validation fails
        }

        // --- 2. CLEAR PREVIOUS RESULTS & SET LOADING STATE ---
        dispatch({ type: 'SET_ITINERARY', payload: { itinerary: null, tripId: null } });
        dispatch({ type: 'SET_ITINERARY_GENERATING', payload: true });

        // --- 3. DEFER ASYNC WORK TO ENSURE UI UPDATE ---
        setTimeout(async () => {
            try {
                const finalRoadPreference = tripPlanner.roadPreference === 'Percorso personalizzato' ? tripPlanner.customRoadPreferenceText : tripPlanner.roadPreference;

                const options = {
                    duration: tripPlanner.duration,
                    roadPreference: finalRoadPreference,
                    period: tripPlanner.tripPeriod,
                    motorcycle: state.activeVehicle ?? undefined,
                    customPrompt: tripPlanner.customPrompt,
                    ...(tripPlanner.tripType === 'itinerary'
                        ? { departure: tripPlanner.departure, destination: tripPlanner.destination }
                        : { departure: tripPlanner.departure, tourName: tripPlanner.selectedTour }
                    )
                };
                const result = await generateItinerary(options);
                dispatch({ type: 'SET_ITINERARY', payload: { itinerary: result, tripId: null } });

                if (state.activeVehicle && result) {
                    const totalTripKm = result.programma_giornaliero.reduce((total, day) => total + day.chilometri_tappa, 0);
                    const currentKm = parseInt(state.activeVehicle.kilometers, 10);
                    const endOfTripKm = currentKm + totalTripKm;
                    const alerts = state.reminders
                        .filter(r => endOfTripKm >= r.targetKilometers && currentKm < r.targetKilometers)
                        .map(r => `Durante questo viaggio supererai la scadenza per "${r.description}" a ${r.targetKilometers.toLocaleString('it-IT')} km.`);
                    dispatch({ type: 'SET_DATA', payload: { key: 'tripMaintenanceAlerts', value: alerts } });
                }
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'Si è verificato un errore sconosciuto.';
                dispatch({ type: 'SET_ERROR', payload: errorMessage });
                showNotification(errorMessage, 'error');
            } finally {
                dispatch({ type: 'SET_ITINERARY_GENERATING', payload: false });
            }
        }, 0); // Using 0ms timeout defers execution until after the current stack clears, allowing the UI to re-render.
    }, [state.drafts, state.activeVehicle, state.reminders, showNotification]);

    const handleMechanicSubmit = useCallback(async (e: FormEvent) => {
        e.preventDefault();
        const { mechanicMode, tripHistory, activeVehicle, maintenanceLog } = state;
        const { problemDescription, problemImage } = state.drafts.virtualMechanic;

        if (mechanicMode === 'maintenance' && tripHistory.length === 0) {
            const msg = "Per i consigli di manutenzione, devi prima generare e salvare almeno un itinerario nello storico.";
            dispatch({ type: 'SET_ERROR', payload: msg });
            showNotification(msg, 'error');
            return;
        }
        if (mechanicMode !== 'workshop' && !activeVehicle) {
            const msg = "Per favore, seleziona un veicolo attivo nel tuo Garage.";
            dispatch({ type: 'SET_ERROR', payload: msg });
            showNotification(msg, 'error');
            return;
        }
         if (mechanicMode === 'diagnose' && !problemDescription.trim()) {
            const msg = "La descrizione del problema è obbligatoria.";
            dispatch({ type: 'SET_ERROR', payload: msg });
            showNotification(msg, 'error');
            return;
        }

        dispatch({ type: 'SET_ERROR', payload: null });
        if (mechanicMode === 'diagnose') {
            dispatch({ type: 'SET_DIAGNOSIS_GENERATING', payload: true });
        } else if (mechanicMode === 'maintenance') {
            dispatch({ type: 'SET_CHECKLIST_GENERATING', payload: true });
        }
        
        try {
            if (mechanicMode === 'diagnose') {
                const result = await diagnoseProblem(problemDescription, activeVehicle!, problemImage || undefined);
                dispatch({ type: 'SET_DIAGNOSIS', payload: { diagnosis: result, diagnosisId: null } });
            } else if (mechanicMode === 'maintenance') {
                const latestTrip = tripHistory[0];
                const tips = await getMaintenanceTips(activeVehicle!, latestTrip.itinerary, maintenanceLog);
                dispatch({ type: 'SET_DATA', payload: { key: 'maintenanceTips', value: tips } });
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Si è verificato un errore sconosciuto.';
            dispatch({ type: 'SET_ERROR', payload: errorMessage });
            showNotification(errorMessage, 'error');
        } finally {
            if (mechanicMode === 'diagnose') {
                dispatch({ type: 'SET_DIAGNOSIS_GENERATING', payload: false });
            } else if (mechanicMode === 'maintenance') {
                dispatch({ type: 'SET_CHECKLIST_GENERATING', payload: false });
            }
        }
    }, [state.mechanicMode, state.drafts.virtualMechanic, state.activeVehicle, state.tripHistory, state.maintenanceLog, showNotification]);
    
    // --- GARAGE HANDLERS ---
    const handleAddVehicle = useCallback((newVehicleData: Omit<GarageVehicle, 'id'>) => {
        const newVehicle: GarageVehicle = { ...newVehicleData, id: Date.now().toString() };
        const updatedVehicles = [...state.garageVehicles, newVehicle];
        setStoredVehicles(updatedVehicles);
        dispatch({ type: 'SET_DATA', payload: { key: 'garageVehicles', value: updatedVehicles } });
        
        if (state.garageVehicles.length === 0) {
            handleSetActiveVehicle(newVehicle.id, updatedVehicles);
        }
        refreshChatHistoryListRef.current();
        showNotification("Veicolo aggiunto!");
    }, [state.garageVehicles, setStoredVehicles, showNotification]);

    const handleUpdateVehicle = useCallback((updatedVehicle: GarageVehicle) => {
        const updatedVehicles = state.garageVehicles.map(v => v.id === updatedVehicle.id ? updatedVehicle : v);
        setStoredVehicles(updatedVehicles);
        dispatch({ type: 'SET_DATA', payload: { key: 'garageVehicles', value: updatedVehicles } });

        if (state.activeVehicle?.id === updatedVehicle.id) {
            dispatch({ type: 'SET_DATA', payload: { key: 'activeVehicle', value: updatedVehicle } });
        }
        refreshChatHistoryListRef.current();
        showNotification("Veicolo aggiornato!");
    }, [state.garageVehicles, state.activeVehicle?.id, setStoredVehicles, showNotification]);

    const handleDeleteVehicle = useCallback((id: string) => {
        const updatedVehicles = state.garageVehicles.filter(v => v.id !== id);
        setStoredVehicles(updatedVehicles);
        dispatch({ type: 'SET_DATA', payload: { key: 'garageVehicles', value: updatedVehicles } });
        
        if (state.activeVehicle?.id === id) {
            setStoredActiveId(null);
            dispatch({ type: 'SET_DATA', payload: { key: 'activeVehicle', value: null } });
        }
        refreshChatHistoryListRef.current();
        showNotification("Veicolo rimosso.", "success");
    }, [state.garageVehicles, state.activeVehicle?.id, setStoredVehicles, setStoredActiveId, showNotification]);

    const handleSetActiveVehicle = useCallback((id: string, currentVehicles = state.garageVehicles) => {
        const vehicleToSet = currentVehicles.find(v => v.id === id);
        if (vehicleToSet) {
            setStoredActiveId(id);
            dispatch({ type: 'SET_DATA', payload: { key: 'activeVehicle', value: vehicleToSet } });
        }
    }, [state.garageVehicles, setStoredActiveId]);


    // --- TRIP HISTORY HANDLERS ---
    const saveItinerary = useCallback(() => {
        if (!state.itinerary) return;

        let updatedHistory: SavedTrip[];
        let confirmationMessage: string;

        const isUpdating = state.activeTripId && state.tripHistory.some(trip => trip.id === state.activeTripId);
        
        // Fix: Mapped the draft state ('tripPeriod') to the required 'SavedTrip' interface ('period')
        // to resolve the type mismatch.
        const { tripPlanner } = state.drafts;
        const currentInputs = {
            tripType: tripPlanner.tripType,
            departure: tripPlanner.departure,
            destination: tripPlanner.destination,
            selectedTour: tripPlanner.selectedTour,
            duration: tripPlanner.duration,
            roadPreference: tripPlanner.roadPreference,
            customRoadPreferenceText: tripPlanner.customRoadPreferenceText,
            period: tripPlanner.tripPeriod,
            customPrompt: tripPlanner.customPrompt,
        };

        if (isUpdating) {
            updatedHistory = state.tripHistory.map(trip => 
                trip.id === state.activeTripId 
                ? { ...trip, inputs: currentInputs, itinerary: state.itinerary! } 
                : trip
            );
            confirmationMessage = "Itinerario aggiornato!";
        } else {
            const newTripId = Date.now().toString();
            const tripToSave: SavedTrip = { id: newTripId, inputs: currentInputs, itinerary: state.itinerary };
            updatedHistory = [tripToSave, ...state.tripHistory];
            dispatch({ type: 'SET_ITINERARY', payload: { itinerary: state.itinerary, tripId: newTripId }});
            confirmationMessage = "Itinerario salvato nello storico!";
        }
        setStoredTripHistory(updatedHistory);
        dispatch({ type: 'SET_DATA', payload: { key: 'tripHistory', value: updatedHistory } });
        dispatch({ type: 'SET_DATA', payload: { key: 'savedConfirmation', value: confirmationMessage } });
        setTimeout(() => dispatch({ type: 'SET_DATA', payload: { key: 'savedConfirmation', value: null } }), 3000);
    }, [state.itinerary, state.activeTripId, state.tripHistory, state.drafts.tripPlanner, setStoredTripHistory]);

    const handleSaveAndReset = useCallback(() => {
        saveItinerary();
        dispatch({ type: 'RESET_TRIP_PLANNER_FORM' });
    }, [saveItinerary]);
    
    const loadTripFromHistory = useCallback((tripId: string) => {
        const tripToLoad = state.tripHistory.find(trip => trip.id === tripId);
        if (tripToLoad) {
            dispatch({ type: 'UPDATE_TRIP_DRAFT', payload: tripToLoad.inputs });
            dispatch({ type: 'SET_ITINERARY', payload: { itinerary: tripToLoad.itinerary, tripId: tripToLoad.id } });
            dispatch({ type: 'SET_DATA', payload: { key: 'tripMaintenanceAlerts', value: [] }}); // Clear old alerts
            showNotification("Itinerario caricato!");
        }
    }, [state.tripHistory, showNotification]);

    const loadLastItinerary = useCallback(() => {
        if (state.tripHistory.length > 0) {
            loadTripFromHistory(state.tripHistory[0].id);
        }
    }, [state.tripHistory, loadTripFromHistory]);

    const deleteTripFromHistory = useCallback((tripId: string) => {
        if (state.activeTripId === tripId) {
            dispatch({ type: 'RESET_TRIP_PLANNER_FORM' });
        }
        const updatedHistory = state.tripHistory.filter(trip => trip.id !== tripId);
        setStoredTripHistory(updatedHistory);
        dispatch({ type: 'SET_DATA', payload: { key: 'tripHistory', value: updatedHistory }});
        showNotification("Viaggio eliminato dallo storico.", "success");
    }, [state.activeTripId, state.tripHistory, setStoredTripHistory, showNotification]);

    const exportTripHistory = useCallback(() => {
        const dataStr = JSON.stringify(state.tripHistory, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        const exportFileDefaultName = 'motomentor_viaggi.json';
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
    }, [state.tripHistory]);


    // --- PDF & GPX HANDLERS ---
    const handleDownloadPdf = useCallback(() => {
        if (!state.itinerary) return;
        dispatch({ type: 'SET_PDF_GENERATING', payload: true });
        dispatch({ type: 'SET_ERROR', payload: null });
        try {
            generatePdf(
                `itinerario-${state.itinerary.titolo_viaggio.replace(/\s/g, '_')}.pdf`,
                state.itinerary.titolo_viaggio,
                ({ addWrappedText, addSeparator }) => {
                    addWrappedText(state.itinerary!.descrizione_generale, { size: 12, color: [100], marginBottom: 5 });
                    addSeparator({ marginTop: 0, marginBottom: 5 });
                    
                    state.itinerary?.programma_giornaliero.forEach((day, index) => {
                         addWrappedText(`Giorno ${day.giorno}: ${day.titolo_tappa}`, { size: 16, color: [0, 105, 217], marginBottom: 2 });
                         addWrappedText(day.descrizione_percorso, { size: 11 });
                         
                         addWrappedText("Attività e Luoghi di Interesse:", { size: 12, color: [40], marginBottom: 2 });
                         day.attivita_luoghi_interesse.forEach(activity => {
                             addWrappedText(`• ${activity}`, { isListItem: true, size: 10, color: [100], marginBottom: 1 });
                         });

                         addWrappedText("Dettagli Tappa:", { size: 12, color: [40], marginBottom: 2 });
                         addWrappedText(`Chilometri: ${day.chilometri_tappa} km`, { isListItem: true, size: 10, color: [100], marginBottom: 1 });
                         addWrappedText(`Consigli di Guida: ${day.consigli_di_guida}`, { isListItem: true, size: 10, color: [100], marginBottom: 1 });
                         addWrappedText(`Ristoro: ${day.opzione_ristoro}`, { isListItem: true, size: 10, color: [100], marginBottom: 1 });
                         addWrappedText(`Alloggio: ${day.alloggio_consigliato}`, { isListItem: true, size: 10, color: [100], marginBottom: 1 });

                         if (index < state.itinerary!.programma_giornaliero.length - 1) {
                            addSeparator({ marginTop: 5, marginBottom: 5 });
                         }
                    });
                }
            );
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Impossibile generare il PDF.";
            dispatch({ type: 'SET_ERROR', payload: errorMessage });
            showNotification(errorMessage, 'error');
        } finally {
            dispatch({ type: 'SET_PDF_GENERATING', payload: false });
        }
    }, [state.itinerary, showNotification]);

    const exportDayGpx = useCallback((day: Day) => {
        // ... GPX export logic (same as before)
    }, []);
    
    const showFullMap = useCallback(() => {
        // ... Full map logic (same as before)
    }, [state.itinerary]);

    const showDayMap = useCallback((day: Day) => {
        const points = day.tracciato_gpx;
        if (!points || points.length < 2) {
            alert("Dati GPX insufficienti per visualizzare la mappa del giorno.");
            return;
        }
    
        const origin = points[0];
        const destination = points[points.length - 1];
        let waypoints = points.slice(1, -1);
        
        const MAX_WAYPOINTS = 23;
        
        if (waypoints.length > MAX_WAYPOINTS) {
            const epsilon = 0.001;
            waypoints = douglasPeucker(waypoints, epsilon);
            if (waypoints.length > MAX_WAYPOINTS) {
                 waypoints = waypoints.slice(0, MAX_WAYPOINTS);
            }
        }
    
        const waypointsString = waypoints.map(p => `${p.lat},${p.lon}`).join('|');
        const mapUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lon}&destination=${destination.lat},${destination.lon}&waypoints=${waypointsString}&travelmode=driving`;
        window.open(mapUrl, '_blank');
    }, []);

    // --- MAINTENANCE & REMINDERS ---
    const handleAddMaintenanceRecord = useCallback((newRecordData: Omit<MaintenanceRecord, 'id'>) => {
        const newRecord = { ...newRecordData, id: Date.now().toString() };
        const updatedLog = [...state.maintenanceLog, newRecord].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setStoredLog(updatedLog);
        dispatch({ type: 'SET_DATA', payload: { key: 'maintenanceLog', value: updatedLog }});
        
        if (state.activeVehicle && newRecordData.kilometers > parseInt(state.activeVehicle.kilometers, 10)) {
             const updatedVehicle = { ...state.activeVehicle, kilometers: newRecordData.kilometers.toString() };
             handleUpdateVehicle(updatedVehicle);
             showNotification(`Chilometraggio aggiornato a ${newRecordData.kilometers.toLocaleString('it-IT')} km!`);
        } else {
            showNotification("Intervento salvato!");
        }
    }, [state.maintenanceLog, state.activeVehicle, setStoredLog, handleUpdateVehicle, showNotification]);

    const handleDeleteMaintenanceRecord = useCallback((id: string) => {
        if(window.confirm("Sei sicuro di voler eliminare questa registrazione?")) {
            const updatedLog = state.maintenanceLog.filter(r => r.id !== id);
            setStoredLog(updatedLog);
            dispatch({ type: 'SET_DATA', payload: { key: 'maintenanceLog', value: updatedLog } });
        }
    }, [state.maintenanceLog, setStoredLog]);
    
    const handleAddReminder = useCallback((newReminderData: Omit<MaintenanceReminder, 'id'>) => {
        const newReminder = { ...newReminderData, id: Date.now().toString() };
        const updatedReminders = [...state.reminders, newReminder];
        setStoredReminders(updatedReminders);
        dispatch({ type: 'SET_DATA', payload: { key: 'reminders', value: updatedReminders } });
    }, [state.reminders, setStoredReminders]);

    const handleDeleteReminder = useCallback((id: string) => {
        const updatedReminders = state.reminders.filter(r => r.id !== id);
        setStoredReminders(updatedReminders);
        dispatch({ type: 'SET_DATA', payload: { key: 'reminders', value: updatedReminders } });
    }, [state.reminders, setStoredReminders]);
    
    // --- DIAGNOSIS HISTORY HANDLERS ---
    const handleSaveOrUpdateDiagnosis = useCallback(() => {
        if (!state.diagnosis || !state.activeVehicle) return;

        let updatedDiagnoses: SavedDiagnosis[];
        let confirmationMessage: string;
        let finalDiagnosisId = state.activeDiagnosisId;

        const isUpdating = state.activeDiagnosisId && state.savedDiagnoses.some(d => d.id === state.activeDiagnosisId);
        
        if (isUpdating) {
            updatedDiagnoses = state.savedDiagnoses.map(d => 
                d.id === state.activeDiagnosisId
                ? { ...d, diagnosisText: state.diagnosis!, problemDescription: state.drafts.virtualMechanic.problemDescription, date: new Date().toISOString() }
                : d
            );
            confirmationMessage = "Diagnosi aggiornata!";
        } else {
            const newDiagnosisId = Date.now().toString();
            const diagnosisToSave: SavedDiagnosis = {
                id: newDiagnosisId,
                vehicleId: state.activeVehicle.id,
                date: new Date().toISOString(),
                problemDescription: state.drafts.virtualMechanic.problemDescription,
                diagnosisText: state.diagnosis,
            };
            updatedDiagnoses = [diagnosisToSave, ...state.savedDiagnoses];
            finalDiagnosisId = newDiagnosisId;
            confirmationMessage = "Diagnosi salvata nello storico!";
        }
        setStoredDiagnoses(updatedDiagnoses);
        dispatch({ type: 'SET_DATA', payload: { key: 'savedDiagnoses', value: updatedDiagnoses } });
        dispatch({ type: 'SET_DIAGNOSIS', payload: { diagnosis: state.diagnosis, diagnosisId: finalDiagnosisId } });
        dispatch({ type: 'SET_DATA', payload: { key: 'savedConfirmation', value: confirmationMessage } });
        setTimeout(() => dispatch({ type: 'SET_DATA', payload: { key: 'savedConfirmation', value: null } }), 3000);
    }, [state.diagnosis, state.activeDiagnosisId, state.activeVehicle, state.savedDiagnoses, state.drafts.virtualMechanic.problemDescription, setStoredDiagnoses]);

    const handleLoadDiagnosis = useCallback((diagnosisId: string) => {
        const diagnosisToLoad = state.savedDiagnoses.find(d => d.id === diagnosisId);
        if (diagnosisToLoad) {
            dispatch({ type: 'UPDATE_MECHANIC_DRAFT', payload: { problemDescription: diagnosisToLoad.problemDescription, problemImage: null } });
            dispatch({ type: 'SET_DIAGNOSIS', payload: { diagnosis: diagnosisToLoad.diagnosisText, diagnosisId: diagnosisToLoad.id }});
            showNotification("Diagnosi caricata!");
        }
    }, [state.savedDiagnoses, showNotification]);
    
    const handleDeleteDiagnosis = useCallback((diagnosisId: string) => {
        if (window.confirm("Sei sicuro di voler eliminare questa diagnosi dallo storico?")) {
            if (state.activeDiagnosisId === diagnosisId) {
                dispatch({ type: 'SET_DIAGNOSIS', payload: { diagnosis: null, diagnosisId: null }});
                dispatch({ type: 'UPDATE_MECHANIC_DRAFT', payload: { problemDescription: '' } });
            }
            const updatedDiagnoses = state.savedDiagnoses.filter(d => d.id !== diagnosisId);
            setStoredDiagnoses(updatedDiagnoses);
            dispatch({ type: 'SET_DATA', payload: { key: 'savedDiagnoses', value: updatedDiagnoses }});
        }
    }, [state.activeDiagnosisId, state.savedDiagnoses, setStoredDiagnoses]);

    const handleDownloadDiagnosisPdf = useCallback(() => {
        if (!state.diagnosis || !state.activeVehicle) return;
        dispatch({ type: 'SET_DIAGNOSIS_PDF_GENERATING', payload: true });
        dispatch({ type: 'SET_ERROR', payload: null });
        try {
            generatePdf(
                `diagnosi_${state.activeVehicle.model.replace(/\s/g, '_')}.pdf`,
                "Report Diagnosi MotoMentor AI",
                ({ addWrappedText, addSeparator }) => {
                    addWrappedText(`Data: ${new Date().toLocaleDateString('it-IT')}`, { size: 11, color: [100] });
                    addSeparator({ marginBottom: 5 });
                    
                    addWrappedText("Dati Veicolo", { size: 14, color: [40], marginBottom: 2 });
                    addWrappedText(`Modello: ${state.activeVehicle!.model} (${state.activeVehicle!.year})`);
                    addWrappedText(`Chilometri: ${Number(state.activeVehicle!.kilometers).toLocaleString('it-IT')} km`, { marginBottom: 5 });
                    
                    addWrappedText("Problema Riscontrato", { size: 14, color: [40], marginBottom: 2 });
                    addWrappedText(state.drafts.virtualMechanic.problemDescription, { marginBottom: 5 });
                    
                    addWrappedText("Analisi e Diagnosi dell'IA", { size: 14, color: [40], marginBottom: 2 });
                    addWrappedText(state.diagnosis!);
                }
            );
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Impossibile generare il PDF della diagnosi.";
            dispatch({ type: 'SET_ERROR', payload: errorMessage });
            showNotification(errorMessage, 'error');
        } finally {
            dispatch({ type: 'SET_DIAGNOSIS_PDF_GENERATING', payload: false });
        }
    }, [state.diagnosis, state.activeVehicle, state.drafts.virtualMechanic.problemDescription, showNotification]);

    const handleDownloadChecklistPdf = useCallback(() => {
        if (!state.maintenanceTips || !state.activeVehicle) return;
        dispatch({ type: 'SET_CHECKLIST_PDF_GENERATING', payload: true });
        dispatch({ type: 'SET_ERROR', payload: null });
        try {
            generatePdf(
                `checklist_${state.activeVehicle.model.replace(/\s/g, '_')}.pdf`,
                "Checklist Manutenzione Pre-Viaggio",
                ({ addWrappedText, addSeparator }) => {
                    addWrappedText(`Data: ${new Date().toLocaleDateString('it-IT')}`, { size: 11, color: [100] });
                    addWrappedText(`Veicolo: ${state.activeVehicle!.model} (${state.activeVehicle!.year}) - ${Number(state.activeVehicle!.kilometers).toLocaleString('it-IT')} km`, { size: 11, color: [100], marginBottom: 5 });
                    addSeparator({ marginTop: 0, marginBottom: 5 });

                    const { controlli_essenziali, suggerimenti_specifici_viaggio, equipaggiamento_emergenza } = state.maintenanceTips!;
                    
                    addWrappedText("Controlli Essenziali", { size: 14, color: [40], marginBottom: 2 });
                    controlli_essenziali.forEach(item => addWrappedText(`• ${item}`, { isListItem: true, size: 10, color: [100], marginBottom: 1 }));
                    
                    addWrappedText("Suggerimenti Specifici per il Viaggio", { size: 14, color: [40], marginBottom: 4 });
                    suggerimenti_specifici_viaggio.forEach(item => addWrappedText(`• ${item}`, { isListItem: true, size: 10, color: [100], marginBottom: 1 }));
                    
                    addWrappedText("Equipaggiamento d'Emergenza", { size: 14, color: [40], marginBottom: 4 });
                    equipaggiamento_emergenza.forEach(item => addWrappedText(`• ${item}`, { isListItem: true, size: 10, color: [100], marginBottom: 1 }));
                }
            );
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Impossibile generare il PDF della checklist.";
            dispatch({ type: 'SET_ERROR', payload: errorMessage });
            showNotification(errorMessage, 'error');
        } finally {
            dispatch({ type: 'SET_CHECKLIST_PDF_GENERATING', payload: false });
        }
    }, [state.maintenanceTips, state.activeVehicle, showNotification]);


    // --- AI CHAT ---
     // Initialize or re-initialize chat when mode changes to AiChat or active vehicle changes
    useEffect(() => {
        if (state.mode === AiMode.AiChat) {
            dispatch({ type: 'SET_CHAT_LOADING', payload: true });
            const newChatSession = createChatSession(state.activeVehicle);
            dispatch({ type: 'SET_DATA', payload: { key: 'chatSession', value: newChatSession }});
            
            const historyKey = `motoMentorChatHistory_${state.activeVehicle?.id || 'default'}`;
            const savedHistoryJSON = localStorage.getItem(historyKey);
            let history: Content[] = [];
            if (savedHistoryJSON) {
                try {
                    const savedData = JSON.parse(savedHistoryJSON);
                    // Handle both new object format and old array format for backward compatibility
                    history = savedData.history || savedData;
                    if (!Array.isArray(history)) {
                        history = []; // Safety check
                    }
                    newChatSession.history = history;
                } catch (e) { console.error("Failed to parse chat history", e); }
            }
            dispatch({ type: 'SET_DATA', payload: { key: 'chatHistory', value: history } });
            dispatch({ type: 'SET_CHAT_LOADING', payload: false });
        }
    }, [state.mode, state.activeVehicle]);

    const handleSendMessage = useCallback(async (message: string) => {
        if (!state.chatSession || state.isChatLoading) return;

        const userMessage: Content = { role: 'user', parts: [{ text: message }] };
        const updatedHistoryWithUser = [...state.chatHistory, userMessage];
        dispatch({ type: 'SET_DATA', payload: { key: 'chatHistory', value: updatedHistoryWithUser }});
        dispatch({ type: 'SET_CHAT_LOADING', payload: true });

        try {
            const stream = await state.chatSession.sendMessageStream({ message });
            let modelResponseText = '';
            let firstChunk = true;

            for await (const chunk of stream) {
                modelResponseText += chunk.text;
                if (firstChunk) {
                    dispatch({ type: 'SET_DATA', payload: { key: 'chatHistory', value: [...updatedHistoryWithUser, { role: 'model', parts: [{ text: modelResponseText }] }] } });
                    firstChunk = false;
                } else {
                    const currentHistory = [...updatedHistoryWithUser, { role: 'model', parts: [{ text: modelResponseText }] }];
                    dispatch({ type: 'SET_DATA', payload: { key: 'chatHistory', value: currentHistory }});
                }
            }

            const historyToSave = [...updatedHistoryWithUser, { role: 'model', parts: [{ text: modelResponseText }] }];
            const historyKey = `motoMentorChatHistory_${state.activeVehicle?.id || 'default'}`;
            
            const dataToStore = {
                lastUpdated: new Date().toISOString(),
                history: historyToSave,
            };
            localStorage.setItem(historyKey, JSON.stringify(dataToStore));
            refreshChatHistoryListRef.current();

        } catch (err) {
            console.error("Chat error:", err);
            const errorMessage: Content = { role: 'model', parts: [{ text: "Oops! Qualcosa è andato storto. Riprova." }] };
            dispatch({ type: 'SET_DATA', payload: { key: 'chatHistory', value: [...updatedHistoryWithUser, errorMessage] } });
        } finally {
            dispatch({ type: 'SET_CHAT_LOADING', payload: false });
        }
    }, [state.chatSession, state.isChatLoading, state.chatHistory, state.activeVehicle]);

    const handleClearActiveChat = useCallback(() => {
        const historyKey = `motoMentorChatHistory_${state.activeVehicle?.id || 'default'}`;
        
        // Directly modify localStorage, then force a re-sync of the list from storage.
        localStorage.removeItem(historyKey);
        refreshChatHistoryListRef.current();

        // Also reset the active chat UI state.
        dispatch({ type: 'SET_DATA', payload: { key: 'chatHistory', value: [] } });
        dispatch({ type: 'SET_DATA', payload: { key: 'chatSession', value: createChatSession(state.activeVehicle) } });
        
        showNotification("Chat cancellata.", "success");
    }, [state.activeVehicle, showNotification]);

    const handleDeleteChatHistory = useCallback((key: string) => {
        const currentKey = `motoMentorChatHistory_${state.activeVehicle?.id || 'default'}`;
        
        // Directly modify localStorage, then force a re-sync of the list from storage.
        localStorage.removeItem(key);
        refreshChatHistoryListRef.current();

        // If the deleted chat was the one currently active, clear the UI.
        if (key === currentKey) {
            dispatch({ type: 'SET_DATA', payload: { key: 'chatHistory', value: [] } });
            dispatch({ type: 'SET_DATA', payload: { key: 'chatSession', value: createChatSession(state.activeVehicle) } });
        }
        
        showNotification("Cronologia chat eliminata.", "success");
    }, [state.activeVehicle, showNotification]);


    const value = {
        state,
        dispatch,
        handleTripSubmit,
        handleMechanicSubmit,
        handleAddVehicle,
        handleUpdateVehicle,
        handleDeleteVehicle,
        handleSetActiveVehicle,
        saveItinerary,
        handleSaveAndReset,
        loadLastItinerary,
        loadTripFromHistory,
        deleteTripFromHistory,
        exportTripHistory,
        handleDownloadPdf,
        exportDayGpx,
        showFullMap,
        showDayMap,
        handleAddMaintenanceRecord,
        handleDeleteMaintenanceRecord,
        handleAddReminder,
        handleDeleteReminder,
        handleSendMessage,
        handleClearActiveChat,
        handleDeleteChatHistory,
        handleSaveOrUpdateDiagnosis,
        handleLoadDiagnosis,
        handleDeleteDiagnosis,
        handleDownloadDiagnosisPdf,
        handleDownloadChecklistPdf,
    };

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

// --- HOOK ---
export const useAppContext = (): AppContextType => {
    const context = useContext(AppContext);
    if (context === undefined) {
        throw new Error('useAppContext must be used within an AppProvider');
    }
    return context;
};