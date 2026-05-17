
import { create } from 'zustand';
import { db, auth } from '../firebase';
import { 
    collection, 
    onSnapshot, 
    doc, 
    setDoc, 
    deleteDoc 
} from 'firebase/firestore';
import { GarageVehicle } from '../../types';
import { useUIStore } from './useUIStore';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrors';
import { getVehicleSpecs } from '../../services/geminiService';

interface DeadlineAlert {
    vehicleId: string;
    vehicleName: string;
    type: 'Assicurazione' | 'Bollo' | 'Revisione';
    date: string;
    status: 'expired' | 'warning';
    daysRemaining: number;
}

interface GarageState {
    garageVehicles: GarageVehicle[];
    activeVehId: string | null;
    activeVehicle: GarageVehicle | null;
    deadlineAlerts: DeadlineAlert[];
    
    // Actions
    initGarage: (userId: string) => () => void;
    addVehicle: (v: any) => Promise<void>;
    updateVehicle: (updated: GarageVehicle) => Promise<void>;
    deleteVehicle: (id: string) => Promise<void>;
    setActiveVehicle: (id: string) => void;
    calculateAlerts: () => void;
    handleGenerateSpecs: (model: string, year: string) => Promise<any>;
}

export const useGarageStore = create<GarageState>((set, get) => ({
    garageVehicles: [],
    activeVehId: (typeof window !== 'undefined' ? localStorage.getItem('motomentor_active_vehicle') : null),
    activeVehicle: null,
    deadlineAlerts: [],

    initGarage: (userId) => {
        const unsub = onSnapshot(collection(db, `users/${userId}/vehicles`), (snapshot) => {
            const vehicles = snapshot.docs.map(doc => doc.data() as GarageVehicle);
            set({ garageVehicles: vehicles });
            
            // Update active vehicle if context changes
            const activeId = get().activeVehId;
            const active = vehicles.find(v => v.id === activeId) || null;
            set({ activeVehicle: active });
            
            // Re-calculate alerts
            get().calculateAlerts();
        }, (error) => console.error("Firestore Listen Error (vehicles):", error));
        
        return unsub;
    },

    calculateAlerts: () => {
        const vehicles = get().garageVehicles;
        const alerts: DeadlineAlert[] = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        vehicles.forEach((v) => {
            const checks: { type: 'Assicurazione' | 'Bollo' | 'Revisione', date?: string }[] = [
                { type: 'Assicurazione', date: v.insuranceExpiry },
                { type: 'Bollo', date: v.taxExpiry },
                { type: 'Revisione', date: v.inspectionExpiry }
            ];

            checks.forEach(check => {
                if (check.date) {
                    const expiryDate = new Date(check.date);
                    expiryDate.setHours(0, 0, 0, 0);
                    const diffTime = expiryDate.getTime() - today.getTime();
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                    if (diffDays <= 30) {
                        alerts.push({
                            vehicleId: v.id,
                            vehicleName: v.model,
                            type: check.type as any,
                            date: check.date,
                            status: diffDays < 0 ? 'expired' : 'warning',
                            daysRemaining: diffDays
                        });
                    }
                }
            });
        });

        alerts.sort((a, b) => {
            if (a.status === 'expired' && b.status !== 'expired') return -1;
            if (a.status !== 'expired' && b.status === 'expired') return 1;
            return a.daysRemaining - b.daysRemaining;
        });

        set({ deadlineAlerts: alerts });
    },

    addVehicle: async (v) => {
        const { showNotification } = useUIStore.getState();
        const userId = auth.currentUser?.uid;
        if (!userId) return;
        const newVeh = { ...v, id: crypto.randomUUID(), userId };
        try {
            await setDoc(doc(db, `users/${userId}/vehicles`, newVeh.id), newVeh);
            showNotification("Moto aggiunta al garage!");
        } catch (e: any) {
            handleFirestoreError(e, OperationType.WRITE, `users/${userId}/vehicles/${newVeh.id}`);
        }
    },

    updateVehicle: async (updated) => {
        const { showNotification } = useUIStore.getState();
        const userId = auth.currentUser?.uid;
        if (!userId) return;
        try {
            await setDoc(doc(db, `users/${userId}/vehicles`, updated.id), updated);
            showNotification("Dati veicolo aggiornati.");
        } catch (e: any) {
            handleFirestoreError(e, OperationType.WRITE, `users/${userId}/vehicles/${updated.id}`);
        }
    },

    deleteVehicle: async (id) => {
        const { showNotification } = useUIStore.getState();
        const userId = auth.currentUser?.uid;
        if (!userId) return;
        try {
            await deleteDoc(doc(db, `users/${userId}/vehicles`, id));
            if (get().activeVehId === id) {
                set({ activeVehId: null, activeVehicle: null });
                localStorage.removeItem('motomentor_active_vehicle');
            }
            showNotification("Veicolo rimosso.");
        } catch (e: any) {
            handleFirestoreError(e, OperationType.DELETE, `users/${userId}/vehicles/${id}`);
        }
    },

    setActiveVehicle: (id) => {
        const { showNotification } = useUIStore.getState();
        set({ activeVehId: id });
        localStorage.setItem('motomentor_active_vehicle', id);
        const active = get().garageVehicles.find(v => v.id === id) || null;
        set({ activeVehicle: active });
        showNotification("Moto selezionata come attiva!");
    },

    handleGenerateSpecs: async (model, year) => {
        const { showNotification } = useUIStore.getState();
        try {
            return await getVehicleSpecs(model, year);
        } catch (err: any) {
            showNotification("Errore ricerca dati tecnici.", "error");
            return null;
        }
    }
}));

