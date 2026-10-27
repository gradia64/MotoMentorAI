
import { create } from 'zustand';
import { AiMode } from '../../types';

interface Notification {
    message: string;
    type: 'success' | 'error' | 'warning';
}

interface UIState {
    mode: AiMode;
    notification: Notification | null;
    isLoadingData: boolean;
    isGeneratingItinerary: boolean;
    isDiagnosingProblem: boolean;
    isGeneratingChecklist: boolean;
    isChatLoading: boolean;
    isGeneratingPdf: boolean;
    isGeneratingDiagnosisPdf: boolean;
    isGeneratingChecklistPdf: boolean;
    isGeneratingDiarySummary: boolean;
    isScanningReceipt: boolean;
    isGeneratingMaintenancePdf: boolean;
    error: string | null;
    settingsOpen: boolean;
    
    // Actions
    setMode: (mode: AiMode) => void;
    showNotification: (message: string, type?: 'success' | 'error' | 'warning') => void;
    hideNotification: () => void;
    setLoading: (key: keyof UIState, value: boolean) => void;
    setError: (error: string | null) => void;
    setSettingsOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
    mode: AiMode.Dashboard,
    notification: null,
    isLoadingData: false,
    isGeneratingItinerary: false,
    isDiagnosingProblem: false,
    isGeneratingChecklist: false,
    isChatLoading: false,
    isGeneratingPdf: false,
    isGeneratingDiagnosisPdf: false,
    isGeneratingChecklistPdf: false,
    isGeneratingDiarySummary: false,
    isScanningReceipt: false,
    isGeneratingMaintenancePdf: false,
    error: null,
    settingsOpen: false,

    setMode: (mode) => set({ mode }),
    
    showNotification: (message, type = 'success') => {
        set({ notification: { message, type } });
        // L'auto-hide è di competenza del componente Notification (timer unico
        // che si resetta a ogni nuova notifica): un timer qui durerebbe più
        // lungo e azzererebbe le notifiche successive in anticipo.
    },
    
    hideNotification: () => set({ notification: null }),
    
    setLoading: (key, value) => set({ [key]: value } as any),
    
    setError: (error) => set({ error }),

    setSettingsOpen: (open) => set({ settingsOpen: open }),
}));
