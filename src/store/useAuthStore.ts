
import { create } from 'zustand';
import { 
    onAuthStateChanged, 
    signInWithPopup, 
    signInWithRedirect,
    getRedirectResult,
    setPersistence,
    browserLocalPersistence,
    GoogleAuthProvider, 
    signOut,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    sendPasswordResetEmail,
    updateProfile
} from 'firebase/auth';
import { auth } from '../firebase';
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
    
    // Actions
    checkAuth: () => void;
    loginWithGoogle: () => Promise<void>;
    loginWithGoogleRedirect: () => Promise<void>;
    signUpWithEmail: (email: string, pass: string) => Promise<void>;
    loginWithEmail: (email: string, pass: string) => Promise<void>;
    resetPassword: (email: string) => Promise<void>;
    logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    isAuthenticated: false,
    isCheckingAuth: true,

    checkAuth: () => {
        const { showNotification } = useUIStore.getState();
        
        set({ isCheckingAuth: true });

        const authTimeout = setTimeout(() => {
            set({ isCheckingAuth: false });
        }, 10000);

        setPersistence(auth, browserLocalPersistence).catch(err => console.error("Errore setPersistence:", err));

        getRedirectResult(auth).then((result) => {
            if (result?.user) {
                showNotification("Accesso completato con successo!");
            }
        }).catch((error) => {
            if (error.code === 'auth/missing-initial-state' || error.message?.includes('missing initial state')) {
                showNotification("Errore di sessione: usa il popup o apri in una nuova scheda.", "error");
            } else {
                showNotification("Errore accesso: " + error.message, "error");
            }
        });

        onAuthStateChanged(auth, (user) => {
            clearTimeout(authTimeout);
            if (user) {
                set({ 
                    user: { id: user.uid, username: user.displayName || user.email?.split('@')[0] || 'Utente' }, 
                    isAuthenticated: true,
                    isCheckingAuth: false 
                });
            } else {
                set({ user: null, isAuthenticated: false, isCheckingAuth: false });
            }
        });
    },

    loginWithGoogle: async () => {
        const { showNotification } = useUIStore.getState();
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        try {
            await signInWithPopup(auth, provider);
        } catch (error: any) {
            showNotification(error.message, "error");
        }
    },

    loginWithGoogleRedirect: async () => {
        const { showNotification } = useUIStore.getState();
        const provider = new GoogleAuthProvider();
        try {
            await signInWithRedirect(auth, provider);
        } catch (error: any) {
            showNotification(error.message, "error");
        }
    },

    signUpWithEmail: async (email, pass) => {
        const { showNotification } = useUIStore.getState();
        try {
            const result = await createUserWithEmailAndPassword(auth, email, pass);
            await updateProfile(result.user, { displayName: email.split('@')[0] });
        } catch (error: any) {
            showNotification(error.message, "error");
            throw error;
        }
    },

    loginWithEmail: async (email, pass) => {
        const { showNotification } = useUIStore.getState();
        try {
            await signInWithEmailAndPassword(auth, email, pass);
        } catch (error: any) {
            showNotification(error.message, "error");
            throw error;
        }
    },

    resetPassword: async (email) => {
        const { showNotification } = useUIStore.getState();
        try {
            await sendPasswordResetEmail(auth, email);
            showNotification("Email di reset inviata!");
        } catch (error: any) {
            showNotification(error.message, "error");
        }
    },

    logout: async () => {
        const { showNotification } = useUIStore.getState();
        try {
            await signOut(auth);
            localStorage.removeItem('motomentor_active_vehicle');
            useUIStore.getState().setMode(AiMode.Dashboard);
        } catch (error: any) {
            showNotification(error.message, "error");
        }
    }
}));
