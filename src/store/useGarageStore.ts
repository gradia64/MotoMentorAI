
import { create } from 'zustand';
import { subscribeCollection, upsertDoc, removeDoc, listCollection } from '../local/client';
import { GarageVehicle } from '../../types';
import { useUIStore } from './useUIStore';
import { useAuthStore } from './useAuthStore';
import { handleDataError, OperationType } from '../utils/dataErrors';
import { getVehicleSpecs } from '../../services/geminiService';
import { parseLocalDate } from '../utils/hooks';

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
    reset: () => void;
}

// UID della sessione locale corrente (unica fonte di verita': lo store auth).
const currentUid = (): string | undefined => useAuthStore.getState().user?.id;

// Il veicolo attivo è ricordato per utente: con una chiave unica un altro
// utente dello stesso PC erediterebbe la selezione.
const activeVehicleKey = (userId: string) => `motomentor_active_vehicle_${userId}`;
const readActiveVehId = (userId: string): string | null => {
    try { return localStorage.getItem(activeVehicleKey(userId)); } catch { return null; }
};
const emptyGarage = { garageVehicles: [], activeVehId: null, activeVehicle: null, deadlineAlerts: [] };

export const useGarageStore = create<GarageState>((set, get) => ({
    garageVehicles: [],
    activeVehId: null,
    activeVehicle: null,
    deadlineAlerts: [],

    initGarage: (userId) => {
        set({ ...emptyGarage, activeVehId: readActiveVehId(userId) });
        // Semantica identica a onSnapshot: caricamento iniziale + aggiornamento
        // ad ogni write sulla collection (il main invia 'db:changed').
        const unsub = subscribeCollection<GarageVehicle>(`users/${userId}/vehicles`, (vehicles) => {
            set({ garageVehicles: vehicles });
            
            // Update active vehicle if context changes
            const activeId = get().activeVehId;
            const active = vehicles.find(v => v.id === activeId) || null;
            set({ activeVehicle: active });
            
            // Re-calculate alerts
            get().calculateAlerts();
        });
        
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
                    const expiryDate = parseLocalDate(check.date);
                    if (!expiryDate) return;
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
        const userId = currentUid();
        if (!userId) return;
        const newVeh = { ...v, id: crypto.randomUUID(), userId };
        try {
            await upsertDoc(`users/${userId}/vehicles`, newVeh.id, newVeh);
            showNotification("Moto aggiunta al garage!");
        } catch (e: any) {
            showNotification(handleDataError(e, OperationType.WRITE, `users/${userId}/vehicles/${newVeh.id}`), "error");
        }
    },

    updateVehicle: async (updated) => {
        const { showNotification } = useUIStore.getState();
        const userId = currentUid();
        if (!userId) return;
        try {
            await upsertDoc(`users/${userId}/vehicles`, updated.id, updated);
            showNotification("Dati veicolo aggiornati.");
        } catch (e: any) {
            showNotification(handleDataError(e, OperationType.WRITE, `users/${userId}/vehicles/${updated.id}`), "error");
        }
    },

    deleteVehicle: async (id) => {
        const { showNotification } = useUIStore.getState();
        const userId = currentUid();
        if (!userId) return;
        try {
            await removeDoc(`users/${userId}/vehicles`, id);
            // Diagnosi, interventi e promemoria del veicolo resterebbero orfani:
            // si eliminano insieme a lui (i record senza vehicleId restano).
            for (const sub of ['diagnoses', 'maintenance', 'reminders']) {
                const path = `users/${userId}/${sub}`;
                const rows = await listCollection<{ id: string; data?: { vehicleId?: string } }>(path);
                for (const row of rows) {
                    if (row.data?.vehicleId === id) await removeDoc(path, row.id);
                }
            }
            if (get().activeVehId === id) {
                set({ activeVehId: null, activeVehicle: null });
                localStorage.removeItem(activeVehicleKey(userId));
            }
            showNotification("Veicolo rimosso.");
        } catch (e: any) {
            showNotification(handleDataError(e, OperationType.DELETE, `users/${userId}/vehicles/${id}`), "error");
        }
    },

    setActiveVehicle: (id) => {
        const { showNotification } = useUIStore.getState();
        set({ activeVehId: id });
        const userId = currentUid();
        if (userId) localStorage.setItem(activeVehicleKey(userId), id);
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
    },

    reset: () => set(emptyGarage),
}));
