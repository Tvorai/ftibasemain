"use client";

import { useState, useEffect } from "react";

export type CookieConsentType = "accepted" | "rejected" | "custom" | null;

export interface CookieSettings {
  necessary: boolean;
  analytical: boolean;
  marketing: boolean;
}

const STORAGE_KEY = "fitbase_cookie_consent";
const SETTINGS_KEY = "fitbase_cookie_settings";

export function useCookieConsent() {
  const [consent, setConsent] = useState<CookieConsentType>(null);
  const [settings, setSettings] = useState<CookieSettings>({
    necessary: true,
    analytical: false,
    marketing: false,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const savedConsent = localStorage.getItem(STORAGE_KEY) as CookieConsentType;
    const savedSettings = localStorage.getItem(SETTINGS_KEY);

    if (savedConsent) {
      setConsent(savedConsent);
    }
    if (savedSettings) {
      setSettings(JSON.parse(savedSettings));
    }
    setIsLoading(false);
  }, []);

  const acceptAll = () => {
    const allSettings = { necessary: true, analytical: true, marketing: true };
    localStorage.setItem(STORAGE_KEY, "accepted");
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(allSettings));
    setConsent("accepted");
    setSettings(allSettings);
  };

  const rejectAll = () => {
    const minSettings = { necessary: true, analytical: false, marketing: false };
    localStorage.setItem(STORAGE_KEY, "rejected");
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(minSettings));
    setConsent("rejected");
    setSettings(minSettings);
  };

  const saveCustomSettings = (newSettings: CookieSettings) => {
    localStorage.setItem(STORAGE_KEY, "custom");
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
    setConsent("custom");
    setSettings(newSettings);
  };

  return {
    consent,
    settings,
    isLoading,
    acceptAll,
    rejectAll,
    saveCustomSettings,
  };
}
