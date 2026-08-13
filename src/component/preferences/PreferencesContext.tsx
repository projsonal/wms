'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

export type ThemeMode = 'light' | 'dark';
export type FontChoice = 'inter' | 'ibm-plex-sans' | 'plus-jakarta-sans';
export type AppLanguage = 'id' | 'en';

const THEME_KEY = 'wms_theme';
const FONT_KEY = 'wms_font';
const LANGUAGE_KEY = 'wms_language';

/** Nama CSS var next/font untuk tiap pilihan (lihat app/layout.tsx). */
export const FONT_CSS_VAR: Record<FontChoice, string> = {
  inter: '--font-inter',
  'ibm-plex-sans': '--font-ibm-plex-sans',
  'plus-jakarta-sans': '--font-plus-jakarta-sans',
};

export const FONT_LABEL: Record<FontChoice, string> = {
  inter: 'Inter',
  'ibm-plex-sans': 'IBM Plex Sans',
  'plus-jakarta-sans': 'Plus Jakarta Sans',
};

interface PreferencesContextValue {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  font: FontChoice;
  setFont: (font: FontChoice) => void;
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
}

const PreferencesContext = createContext<PreferencesContextValue | undefined>(undefined);

function applyTheme(theme: ThemeMode): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

function applyFont(font: FontChoice): void {
  document.documentElement.style.setProperty('--font-app', `var(${FONT_CSS_VAR[font]})`);
}

export function PreferencesProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [theme, setThemeState] = useState<ThemeMode>('light');
  const [font, setFontState] = useState<FontChoice>('inter');
  const [language, setLanguageState] = useState<AppLanguage>('id');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedTheme = window.localStorage.getItem(THEME_KEY) as ThemeMode | null;
    const storedFont = window.localStorage.getItem(FONT_KEY) as FontChoice | null;
    const storedLanguage = window.localStorage.getItem(LANGUAGE_KEY) as AppLanguage | null;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- baca preferensi tersimpan sekali saat mount
    if (storedTheme) setThemeState(storedTheme);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (storedFont) setFontState(storedFont);
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

  const setFont = useCallback((next: FontChoice) => {
    setFontState(next);
    applyFont(next);
    window.localStorage.setItem(FONT_KEY, next);
  }, []);

  const setLanguage = useCallback((next: AppLanguage) => {
    setLanguageState(next);
    window.localStorage.setItem(LANGUAGE_KEY, next);
  }, []);

  return (
    <PreferencesContext.Provider
      value={{ theme, setTheme, toggleTheme, font, setFont, language, setLanguage }}
    >
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
