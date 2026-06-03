'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Lang, translate } from '@/lib/i18n';

interface LanguageContextValue {
  lang:    Lang;
  setLang: (l: Lang) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t:       (key: string, ...args: any[]) => string;
}

const LanguageContext = createContext<LanguageContextValue>({
  lang:    'es',
  setLang: () => {},
  t:       (key) => key,
});

const STORAGE_KEY = 'sanadds_lang';

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('es');

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Lang | null;
    if (stored === 'es' || stored === 'en') setLangState(stored);
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    localStorage.setItem(STORAGE_KEY, l);
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const t = useCallback((key: string, ...args: any[]) => translate(lang, key, ...args), [lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
