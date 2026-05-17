
import { create } from 'zustand';
import { db, auth } from '../firebase';
import { 
    collection, 
    onSnapshot, 
    doc, 
    setDoc, 
    deleteDoc,
    query
} from 'firebase/firestore';
import { Itinerary, SavedTrip } from '../../types';
import { useUIStore } from './useUIStore';
import { useGarageStore } from './useGarageStore';
import { generateItinerary, generateTripDiarySummary } from '../../services/geminiService';
import { generatePdf } from '../utils/pdf';
import { downloadFile } from '../utils/mapsHelpers';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrors';

interface TripState {
    tripHistory: SavedTrip[];
    itinerary: Itinerary | null;
    activeTripId: string | null;
    activeDiaryTripId: string | null;
    draft: {
        tripType: 'itinerary' | 'tour';
        selectedTour: string;
        departure: string;
        destination: string;
        returnPoint: string;
        duration: string;
        period: string;
        roadPreference: string;
        customRoadPreferenceText: string;
        customPrompt: string;
        mapImages: File[];
    };
    
    // Actions
    initTrips: (userId: string) => () => void;
    updateDraft: (update: Partial<TripState['draft']>) => void;
    generateTrip: () => Promise<void>;
    saveItinerary: () => Promise<void>;
    resetPlanner: () => void;
    loadTripFromHistory: (id: string) => void;
    deleteTrip: (id: string) => Promise<void>;
    updateTrip: (updatedTrip: SavedTrip) => Promise<void>;
    setActiveDiaryTrip: (id: string) => void;
    exportHistory: () => void;
    importHistory: (file: File) => Promise<void>;
    updateDiarySummary: (trip: SavedTrip) => Promise<void>;
    downloadPdf: () => void;
    downloadDiaryPdf: (trip: SavedTrip) => void;
}

const initialDraft: TripState['draft'] = {
    tripType: 'itinerary',
    selectedTour: '',
    departure: '',
    destination: '',
    returnPoint: '',
    duration: '',
    period: '',
    roadPreference: '',
    customRoadPreferenceText: '',
    customPrompt: '',
    mapImages: [],
};

export const useTripStore = create<TripState>((set, get) => ({
    tripHistory: [],
    itinerary: null,
    activeTripId: null,
    activeDiaryTripId: null,
    draft: initialDraft,

    initTrips: (userId) => {
        const unsub = onSnapshot(query(collection(db, `users/${userId}/trips`)), (snapshot) => {
            set({ tripHistory: snapshot.docs.map(doc => doc.data().data as SavedTrip) });
        }, (error) => console.error("Firestore Listen Error (trips):", error));
        return unsub;
    },

    updateDraft: (update) => set((state) => ({ draft: { ...state.draft, ...update } })),

    generateTrip: async () => {
        const { setLoading, showNotification } = useUIStore.getState();
        const { activeVehicle } = useGarageStore.getState();
        
        setLoading('isGeneratingItinerary', true);
        try {
            const itinerary = await generateItinerary({ ...get().draft, motorcycle: activeVehicle });
            set({ itinerary, activeTripId: null });
            showNotification("Itinerario calcolato!");
        } catch (err: any) {
            showNotification(err.message || "Errore calcolo viaggio.", "error");
        } finally {
            setLoading('isGeneratingItinerary', false);
        }
    },

    saveItinerary: async () => {
        const { itinerary, activeTripId, draft, tripHistory } = get();
        const { showNotification } = useUIStore.getState();
        const userId = auth.currentUser?.uid;
        if (!itinerary || !userId) return;

        const { mapImages, ...inputsToSave } = draft;

        if (activeTripId) {
            const existingTrip = tripHistory.find(t => t.id === activeTripId);
            if (existingTrip) {
                const updatedTrip = { ...existingTrip, inputs: inputsToSave, itinerary };
                try {
                    await setDoc(doc(db, `users/${userId}/trips`, updatedTrip.id), { id: updatedTrip.id, userId, data: updatedTrip });
                    showNotification("Viaggio aggiornato!");
                } catch (e: any) {
                    handleFirestoreError(e, OperationType.WRITE, `users/${userId}/trips/${updatedTrip.id}`);
                }
                return;
            }
        }

        const newId = crypto.randomUUID();
        const newTrip: SavedTrip = { id: newId, inputs: inputsToSave, itinerary, diaryEntries: [] };
        try {
            await setDoc(doc(db, `users/${userId}/trips`, newId), { id: newId, userId, data: newTrip });
            set({ activeTripId: newId });
            showNotification("Viaggio salvato!");
        } catch (e: any) {
            handleFirestoreError(e, OperationType.WRITE, `users/${userId}/trips/${newId}`);
        }
    },

    resetPlanner: () => set({ itinerary: null, activeTripId: null, draft: initialDraft }),

    loadTripFromHistory: (id) => {
        const trip = get().tripHistory.find(t => t.id === id);
        if (trip) {
            set({ itinerary: trip.itinerary, activeTripId: trip.id, draft: { ...initialDraft, ...trip.inputs } });
        }
    },

    deleteTrip: async (id) => {
        const { showNotification } = useUIStore.getState();
        const userId = auth.currentUser?.uid;
        if (!userId) return;
        try {
            await deleteDoc(doc(db, `users/${userId}/trips`, id));
            if (get().activeTripId === id) set({ activeTripId: null });
            showNotification("Viaggio eliminato.");
        } catch (e: any) {
            handleFirestoreError(e, OperationType.DELETE, `users/${userId}/trips/${id}`);
        }
    },

    updateTrip: async (updatedTrip: SavedTrip) => {
        const { showNotification } = useUIStore.getState();
        const userId = auth.currentUser?.uid;
        if (!userId) return;
        try {
            await setDoc(doc(db, `users/${userId}/trips`, updatedTrip.id), { id: updatedTrip.id, userId, data: updatedTrip });
            showNotification("Diario aggiornato.");
        } catch (e: any) {
            handleFirestoreError(e, OperationType.WRITE, `users/${userId}/trips/${updatedTrip.id}`);
        }
    },

    setActiveDiaryTrip: (id) => set({ activeDiaryTripId: id }),

    exportHistory: () => {
        const data = JSON.stringify(get().tripHistory, null, 2);
        downloadFile(data, 'motomentor_viaggi.json', 'application/json');
    },

    importHistory: async (file) => {
        const { showNotification } = useUIStore.getState();
        const userId = auth.currentUser?.uid;
        if (!userId) return;
        try {
            const imported = JSON.parse(await file.text());
            // In a real app we might want to batch upload these to Firebase
            // for simplicity now we just update local state (which will be overwritten by listener)
            // or we could iterate and save each. Let's just notify.
            showNotification("Funzione import richiede salvataggio manuale.");
        } catch (e) {
            showNotification("Errore importazione.", "error");
        }
    },

    updateDiarySummary: async (trip) => {
        const { setLoading, showNotification } = useUIStore.getState();
        if (!trip.diaryEntries?.length) return;
        
        setLoading('isGeneratingDiarySummary', true);
        try {
            const summary = await generateTripDiarySummary(trip.itinerary, trip.diaryEntries);
            const updatedTrip = { ...trip, diarySummary: summary };
            const userId = auth.currentUser?.uid;
            if (userId) {
                await setDoc(doc(db, `users/${userId}/trips`, trip.id), { id: trip.id, userId, data: updatedTrip });
                showNotification("Racconto generato!");
            }
        } catch (e: any) {
            showNotification("Errore generazione racconto.", "error");
        } finally {
            setLoading('isGeneratingDiarySummary', false);
        }
    },

    downloadPdf: () => {
        const { itinerary } = get();
        const { activeVehicle } = useGarageStore.getState();
        if (!itinerary) return;
        
        useUIStore.getState().setLoading('isGeneratingPdf', true);
        setTimeout(() => {
            try {
                generatePdf(
                    `RoadBook_${itinerary.tripTitle.replace(/\s/g, '_')}.pdf`,
                    `ROAD BOOK: ${itinerary.tripTitle.toUpperCase()}`,
                    ({ addWrappedText, addSeparator }: any) => {
                        addWrappedText("DESCRIZIONE GENERALE", { size: 10, color: [100], marginBottom: 2 });
                        addWrappedText(itinerary.generalDescription, { size: 11, marginBottom: 8 });
                        if (activeVehicle) {
                            addWrappedText("VEICOLO:", { size: 9, color: [100], marginBottom: 1 });
                            addWrappedText(`${activeVehicle.model} (${activeVehicle.year})`, { size: 11, marginBottom: 5 });
                        }
                        itinerary.dailySchedule.forEach((day: any) => {
                            addSeparator({ marginTop: 8, marginBottom: 8 });
                            addWrappedText(`TAPPA ${day.day}: ${day.stageTitle.toUpperCase()}`, { size: 14, color: [37, 99, 235], marginBottom: 5 });
                            addWrappedText(day.routeDescription, { size: 11, marginBottom: 6 });
                        });
                    }
                );
            } finally {
                useUIStore.getState().setLoading('isGeneratingPdf', false);
            }
        }, 100);
    },

    downloadDiaryPdf: (trip) => {
        useUIStore.getState().setLoading('isGeneratingPdf', true);
        setTimeout(() => {
            try {
                generatePdf(`Diario_${trip.itinerary.tripTitle.replace(/\s/g, '_')}.pdf`, trip.itinerary.tripTitle, ({ addWrappedText, addSeparator }: any) => {
                    if (trip.diarySummary) {
                        addWrappedText("IL RACCONTO DEL VIAGGIO:", { size: 14, color: [147, 51, 234] });
                        addWrappedText(trip.diarySummary, { marginBottom: 10 });
                    }
                    trip.itinerary.dailySchedule.forEach((day: any) => {
                        const note = trip.diaryEntries?.find((e: any) => e.day === day.day);
                        if (note) {
                            addSeparator();
                            addWrappedText(`GIORNO ${day.day}: ${day.stageTitle}`, { size: 12, color: [37, 99, 235] });
                            addWrappedText(note.content);
                        }
                    });
                });
            } finally {
                useUIStore.getState().setLoading('isGeneratingPdf', false);
            }
        }, 100);
    }
}));
