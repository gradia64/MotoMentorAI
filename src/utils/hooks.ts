import React, { useState, useEffect } from 'react';

// A simple hook to manage state with localStorage persistence.
export function useLocalStorage<T>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Error reading localStorage key “${key}”:`, error);
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      // Prevents overwriting stored value with initial value on first render if value exists
      const item = window.localStorage.getItem(key);
      if (item !== JSON.stringify(value)) {
        window.localStorage.setItem(key, JSON.stringify(value));
      }
    } catch (error) {
      console.error(`Error setting localStorage key “${key}”:`, error);
    }
  }, [key, value]);

  return [value, setValue];
}


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
