"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { supabaseUrl, supabaseAnonKey } from "@/lib/config";

export default function AdminImpersonatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      setError("Chýbajúci token.");
      return;
    }

    const handleImpersonation = async () => {
      const supabase = createClient(supabaseUrl, supabaseAnonKey);
      
      try {
        const res = await fetch("/api/admin/impersonate-verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });

        const data = await res.json();

        if (!res.ok) {
          setError(data.message || "Chyba pri overovaní tokenu.");
          return;
        }

        const { magic_link, admin_id } = data;

        // 1. Uložíme informáciu o impersonácii pre UI
        localStorage.setItem("impersonator_admin_id", admin_id);
        
        // 2. Presmerujeme na magic link, ktorý nás prihlási
        window.location.href = magic_link;
      } catch (err) {
        setError("Neočakávaná chyba.");
      }
    };

    handleImpersonation();
  }, [searchParams, router]);

  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white p-4">
        <div className="bg-zinc-900 border border-red-500/30 p-8 rounded-3xl max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-red-500 mb-4">Chyba impersonácie</h1>
          <p className="text-zinc-400 mb-6">{error}</p>
          <button 
            onClick={() => router.replace("/prihlasenie")}
            className="bg-zinc-800 hover:bg-zinc-700 text-white px-6 py-2 rounded-full transition-all"
          >
            Späť na prihlásenie
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center text-white">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-zinc-500 font-display uppercase tracking-widest">Pripravujem prístup...</p>
      </div>
    </div>
  );
}
