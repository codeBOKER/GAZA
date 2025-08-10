import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type LanguageCode = 'en' | 'ar' | 'fr' | 'es' | 'de' | 'tr' | 'ur';

interface LanguageContextValue {
  language: LanguageCode | null;
  setLanguage: (lang: LanguageCode) => Promise<void>;
  loaded: boolean;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem('app_language');
        if (stored) setLanguageState(stored as LanguageCode);
      } catch (e) {
        // noop
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const setLanguage = async (lang: LanguageCode) => {
    setLanguageState(lang);
    try {
      await AsyncStorage.setItem('app_language', lang);
    } catch (e) {
      // noop
    }
  };

  const value = useMemo(() => ({ language, setLanguage, loaded }), [language, loaded]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}
