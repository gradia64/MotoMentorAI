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
