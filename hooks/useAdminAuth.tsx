import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';

const STORAGE_KEY = 'pawmap_admin_unlocked';
const ADMIN_PIN = process.env.EXPO_PUBLIC_ADMIN_PIN ?? '7264';

type AdminAuthContextValue = {
  isAdmin: boolean;
  unlock: (pin: string) => boolean;
  lock: () => void;
};

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then(v => { if (v === 'true') setIsAdmin(true); })
      .catch(() => {});
  }, []);

  const unlock = useCallback((pin: string): boolean => {
    if (pin !== ADMIN_PIN) return false;
    setIsAdmin(true);
    AsyncStorage.setItem(STORAGE_KEY, 'true').catch(() => {});
    return true;
  }, []);

  const lock = useCallback(() => {
    setIsAdmin(false);
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  }, []);

  return (
    <AdminAuthContext.Provider value={{ isAdmin, unlock, lock }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth(): AdminAuthContextValue {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error('useAdminAuth must be used within AdminAuthProvider');
  return ctx;
}
