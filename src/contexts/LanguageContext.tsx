import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  DEFAULT_LANGUAGE,
  LOCALE_CONFIG,
  SUPPORTED_LANGUAGES,
  locales,
  type Language
} from '../utils/i18n';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const STORAGE_KEY = 'dental_workspace_lang_v2';

function isSupportedLanguage(value: string | null): value is Language {
  return Boolean(value && (SUPPORTED_LANGUAGES as readonly string[]).includes(value));
}

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return isSupportedLanguage(saved) ? saved : DEFAULT_LANGUAGE;
    } catch {
      return DEFAULT_LANGUAGE;
    }
  });

  useEffect(() => {
    document.documentElement.lang = LOCALE_CONFIG[language].htmlLang;
  }, [language]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.lang = LOCALE_CONFIG[lang].htmlLang;
  };

  const t = (key: string): string => {
    const activeDict = locales[language] as Record<string, string>;
    const fallbackDict = locales[DEFAULT_LANGUAGE] as Record<string, string>;
    return activeDict[key] || fallbackDict[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
