
import { create } from 'zustand';
import {
    initLocalDB,
    getSession,
    registerLocal,
    loginLocal,
    logoutLocal,
} from '../local/client';
import { useUIStore } from './useUIStore';
import { AiMode } from '../../types';

interface User {
    id: string;
    username: string;
}

interface AuthState {
    user: User | null;
    isAuthenticated: boolean;
    isCheckingAuth: boolean;
    dbReady: boolean;

    // Actions
    bootstrap: () => Promise<void>;   // init DB + carica sessione
    checkAuth: () => Promise<void>;   // ricarica lo stato sessione
    register: (username: string, pass: string) => Promise<void>;
    login: (username: string, pass: string) => Promise<void>;
    logout: () => Promise<void>;
}

const ui = () => useUIStore.getState();

export const useAuthStore = create<AuthState>((set, get) => ({
    user: null,
    isAuthenticated: false,
    isCheckingAuth: true,
    dbReady: false,

    bootstrap: async () => {
        try {
            if (!get().dbReady) {
                await initLocalDB();
                set({ dbReady: true });
            }
            await get().checkAuth();
        } catch (err: any) {
            console.error('Errore bootstrap auth locale:', err);
            set({ isCheckingAuth: false });
        }
    },

    checkAuth: async () => {
        set({ isCheckingAuth: true });
        try {
            const session = await getSession();
            if (session) {
                set({
                    user: { id: session.uid, username: session.username },
                    isAuthenticated: true,
                    isCheckingAuth: false,
                });
            } else {
                set({ user: null, isAuthenticated: false, isCheckingAuth: false });
            }
        } catch (err: any) {
            console.error('Errore controllo sessione:', err);
            set({ user: null, isAuthenticated: false, isCheckingAuth: false });
        }
    },

    register: async (username, pass) => {
        try {
            const session = await registerLocal(username, pass);
            set({
                user: { id: session.uid, username: session.username },
                isAuthenticated: true,
            });
            ui().showNotification(`Benvenuto, ${session.username}!`);
        } catch (error: any) {
            ui().showNotification(error.message || 'Errore di registrazione', 'error');
            throw error;
        }
    },

    login: async (username, pass) => {
        try {
            const session = await loginLocal(username, pass);
            set({
                user: { id: session.uid, username: session.username },
                isAuthenticated: true,
            });
            ui().showNotification(`Accesso completato. Ciao, ${session.username}!`);
        } catch (error: any) {
            ui().showNotification(error.message || 'Errore di accesso', 'error');
            throw error;
        }
    },

    logout: async () => {
        try {
            await logoutLocal();
            set({ user: null, isAuthenticated: false });
            localStorage.removeItem('motomentor_active_vehicle');
            ui().setMode(AiMode.Dashboard);
            ui().showNotification('Sessione chiusa.');
        } catch (error: any) {
            ui().showNotification(error.message, 'error');
        }
    },
}));
