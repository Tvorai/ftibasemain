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
      <div className={`fixed bottom-0 left-0 z-[99] p-4 md:p-6 transition-all duration-700 ease-in-out transform ${
        isVisible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
      }`}>
        <div className="max-w-[400px]">
          <div className="bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-[2rem] p-6 shadow-2xl flex flex-col gap-6">
            <div className="space-y-3">
              <h2 className="text-lg font-bold text-white uppercase tracking-tight">Používame cookies</h2>
              <p className="text-zinc-400 text-xs leading-relaxed">
                Používame cookies na zlepšenie fungovania stránky, analýzu návštevnosti a personalizáciu obsahu. 
                Viac informácií nájdete tu:{" "}
                <Link href="/cookies" className="text-emerald-400 hover:underline font-bold">
                  Zásady cookies
                </Link>
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={() => {
                  acceptAll();
                  setIsVisible(false);
                }}
                className="w-full py-3 rounded-full bg-emerald-500 text-black text-[10px] font-bold uppercase tracking-widest hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20"
              >
                Prijať všetko
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="flex-1 py-3 rounded-full border border-white/10 text-[10px] font-bold uppercase tracking-widest text-zinc-400 hover:text-white hover:bg-white/5 transition-all"
                >
                  Nastavenia
                </button>
                <button
                  onClick={() => {
                    rejectAll();
                    setIsVisible(false);
                  }}
                  className="flex-1 py-3 rounded-full border border-white/10 text-[10px] font-bold uppercase tracking-widest text-zinc-400 hover:text-white hover:bg-white/5 transition-all"
                >
                  Odmietnuť
                </button>
              </div>
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
