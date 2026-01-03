
import React, { createContext, useReducer, useContext, useEffect, ReactNode, useCallback, FormEvent } from 'react';
import { Chat, Content, GenerateContentResponse } from '@google/genai';
import { generateItinerary, diagnoseProblem, getMaintenanceTips, createChatSession, getVehicleSpecs, generateTripDiarySummary } from '../services/geminiService';
import { Itinerary, MaintenanceTips, GarageVehicle, AiMode, SavedTrip, MaintenanceRecord, MaintenanceReminder, SavedDiagnosis, DiaryEntry, MaintenanceType, SavedChat } from '../types';
import { useLocalStorage } from '../utils/hooks';
import { generatePdf } from '../utils/pdf';
import { downloadFile } from '../utils/mapsHelpers';

interface Notification {
    message: string;
    type: 'success' | 'error' | 'warning';
}

interface DeadlineAlert {
    vehicleId: string;
    vehicleName: string;
    type: 'Assicurazione' | 'Bollo' | 'Revisione';
    date: string;
    status: 'expired' | 'warning';
    daysRemaining: number;
}

export interface AppState {
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
    savedChats: SavedChat[];
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

export type AppAction =
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
    savedChats: [],
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
        case 'RESET_TRIP_PLANNER_FORM': 
            return { 
                ...state, 
                itinerary: null, 
                activeTripId: null, 
                drafts: { 
                    ...state.drafts, 
                    tripPlanner: { ...initialState.drafts.tripPlanner } 
                } 
            };
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
    const [diagnoses, setDiagnoses] = useLocalStorage<SavedDiagnosis[]>('motomentor_diagnoses', []);
    const [mLog, setMLog] = useLocalStorage<MaintenanceRecord[]>('motomentor_mlog', []);
    const [mReminders, setMReminders] = useLocalStorage<MaintenanceReminder[]>('motomentor_reminders', []);
    const [chats, setSavedChats] = useLocalStorage<SavedChat[]>('motomentor_chats', []);

    useEffect(() => {
        dispatch({ type: 'SET_DATA', payload: { key: 'garageVehicles', value: garage } });
        const active = garage.find(v => v.id === activeVehId) || null;
        dispatch({ type: 'SET_DATA', payload: { key: 'activeVehicle', value: active } });
    }, [garage, activeVehId]);

    useEffect(() => { dispatch({ type: 'SET_DATA', payload: { key: 'tripHistory', value: trips } }); }, [trips]);
    useEffect(() => { dispatch({ type: 'SET_DATA', payload: { key: 'savedDiagnoses', value: diagnoses } }); }, [diagnoses]);
    useEffect(() => { dispatch({ type: 'SET_DATA', payload: { key: 'maintenanceLog', value: mLog } }); }, [mLog]);
    useEffect(() => { dispatch({ type: 'SET_DATA', payload: { key: 'reminders', value: mReminders } }); }, [mReminders]);
    useEffect(() => { dispatch({ type: 'SET_DATA', payload: { key: 'savedChats', value: chats } }); }, [chats]);

    const showNotification = useCallback((message: string, type: 'success' | 'error' | 'warning' = 'success') => {
        dispatch({ type: 'SET_NOTIFICATION', payload: { message, type } });
    }, []);

    const handleAddVehicle = (v: any) => {
        const newVeh = { ...v, id: crypto.randomUUID() };
        setGarage([...garage, newVeh]);
        showNotification("Moto aggiunta al garage!");
    };

    const handleUpdateVehicle = (updated: GarageVehicle) => {
        setGarage(garage.map(v => v.id === updated.id ? updated : v));
        showNotification("Dati veicolo aggiornati.");
    };

    const handleDeleteVehicle = (id: string) => {
        setGarage(garage.filter(v => v.id !== id));
        if (activeVehId === id) setActiveVehId(null);
        showNotification("Veicolo rimosso.");
    };

    const handleSetActiveVehicle = (id: string) => {
        setActiveVehId(id);
        showNotification("Moto selezionata come attiva!");
    };

    const handleGenerateSpecs = async (model: string, year: string) => {
        try {
            return await getVehicleSpecs(model, year);
        } catch (e: any) {
            showNotification("Errore ricerca specifiche: " + e.message, "error");
            return null;
        }
    };

    const handleTripSubmit = useCallback(async (e: FormEvent) => {
        e.preventDefault();
        dispatch({ type: 'SET_ITINERARY_GENERATING', payload: true });
        dispatch({ type: 'SET_DATA', payload: { key: 'error', value: null } });
        try {
            const itinerary = await generateItinerary({ ...state.drafts.tripPlanner, motorcycle: state.activeVehicle });
            dispatch({ type: 'SET_ITINERARY', payload: { itinerary, tripId: null } });
            showNotification("Itinerario calcolato!");
        } catch (err: any) {
            showNotification(err.message || "Errore calcolo viaggio.", "error");
            dispatch({ type: 'SET_DATA', payload: { key: 'error', value: err.message } });
        } finally {
            dispatch({ type: 'SET_ITINERARY_GENERATING', payload: false });
        }
    }, [state.drafts.tripPlanner, state.activeVehicle, showNotification]);

    const saveItinerary = useCallback(() => {
        if (!state.itinerary) return;

        // Recuperiamo il viaggio esistente se presente
        const existingTrip = state.activeTripId ? trips.find(t => t.id === state.activeTripId) : null;

        // Se esiste già, controlliamo se ci sono state modifiche effettive
        if (existingTrip) {
            const isUnchanged = JSON.stringify(existingTrip.inputs) === JSON.stringify(state.drafts.tripPlanner) &&
                              JSON.stringify(existingTrip.itinerary) === JSON.stringify(state.itinerary);
            
            if (isUnchanged) {
                showNotification("Nessuna modifica rilevata, il viaggio è già salvato.", "warning");
                return;
            }

            // Se ci sono modifiche, aggiorniamo il record
            const updatedTrips = trips.map(t => t.id === state.activeTripId ? {
                ...t,
                inputs: { ...state.drafts.tripPlanner },
                itinerary: state.itinerary!
            } : t);
            
            setTrips(updatedTrips);
            showNotification("Viaggio aggiornato nello storico.");
            return;
        }

        // Altrimenti creiamo un nuovo record
        const newId = crypto.randomUUID();
        const newTrip: SavedTrip = {
            id: newId,
            inputs: { ...state.drafts.tripPlanner },
            itinerary: state.itinerary,
            diaryEntries: []
        };
        setTrips([newTrip, ...trips]);
        dispatch({ type: 'SET_DATA', payload: { key: 'activeTripId', value: newId } });
        showNotification("Viaggio salvato nello storico.");
    }, [state.itinerary, state.activeTripId, state.drafts.tripPlanner, trips, setTrips, showNotification]);

    const handleResetForm = useCallback(() => {
        dispatch({ type: 'RESET_TRIP_PLANNER_FORM' });
        showNotification("Moduli ripuliti. Puoi iniziare una nuova pianificazione.");
    }, [showNotification]);

    const handleSaveAndReset = useCallback(() => {
        saveItinerary();
        handleResetForm();
    }, [saveItinerary, handleResetForm]);

    const loadLastItinerary = () => {
        if (trips.length > 0) {
            const last = trips[0];
            dispatch({ type: 'SET_ITINERARY', payload: { itinerary: last.itinerary, tripId: last.id } });
            dispatch({ type: 'UPDATE_TRIP_DRAFT', payload: last.inputs });
            showNotification("Caricato ultimo viaggio salvato.");
        }
    };

    const loadTripFromHistory = (id: string) => {
        const trip = trips.find(t => t.id === id);
        if (trip) {
            dispatch({ type: 'SET_ITINERARY', payload: { itinerary: trip.itinerary, tripId: trip.id } });
            dispatch({ type: 'UPDATE_TRIP_DRAFT', payload: trip.inputs });
        }
    };

    const deleteTripFromHistory = (id: string) => {
        setTrips(trips.filter(t => t.id !== id));
        if (state.activeTripId === id) {
            dispatch({ type: 'SET_DATA', payload: { key: 'activeTripId', value: null } });
        }
        showNotification("Viaggio eliminato.");
    };

    const exportTripHistory = () => {
        const data = JSON.stringify(trips, null, 2);
        downloadFile(data, 'motomentor_viaggi.json', 'application/json');
    };

    const importTripHistory = async (file: File) => {
        const text = await file.text();
        try {
            const imported = JSON.parse(text);
            setTrips([...imported, ...trips]);
            showNotification("Storico importato!");
        } catch (e) {
            showNotification("Errore importazione file.", "error");
        }
    };

    const handleMechanicSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (state.mechanicMode === 'diagnose') {
            dispatch({ type: 'SET_DIAGNOSIS_GENERATING', payload: true });
            try {
                const res = await diagnoseProblem(state.drafts.virtualMechanic.problemDescription, state.activeVehicle!, state.drafts.virtualMechanic.problemImage!);
                dispatch({ type: 'SET_DIAGNOSIS', payload: { diagnosis: res, diagnosisId: null } });
            } catch (e: any) {
                showNotification(e.message, "error");
            } finally {
                dispatch({ type: 'SET_DIAGNOSIS_GENERATING', payload: false });
            }
        } else {
            dispatch({ type: 'SET_CHECKLIST_GENERATING', payload: true });
            try {
                const lastTrip = state.itinerary ? { tripTitle: state.itinerary.tripTitle, dailySchedule: state.itinerary.dailySchedule } as any : (trips.length > 0 ? trips[0].itinerary : null);
                if (!lastTrip) throw new Error("Devi avere almeno un viaggio pianificato o salvato.");
                const tips = await getMaintenanceTips(lastTrip, state.activeVehicle!);
                dispatch({ type: 'SET_DATA', payload: { key: 'maintenanceTips', value: tips } });
            } catch (e: any) {
                showNotification(e.message, "error");
            } finally {
                dispatch({ type: 'SET_CHECKLIST_GENERATING', payload: false });
            }
        }
    };

    const handleAddMaintenanceRecord = (record: Omit<MaintenanceRecord, 'id'>) => {
        setMLog([{ ...record, id: crypto.randomUUID() }, ...mLog]);
        showNotification("Intervento registrato.");
    };

    const handleDeleteMaintenanceRecord = (id: string) => {
        setMLog(mLog.filter(l => l.id !== id));
    };

    const handleAddReminder = (r: Omit<MaintenanceReminder, 'id'>) => {
        setMReminders([...mReminders, { ...r, id: crypto.randomUUID() }]);
    };

    const handleDeleteReminder = (id: string) => {
        setMReminders(mReminders.filter(r => r.id !== id));
    };

    const handleSaveOrUpdateDiagnosis = () => {
        if (!state.diagnosis) return;
        const diag: SavedDiagnosis = {
            id: state.activeDiagnosisId || crypto.randomUUID(),
            vehicleId: state.activeVehicle!.id,
            date: new Date().toISOString(),
            problemDescription: state.drafts.virtualMechanic.problemDescription,
            diagnosisText: state.diagnosis
        };
        if (state.activeDiagnosisId) {
            setDiagnoses(diagnoses.map(d => d.id === diag.id ? diag : d));
        } else {
            setDiagnoses([diag, ...diagnoses]);
        }
        showNotification("Diagnosi salvata.");
    };

    const handleLoadDiagnosis = (id: string) => {
        const d = diagnoses.find(x => x.id === id);
        if (d) {
            dispatch({ type: 'SET_DIAGNOSIS', payload: { diagnosis: d.diagnosisText, diagnosisId: d.id } });
            dispatch({ type: 'UPDATE_MECHANIC_DRAFT', payload: { problemDescription: d.problemDescription } });
        }
    };

    const handleDeleteDiagnosis = (id: string) => {
        setDiagnoses(diagnoses.filter(d => d.id !== id));
    };

    const handleSendMessage = useCallback(async (message: string) => {
        if (state.isChatLoading) return;
        
        let session = state.chatSession;
        if (!session) {
            session = createChatSession(state.activeVehicle, state.chatHistory);
            dispatch({ type: 'SET_DATA', payload: { key: 'chatSession', value: session } });
        }

        const userMsg = { role: 'user', parts: [{ text: message }] };
        const updatedHistory = [...state.chatHistory, userMsg];
        dispatch({ type: 'SET_DATA', payload: { key: 'chatHistory', value: updatedHistory } });
        dispatch({ type: 'SET_CHAT_LOADING', payload: true });
        
        try {
            const streamResponse = await session.sendMessageStream({ message });
            let fullText = "";
            for await (const chunk of streamResponse) {
                const c = chunk as GenerateContentResponse;
                fullText += c.text;
                const newHistory = [...updatedHistory, { role: 'model', parts: [{ text: fullText }] }];
                dispatch({ type: 'SET_DATA', payload: { key: 'chatHistory', value: newHistory } });
            }
        } catch (err: any) {
            showNotification(err.message || "Errore chat.", "error");
        } finally {
            dispatch({ type: 'SET_CHAT_LOADING', payload: false });
        }
    }, [state.chatSession, state.chatHistory, state.isChatLoading, state.activeVehicle, showNotification]);

    const handleClearActiveChat = () => {
        dispatch({ type: 'SET_DATA', payload: { key: 'chatHistory', value: [] } });
        dispatch({ type: 'SET_DATA', payload: { key: 'chatSession', value: null } });
    };

    const handleSaveCurrentChat = () => {
        if (state.chatHistory.length === 0) {
            showNotification("La chat è vuota, nulla da salvare.", "warning");
            return;
        }
        const newChat: SavedChat = {
            id: crypto.randomUUID(),
            vehicleName: state.activeVehicle?.model || "Generica",
            timestamp: new Date().toISOString(),
            history: [...state.chatHistory]
        };
        setSavedChats([newChat, ...chats]);
        showNotification("Conversazione salvata nello storico.");
    };

    const handleLoadChatHistory = (id: string) => {
        const chat = chats.find(c => c.id === id);
        if (chat) {
            dispatch({ type: 'SET_DATA', payload: { key: 'chatHistory', value: chat.history } });
            dispatch({ type: 'SET_DATA', payload: { key: 'chatSession', value: null } }); // Sessione verrà ricreata con history al prossimo invio
            showNotification("Conversazione caricata.");
        }
    };

    const handleDeleteSavedChat = (id: string) => {
        setSavedChats(chats.filter(c => c.id !== id));
        showNotification("Conversazione eliminata dallo storico.");
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

    const handleDownloadPdf = async () => {
        const currentItinerary = state.itinerary;
        if (!currentItinerary) return;
        
        dispatch({ type: 'SET_PDF_GENERATING', payload: true });
        
        setTimeout(() => {
            try {
                generatePdf(
                    `Itinerario_${currentItinerary.tripTitle.replace(/\s/g, '_')}.pdf`,
                    currentItinerary.tripTitle,
                    ({ addWrappedText, addSeparator }) => {
                        addWrappedText(currentItinerary.generalDescription, { size: 12, marginBottom: 5 });
                        currentItinerary.dailySchedule.forEach(day => {
                            addSeparator();
                            addWrappedText(`GIORNO ${day.day}: ${day.stageTitle}`, { size: 14, color: [37, 99, 235], marginBottom: 3 });
                            addWrappedText(`${day.stageKilometers} km - ${day.weatherForecast.conditions}`, { size: 10, marginBottom: 2 });
                            addWrappedText(day.routeDescription);
                            addWrappedText("ATTIVITÀ:", { size: 10, color: [100], marginBottom: 1 });
                            day.activities.forEach(a => addWrappedText(`• ${a}`, { isListItem: true, size: 9 }));
                        });
                    }
                );
            } catch (e: any) {
                showNotification(e.message, "error");
            } finally {
                dispatch({ type: 'SET_PDF_GENERATING', payload: false });
            }
        }, 100);
    };

    const handleDownloadDiagnosisPdf = async () => {
        const currentDiagnosis = state.diagnosis;
        if (!currentDiagnosis) return;
        
        dispatch({ type: 'SET_DIAGNOSIS_PDF_GENERATING', payload: true });
        
        setTimeout(() => {
            try {
                generatePdf(`Diagnosi_${state.activeVehicle?.model || 'Moto'}.pdf`, "Report Diagnosi Meccanica", ({ addWrappedText }) => {
                    addWrappedText(`Veicolo: ${state.activeVehicle?.model || 'N/D'} (${state.activeVehicle?.year || 'N/D'})`);
                    addWrappedText(`Problema Segnalato: ${state.drafts.virtualMechanic.problemDescription}`, { marginBottom: 5 });
                    addWrappedText("ANALISI IA:", { size: 14, color: [37, 99, 235] });
                    addWrappedText(currentDiagnosis);
                });
            } catch (e: any) {
                showNotification(e.message, "error");
            } finally {
                dispatch({ type: 'SET_DIAGNOSIS_PDF_GENERATING', payload: false });
            }
        }, 100);
    };

    const handleDownloadChecklistPdf = async () => {
        const tips = state.maintenanceTips;
        if (!tips) return;
        
        dispatch({ type: 'SET_CHECKLIST_PDF_GENERATING', payload: true });
        
        setTimeout(() => {
            try {
                generatePdf("Checklist_Manutenzione.pdf", "Checklist Pre-Viaggio", ({ addWrappedText, addSeparator }) => {
                    addWrappedText("CONTROLLI ESSENZIALI:", { size: 14, color: [37, 99, 235] });
                    tips.essentialChecks.forEach(c => addWrappedText(`[ ] ${c}`, { isListItem: true }));
                    addSeparator();
                    addWrappedText("EQUIPAGGIAMENTO EMERGENZA:", { size: 14, color: [37, 99, 235] });
                    tips.emergencyEquipment.forEach(c => addWrappedText(`[ ] ${c}`, { isListItem: true }));
                });
            } catch (e: any) {
                showNotification(e.message, "error");
            } finally {
                dispatch({ type: 'SET_CHECKLIST_PDF_GENERATING', payload: false });
            }
        }, 100);
    };

    const handleDownloadDiaryPdf = async (trip: SavedTrip) => {
        dispatch({ type: 'SET_PDF_GENERATING', payload: true });
        
        setTimeout(() => {
            try {
                generatePdf(`Diario_${trip.itinerary.tripTitle.replace(/\s/g, '_')}.pdf`, trip.itinerary.tripTitle, ({ addWrappedText, addSeparator }) => {
                    if (trip.diarySummary) {
                        addWrappedText("IL RACCONTO DEL VIAGGIO:", { size: 14, color: [147, 51, 234] });
                        addWrappedText(trip.diarySummary, { marginBottom: 10 });
                    }
                    trip.itinerary.dailySchedule.forEach(day => {
                        const note = trip.diaryEntries?.find(e => e.day === day.day);
                        if (note) {
                            addSeparator();
                            addWrappedText(`GIORNO ${day.day}: ${day.stageTitle}`, { size: 12, color: [37, 99, 235] });
                            addWrappedText(note.content);
                        }
                    });
                });
            } catch (e: any) {
                showNotification(e.message, "error");
            } finally {
                dispatch({ type: 'SET_PDF_GENERATING', payload: false });
            }
        }, 100);
    };

    return (
        <AppContext.Provider value={{ 
            state, dispatch, 
            handleTripSubmit, handleSendMessage, handleAddVehicle, handleUpdateVehicle, handleDeleteVehicle,
            handleSetActiveVehicle, saveItinerary, handleSaveAndReset, handleResetForm, loadLastItinerary, loadTripFromHistory,
            deleteTripFromHistory, exportTripHistory, importTripHistory, handleDownloadPdf,
            handleMechanicSubmit, handleAddMaintenanceRecord, handleDeleteMaintenanceRecord, handleAddReminder,
            handleDeleteReminder, handleSaveOrUpdateDiagnosis, handleLoadDiagnosis, handleDeleteDiagnosis,
            handleDownloadDiagnosisPdf, handleDownloadChecklistPdf, handleGenerateSpecs,
            handleUpdateTrip, handleGenerateDiarySummary, handleDownloadDiaryPdf,
            handleClearActiveChat, handleSaveCurrentChat, handleLoadChatHistory, handleDeleteSavedChat
        }}>
            {children}
        </AppContext.Provider>
    );
};

export const useAppContext = () => useContext(AppContext);
