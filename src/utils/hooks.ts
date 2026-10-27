import { useEffect } from 'react';

// --- Reusable Hook for Modal Accessibility ---
// This hook centralizes the logic for closing a modal when the 'Escape' key is pressed.
// By using this hook, we ensure consistent behavior across all modals and keep the
// component code cleaner (DRY principle).
export const useEscapeKey = (callback: () => void, isActive: boolean = true) => {
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                callback();
            }
        };

        if (isActive) {
            document.addEventListener('keydown', handleKeyDown);
        }

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [callback, isActive]);
};

// Parsa una data "solo giorno" ('YYYY-MM-DD') come data locale: new Date(string)
// userebbe la mezzanotte UTC, spostando la giornata nei fusi non-UTC.
export const parseLocalDate = (value?: string | null): Date | null => {
    if (!value) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
    if (!m) {
        const d = new Date(value);
        return isNaN(d.getTime()) ? null : d;
    }
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
};

// Data di oggi come 'YYYY-MM-DD' nel fuso locale: toISOString() usa l'UTC e
// tra mezzanotte e l'1-2 di notte restituirebbe la data di ieri.
export const todayLocalISO = (): string => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// Formatta una data 'YYYY-MM-DD' (o ISO completa) per la UI, senza slittamenti di fuso.
export const formatLocalDate = (value?: string | null): string =>
    parseLocalDate(value)?.toLocaleDateString('it-IT') ?? (value || 'N/D');

// Timestamp per ordinare date 'YYYY-MM-DD'; le date non valide vanno in fondo.
export const localDateTime = (value?: string | null): number =>
    parseLocalDate(value)?.getTime() ?? 0;
