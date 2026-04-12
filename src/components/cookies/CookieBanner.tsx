"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useCookieConsent, CookieSettings } from "../../hooks/useCookieConsent";
import CookieSettingsModal from "./CookieSettingsModal";

export default function CookieBanner() {
  const { consent, settings, isLoading, acceptAll, rejectAll, saveCustomSettings } = useCookieConsent();
  const [isVisible, setIsVisible] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !consent) {
      const timer = setTimeout(() => setIsVisible(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [isLoading, consent]);

  if (isLoading || !isVisible || consent) return null;

  const handleSaveCustom = (newSettings: CookieSettings) => {
    saveCustomSettings(newSettings);
    setIsModalOpen(false);
    setIsVisible(false);
  };

  return (
    <>
      <div className={`fixed bottom-0 left-0 right-0 z-[99] p-4 md:p-8 transition-all duration-700 ease-in-out transform ${
        isVisible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
      }`}>
        <div className="container mx-auto max-w-7xl">
          <div className="bg-zinc-900/90 backdrop-blur-xl border border-white/10 rounded-[2.5rem] p-6 md:p-10 shadow-2xl flex flex-col lg:flex-row items-center justify-between gap-8">
            <div className="flex-1 max-w-3xl">
              <h2 className="text-xl md:text-2xl font-bold mb-4 text-white uppercase tracking-tight">Používame cookies</h2>
              <p className="text-zinc-400 text-sm md:text-base leading-relaxed">
                Používame cookies na zlepšenie fungovania stránky, analýzu návštevnosti a personalizáciu obsahu. 
                Viac informácií nájdete tu:{" "}
                <Link href="/cookies" className="text-emerald-400 hover:underline font-bold">
                  Zásady cookies
                </Link>
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-4 w-full lg:w-auto">
              <button
                onClick={() => setIsModalOpen(true)}
                className="px-8 py-4 rounded-full border border-white/10 text-xs font-bold uppercase tracking-widest text-zinc-400 hover:text-white hover:bg-white/5 transition-all w-full md:w-auto"
              >
                Nastavenia
              </button>
              <button
                onClick={() => {
                  rejectAll();
                  setIsVisible(false);
                }}
                className="px-8 py-4 rounded-full border border-white/10 text-xs font-bold uppercase tracking-widest text-zinc-400 hover:text-white hover:bg-white/5 transition-all w-full md:w-auto"
              >
                Odmietnuť
              </button>
              <button
                onClick={() => {
                  acceptAll();
                  setIsVisible(false);
                }}
                className="px-8 py-4 rounded-full bg-emerald-500 text-black text-xs font-bold uppercase tracking-widest hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20 w-full md:w-auto"
              >
                Prijať všetko
              </button>
            </div>
          </div>
        </div>
      </div>

      <CookieSettingsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        currentSettings={settings}
        onSave={handleSaveCustom}
      />
    </>
  );
}
