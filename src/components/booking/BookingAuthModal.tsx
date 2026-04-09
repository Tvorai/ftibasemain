"use client";

import React, { useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { featureFlags, siteUrl, supabaseAnonKey, supabaseUrl } from "@/lib/config";

interface BookingAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthed: () => Promise<void> | void;
  initialEmail?: string;
};

export default function BookingAuthModal({ isOpen, onClose, onAuthed, initialEmail }: BookingAuthModalProps) {
  const supabase = useMemo(() => {
    return featureFlags.supabaseEnabled ? createClient(supabaseUrl, supabaseAnonKey) : null;
  }, []);

  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState(initialEmail || "");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80">
      <div className="relative w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-white shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 text-zinc-400 hover:text-white transition-colors"
          aria-label="Zavrieť"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <h2 className="text-2xl font-bold mb-2">Prihlásenie</h2>
        <p className="text-sm text-zinc-400 mb-5">Pre dokončenie rezervácie sa musíte prihlásiť alebo registrovať.</p>

        <div className="flex gap-2 mb-4">
          <button
            type="button"
            onClick={() => setMode("login")}
            className={`flex-1 rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-widest ${
              mode === "login" ? "bg-emerald-500 text-black" : "bg-zinc-900 text-zinc-300 hover:text-white"
            }`}
          >
            Prihlásiť
          </button>
          <button
            type="button"
            onClick={() => setMode("register")}
            className={`flex-1 rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-widest ${
              mode === "register" ? "bg-emerald-500 text-black" : "bg-zinc-900 text-zinc-300 hover:text-white"
            }`}
          >
            Registrovať
          </button>
        </div>

        <button
          type="button"
          disabled={loading}
          onClick={async () => {
            if (!supabase) return;
            setError(null);
            setLoading(true);
            const redirectTo = typeof window !== "undefined" ? `${siteUrl.replace(/\/$/, "")}/auth/callback?next=${encodeURIComponent(window.location.pathname)}` : undefined;
            const result = await supabase.auth.signInWithOAuth({
              provider: "google",
              options: redirectTo ? { redirectTo } : undefined,
            });
            setLoading(false);
            if (result.error) setError(result.error.message);
          }}
          className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm font-bold hover:bg-zinc-800 transition-colors disabled:opacity-50"
        >
          Pokračovať cez Google
        </button>

        <div className="my-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-zinc-800" />
          <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">alebo</span>
          <div className="h-px flex-1 bg-zinc-800" />
        </div>

        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!supabase) return;
            if (!email.trim() || !password) return;
            if (loading) return;

            setError(null);
            setLoading(true);

            const op =
              mode === "login"
                ? supabase.auth.signInWithPassword({ email: email.trim(), password })
                : supabase.auth.signUp({ email: email.trim(), password });

            const result = await op;
            setLoading(false);

            if (result.error) {
              setError(result.error.message);
              return;
            }

            await onAuthed();
          }}
        >
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-500"
            autoComplete="email"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Heslo"
            className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-500"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
          />

          {error && <div className="rounded-xl border border-red-500/50 bg-red-500/10 px-4 py-3 text-xs text-red-300">{error}</div>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-black hover:bg-emerald-400 transition-colors disabled:opacity-50"
          >
            {loading ? "Spracovávam..." : mode === "login" ? "Prihlásiť sa" : "Registrovať sa"}
          </button>
        </form>

        <p className="mt-4 text-[10px] text-zinc-500 leading-snug">
          Dokončením prihlásenia sa rezervácia automaticky odošle.
        </p>
      </div>
    </div>
  );
}
