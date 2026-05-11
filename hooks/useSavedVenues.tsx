import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import type { Venue } from '@/types/venue';

const STORAGE_KEY = 'pawmap_saved_ids';

type SavedVenuesContextValue = {
  isSaved: (id: number) => boolean;
  toggleSave: (venue: Venue) => void;
  showToast: (message: string) => void;
  toastMessage: string | null;
  clearToast: () => void;
};

const SavedVenuesContext = createContext<SavedVenuesContextValue | null>(null);

async function persist(ids: number[]) {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // silently swallow storage errors
  }
}

export function SavedVenuesProvider({ children }: { children: ReactNode }) {
  const [savedIds, setSavedIds] = useState<number[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then(raw => {
        if (raw) setSavedIds(JSON.parse(raw));
      })
      .catch(() => {});
  }, []);

  const isSaved = useCallback((id: number) => savedIds.includes(id), [savedIds]);

  const toggleSave = useCallback((venue: Venue) => {
    setSavedIds(prev => {
      const wasSaved = prev.includes(venue.id);
      const next = wasSaved
        ? prev.filter(id => id !== venue.id)
        : [...prev, venue.id];
      persist(next);
      setToastMessage(wasSaved ? 'Removed' : 'Saved');
      return next;
    });
  }, []);

  const showToast = useCallback((message: string) => setToastMessage(message), []);
  const clearToast = useCallback(() => setToastMessage(null), []);

  return (
    <SavedVenuesContext.Provider value={{ isSaved, toggleSave, showToast, toastMessage, clearToast }}>
      {children}
    </SavedVenuesContext.Provider>
  );
}

export function useSavedVenues(): SavedVenuesContextValue {
  const ctx = useContext(SavedVenuesContext);
  if (!ctx) {
    throw new Error('useSavedVenues must be used within a SavedVenuesProvider');
  }
  return ctx;
}
