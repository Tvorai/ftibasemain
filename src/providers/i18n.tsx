"use client";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { dictionaries, type Locale, type Messages } from "@/i18n";

type I18nContextValue = {
  locale: Locale;
  messages: Messages;
  setLocale: (l: Locale) => void;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  children,
  defaultLocale = "sk"
}: {
  children: React.ReactNode;
  defaultLocale?: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(defaultLocale);

  useEffect(() => {
    const saved = window.localStorage.getItem("fitbase:locale") as Locale | null;
    if (saved && (saved === "sk" || saved === "cs")) {
      setLocaleState(saved);
    }
  }, []);

  const setLocale = (l: Locale) => {
    setLocaleState(l);
    try {
      window.localStorage.setItem("fitbase:locale", l);
    } catch {}
  };

  const messages = useMemo(() => dictionaries[locale], [locale]);

  return (
    <I18nContext.Provider value={{ locale, setLocale, messages }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
