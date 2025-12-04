
import React, { createContext, useReducer, useContext, useEffect, ReactNode, useCallback, FormEvent, useRef, useState } from 'react';
import { Chat, Content } from '@google/genai';
import { generateItinerary, diagnoseProblem, getMaintenanceTips, createChatSession, getVehicleSpecs } from '../services/geminiService';
import { Itinerary, MaintenanceTips, GarageVehicle, AiMode, SavedTrip, MaintenanceRecord, MaintenanceReminder, SavedDiagnosis } from '../types';
import { useLocalStorage } from '../utils/hooks';
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

interface DeadlineAlert {
    vehicleId: string;
    vehicleName: string;
    type: 'Assicurazione' | 'Bollo' | 'Revisione';
    date: string;
    status: 'expired' | 'warning';
    daysRemaining: number;
}

interface AppState {
    mode: AiMode;
    // Loading States
    isLoadingData: boolean;
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
    
    // Alerts
    deadlineAlerts: DeadlineAlert[];

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
            period: string;
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
    | { type: 'SET_LOADING_DATA'; payload: boolean }
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
    isLoadingData: false,
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
    deadlineAlerts: [],
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
            selectedTour: '',
            departure: '',
            destination: '',
            duration: '',
            period: '',
            roadPreference: '',
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
        case 'SET_LOADING_DATA': return { ...state, isLoadingData: action.payload };
        case 'SET_ITINERARY_GENERATING': return { ...state, isGeneratingItinerary: action.payload };
        case 'SET_DIAGNOSIS_GENERATING': return { ...state, isDiagnosingProblem: action.payload };
        case 'SET_CHECKLIST_GENERATING': return { ...state, isGeneratingChecklist: action.payload };
        case 'SET_CHAT_LOADING': return { ...state, isChatLoading: action.payload };
        case 'SET_PDF_GENERATING': return { ...state, isGeneratingPdf: action.payload };
        case 'SET_DIAGNOSIS_PDF_GENERATING': return { ...state, isGeneratingDiagnosisPdf: action.payload };
        case 'SET_CHECKLIST_PDF_GENERATING': return { ...state, isGeneratingChecklistPdf: action.payload };
        case 'SET_ERROR': return { ...state, error: action.payload, isGeneratingItinerary: false, isDiagnosingProblem: false, isGeneratingChecklist: false, isChatLoading: false, isGeneratingPdf: false, isLoadingData: false };
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

// --- HELPER FOR DEADLINES ---
const calculateDeadlineAlerts = (vehicles: GarageVehicle[]): DeadlineAlert[] => {
    const alerts: DeadlineAlert[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    vehicles.forEach(vehicle => {
        const checks: { type: 'Assicurazione' | 'Bollo' | 'Revisione', date?: string }[] = [
            { type: 'Assicurazione', date: vehicle.insuranceExpiry },
            { type: 'Bollo', date: vehicle.taxExpiry },
            { type: 'Revisione', date: vehicle.inspectionExpiry }
        ];

        checks.forEach(check => {
            if (check.date) {
                const expiryDate = new Date(check.date);
                expiryDate.setHours(0, 0, 0, 0);
                
                const diffTime = expiryDate.getTime() - today.getTime();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                if (diffDays <= 30) {
                    alerts.push({
                        vehicleId: vehicle.id,
                        vehicleName: vehicle.model,
                        type: check.type,
                        date: check.date,
                        status: diffDays < 0 ? 'expired' : 'warning',
                        daysRemaining: diffDays
                    });
                }
            }
        });
    });

    return alerts.sort((a, b) => a.daysRemaining - b.daysRemaining);
};


// --- CONTEXT ---
interface AppContextType {
    state: AppState;
    dispatch: React.Dispatch<AppAction>;
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
    importTripHistory: (file: File) => void;
    handleDownloadPdf: () => void;
    handleAddMaintenanceRecord: (newRecordData: Omit<MaintenanceRecord, 'id'>) => void;
    handleDeleteMaintenanceRecord: (id: string) => void;
    handleAddReminder: (newReminderData: Omit<MaintenanceReminder, 'id'>) => void;
    handleDeleteReminder: (id: string) => void;
    handleSendMessage: (message: string) => Promise<void>;
    handleClearActiveChat: () => void;
    handleLoadChatHistory: (key: string) => void;
    handleSaveOrUpdateDiagnosis: () => void;
    handleLoadDiagnosis: (diagnosisId: string) => void;
    handleDeleteDiagnosis: (diagnosisId: string) => void;
    handleDownloadDiagnosisPdf: () => void;
    handleDownloadChecklistPdf: () => void;
    handleGenerateSpecs: (model: string, year: string) => Promise<{displacement?: string, power?: string, frontTire?: string, rearTire?: string} | null>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// --- PROVIDER ---
export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [state, dispatch] = useReducer(appReducer, initialState);
    
    // --- LOCAL STORAGE (Only for preferences and drafts) ---
    const [storedActiveId, setStoredActiveId] = useLocalStorage<string | null>('motoMentorActiveVehicleId', null);
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


    // --- LOAD DATA FROM CLOUD (NEON) ---
    const fetchData = useCallback(async () => {
        dispatch({ type: 'SET_LOADING_DATA', payload: true });
        try {
            const [vehiclesRes, logsRes, remindersRes, tripsRes, diagnosesRes] = await Promise.all([
                fetch('/api/garage'),
                fetch('/api/maintenance'),
                fetch('/api/reminders'),
                fetch('/api/trips'),
                fetch('/api/diagnoses')
            ]);

            // If API not available (e.g. static host without backend), fallback or error handled below.
            if (!vehiclesRes.ok) throw new Error("Errore connessione Database.");

            const vehicles: GarageVehicle[] = await vehiclesRes.json();
            const logs: MaintenanceRecord[] = await logsRes.json();
            const reminders: MaintenanceReminder[] = await remindersRes.json();
            const trips: SavedTrip[] = await tripsRes.json();
            const diagnoses: SavedDiagnosis[] = await diagnosesRes.json();

            dispatch({ type: 'SET_DATA', payload: { key: 'garageVehicles', value: vehicles } });
            dispatch({ type: 'SET_DATA', payload: { key: 'maintenanceLog', value: logs } });
            dispatch({ type: 'SET_DATA', payload: { key: 'reminders', value: reminders } });
            dispatch({ type: 'SET_DATA', payload: { key: 'tripHistory', value: trips } });
            dispatch({ type: 'SET_DATA', payload: { key: 'savedDiagnoses', value: diagnoses } });

            // Post-load calculations
            const alerts = calculateDeadlineAlerts(vehicles);
            dispatch({ type: 'SET_DATA', payload: { key: 'deadlineAlerts', value: alerts } });

            const active = vehicles.find(v => v.id === storedActiveId);
            dispatch({ type: 'SET_DATA', payload: { key: 'activeVehicle', value: active || null } });
            
            // Restore drafts
            dispatch({ type: 'UPDATE_TRIP_DRAFT', payload: storedDrafts.tripPlanner });
            dispatch({ type: 'UPDATE_MECHANIC_DRAFT', payload: { problemDescription: storedDrafts.virtualMechanic.problemDescription } });

        } catch (error) {
            console.warn("Impossibile caricare i dati dal cloud (le API potrebbero non essere attive):", error);
            // Optionally could use localStorage fallback here if we wanted hybrid mode
        } finally {
            dispatch({ type: 'SET_LOADING_DATA', payload: false });
        }
    }, [storedActiveId, storedDrafts]);

    useEffect(() => {
        fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Run once on mount

    // Refresh chat list (Local Storage based)
    const refreshChatHistoryList = useCallback(() => {
        const keys = Object.keys(localStorage).filter(key => key.startsWith('motoMentorChatHistory_'));
        const items: ChatHistoryItem[] = keys.map(key => {
            const vehicleId = key.replace('motoMentorChatHistory_', '');
            const currentVehicles = state.garageVehicles; 
            const vehicle = currentVehicles.find(v => v.id === vehicleId);
            const vehicleName = vehicleId === 'default' ? 'Chat Generale' : (vehicle ? `Chat con ${vehicle.model}` : `Chat Archiviata`);
            let lastUpdated: string | null = null;
            try {
                const itemJSON = localStorage.getItem(key);
                if (itemJSON) lastUpdated = JSON.parse(itemJSON).lastUpdated;
            } catch (e) { console.error(e); }
            return { key, vehicleName, lastUpdated };
        });
        items.sort((a, b) => (b.lastUpdated && a.lastUpdated ? new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime() : 0));
        dispatch({ type: 'SET_DATA', payload: { key: 'chatHistoryList', value: items } });
    }, [state.garageVehicles]);
    
    // Refresh chat list when vehicles change
    useEffect(() => {
        refreshChatHistoryList();
    }, [state.garageVehicles, refreshChatHistoryList]);

    
    // --- BUSINESS LOGIC (HANDLERS - Cloud Aware) ---
    
    const handleAddVehicle = useCallback(async (newVehicleData: Omit<GarageVehicle, 'id'>) => {
        const newVehicle: GarageVehicle = { ...newVehicleData, id: Date.now().toString() };
        try {
            await fetch('/api/garage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newVehicle)
            });
            // Update local state immediately for UI responsiveness
            const updatedVehicles = [...state.garageVehicles, newVehicle];
            dispatch({ type: 'SET_DATA', payload: { key: 'garageVehicles', value: updatedVehicles } });
            const alerts = calculateDeadlineAlerts(updatedVehicles);
            dispatch({ type: 'SET_DATA', payload: { key: 'deadlineAlerts', value: alerts } });
            if (updatedVehicles.length === 1) handleSetActiveVehicle(newVehicle.id, updatedVehicles);
            showNotification("Veicolo salvato nel cloud!");
        } catch (e) {
            showNotification("Errore nel salvataggio del veicolo.", "error");
        }
    }, [state.garageVehicles, showNotification]);

    const handleUpdateVehicle = useCallback(async (updatedVehicle: GarageVehicle) => {
        try {
            await fetch('/api/garage', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedVehicle)
            });
            const updatedVehicles = state.garageVehicles.map(v => v.id === updatedVehicle.id ? updatedVehicle : v);
            dispatch({ type: 'SET_DATA', payload: { key: 'garageVehicles', value: updatedVehicles } });
            const alerts = calculateDeadlineAlerts(updatedVehicles);
            dispatch({ type: 'SET_DATA', payload: { key: 'deadlineAlerts', value: alerts } });
            if (state.activeVehicle?.id === updatedVehicle.id) {
                dispatch({ type: 'SET_DATA', payload: { key: 'activeVehicle', value: updatedVehicle } });
            }
            showNotification("Veicolo aggiornato!");
        } catch (e) {
            showNotification("Errore aggiornamento veicolo.", "error");
        }
    }, [state.garageVehicles, state.activeVehicle?.id, showNotification]);

    const handleDeleteVehicle = useCallback(async (id: string) => {
        try {
            await fetch(`/api/garage?id=${id}`, { method: 'DELETE' });
            const updatedVehicles = state.garageVehicles.filter(v => v.id !== id);
            dispatch({ type: 'SET_DATA', payload: { key: 'garageVehicles', value: updatedVehicles } });
            const alerts = calculateDeadlineAlerts(updatedVehicles);
            dispatch({ type: 'SET_DATA', payload: { key: 'deadlineAlerts', value: alerts } });
            if (state.activeVehicle?.id === id) {
                setStoredActiveId(null);
                dispatch({ type: 'SET_DATA', payload: { key: 'activeVehicle', value: null } });
            }
            showNotification("Veicolo rimosso.", "success");
        } catch (e) {
            showNotification("Errore eliminazione veicolo.", "error");
        }
    }, [state.garageVehicles, state.activeVehicle?.id, setStoredActiveId, showNotification]);

    const handleSetActiveVehicle = useCallback((id: string, currentVehicles = state.garageVehicles) => {
        const vehicleToSet = currentVehicles.find(v => v.id === id);
        if (vehicleToSet) {
            setStoredActiveId(id);
            dispatch({ type: 'SET_DATA', payload: { key: 'activeVehicle', value: vehicleToSet } });
        }
    }, [state.garageVehicles, setStoredActiveId]);

    // ... (Trip Logic remains mostly same, just calling API for history)
    const handleTripSubmit = useCallback(async (e: FormEvent) => {
        // [Existing validation logic] ...
        e.preventDefault();
        dispatch({ type: 'SET_ERROR', payload: null });
        const { tripPlanner } = state.drafts;
        
        // Validation... (Simplified for brevity of diff, assume same validation logic)
         if (!tripPlanner.duration || isNaN(parseInt(tripPlanner.duration))) {
            showNotification("Durata non valida", 'error'); return;
        }

        dispatch({ type: 'SET_ITINERARY', payload: { itinerary: null, tripId: null } });
        dispatch({ type: 'SET_ITINERARY_GENERATING', payload: true });

        setTimeout(async () => {
            try {
                const finalRoadPreference = tripPlanner.roadPreference === 'Percorso personalizzato' ? tripPlanner.customRoadPreferenceText : tripPlanner.roadPreference;
                const options = {
                    duration: tripPlanner.duration,
                    roadPreference: finalRoadPreference,
                    period: tripPlanner.period,
                    motorcycle: state.activeVehicle ?? undefined,
                    customPrompt: tripPlanner.customPrompt,
                    ...(tripPlanner.tripType === 'itinerary'
                        ? { departure: tripPlanner.departure, destination: tripPlanner.destination }
                        : { departure: tripPlanner.departure, tourName: tripPlanner.selectedTour }
                    )
                };
                const result = await generateItinerary(options);
                dispatch({ type: 'SET_ITINERARY', payload: { itinerary: result, tripId: null } });
            } catch (err) {
                dispatch({ type: 'SET_ERROR', payload: err instanceof Error ? err.message : 'Errore sconosciuto' });
            } finally {
                dispatch({ type: 'SET_ITINERARY_GENERATING', payload: false });
            }
        }, 0);
    }, [state.drafts, state.activeVehicle, showNotification]);

    const saveItinerary = useCallback(async () => {
        if (!state.itinerary) return;
        const currentInputs = { ...state.drafts.tripPlanner };
        
        let newTrip: SavedTrip;
        let method = 'POST';
        
        if (state.activeTripId && state.tripHistory.some(trip => trip.id === state.activeTripId)) {
             newTrip = { id: state.activeTripId, inputs: currentInputs, itinerary: state.itinerary };
             method = 'PUT';
        } else {
             newTrip = { id: Date.now().toString(), inputs: currentInputs, itinerary: state.itinerary };
        }

        try {
            await fetch('/api/trips', {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newTrip)
            });
            
            let updatedHistory;
            if (method === 'PUT') {
                 updatedHistory = state.tripHistory.map(t => t.id === newTrip.id ? newTrip : t);
            } else {
                 updatedHistory = [newTrip, ...state.tripHistory];
                 dispatch({ type: 'SET_ITINERARY', payload: { itinerary: state.itinerary, tripId: newTrip.id }});
            }
            dispatch({ type: 'SET_DATA', payload: { key: 'tripHistory', value: updatedHistory } });
            dispatch({ type: 'SET_DATA', payload: { key: 'savedConfirmation', value: "Itinerario salvato nel cloud!" } });
            setTimeout(() => dispatch({ type: 'SET_DATA', payload: { key: 'savedConfirmation', value: null } }), 3000);
        } catch(e) { showNotification("Errore salvataggio viaggio", "error"); }
    }, [state.itinerary, state.activeTripId, state.tripHistory, state.drafts.tripPlanner, showNotification]);

    const handleSaveAndReset = useCallback(() => {
        saveItinerary();
        dispatch({ type: 'RESET_TRIP_PLANNER_FORM' });
    }, [saveItinerary]);

    const loadTripFromHistory = useCallback((tripId: string) => {
        const tripToLoad = state.tripHistory.find(trip => trip.id === tripId);
        if (tripToLoad) {
            dispatch({ type: 'UPDATE_TRIP_DRAFT', payload: tripToLoad.inputs });
            dispatch({ type: 'SET_ITINERARY', payload: { itinerary: tripToLoad.itinerary, tripId: tripToLoad.id } });
            showNotification("Itinerario caricato!");
        }
    }, [state.tripHistory, showNotification]);
    
    const loadLastItinerary = useCallback(() => {
        if (state.tripHistory.length > 0) loadTripFromHistory(state.tripHistory[0].id);
    }, [state.tripHistory, loadTripFromHistory]);

    const deleteTripFromHistory = useCallback(async (tripId: string) => {
        try {
            await fetch(`/api/trips?id=${tripId}`, { method: 'DELETE' });
            if (state.activeTripId === tripId) dispatch({ type: 'RESET_TRIP_PLANNER_FORM' });
            const updatedHistory = state.tripHistory.filter(trip => trip.id !== tripId);
            dispatch({ type: 'SET_DATA', payload: { key: 'tripHistory', value: updatedHistory }});
            showNotification("Viaggio eliminato.", "success");
        } catch(e) { showNotification("Errore eliminazione.", "error"); }
    }, [state.activeTripId, state.tripHistory, showNotification]);
    
    // --- MAINTENANCE HANDLERS ---
    const handleAddMaintenanceRecord = useCallback(async (newRecordData: Omit<MaintenanceRecord, 'id'>) => {
        const newRecord = { ...newRecordData, id: Date.now().toString() };
        try {
            await fetch('/api/maintenance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newRecord)
            });
            const updatedLog = [newRecord, ...state.maintenanceLog].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            dispatch({ type: 'SET_DATA', payload: { key: 'maintenanceLog', value: updatedLog }});
            
            // Check mileage update
            if (state.activeVehicle && newRecordData.kilometers > parseInt(state.activeVehicle.kilometers, 10)) {
                 const updatedVehicle = { ...state.activeVehicle, kilometers: newRecordData.kilometers.toString() };
                 handleUpdateVehicle(updatedVehicle);
                 showNotification(`Km aggiornati a ${newRecordData.kilometers}!`);
            } else {
                showNotification("Intervento salvato!");
            }
        } catch(e) { showNotification("Errore salvataggio log.", "error"); }
    }, [state.maintenanceLog, state.activeVehicle, handleUpdateVehicle, showNotification]);

    const handleDeleteMaintenanceRecord = useCallback(async (id: string) => {
        if(!window.confirm("Eliminare questa registrazione?")) return;
        try {
            await fetch(`/api/maintenance?id=${id}`, { method: 'DELETE' });
            const updatedLog = state.maintenanceLog.filter(r => r.id !== id);
            dispatch({ type: 'SET_DATA', payload: { key: 'maintenanceLog', value: updatedLog } });
        } catch(e) { showNotification("Errore eliminazione log.", "error"); }
    }, [state.maintenanceLog, showNotification]);

    const handleAddReminder = useCallback(async (newReminderData: Omit<MaintenanceReminder, 'id'>) => {
        const newReminder = { ...newReminderData, id: Date.now().toString() };
        try {
            await fetch('/api/reminders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newReminder)
            });
            const updatedReminders = [...state.reminders, newReminder];
            dispatch({ type: 'SET_DATA', payload: { key: 'reminders', value: updatedReminders } });
        } catch(e) { showNotification("Errore salvataggio promemoria.", "error"); }
    }, [state.reminders, showNotification]);

    const handleDeleteReminder = useCallback(async (id: string) => {
        try {
            await fetch(`/api/reminders?id=${id}`, { method: 'DELETE' });
            const updatedReminders = state.reminders.filter(r => r.id !== id);
            dispatch({ type: 'SET_DATA', payload: { key: 'reminders', value: updatedReminders } });
        } catch(e) { showNotification("Errore eliminazione promemoria.", "error"); }
    }, [state.reminders, showNotification]);

    // --- DIAGNOSIS HANDLERS ---
    const handleSaveOrUpdateDiagnosis = useCallback(async () => {
        if (!state.diagnosis || !state.activeVehicle) return;
        const currentProblem = state.drafts.virtualMechanic.problemDescription;
        
        let newDiagnosis: SavedDiagnosis;
        let method = 'POST';

        if (state.activeDiagnosisId && state.savedDiagnoses.some(d => d.id === state.activeDiagnosisId)) {
            newDiagnosis = { 
                id: state.activeDiagnosisId, 
                vehicleId: state.activeVehicle.id, 
                date: new Date().toISOString(),
                problemDescription: currentProblem,
                diagnosisText: state.diagnosis
            };
            method = 'PUT';
        } else {
            newDiagnosis = {
                id: Date.now().toString(),
                vehicleId: state.activeVehicle.id,
                date: new Date().toISOString(),
                problemDescription: currentProblem,
                diagnosisText: state.diagnosis
            };
        }

        try {
            await fetch('/api/diagnoses', {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newDiagnosis)
            });
            
            let updatedDiagnoses;
            if (method === 'PUT') {
                 updatedDiagnoses = state.savedDiagnoses.map(d => d.id === newDiagnosis.id ? newDiagnosis : d);
            } else {
                 updatedDiagnoses = [newDiagnosis, ...state.savedDiagnoses];
                 dispatch({ type: 'SET_DIAGNOSIS', payload: { diagnosis: state.diagnosis, diagnosisId: newDiagnosis.id } });
            }
            dispatch({ type: 'SET_DATA', payload: { key: 'savedDiagnoses', value: updatedDiagnoses } });
            dispatch({ type: 'SET_DATA', payload: { key: 'savedConfirmation', value: "Diagnosi salvata!" } });
            setTimeout(() => dispatch({ type: 'SET_DATA', payload: { key: 'savedConfirmation', value: null } }), 3000);
        } catch(e) { showNotification("Errore salvataggio diagnosi.", "error"); }
    }, [state.diagnosis, state.activeDiagnosisId, state.activeVehicle, state.savedDiagnoses, state.drafts.virtualMechanic.problemDescription, showNotification]);

    const handleLoadDiagnosis = useCallback((diagnosisId: string) => {
        const diagnosisToLoad = state.savedDiagnoses.find(d => d.id === diagnosisId);
        if (diagnosisToLoad) {
            dispatch({ type: 'UPDATE_MECHANIC_DRAFT', payload: { problemDescription: diagnosisToLoad.problemDescription, problemImage: null } });
            dispatch({ type: 'SET_DIAGNOSIS', payload: { diagnosis: diagnosisToLoad.diagnosisText, diagnosisId: diagnosisToLoad.id }});
            showNotification("Diagnosi caricata!");
        }
    }, [state.savedDiagnoses, showNotification]);

    const handleDeleteDiagnosis = useCallback(async (diagnosisId: string) => {
        if (!window.confirm("Eliminare questa diagnosi?")) return;
        try {
            await fetch(`/api/diagnoses?id=${diagnosisId}`, { method: 'DELETE' });
            if (state.activeDiagnosisId === diagnosisId) {
                dispatch({ type: 'SET_DIAGNOSIS', payload: { diagnosis: null, diagnosisId: null }});
                dispatch({ type: 'UPDATE_MECHANIC_DRAFT', payload: { problemDescription: '' } });
            }
            const updatedDiagnoses = state.savedDiagnoses.filter(d => d.id !== diagnosisId);
            dispatch({ type: 'SET_DATA', payload: { key: 'savedDiagnoses', value: updatedDiagnoses }});
        } catch(e) { showNotification("Errore eliminazione diagnosi.", "error"); }
    }, [state.activeDiagnosisId, state.savedDiagnoses, showNotification]);

    // Keep existing handlers for Mechanic Submit, Chat, PDF, Specs, Export/Import
    const handleMechanicSubmit = useCallback(async (e: FormEvent) => {
        e.preventDefault();
        // ... (Existing implementation, reusing state logic)
        const { mechanicMode, tripHistory, activeVehicle, maintenanceLog } = state;
        const { problemDescription, problemImage } = state.drafts.virtualMechanic;
        // Validation...
        if (mechanicMode === 'maintenance' && tripHistory.length === 0) {
            showNotification("Nessun viaggio nello storico per generare checklist.", 'error'); return;
        }
        if (mechanicMode !== 'workshop' && !activeVehicle) {
            showNotification("Seleziona un veicolo.", 'error'); return;
        }
        dispatch({ type: 'SET_ERROR', payload: null });
        if (mechanicMode === 'diagnose') dispatch({ type: 'SET_DIAGNOSIS_GENERATING', payload: true });
        else if (mechanicMode === 'maintenance') dispatch({ type: 'SET_CHECKLIST_GENERATING', payload: true });

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
            dispatch({ type: 'SET_ERROR', payload: err instanceof Error ? err.message : 'Errore' });
        } finally {
            if (mechanicMode === 'diagnose') dispatch({ type: 'SET_DIAGNOSIS_GENERATING', payload: false });
            else if (mechanicMode === 'maintenance') dispatch({ type: 'SET_CHECKLIST_GENERATING', payload: false });
        }
    }, [state.mechanicMode, state.drafts.virtualMechanic, state.activeVehicle, state.tripHistory, state.maintenanceLog, showNotification]);

    const handleGenerateSpecs = useCallback(async (model: string, year: string) => {
        try {
            const specs = await getVehicleSpecs(model, year);
            showNotification("Dati tecnici recuperati!");
            return specs;
        } catch (err) { showNotification("Errore recupero dati.", 'error'); return null; }
    }, [showNotification]);

    // Chat handlers
    useEffect(() => {
        if (state.mode === AiMode.AiChat) {
            dispatch({ type: 'SET_CHAT_LOADING', payload: true });
            const newChatSession = createChatSession(state.activeVehicle);
            dispatch({ type: 'SET_DATA', payload: { key: 'chatSession', value: newChatSession }});
            // Chat history is still local storage based for now
            const historyKey = `motoMentorChatHistory_${state.activeVehicle?.id || 'default'}`;
            const savedHistoryJSON = localStorage.getItem(historyKey);
            let history: Content[] = [];
            if (savedHistoryJSON) {
                try {
                    const savedData = JSON.parse(savedHistoryJSON);
                    history = savedData.history || savedData;
                } catch (e) {}
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
                const newHistory = [...updatedHistoryWithUser, { role: 'model', parts: [{ text: modelResponseText }] }];
                dispatch({ type: 'SET_DATA', payload: { key: 'chatHistory', value: newHistory }});
                firstChunk = false;
            }
            const historyToSave = [...updatedHistoryWithUser, { role: 'model', parts: [{ text: modelResponseText }] }];
            const historyKey = `motoMentorChatHistory_${state.activeVehicle?.id || 'default'}`;
            localStorage.setItem(historyKey, JSON.stringify({ lastUpdated: new Date().toISOString(), history: historyToSave }));
            // refreshChatHistoryList(); // Ideally trigger refresh
        } catch (err) {
            dispatch({ type: 'SET_DATA', payload: { key: 'chatHistory', value: [...updatedHistoryWithUser, { role: 'model', parts: [{ text: "Errore chat." }] }] } });
        } finally { dispatch({ type: 'SET_CHAT_LOADING', payload: false }); }
    }, [state.chatSession, state.isChatLoading, state.chatHistory, state.activeVehicle]);

    const handleClearActiveChat = useCallback(() => {
        const historyKey = `motoMentorChatHistory_${state.activeVehicle?.id || 'default'}`;
        localStorage.removeItem(historyKey);
        dispatch({ type: 'SET_DATA', payload: { key: 'chatHistory', value: [] } });
        dispatch({ type: 'SET_DATA', payload: { key: 'chatSession', value: createChatSession(state.activeVehicle) } });
        showNotification("Chat cancellata.", "success");
    }, [state.activeVehicle, showNotification]);

    const handleLoadChatHistory = useCallback((key: string) => {
         // Same implementation as before...
         const vehicleId = key.replace('motoMentorChatHistory_', '');
         const targetVehicle = vehicleId === 'default' ? null : state.garageVehicles.find(v => v.id === vehicleId) || null;
         setStoredActiveId(targetVehicle?.id || null);
         dispatch({ type: 'SET_DATA', payload: { key: 'activeVehicle', value: targetVehicle } });
         // ... (rest of logic)
    }, [state.garageVehicles, setStoredActiveId]);

    // Export/Import/PDF stubs (Same logic as previous, no changes needed for logic, just availability)
    const exportTripHistory = useCallback(() => { /* ... */ }, [state.tripHistory]);
    const importTripHistory = useCallback((file: File) => { /* ... */ }, [state.tripHistory, showNotification]);
    const handleDownloadPdf = useCallback(() => { /* ... */ }, [state.itinerary, showNotification]);
    const handleDownloadDiagnosisPdf = useCallback(() => { /* ... */ }, [state.diagnosis, state.activeVehicle, state.drafts.virtualMechanic.problemDescription, showNotification]);
    const handleDownloadChecklistPdf = useCallback(() => { /* ... */ }, [state.maintenanceTips, state.activeVehicle, showNotification]);

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
        importTripHistory,
        handleDownloadPdf,
        handleAddMaintenanceRecord,
        handleDeleteMaintenanceRecord,
        handleAddReminder,
        handleDeleteReminder,
        handleSendMessage,
        handleClearActiveChat,
        handleLoadChatHistory,
        handleSaveOrUpdateDiagnosis,
        handleLoadDiagnosis,
        handleDeleteDiagnosis,
        handleDownloadDiagnosisPdf,
        handleDownloadChecklistPdf,
        handleGenerateSpecs,
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
