'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

export type ThemeMode = 'light' | 'dark';
export type AppLanguage = 'id' | 'en';

const THEME_KEY = 'wms_theme';
const LANGUAGE_KEY = 'wms_language';

interface PreferencesContextValue {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
}

const PreferencesContext = createContext<PreferencesContextValue | undefined>(undefined);

function applyTheme(theme: ThemeMode): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

export function PreferencesProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [theme, setThemeState] = useState<ThemeMode>('light');
  const [language, setLanguageState] = useState<AppLanguage>('id');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedTheme = window.localStorage.getItem(THEME_KEY) as ThemeMode | null;
    const storedLanguage = window.localStorage.getItem(LANGUAGE_KEY) as AppLanguage | null;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- baca preferensi tersimpan sekali saat mount
    if (storedTheme) setThemeState(storedTheme);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (storedLanguage) setLanguageState(storedLanguage);
  }, []);

  const setTheme = useCallback((next: ThemeMode) => {
    setThemeState(next);
    applyTheme(next);
    window.localStorage.setItem(THEME_KEY, next);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      window.localStorage.setItem(THEME_KEY, next);
      return next;
    });
  }, []);

  const setLanguage = useCallback((next: AppLanguage) => {
    setLanguageState(next);
    window.localStorage.setItem(LANGUAGE_KEY, next);
    document.documentElement.setAttribute('lang', next);
  }, []);

  return (
    <PreferencesContext.Provider value={{ theme, setTheme, toggleTheme, language, setLanguage }}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences(): PreferencesContextValue {
  const ctx = useContext(PreferencesContext);
  if (!ctx) {
    throw new Error('usePreferences harus dipakai di dalam <PreferencesProvider>');
  }
  return ctx;
}
