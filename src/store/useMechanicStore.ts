
import { create } from 'zustand';
import { db, auth } from '../firebase';
import { 
    collection, 
    onSnapshot, 
    doc, 
    setDoc, 
    deleteDoc 
} from 'firebase/firestore';
import { MaintenanceRecord, MaintenanceReminder, SavedDiagnosis, MaintenanceTips } from '../../types';
import { useUIStore } from './useUIStore';
import { useGarageStore } from './useGarageStore';
import { useTripStore } from './useTripStore';
import { diagnoseProblem, getMaintenanceTips, scanReceiptImage } from '../../services/geminiService';
import { generatePdf } from '../utils/pdf';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrors';

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
    downloadDiagnosisPdf: () => void;
    downloadChecklistPdf: () => void;
    scanReceipt: (image: File) => Promise<Partial<Omit<MaintenanceRecord, 'id'>> | null>;
}

export const useMechanicStore = create<MechanicState>((set, get) => ({
    maintenanceLog: [],
    reminders: [],
    savedDiagnoses: [],
    diagnosis: null,
    activeDiagnosisId: null,
    maintenanceTips: null,
    mechanicMode: 'workshop',
    draft: {
        problemDescription: '',
        problemImage: null,
    },

    initMechanic: (userId) => {
        const unsub1 = onSnapshot(collection(db, `users/${userId}/maintenance`), (snapshot) => {
            set({ maintenanceLog: snapshot.docs.map(doc => doc.data().data as MaintenanceRecord) });
        });
        const unsub2 = onSnapshot(collection(db, `users/${userId}/reminders`), (snapshot) => {
            set({ reminders: snapshot.docs.map(doc => doc.data().data as MaintenanceReminder) });
        });
        const unsub3 = onSnapshot(collection(db, `users/${userId}/diagnoses`), (snapshot) => {
            set({ savedDiagnoses: snapshot.docs.map(doc => doc.data().data as SavedDiagnosis) });
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
            const lastTrip = itinerary ? { tripTitle: itinerary.tripTitle, dailySchedule: itinerary.dailySchedule } as any : (tripHistory.length > 0 ? tripHistory[0].itinerary : null);
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
        const userId = auth.currentUser?.uid;
        if (!diagnosis || !userId || !activeVehicle) return;

        const diag: SavedDiagnosis = {
            id: activeDiagnosisId || crypto.randomUUID(),
            vehicleId: activeVehicle.id,
            date: new Date().toISOString(),
            problemDescription: draft.problemDescription,
            diagnosisText: diagnosis
        };
        try {
            await setDoc(doc(db, `users/${userId}/diagnoses`, diag.id), { id: diag.id, userId, data: diag });
            showNotification("Diagnosi salvata.");
        } catch (e: any) {
            handleFirestoreError(e, OperationType.WRITE, `users/${userId}/diagnoses/${diag.id}`);
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
        const userId = auth.currentUser?.uid;
        if (!userId) return;
        try {
            await deleteDoc(doc(db, `users/${userId}/diagnoses`, id));
            showNotification("Diagnosi eliminata.");
        } catch (e: any) {
            handleFirestoreError(e, OperationType.DELETE, `users/${userId}/diagnoses/${id}`);
        }
    },

    addMaintenanceRecord: async (record) => {
        const { showNotification } = useUIStore.getState();
        const userId = auth.currentUser?.uid;
        if (!userId) return;
        const newRecord = { ...record, id: crypto.randomUUID() };
        try {
            await setDoc(doc(db, `users/${userId}/maintenance`, newRecord.id), { id: newRecord.id, userId, data: newRecord });
            showNotification("Intervento registrato.");
        } catch (e: any) {
            handleFirestoreError(e, OperationType.WRITE, `users/${userId}/maintenance/${newRecord.id}`);
        }
    },

    deleteMaintenanceRecord: async (id) => {
        const userId = auth.currentUser?.uid;
        if (!userId) return;
        try {
            await deleteDoc(doc(db, `users/${userId}/maintenance`, id));
        } catch (e: any) {
            handleFirestoreError(e, OperationType.DELETE, `users/${userId}/maintenance/${id}`);
        }
    },

    addReminder: async (r) => {
        const userId = auth.currentUser?.uid;
        if (!userId) return;
        const newReminder = { ...r, id: crypto.randomUUID() };
        try {
            await setDoc(doc(db, `users/${userId}/reminders`, newReminder.id), { id: newReminder.id, userId, data: newReminder });
        } catch (e: any) {
            handleFirestoreError(e, OperationType.WRITE, `users/${userId}/reminders/${newReminder.id}`);
        }
    },

    deleteReminder: async (id) => {
        const userId = auth.currentUser?.uid;
        if (!userId) return;
        try {
            await deleteDoc(doc(db, `users/${userId}/reminders`, id));
        } catch (e: any) {
            handleFirestoreError(e, OperationType.DELETE, `users/${userId}/reminders/${id}`);
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
                    addWrappedText("ANALISI IA:", { size: 14, color: [37, 99, 235], marginTop: 5 });
                    addWrappedText(diagnosis);
                });
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
            } finally {
                useUIStore.getState().setLoading('isGeneratingChecklistPdf', false);
            }
        }, 100);
    },

    scanReceipt: async (image: File) => {
        const { showNotification, setLoading } = useUIStore.getState();
        setLoading('isScanningReceipt', true);
        try {
            const result = await scanReceiptImage(image);
            const typeMap: Record<string, MaintenanceType> = {
                'Ordinaria': MaintenanceType.Ordinary,
                'Straordinaria': MaintenanceType.Extraordinary,
                'Eccezionale': MaintenanceType.Exceptional,
            };
            return {
                date: result.date,
                description: result.description,
                cost: result.cost ?? undefined,
                kilometers: result.kilometers ?? undefined,
                type: typeMap[result.type] ?? MaintenanceType.Ordinary,
            };
        } catch (e: any) {
            showNotification(`Errore scansione: ${e.message}`, 'error');
            return null;
        } finally {
            setLoading('isScanningReceipt', false);
        }
    },

}));
