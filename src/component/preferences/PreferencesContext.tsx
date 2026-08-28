'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

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

export function PreferencesProvider({ children }: Readonly<{ children: ReactNode }>): React.JSX.Element {
  const [theme, setTheme] = useState<ThemeMode>('light');
  const [language, setLanguage] = useState<AppLanguage>('id');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedTheme = window.localStorage.getItem(THEME_KEY) as ThemeMode | null;
    const storedLanguage = window.localStorage.getItem(LANGUAGE_KEY) as AppLanguage | null;

    if (storedTheme) setTheme(storedTheme);

    if (storedLanguage) setLanguage(storedLanguage);
  }, []);

  const updateTheme = useCallback((next: ThemeMode) => {
    setTheme(next);
    applyTheme(next);
    window.localStorage.setItem(THEME_KEY, next);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      window.localStorage.setItem(THEME_KEY, next);
      return next;
    });
  }, []);

  const updateLanguage = useCallback((next: AppLanguage) => {
    setLanguage(next);
    window.localStorage.setItem(LANGUAGE_KEY, next);
    document.documentElement.setAttribute('lang', next);
  }, []);

  const contextValue = useMemo(
    () => ({ theme, setTheme: updateTheme, toggleTheme, language, setLanguage: updateLanguage }),
    [theme, updateTheme, toggleTheme, language, updateLanguage],
  );

  return (
    <PreferencesContext.Provider value={contextValue}>
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
