
import React, { createContext, useReducer, useContext, useEffect, ReactNode, useCallback, FormEvent } from 'react';
import { Chat, Content } from '@google/genai';
import { generateItinerary, diagnoseProblem, getMaintenanceTips, createChatSession, getVehicleSpecs, generateTripDiarySummary } from '../services/geminiService';
import { Itinerary, MaintenanceTips, GarageVehicle, AiMode, SavedTrip, MaintenanceRecord, MaintenanceReminder, SavedDiagnosis, DiaryEntry } from '../types';
import { useLocalStorage } from '../utils/hooks';

interface Notification {
    message: string;
    type: 'success' | 'error' | 'warning';
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
    isLoadingData: boolean;
    isGeneratingItinerary: boolean;
    isDiagnosingProblem: boolean;
    isGeneratingChecklist: boolean;
    isChatLoading: boolean;
    isGeneratingPdf: boolean;
    isGeneratingDiagnosisPdf: boolean;
    isGeneratingChecklistPdf: boolean;
    isGeneratingDiarySummary: boolean;
    error: string | null;
    notification: Notification | null;
    savedConfirmation: string | null;
    garageVehicles: GarageVehicle[];
    activeVehicle: GarageVehicle | null;
    maintenanceLog: MaintenanceRecord[];
    reminders: MaintenanceReminder[];
    tripHistory: SavedTrip[];
    savedDiagnoses: SavedDiagnosis[];
    deadlineAlerts: DeadlineAlert[];
    itinerary: Itinerary | null;
    activeTripId: string | null;
    tripMaintenanceAlerts: string[];
    diagnosis: string | null;
    activeDiagnosisId: string | null;
    maintenanceTips: MaintenanceTips | null;
    activeDiaryTripId: string | null;
    chatSession: Chat | null;
    chatHistory: Content[];
    chatHistoryList: ChatHistoryItem[];
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
    | { type: 'SET_DATA'; payload: { key: keyof AppState, value: any } }
    | { type: 'SET_NOTIFICATION'; payload: Notification | null }
    | { type: 'UPDATE_TRIP_DRAFT'; payload: Partial<AppState['drafts']['tripPlanner']> }
    | { type: 'UPDATE_MECHANIC_DRAFT'; payload: Partial<AppState['drafts']['virtualMechanic']> }
    | { type: 'SET_MECHANIC_MODE'; payload: 'diagnose' | 'maintenance' | 'workshop' }
    | { type: 'SET_ITINERARY'; payload: { itinerary: Itinerary | null, tripId: string | null } }
    | { type: 'SET_DIAGNOSIS'; payload: { diagnosis: string | null, diagnosisId: string | null } }
    | { type: 'RESET_TRIP_PLANNER_FORM' }
    | { type: 'SET_ACTIVE_DIARY_TRIP'; payload: string | null }
    | { type: 'SET_ITINERARY_GENERATING'; payload: boolean }
    | { type: 'SET_DIAGNOSIS_GENERATING'; payload: boolean }
    | { type: 'SET_CHECKLIST_GENERATING'; payload: boolean }
    | { type: 'SET_CHAT_LOADING'; payload: boolean }
    | { type: 'SET_DIARY_SUMMARY_GENERATING'; payload: boolean }
    | { type: 'SET_PDF_GENERATING'; payload: boolean }
    | { type: 'SET_DIAGNOSIS_PDF_GENERATING'; payload: boolean }
    | { type: 'SET_CHECKLIST_PDF_GENERATING'; payload: boolean };

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
    isGeneratingDiarySummary: false,
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
    activeDiaryTripId: null,
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

const appReducer = (state: AppState, action: AppAction): AppState => {
    switch (action.type) {
        case 'SET_MODE': return { ...state, mode: action.payload };
        case 'SET_DATA': return { ...state, [action.payload.key]: action.payload.value };
        case 'SET_NOTIFICATION': return { ...state, notification: action.payload };
        case 'UPDATE_TRIP_DRAFT': return { ...state, drafts: { ...state.drafts, tripPlanner: { ...state.drafts.tripPlanner, ...action.payload } } };
        case 'UPDATE_MECHANIC_DRAFT': return { ...state, drafts: { ...state.drafts, virtualMechanic: { ...state.drafts.virtualMechanic, ...action.payload } } };
        case 'SET_MECHANIC_MODE': return { ...state, mechanicMode: action.payload };
        case 'SET_ITINERARY': return { ...state, itinerary: action.payload.itinerary, activeTripId: action.payload.tripId };
        case 'SET_DIAGNOSIS': return { ...state, diagnosis: action.payload.diagnosis, activeDiagnosisId: action.payload.diagnosisId };
        case 'SET_ITINERARY_GENERATING': return { ...state, isGeneratingItinerary: action.payload };
        case 'SET_DIAGNOSIS_GENERATING': return { ...state, isDiagnosingProblem: action.payload };
        case 'SET_CHECKLIST_GENERATING': return { ...state, isGeneratingChecklist: action.payload };
        case 'SET_CHAT_LOADING': return { ...state, isChatLoading: action.payload };
        case 'SET_DIARY_SUMMARY_GENERATING': return { ...state, isGeneratingDiarySummary: action.payload };
        case 'SET_PDF_GENERATING': return { ...state, isGeneratingPdf: action.payload };
        case 'SET_DIAGNOSIS_PDF_GENERATING': return { ...state, isGeneratingDiagnosisPdf: action.payload };
        case 'SET_CHECKLIST_PDF_GENERATING': return { ...state, isGeneratingChecklistPdf: action.payload };
        case 'RESET_TRIP_PLANNER_FORM': return { ...state, itinerary: null, activeTripId: null, drafts: { ...state.drafts, tripPlanner: initialState.drafts.tripPlanner } };
        case 'SET_ACTIVE_DIARY_TRIP': return { ...state, activeDiaryTripId: action.payload };
        default: return state;
    }
};

const AppContext = createContext<any>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [state, dispatch] = useReducer(appReducer, initialState);
    const [garage, setGarage] = useLocalStorage<GarageVehicle[]>('motomentor_garage', []);
    const [activeVehId, setActiveVehId] = useLocalStorage<string | null>('motomentor_active_veh', null);
    const [trips, setTrips] = useLocalStorage<SavedTrip[]>('motomentor_trips', []);

    useEffect(() => {
        dispatch({ type: 'SET_DATA', payload: { key: 'garageVehicles', value: garage } });
        const active = garage.find(v => v.id === activeVehId) || null;
        dispatch({ type: 'SET_DATA', payload: { key: 'activeVehicle', value: active } });
    }, [garage, activeVehId]);

    useEffect(() => {
        dispatch({ type: 'SET_DATA', payload: { key: 'tripHistory', value: trips } });
    }, [trips]);

    const showNotification = useCallback((message: string, type: 'success' | 'error' | 'warning' = 'success') => {
        dispatch({ type: 'SET_NOTIFICATION', payload: { message, type } });
    }, []);

    const handleSendMessage = useCallback(async (message: string) => {
        if (!state.chatSession || state.isChatLoading) return;
        const userMsg = { role: 'user', parts: [{ text: message }] };
        const updatedHistory = [...state.chatHistory, userMsg];
        dispatch({ type: 'SET_DATA', payload: { key: 'chatHistory', value: updatedHistory } });
        dispatch({ type: 'SET_CHAT_LOADING', payload: true });
        try {
            const stream = await state.chatSession.sendMessageStream({ message });
            let fullText = "";
            for await (const chunk of stream) {
                fullText += chunk.text;
                const newHistory = [...updatedHistory, { role: 'model', parts: [{ text: fullText }] }];
                dispatch({ type: 'SET_DATA', payload: { key: 'chatHistory', value: newHistory } });
            }
        } catch (err: any) {
            showNotification(err.message || "Errore di comunicazione.", "error");
        } finally {
            dispatch({ type: 'SET_CHAT_LOADING', payload: false });
        }
    }, [state.chatSession, state.chatHistory, state.isChatLoading, showNotification]);

    const handleTripSubmit = useCallback(async (e: FormEvent) => {
        e.preventDefault();
        dispatch({ type: 'SET_ITINERARY_GENERATING', payload: true });
        dispatch({ type: 'SET_DATA', payload: { key: 'error', value: null } });
        try {
            const itinerary = await generateItinerary({ ...state.drafts.tripPlanner, motorcycle: state.activeVehicle });
            dispatch({ type: 'SET_ITINERARY', payload: { itinerary, tripId: null } });
            showNotification("Itinerario calcolato!");
        } catch (err: any) {
            console.error("Trip Generation Error:", err);
            const errorMsg = err.message || "Errore sconosciuto nel calcolo del viaggio.";
            showNotification(errorMsg, "error");
            dispatch({ type: 'SET_DATA', payload: { key: 'error', value: errorMsg } });
        } finally {
            dispatch({ type: 'SET_ITINERARY_GENERATING', payload: false });
        }
    }, [state.drafts.tripPlanner, state.activeVehicle, showNotification]);

    const handleAddVehicle = (v: any) => {
        const newVeh = { ...v, id: crypto.randomUUID() };
        setGarage([...garage, newVeh]);
        showNotification("Moto aggiunta al garage!");
    };

    const handleSetActiveVehicle = (id: string) => {
        setActiveVehId(id);
        showNotification("Moto selezionata!");
    };

    const saveItinerary = () => {
        if (!state.itinerary) return;
        const newTrip: SavedTrip = {
            id: crypto.randomUUID(),
            inputs: state.drafts.tripPlanner,
            itinerary: state.itinerary
        };
        setTrips([...trips, newTrip]);
        showNotification("Viaggio salvato nello storico.");
    };

    const handleUpdateTrip = (updatedTrip: SavedTrip) => {
        setTrips(trips.map(t => t.id === updatedTrip.id ? updatedTrip : t));
    };

    const handleGenerateDiarySummary = async (trip: SavedTrip) => {
        if (!trip.diaryEntries?.length) {
            showNotification("Aggiungi qualche nota prima!", "warning");
            return;
        }
        dispatch({ type: 'SET_DIARY_SUMMARY_GENERATING', payload: true });
        try {
            const summary = await generateTripDiarySummary(trip.itinerary, trip.diaryEntries);
            handleUpdateTrip({ ...trip, diarySummary: summary });
            showNotification("Racconto generato!");
        } catch (e: any) {
            showNotification(e.message || "Errore generazione racconto.", "error");
        } finally {
            dispatch({ type: 'SET_DIARY_SUMMARY_GENERATING', payload: false });
        }
    };

    return (
        <AppContext.Provider value={{ 
            state, dispatch, 
            handleTripSubmit, handleSendMessage, handleAddVehicle, 
            handleSetActiveVehicle, saveItinerary, handleUpdateTrip,
            handleGenerateDiarySummary 
        }}>
            {children}
        </AppContext.Provider>
    );
};

export const useAppContext = () => useContext(AppContext);
