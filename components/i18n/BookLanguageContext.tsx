'use client';

import { createContext, useContext, useMemo, useState } from 'react';

export type BookLanguageMode = 'zh_native' | 'multilingual' | 'en_native';

interface BookLanguageContextValue {
  languageMode: BookLanguageMode | null;
  setLanguageMode: (mode: BookLanguageMode | null) => void;
}

const BookLanguageContext = createContext<BookLanguageContextValue | undefined>(
  undefined
);

export function BookLanguageProvider({ children }: { children: React.ReactNode }) {
  const [languageMode, setLanguageMode] = useState<BookLanguageMode | null>(null);

  const value = useMemo(
    () => ({ languageMode, setLanguageMode }),
    [languageMode]
  );

  return (
    <BookLanguageContext.Provider value={value}>
      {children}
    </BookLanguageContext.Provider>
  );
}

export function useBookLanguage(): BookLanguageContextValue {
  const ctx = useContext(BookLanguageContext);
  if (!ctx) {
    throw new Error('useBookLanguage must be used within a BookLanguageProvider');
  }
  return ctx;
}