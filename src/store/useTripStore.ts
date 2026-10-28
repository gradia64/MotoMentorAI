
import { create } from 'zustand';
import { subscribeCollection, upsertDoc, removeDoc, listCollection, saveSharedTripFile, getPlanningStatus, planTripWithProvider } from '../local/client';
import type { PlanTripResult } from '../local/types';
import { Itinerary, SavedTrip, SharedTrip, ITINERARY_SCHEMA } from '../../types';
import { useUIStore } from './useUIStore';
import { useGarageStore } from './useGarageStore';
import { useAuthStore } from './useAuthStore';
import { buildItineraryRequest, generateItinerary, generateTripDiarySummary, formatGeminiError, parseItineraryResponse, ItineraryRequest } from '../../services/geminiService';
import { generatePdf } from '../utils/pdf';
import { downloadFile } from '../utils/mapsHelpers';
import { handleDataError, OperationType } from '../utils/dataErrors';
import { normalizeSavedTrip, normalizeItinerary, formatModelName } from '../utils/itinerary';
import { geminiToJsonSchema } from '../utils/jsonSchema';

interface TripState {
    tripHistory: SavedTrip[];
    itinerary: Itinerary | null;
    activeTripId: string | null;
    activeDiaryTripId: string | null;
    sharedTrip: SharedTrip | null;
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
    updateTrip: (updatedTrip: SavedTrip) => Promise<boolean>;
    setActiveDiaryTrip: (id: string) => void;
    exportHistory: () => void;
    importHistory: (file: File) => Promise<void>;
    updateDiarySummary: (trip: SavedTrip) => Promise<void>;
    downloadPdf: () => void;
    downloadDiaryPdf: (trip: SavedTrip) => void;
    shareTrip: () => Promise<string | null>;
    getSharedTrip: (id: string) => Promise<SharedTrip | null>;
    reset: () => void;
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

// Formato documento: { id, userId, data } — identico a quanto faceva Firestore.
interface TripDoc {
    id: string;
    userId: string;
    data: SavedTrip;
}

const currentUid = (): string | undefined => useAuthStore.getState().user?.id;

const ITINERARY_JSON_SCHEMA = geminiToJsonSchema(ITINERARY_SCHEMA);

const PROVIDER_LABELS = { openrouter: 'OpenRouter', deepseek: 'DeepSeek' } as const;

// Pianificazione con il fornitore a pagamento scelto nelle Impostazioni.
// null se non ce n'è uno attivo; un errore se attivo ma non riuscito (o se il
// modello non legge gli screenshot allegati): in entrambi i casi decide Gemini.
// "Costo OpenRouter: $0.173" / "Costo stimato DeepSeek: circa $0.004 (15.230 token)".
const costMessage = (label: string, result: PlanTripResult): string => {
    const tokens = result.tokens !== null ? ` (${result.tokens.toLocaleString('it-IT')} token)` : '';
    if (result.cost === null) return tokens ? ` Token usati con ${label}:${tokens.slice(1, -1)}.` : '';
    const amount = `$${result.cost < 0.001 ? result.cost.toFixed(4) : result.cost.toFixed(3)}`;
    return result.costEstimated
        ? ` Costo stimato ${label}: circa ${amount}${tokens}.`
        : ` Costo ${label}: ${amount}${tokens}.`;
};

const planWithProvider = async (request: ItineraryRequest): Promise<{ itinerary: Itinerary; costText: string } | null> => {
    const status = await getPlanningStatus().catch(() => null);
    if (!status?.provider || !status.model) return null;
    const label = PROVIDER_LABELS[status.provider];
    if (request.images.length > 0 && !status.vision) {
        throw new Error(`${status.modelName || status.model} non legge le immagini allegate`);
    }
    const result = await planTripWithProvider({
        // Lo schema anche nel testo: DeepSeek accetta solo json_object e non
        // tutti i provider di OpenRouter applicano lo schema allo stesso modo.
        prompt: `${request.prompt}\n\nSchema JSON da rispettare:\n${JSON.stringify(ITINERARY_JSON_SCHEMA)}`,
        images: request.images,
        schema: ITINERARY_JSON_SCHEMA,
    });
    const itinerary = normalizeItinerary(parseItineraryResponse(result.content));
    if (!itinerary || itinerary.dailySchedule.length === 0) {
        throw new Error('il modello ha restituito un itinerario senza tappe');
    }
    return {
        itinerary: { ...itinerary, generatedBy: `${status.provider}:${result.model}` },
        costText: costMessage(label, result),
    };
};

export const useTripStore = create<TripState>((set, get) => ({
    tripHistory: [],
    itinerary: null,
    activeTripId: null,
    activeDiaryTripId: null,
    sharedTrip: null,
    draft: initialDraft,

    initTrips: (userId) => {
        const unsub = subscribeCollection<TripDoc>(`users/${userId}/trips`, (rows) => {
            set({ tripHistory: rows.map(row => row.data) });
        });
        return unsub;
    },

    updateDraft: (update) => set((state) => ({ draft: { ...state.draft, ...update } })),

    generateTrip: async () => {
        const { setLoading, showNotification } = useUIStore.getState();
        const { activeVehicle } = useGarageStore.getState();
        
        setLoading('isGeneratingItinerary', true);
        try {
            const request = await buildItineraryRequest({ ...get().draft, motorcycle: activeVehicle });
            let message = "Itinerario calcolato!";
            let type: 'success' | 'warning' = 'success';
            let itinerary: Itinerary | null = null;
            try {
                const planned = await planWithProvider(request);
                if (planned) {
                    itinerary = planned.itinerary;
                    message = `Itinerario calcolato!${planned.costText}`;
                }
            } catch (e: any) {
                // Fornitore attivo ma non riuscito (credito, modello, tempo,
                // immagini non supportate): l'itinerario si genera con Gemini.
                console.warn('Fornitore di pianificazione non disponibile, uso Gemini:', e);
                message = `Pianificazione a pagamento non riuscita (${e?.message || e}): itinerario calcolato con Gemini.`;
                type = 'warning';
            }
            if (!itinerary) itinerary = await generateItinerary(request);
            set({ itinerary, activeTripId: null });
            showNotification(message, type);
        } catch (err: any) {
            showNotification(formatGeminiError(err) || "Errore calcolo viaggio.", "error");
        } finally {
            setLoading('isGeneratingItinerary', false);
        }
    },

    saveItinerary: async () => {
        const { itinerary, activeTripId, draft, tripHistory } = get();
        const { showNotification } = useUIStore.getState();
        const userId = currentUid();
        if (!itinerary || !userId) return;

        const { mapImages, ...inputsToSave } = draft;

        if (activeTripId) {
            const existingTrip = tripHistory.find(t => t.id === activeTripId);
            if (existingTrip) {
                const updatedTrip = { ...existingTrip, inputs: inputsToSave, itinerary };
                try {
                    await upsertDoc(`users/${userId}/trips`, updatedTrip.id, { id: updatedTrip.id, userId, data: updatedTrip });
                    showNotification("Viaggio aggiornato!");
                } catch (e: any) {
                    showNotification(handleDataError(e, OperationType.WRITE, `users/${userId}/trips/${updatedTrip.id}`), "error");
                }
                return;
            }
        }

        const newId = crypto.randomUUID();
        const newTrip: SavedTrip = { id: newId, inputs: inputsToSave, itinerary, diaryEntries: [] };
        try {
            await upsertDoc(`users/${userId}/trips`, newId, { id: newId, userId, data: newTrip });
            set({ activeTripId: newId });
            showNotification("Viaggio salvato!");
        } catch (e: any) {
            showNotification(handleDataError(e, OperationType.WRITE, `users/${userId}/trips/${newId}`), "error");
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
        const userId = currentUid();
        if (!userId) return;
        try {
            await removeDoc(`users/${userId}/trips`, id);
            // Il viaggio eliminato non deve restare aperto: "Salva" lo
            // ricreerebbe con un nuovo id.
            if (get().activeTripId === id) set({ activeTripId: null, itinerary: null });
            if (get().activeDiaryTripId === id) set({ activeDiaryTripId: null });
            showNotification("Viaggio eliminato.");
        } catch (e: any) {
            showNotification(handleDataError(e, OperationType.DELETE, `users/${userId}/trips/${id}`), "error");
        }
    },

    updateTrip: async (updatedTrip) => {
        const { showNotification } = useUIStore.getState();
        const userId = currentUid();
        if (!userId) return false;
        try {
            await upsertDoc(`users/${userId}/trips`, updatedTrip.id, { id: updatedTrip.id, userId, data: updatedTrip });
            showNotification("Diario aggiornato.");
            return true;
        } catch (e: any) {
            showNotification(handleDataError(e, OperationType.WRITE, `users/${userId}/trips/${updatedTrip.id}`), "error");
            return false;
        }
    },

    setActiveDiaryTrip: (id) => set({ activeDiaryTripId: id }),

    exportHistory: () => {
        const data = JSON.stringify(get().tripHistory, null, 2);
        downloadFile(data, 'motomentor_viaggi.json', 'application/json');
    },

    importHistory: async (file) => {
        const { showNotification } = useUIStore.getState();
        const userId = currentUid();
        if (!userId) return;
        try {
            const imported = JSON.parse(await file.text());
            if (!Array.isArray(imported)) throw new Error("Formato file non valido.");

            // Miglioria rispetto alla versione Firebase: l'import ora salva
            // davvero ogni viaggio nel database locale.
            // Ogni viaggio viene normalizzato: un file malformato non deve
            // poi mandare in crash il Diario o la generazione dei PDF.
            let saved = 0;
            let skipped = 0;
            for (const raw of imported) {
                const trip = normalizeSavedTrip(raw);
                if (!trip) { skipped++; continue; }
                await upsertDoc(`users/${userId}/trips`, trip.id, { id: trip.id, userId, data: trip });
                saved++;
            }
            showNotification(
                `Importati ${saved} viaggi nell'archivio locale.` + (skipped ? ` ${skipped} voci non valide ignorate.` : ''),
                skipped ? 'warning' : 'success'
            );
        } catch (e: any) {
            showNotification("Errore importazione: " + (e.message || "file non valido"), "error");
        }
    },

    updateDiarySummary: async (trip) => {
        const { setLoading, showNotification } = useUIStore.getState();
        if (!trip.diaryEntries?.length) return;
        
        setLoading('isGeneratingDiarySummary', true);
        try {
            const summary = await generateTripDiarySummary(trip.itinerary, trip.diaryEntries);
            const updatedTrip = { ...trip, diarySummary: summary };
            const userId = currentUid();
            if (userId) {
                await upsertDoc(`users/${userId}/trips`, trip.id, { id: trip.id, userId, data: updatedTrip });
                showNotification("Racconto generato!");
            }
        } catch (e) {
            showNotification(`Errore generazione racconto: ${formatGeminiError(e)}`, "error");
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
                        if (itinerary.generatedBy) {
                            addSeparator({ marginTop: 8, marginBottom: 4 });
                            addWrappedText(`Viaggio pianificato da ${formatModelName(itinerary.generatedBy)}`, { size: 9, color: [107, 114, 128], marginBottom: 0 });
                        }
                    }
                );
            } catch (error) {
                console.error("PDF generation error:", error);
                useUIStore.getState().showNotification("Errore durante la generazione del PDF.", "error");
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
            } catch (error) {
                console.error("PDF generation error:", error);
                useUIStore.getState().showNotification("Errore durante la generazione del PDF.", "error");
            } finally {
                useUIStore.getState().setLoading('isGeneratingPdf', false);
            }
        }, 100);
    },

    shareTrip: async () => {
        const { itinerary } = get();
        const { showNotification } = useUIStore.getState();
        const user = useAuthStore.getState().user;
        if (!itinerary || !user) return null;

        const sharedId = crypto.randomUUID();
        const sharedTrip: SharedTrip = {
            id: sharedId,
            ownerId: user.id,
            ownerName: user.username,
            tripTitle: itinerary.tripTitle,
            itinerary: itinerary,
            createdAt: new Date().toISOString()
        };

        try {
            // Con il desktop locale la condivisione e' un FILE esportabile
            // (niente link cloud). La copia nel DB locale si salva solo dopo
            // che il file è stato scritto: un dialog annullato non deve
            // lasciare righe orfane in sharedTrips.
            const saved = await saveSharedTripFile(sharedTrip);
            if (!saved) {
                // Nessun file creato: il chiamante non deve mostrare il banner.
                showNotification("Esportazione annullata.", "warning");
                return null;
            }
            await upsertDoc('sharedTrips', sharedId, sharedTrip);
            showNotification("Viaggio condiviso esportato come file!");
            return sharedId;
        } catch (e: any) {
            showNotification(handleDataError(e, OperationType.WRITE, `sharedTrips/${sharedId}`), "error");
            return null;
        }
    },

    getSharedTrip: async (id) => {
        try {
            const rows = await listCollection<SharedTrip>('sharedTrips');
            const data = rows.find(t => t.id === id) || null;
            set({ sharedTrip: data });
            return data;
        } catch (e) {
            console.error("Error fetching shared trip:", e);
            return null;
        }
    },

    reset: () => set({
        tripHistory: [],
        itinerary: null,
        activeTripId: null,
        activeDiaryTripId: null,
        sharedTrip: null,
        draft: initialDraft,
    }),
}));
