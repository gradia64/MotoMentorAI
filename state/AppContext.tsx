
import React, { createContext, useReducer, useContext, useEffect, ReactNode, useCallback, FormEvent } from 'react';
import { Chat, Content, GenerateContentResponse } from '@google/genai';
import { generateItinerary, diagnoseProblem, getMaintenanceTips, createChatSession, getVehicleSpecs, generateTripDiarySummary } from '../services/geminiService';
import { Itinerary, MaintenanceTips, GarageVehicle, AiMode, SavedTrip, MaintenanceRecord, MaintenanceReminder, SavedDiagnosis, DiaryEntry, MaintenanceType, SavedChat } from '../types';
import { generatePdf } from '../utils/pdf';
import { downloadFile } from '../utils/mapsHelpers';
import { auth, db } from '../src/firebase';
import { 
    onAuthStateChanged, 
    signInWithPopup, 
    GoogleAuthProvider, 
    signOut,
    User as FirebaseUser
} from 'firebase/auth';
import { 
    doc, 
    setDoc, 
    getDoc, 
    getDocs, 
    collection, 
    deleteDoc, 
    onSnapshot, 
    query, 
    orderBy,
    getDocFromServer
} from 'firebase/firestore';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: any, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

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
    user: any | null;
    isAuthenticated: boolean;
    isCheckingAuth: boolean;
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
    activeChatId: string | null;
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
    | { type: 'SET_AUTH'; payload: { user: any | null, isAuthenticated: boolean } }
    | { type: 'SET_CHECKING_AUTH'; payload: boolean }
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
    user: null,
    isAuthenticated: false,
    isCheckingAuth: true,
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
    activeChatId: null,
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
        case 'SET_AUTH': return { ...state, user: action.payload.user, isAuthenticated: action.payload.isAuthenticated };
        case 'SET_CHECKING_AUTH': return { ...state, isCheckingAuth: action.payload };
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
    
    const [garage, setGarage] = React.useState<GarageVehicle[]>([]);
    const [activeVehId, setActiveVehId] = React.useState<string | null>(() => {
        return localStorage.getItem('motomentor_active_vehicle') || null;
    });
    const [trips, setTrips] = React.useState<SavedTrip[]>([]);
    const [diagnoses, setDiagnoses] = React.useState<SavedDiagnosis[]>([]);
    const [mLog, setMLog] = React.useState<MaintenanceRecord[]>([]);
    const [mReminders, setMReminders] = React.useState<MaintenanceReminder[]>([]);
    const [chats, setSavedChats] = React.useState<SavedChat[]>([]);

    useEffect(() => {
        async function testConnection() {
            try {
                await getDocFromServer(doc(db, 'test', 'connection'));
            } catch (error) {
                if(error instanceof Error && error.message.includes('the client is offline')) {
                    console.error("Please check your Firebase configuration. ");
                }
            }
        }
        testConnection();
    }, []);

    const showNotification = (message: string, type: 'success' | 'error' | 'warning' = 'success') => {
        dispatch({ type: 'SET_NOTIFICATION', payload: { message, type } });
        setTimeout(() => {
            dispatch({ type: 'SET_NOTIFICATION', payload: null });
        }, 5000);
    };

    const checkAuth = () => {
        console.log("Inizio controllo autenticazione...");
        dispatch({ type: 'SET_CHECKING_AUTH', payload: true });
        onAuthStateChanged(auth, async (user) => {
            console.log("Stato autenticazione cambiato:", user ? `Utente: ${user.uid}` : "Nessun utente");
            if (user) {
                dispatch({ type: 'SET_AUTH', payload: { 
                    user: { id: user.uid, username: user.displayName || user.email?.split('@')[0] || 'Utente' }, 
                    isAuthenticated: true 
                } });
                
                // Set up real-time listeners
                const userId = user.uid;
                
                const garageUnsub = onSnapshot(collection(db, `users/${userId}/vehicles`), (snapshot) => {
                    setGarage(snapshot.docs.map(doc => doc.data() as GarageVehicle));
                }, (error) => handleFirestoreError(error, OperationType.LIST, `users/${userId}/vehicles`));

                const tripsUnsub = onSnapshot(query(collection(db, `users/${userId}/trips`)), (snapshot) => {
                    setTrips(snapshot.docs.map(doc => doc.data().data as SavedTrip));
                }, (error) => handleFirestoreError(error, OperationType.LIST, `users/${userId}/trips`));

                const diagnosesUnsub = onSnapshot(collection(db, `users/${userId}/diagnoses`), (snapshot) => {
                    setDiagnoses(snapshot.docs.map(doc => doc.data().data as SavedDiagnosis));
                }, (error) => handleFirestoreError(error, OperationType.LIST, `users/${userId}/diagnoses`));

                const maintenanceUnsub = onSnapshot(collection(db, `users/${userId}/maintenance`), (snapshot) => {
                    setMLog(snapshot.docs.map(doc => doc.data().data as MaintenanceRecord));
                }, (error) => handleFirestoreError(error, OperationType.LIST, `users/${userId}/maintenance`));

                const remindersUnsub = onSnapshot(collection(db, `users/${userId}/reminders`), (snapshot) => {
                    setMReminders(snapshot.docs.map(doc => doc.data().data as MaintenanceReminder));
                }, (error) => handleFirestoreError(error, OperationType.LIST, `users/${userId}/reminders`));

                const chatsUnsub = onSnapshot(collection(db, `users/${userId}/chats`), (snapshot) => {
                    setSavedChats(snapshot.docs.map(doc => doc.data().data as SavedChat));
                }, (error) => handleFirestoreError(error, OperationType.LIST, `users/${userId}/chats`));

                dispatch({ type: 'SET_CHECKING_AUTH', payload: false });

                return () => {
                    garageUnsub();
                    tripsUnsub();
                    diagnosesUnsub();
                    maintenanceUnsub();
                    remindersUnsub();
                    chatsUnsub();
                };
            } else {
                dispatch({ type: 'SET_AUTH', payload: { user: null, isAuthenticated: false } });
                dispatch({ type: 'SET_CHECKING_AUTH', payload: false });
                setGarage([]);
                setTrips([]);
                setDiagnoses([]);
                setMLog([]);
                setMReminders([]);
                setSavedChats([]);
            }
        });
    };

    const loginWithGoogle = async () => {
        const provider = new GoogleAuthProvider();
        // Force account selection to help with some auth issues
        provider.setCustomParameters({
            prompt: 'select_account'
        });
        
        try {
            const result = await signInWithPopup(auth, provider);
            if (!result.user) {
                throw new Error("Accesso fallito: nessun utente restituito.");
            }
            return result.user;
        } catch (error: any) {
            console.error("Errore login Google:", error);
            showNotification(error.message, "error");
            throw error; // Re-throw so the UI can handle it
        }
    };

    const logout = async () => {
        try {
            await signOut(auth);
            localStorage.removeItem('motomentor_active_vehicle');
        } catch (error: any) {
            showNotification(error.message, "error");
        }
    };

    const handleAddVehicle = async (v: any) => {
        const userId = auth.currentUser?.uid;
        if (!userId) return;
        const newVeh = { ...v, id: crypto.randomUUID(), userId };
        try {
            await setDoc(doc(db, `users/${userId}/vehicles`, newVeh.id), newVeh);
            showNotification("Moto aggiunta al garage!");
        } catch (e: any) {
            handleFirestoreError(e, OperationType.WRITE, `users/${userId}/vehicles/${newVeh.id}`);
        }
    };

    const handleUpdateVehicle = async (updated: GarageVehicle) => {
        const userId = auth.currentUser?.uid;
        if (!userId) return;
        try {
            await setDoc(doc(db, `users/${userId}/vehicles`, updated.id), updated);
            showNotification("Dati veicolo aggiornati.");
        } catch (e: any) {
            handleFirestoreError(e, OperationType.WRITE, `users/${userId}/vehicles/${updated.id}`);
        }
    };

    const handleDeleteVehicle = async (id: string) => {
        const userId = auth.currentUser?.uid;
        if (!userId) return;
        try {
            await deleteDoc(doc(db, `users/${userId}/vehicles`, id));
            if (activeVehId === id) {
                setActiveVehId(null);
                localStorage.removeItem('motomentor_active_vehicle');
            }
            showNotification("Veicolo rimosso.");
        } catch (e: any) {
            handleFirestoreError(e, OperationType.DELETE, `users/${userId}/vehicles/${id}`);
        }
    };

    const handleSetActiveVehicle = (id: string) => {
        setActiveVehId(id);
        localStorage.setItem('motomentor_active_vehicle', id);
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

    const saveItinerary = useCallback(async () => {
        if (!state.itinerary) return;
        const userId = auth.currentUser?.uid;
        if (!userId) return;

        const existingTrip = state.activeTripId ? trips.find(t => t.id === state.activeTripId) : null;

        if (existingTrip) {
            const isUnchanged = JSON.stringify(existingTrip.inputs) === JSON.stringify(state.drafts.tripPlanner) &&
                              JSON.stringify(existingTrip.itinerary) === JSON.stringify(state.itinerary);
            
            if (isUnchanged) {
                showNotification("Nessuna modifica rilevata, il viaggio è già salvato.", "warning");
                return;
            }

            const updatedTrip = {
                ...existingTrip,
                inputs: { ...state.drafts.tripPlanner },
                itinerary: state.itinerary!
            };
            
            try {
                await setDoc(doc(db, `users/${userId}/trips`, updatedTrip.id), { id: updatedTrip.id, userId, data: updatedTrip });
                showNotification("Viaggio aggiornato nello storico.");
            } catch (e: any) {
                handleFirestoreError(e, OperationType.WRITE, `users/${userId}/trips/${updatedTrip.id}`);
            }
            return;
        }

        const newId = crypto.randomUUID();
        const newTrip: SavedTrip = {
            id: newId,
            inputs: { ...state.drafts.tripPlanner },
            itinerary: state.itinerary,
            diaryEntries: []
        };
        try {
            await setDoc(doc(db, `users/${userId}/trips`, newId), { id: newId, userId, data: newTrip });
            dispatch({ type: 'SET_DATA', payload: { key: 'activeTripId', value: newId } });
            showNotification("Viaggio salvato nello storico.");
        } catch (e: any) {
            handleFirestoreError(e, OperationType.WRITE, `users/${userId}/trips/${newId}`);
        }
    }, [state.itinerary, state.activeTripId, state.drafts.tripPlanner, trips, showNotification]);

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

    const deleteTripFromHistory = async (id: string) => {
        const userId = auth.currentUser?.uid;
        if (!userId) return;
        try {
            await deleteDoc(doc(db, `users/${userId}/trips`, id));
            if (state.activeTripId === id) {
                dispatch({ type: 'SET_DATA', payload: { key: 'activeTripId', value: null } });
            }
            showNotification("Viaggio eliminato.");
        } catch (e: any) {
            handleFirestoreError(e, OperationType.DELETE, `users/${userId}/trips/${id}`);
        }
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

    const handleAddMaintenanceRecord = async (record: Omit<MaintenanceRecord, 'id'>) => {
        const userId = auth.currentUser?.uid;
        if (!userId) return;
        const newRecord = { ...record, id: crypto.randomUUID() };
        try {
            await setDoc(doc(db, `users/${userId}/maintenance`, newRecord.id), { id: newRecord.id, userId, data: newRecord });
            showNotification("Intervento registrato.");
        } catch (e: any) {
            handleFirestoreError(e, OperationType.WRITE, `users/${userId}/maintenance/${newRecord.id}`);
        }
    };

    const handleDeleteMaintenanceRecord = async (id: string) => {
        const userId = auth.currentUser?.uid;
        if (!userId) return;
        try {
            await deleteDoc(doc(db, `users/${userId}/maintenance`, id));
        } catch (e: any) {
            handleFirestoreError(e, OperationType.DELETE, `users/${userId}/maintenance/${id}`);
        }
    };

    const handleAddReminder = async (r: Omit<MaintenanceReminder, 'id'>) => {
        const userId = auth.currentUser?.uid;
        if (!userId) return;
        const newReminder = { ...r, id: crypto.randomUUID() };
        try {
            await setDoc(doc(db, `users/${userId}/reminders`, newReminder.id), { id: newReminder.id, userId, data: newReminder });
        } catch (e: any) {
            handleFirestoreError(e, OperationType.WRITE, `users/${userId}/reminders/${newReminder.id}`);
        }
    };

    const handleDeleteReminder = async (id: string) => {
        const userId = auth.currentUser?.uid;
        if (!userId) return;
        try {
            await deleteDoc(doc(db, `users/${userId}/reminders`, id));
        } catch (e: any) {
            handleFirestoreError(e, OperationType.DELETE, `users/${userId}/reminders/${id}`);
        }
    };

    const handleSaveOrUpdateDiagnosis = async () => {
        if (!state.diagnosis) return;
        const userId = auth.currentUser?.uid;
        if (!userId) return;
        const diag: SavedDiagnosis = {
            id: state.activeDiagnosisId || crypto.randomUUID(),
            vehicleId: state.activeVehicle!.id,
            date: new Date().toISOString(),
            problemDescription: state.drafts.virtualMechanic.problemDescription,
            diagnosisText: state.diagnosis
        };
        try {
            await setDoc(doc(db, `users/${userId}/diagnoses`, diag.id), { id: diag.id, userId, data: diag });
            showNotification("Diagnosi salvata.");
        } catch (e: any) {
            handleFirestoreError(e, OperationType.WRITE, `users/${userId}/diagnoses/${diag.id}`);
        }
    };

    const handleLoadDiagnosis = (id: string) => {
        const d = diagnoses.find(x => x.id === id);
        if (d) {
            dispatch({ type: 'SET_DIAGNOSIS', payload: { diagnosis: d.diagnosisText, diagnosisId: d.id } });
            dispatch({ type: 'UPDATE_MECHANIC_DRAFT', payload: { problemDescription: d.problemDescription } });
        }
    };

    const handleDeleteDiagnosis = async (id: string) => {
        const userId = auth.currentUser?.uid;
        if (!userId) return;
        try {
            await deleteDoc(doc(db, `users/${userId}/diagnoses`, id));
        } catch (e: any) {
            handleFirestoreError(e, OperationType.DELETE, `users/${userId}/diagnoses/${id}`);
        }
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
        dispatch({ type: 'SET_DATA', payload: { key: 'activeChatId', value: null } });
    };

    const handleSaveCurrentChat = async () => {
        if (state.chatHistory.length === 0) {
            showNotification("La chat è vuota, nulla da salvare.", "warning");
            return;
        }

        const userId = auth.currentUser?.uid;
        if (!userId) return;

        if (state.activeChatId) {
            // Aggiorna chat esistente
            const updatedChat = {
                ...chats.find(c => c.id === state.activeChatId)!,
                history: [...state.chatHistory],
                timestamp: new Date().toISOString()
            };
            try {
                await setDoc(doc(db, `users/${userId}/chats`, updatedChat.id), { id: updatedChat.id, userId, data: updatedChat });
                showNotification("Conversazione aggiornata nello storico.");
            } catch (e: any) {
                handleFirestoreError(e, OperationType.WRITE, `users/${userId}/chats/${updatedChat.id}`);
            }
        } else {
            // Crea nuova chat
            const newId = crypto.randomUUID();
            const newChat: SavedChat = {
                id: newId,
                vehicleName: state.activeVehicle?.model || "Generica",
                timestamp: new Date().toISOString(),
                history: [...state.chatHistory]
            };
            try {
                await setDoc(doc(db, `users/${userId}/chats`, newId), { id: newId, userId, data: newChat });
                dispatch({ type: 'SET_DATA', payload: { key: 'activeChatId', value: newId } });
                showNotification("Conversazione salvata nello storico.");
            } catch (e: any) {
                handleFirestoreError(e, OperationType.WRITE, `users/${userId}/chats/${newId}`);
            }
        }
    };

    const handleLoadChatHistory = (id: string) => {
        const chat = chats.find(c => c.id === id);
        if (chat) {
            dispatch({ type: 'SET_DATA', payload: { key: 'chatHistory', value: chat.history } });
            dispatch({ type: 'SET_DATA', payload: { key: 'chatSession', value: null } });
            dispatch({ type: 'SET_DATA', payload: { key: 'activeChatId', value: chat.id } });
            showNotification("Conversazione caricata.");
        }
    };

    const handleDeleteSavedChat = async (id: string) => {
        const userId = auth.currentUser?.uid;
        if (!userId) return;
        try {
            await deleteDoc(doc(db, `users/${userId}/chats`, id));
            if (state.activeChatId === id) {
                dispatch({ type: 'SET_DATA', payload: { key: 'activeChatId', value: null } });
            }
            showNotification("Conversazione eliminata dallo storico.");
        } catch (e: any) {
            handleFirestoreError(e, OperationType.DELETE, `users/${userId}/chats/${id}`);
        }
    };

    const handleUpdateTrip = async (updatedTrip: SavedTrip) => {
        const userId = auth.currentUser?.uid;
        if (!userId) return;
        try {
            await setDoc(doc(db, `users/${userId}/trips`, updatedTrip.id), { id: updatedTrip.id, userId, data: updatedTrip });
        } catch (e: any) {
            handleFirestoreError(e, OperationType.WRITE, `users/${userId}/trips/${updatedTrip.id}`);
        }
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
            handleClearActiveChat, handleSaveCurrentChat, handleLoadChatHistory, handleDeleteSavedChat,
            loginWithGoogle, logout, checkAuth
        }}>
            {children}
        </AppContext.Provider>
    );
};

export const useAppContext = () => useContext(AppContext);
