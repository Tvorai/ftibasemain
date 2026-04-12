"use client";

import { useState } from "react";
import { CookieSettings } from "../../hooks/useCookieConsent";

interface CookieSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSettings: CookieSettings;
  onSave: (settings: CookieSettings) => void;
}

export default function CookieSettingsModal({
  isOpen,
  onClose,
  currentSettings,
  onSave,
}: CookieSettingsModalProps) {
  const [localSettings, setLocalSettings] = useState<CookieSettings>(currentSettings);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-white/10 w-full max-w-lg rounded-[2.5rem] p-8 shadow-2xl">
        <h2 className="text-2xl font-bold mb-6 text-white uppercase tracking-tight">Nastavenia cookies</h2>
        
        <div className="space-y-6 mb-8">
          {/* Necessary */}
          <div className="flex items-start justify-between gap-4 p-4 rounded-2xl bg-white/5 border border-white/5">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-1">Nevyhnutné cookies</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Tieto cookies sú potrebné pre základné fungovanie stránky a nemožno ich vypnúť.
              </p>
            </div>
            <div className="relative inline-flex items-center cursor-not-allowed opacity-50">
              <div className="w-11 h-6 bg-emerald-500 rounded-full"></div>
              <div className="absolute left-6 w-4 h-4 bg-white rounded-full"></div>
            </div>
          </div>

          {/* Analytical */}
          <div className="flex items-start justify-between gap-4 p-4 rounded-2xl bg-white/5 border border-white/5">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-1">Analytické cookies</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Pomáhajú nám pochopiť, ako návštevníci komunikujú so stránkou, anonymným zbieraním a hlásením informácií.
              </p>
            </div>
            <button
              onClick={() => setLocalSettings(prev => ({ ...prev, analytical: !prev.analytical }))}
              className="relative inline-flex items-center cursor-pointer group shrink-0"
            >
              <div className={`w-11 h-6 rounded-full transition-colors ${localSettings.analytical ? 'bg-emerald-500' : 'bg-zinc-700'}`}></div>
              <div className={`absolute w-4 h-4 bg-white rounded-full transition-transform ${localSettings.analytical ? 'translate-x-6' : 'translate-x-1'}`}></div>
            </button>
          </div>

          {/* Marketing */}
          <div className="flex items-start justify-between gap-4 p-4 rounded-2xl bg-white/5 border border-white/5">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-1">Marketingové cookies</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Používajú sa na sledovanie návštevníkov na webových stránkach. Zámerom je zobrazovať reklamy, ktoré sú relevantné.
              </p>
            </div>
            <button
              onClick={() => setLocalSettings(prev => ({ ...prev, marketing: !prev.marketing }))}
              className="relative inline-flex items-center cursor-pointer group shrink-0"
            >
              <div className={`w-11 h-6 rounded-full transition-colors ${localSettings.marketing ? 'bg-emerald-500' : 'bg-zinc-700'}`}></div>
              <div className={`absolute w-4 h-4 bg-white rounded-full transition-transform ${localSettings.marketing ? 'translate-x-6' : 'translate-x-1'}`}></div>
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-3 rounded-full border border-white/10 text-xs font-bold uppercase tracking-widest text-zinc-400 hover:text-white hover:bg-white/5 transition-all"
          >
            Zrušiť
          </button>
          <button
            onClick={() => onSave(localSettings)}
            className="flex-1 px-6 py-3 rounded-full bg-emerald-500 text-black text-xs font-bold uppercase tracking-widest hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20"
          >
            Uložiť nastavenia
          </button>
        </div>
      </div>
    </div>
  );
}
