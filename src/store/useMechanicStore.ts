
import { create } from 'zustand';
import { subscribeCollection, upsertDoc, removeDoc } from '../local/client';
import { MaintenanceRecord, MaintenanceReminder, SavedDiagnosis, MaintenanceTips } from '../../types';
import { useUIStore } from './useUIStore';
import { useGarageStore } from './useGarageStore';
import { useTripStore } from './useTripStore';
import { useAuthStore } from './useAuthStore';
import { diagnoseProblem, getMaintenanceTips, scanReceiptImage } from '../../services/geminiService';
import { generatePdf } from '../utils/pdf';
import { handleDataError, OperationType } from '../utils/dataErrors';
import { formatLocalDate, localDateTime } from '../utils/hooks';

interface MechanicState {
    maintenanceLog: MaintenanceRecord[];
    reminders: MaintenanceReminder[];
    savedDiagnoses: SavedDiagnosis[];
    diagnosis: string | null;
    activeDiagnosisId: string | null;
    maintenanceTips: MaintenanceTips | null;
    mechanicMode: 'diagnose' | 'maintenance' | 'workshop';
    draft: {
        problemDescription: string;
        problemImage: File | null;
    };
    
    // Actions
    initMechanic: (userId: string) => () => void;
    setMechanicMode: (mode: MechanicState['mechanicMode']) => void;
    updateDraft: (update: Partial<MechanicState['draft']>) => void;
    submitDiagnosis: () => Promise<void>;
    submitMaintenanceTips: () => Promise<void>;
    saveDiagnosis: () => Promise<void>;
    loadDiagnosis: (id: string) => void;
    deleteDiagnosis: (id: string) => Promise<void>;
    addMaintenanceRecord: (record: Omit<MaintenanceRecord, 'id'>) => Promise<void>;
    deleteMaintenanceRecord: (id: string) => Promise<void>;
    addReminder: (r: Omit<MaintenanceReminder, 'id'>) => Promise<void>;
    deleteReminder: (id: string) => Promise<void>;
    scanReceipt: (image: File) => Promise<any>;
    downloadDiagnosisPdf: () => void;
    downloadChecklistPdf: () => void;
    downloadMaintenanceLogPdf: () => void;
    reset: () => void;
}

// Formato documento: { id, userId, data } — identico a quanto faceva Firestore.
interface Doc<T> {
    id: string;
    userId: string;
    data: T;
}

const currentUid = (): string | undefined => useAuthStore.getState().user?.id;

// Interventi e promemoria appartengono a un veicolo. I record senza vehicleId
// (creati prima del campo) non sono attribuibili e restano visibili ovunque.
export const belongsToVehicle = (item: { vehicleId?: string }, vehicleId: string | undefined): boolean =>
    !item.vehicleId || item.vehicleId === vehicleId;

const initialMechanicState = {
    maintenanceLog: [] as MaintenanceRecord[],
    reminders: [] as MaintenanceReminder[],
    savedDiagnoses: [] as SavedDiagnosis[],
    diagnosis: null,
    activeDiagnosisId: null,
    maintenanceTips: null,
    mechanicMode: 'workshop' as const,
    draft: {
        problemDescription: '',
        problemImage: null,
    },
};

export const useMechanicStore = create<MechanicState>((set, get) => ({
    ...initialMechanicState,

    initMechanic: (userId) => {
        const unsub1 = subscribeCollection<Doc<MaintenanceRecord>>(`users/${userId}/maintenance`, (rows) => {
            set({ maintenanceLog: rows.map(row => row.data) });
        });
        const unsub2 = subscribeCollection<Doc<MaintenanceReminder>>(`users/${userId}/reminders`, (rows) => {
            set({ reminders: rows.map(row => row.data) });
        });
        const unsub3 = subscribeCollection<Doc<SavedDiagnosis>>(`users/${userId}/diagnoses`, (rows) => {
            set({ savedDiagnoses: rows.map(row => row.data) });
        });
        return () => { unsub1(); unsub2(); unsub3(); };
    },

    setMechanicMode: (mechanicMode) => set({ mechanicMode }),
    updateDraft: (update) => set((state) => ({ draft: { ...state.draft, ...update } })),

    submitDiagnosis: async () => {
        const { setLoading, showNotification } = useUIStore.getState();
        const { activeVehicle } = useGarageStore.getState();
        const { draft } = get();
        
        setLoading('isDiagnosingProblem', true);
        try {
            const res = await diagnoseProblem(draft.problemDescription, activeVehicle!, draft.problemImage!);
            set({ diagnosis: res, activeDiagnosisId: null });
        } catch (e: any) {
            showNotification(e.message, "error");
        } finally {
            setLoading('isDiagnosingProblem', false);
        }
    },

    submitMaintenanceTips: async () => {
        const { setLoading, showNotification } = useUIStore.getState();
        const { activeVehicle } = useGarageStore.getState();
        const { itinerary, tripHistory } = useTripStore.getState();
        
        setLoading('isGeneratingChecklist', true);
        try {
            // Collection ordinata per updated_at crescente: l'ultimo elemento è il più recente.
            const lastTrip = itinerary ? { tripTitle: itinerary.tripTitle, dailySchedule: itinerary.dailySchedule } as any : (tripHistory.length > 0 ? tripHistory[tripHistory.length - 1].itinerary : null);
            if (!lastTrip) throw new Error("Pianifica un viaggio prima.");
            const tips = await getMaintenanceTips(lastTrip, activeVehicle!);
            set({ maintenanceTips: tips });
        } catch (e: any) {
            showNotification(e.message, "error");
        } finally {
            setLoading('isGeneratingChecklist', false);
        }
    },

    saveDiagnosis: async () => {
        const { diagnosis, activeDiagnosisId, draft } = get();
        const { activeVehicle } = useGarageStore.getState();
        const { showNotification } = useUIStore.getState();
        const userId = currentUid();
        if (!diagnosis || !userId || !activeVehicle) return;

        const diag: SavedDiagnosis = {
            id: activeDiagnosisId || crypto.randomUUID(),
            vehicleId: activeVehicle.id,
            date: new Date().toISOString(),
            problemDescription: draft.problemDescription,
            diagnosisText: diagnosis
        };
        try {
            await upsertDoc(`users/${userId}/diagnoses`, diag.id, { id: diag.id, userId, data: diag });
            showNotification("Diagnosi salvata.");
        } catch (e: any) {
            showNotification(handleDataError(e, OperationType.WRITE, `users/${userId}/diagnoses/${diag.id}`), "error");
        }
    },

    loadDiagnosis: (id) => {
        const d = get().savedDiagnoses.find(x => x.id === id);
        if (d) {
            set({ diagnosis: d.diagnosisText, activeDiagnosisId: d.id, draft: { ...get().draft, problemDescription: d.problemDescription } });
        }
    },

    deleteDiagnosis: async (id) => {
        const { showNotification } = useUIStore.getState();
        const userId = currentUid();
        if (!userId) return;
        try {
            await removeDoc(`users/${userId}/diagnoses`, id);
            showNotification("Diagnosi eliminata.");
        } catch (e: any) {
            showNotification(handleDataError(e, OperationType.DELETE, `users/${userId}/diagnoses/${id}`), "error");
        }
    },

    addMaintenanceRecord: async (record) => {
        const { showNotification } = useUIStore.getState();
        const { activeVehicle } = useGarageStore.getState();
        const userId = currentUid();
        if (!userId) return;
        if (!activeVehicle) {
            showNotification("Seleziona prima un veicolo attivo nel Garage.", "warning");
            return;
        }
        const newRecord = { ...record, vehicleId: activeVehicle.id, id: crypto.randomUUID() };
        try {
            await upsertDoc(`users/${userId}/maintenance`, newRecord.id, { id: newRecord.id, userId, data: newRecord });
            showNotification("Intervento registrato.");
        } catch (e: any) {
            showNotification(handleDataError(e, OperationType.WRITE, `users/${userId}/maintenance/${newRecord.id}`), "error");
        }
    },

    deleteMaintenanceRecord: async (id) => {
        const userId = currentUid();
        if (!userId) return;
        try {
            await removeDoc(`users/${userId}/maintenance`, id);
        } catch (e: any) {
            useUIStore.getState().showNotification(handleDataError(e, OperationType.DELETE, `users/${userId}/maintenance/${id}`), "error");
        }
    },

    addReminder: async (r) => {
        const { activeVehicle } = useGarageStore.getState();
        const userId = currentUid();
        if (!userId) return;
        if (!activeVehicle) {
            useUIStore.getState().showNotification("Seleziona prima un veicolo attivo nel Garage.", "warning");
            return;
        }
        const newReminder = { ...r, vehicleId: activeVehicle.id, id: crypto.randomUUID() };
        try {
            await upsertDoc(`users/${userId}/reminders`, newReminder.id, { id: newReminder.id, userId, data: newReminder });
        } catch (e: any) {
            useUIStore.getState().showNotification(handleDataError(e, OperationType.WRITE, `users/${userId}/reminders/${newReminder.id}`), "error");
        }
    },

    deleteReminder: async (id) => {
        const userId = currentUid();
        if (!userId) return;
        try {
            await removeDoc(`users/${userId}/reminders`, id);
        } catch (e: any) {
            useUIStore.getState().showNotification(handleDataError(e, OperationType.DELETE, `users/${userId}/reminders/${id}`), "error");
        }
    },

    scanReceipt: async (image) => {
        const { setLoading, showNotification } = useUIStore.getState();
        setLoading('isScanningReceipt', true);
        try {
            const data = await scanReceiptImage(image);
            return data;
        } catch (err: any) {
            showNotification("Errore durante la scansione dello scontrino.", "error");
            return null;
        } finally {
            setLoading('isScanningReceipt', false);
        }
    },

    downloadDiagnosisPdf: () => {
        const { diagnosis } = get();
        const { activeVehicle } = useGarageStore.getState();
        if (!diagnosis) return;
        useUIStore.getState().setLoading('isGeneratingDiagnosisPdf', true);
        setTimeout(() => {
            try {
                generatePdf(`Diagnosi_${activeVehicle?.model || 'Moto'}.pdf`, "Report Diagnosi Meccanica", ({ addWrappedText }: any) => {
                    addWrappedText(`Veicolo: ${activeVehicle?.model || 'N/D'}`);
                    addWrappedText("ANALISI IA:", { size: 14, color: [37, 99, 235] });
                    addWrappedText(diagnosis);
                });
            } catch (error) {
                console.error("PDF generation error:", error);
                useUIStore.getState().showNotification("Errore durante la generazione del PDF.", "error");
            } finally {
                useUIStore.getState().setLoading('isGeneratingDiagnosisPdf', false);
            }
        }, 100);
    },

    downloadChecklistPdf: () => {
        const { maintenanceTips } = get();
        if (!maintenanceTips) return;
        useUIStore.getState().setLoading('isGeneratingChecklistPdf', true);
        setTimeout(() => {
            try {
                generatePdf("Checklist_Manutenzione.pdf", "Checklist Pre-Viaggio", ({ addWrappedText, addSeparator }: any) => {
                    addWrappedText("CONTROLLI ESSENZIALI:", { size: 14, color: [37, 99, 235] });
                    maintenanceTips.essentialChecks.forEach((c: any) => addWrappedText(`[ ] ${c}`, { isListItem: true }));
                    addSeparator();
                    addWrappedText("EQUIPAGGIAMENTO EMERGENZA:", { size: 14, color: [37, 99, 235] });
                    maintenanceTips.emergencyEquipment.forEach((c: any) => addWrappedText(`[ ] ${c}`, { isListItem: true }));
                });
            } catch (error) {
                console.error("PDF generation error:", error);
                useUIStore.getState().showNotification("Errore durante la generazione del PDF.", "error");
            } finally {
                useUIStore.getState().setLoading('isGeneratingChecklistPdf', false);
            }
        }, 100);
    },

    downloadMaintenanceLogPdf: () => {
        const { activeVehicle } = useGarageStore.getState();
        // Il libretto è intestato al veicolo attivo: solo i suoi interventi.
        const maintenanceLog = get().maintenanceLog.filter(r => belongsToVehicle(r, activeVehicle?.id));
        if (maintenanceLog.length === 0) {
            useUIStore.getState().showNotification("Nessun intervento registrato da esportare.", "warning");
            return;
        }
        
        useUIStore.getState().setLoading('isGeneratingMaintenancePdf', true);
        
        setTimeout(() => {
            try {
                const vehicleName = activeVehicle ? activeVehicle.model : 'Veicolo non specificato';
                const fileName = `Libretto_Manutenzione_${vehicleName.replace(/\s+/g, '_')}.pdf`;
                
                generatePdf(fileName, "Libretto di Manutenzione", ({ addWrappedText, addSeparator }) => {
                    // Vehicle Info Section
                    addWrappedText("DETTAGLI VEICOLO:", { size: 14, color: [37, 99, 235], marginBottom: 3 });
                    addWrappedText(`Modello: ${vehicleName}`);
                    if (activeVehicle) {
                        addWrappedText(`Anno: ${activeVehicle.year || 'N/D'}`);
                        addWrappedText(`Telaio/VIN: ${activeVehicle.vin || 'N/D'}`);
                    }
                    addSeparator({ marginTop: 5, marginBottom: 8 });

                    // Log Section
                    addWrappedText("LOG INTERVENTI:", { size: 14, color: [37, 99, 235], marginBottom: 5 });
                    
                    // Sort by date descending
                    const sortedLog = [...maintenanceLog].sort((a, b) => localDateTime(b.date) - localDateTime(a.date));
                    
                    sortedLog.forEach((record, index) => {
                        const dateStr = formatLocalDate(record.date);
                        addWrappedText(`${dateStr} - ${record.type.toUpperCase()}`, { size: 12, color: [31, 41, 55], marginBottom: 1 });
                        addWrappedText(`Chilometri: ${record.kilometers || 'N/D'} km`);
                        addWrappedText(`Costo: ${record.cost ? `${record.cost} €` : 'N/D'}`);
                        addWrappedText(`Descrizione: ${record.description}`);
                        
                        if (index < sortedLog.length - 1) {
                            addSeparator({ marginTop: 4, marginBottom: 4 });
                        }
                    });

                    addSeparator({ marginTop: 10 });
                    const today = new Date().toLocaleDateString('it-IT');
                    addWrappedText(`Report generato da MotoMentor il ${today}`, { size: 9, color: [107, 114, 128], marginBottom: 0 });
                });
            } catch (error) {
                console.error("PDF generation error:", error);
                useUIStore.getState().showNotification("Errore durante la generazione del PDF.", "error");
            } finally {
                useUIStore.getState().setLoading('isGeneratingMaintenancePdf', false);
            }
        }, 100);
    },

    reset: () => set({ ...initialMechanicState, draft: { ...initialMechanicState.draft } }),
}));
