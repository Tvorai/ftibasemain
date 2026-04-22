"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { supabaseUrl, supabaseAnonKey } from "@/lib/config";

export function ImpersonationBanner() {
  const [isAdminMode, setIsAdminMode] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const adminId = localStorage.getItem("impersonator_admin_id");
    if (adminId) {
      setIsAdminMode(true);
    }
  }, []);

  const handleReturnToAdmin = async () => {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    // 1. Audit log návratu
    const adminId = localStorage.getItem("impersonator_admin_id");
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    
    if (adminId && currentUser) {
      await fetch("/api/admin/impersonate-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          admin_id: adminId,
          target_id: currentUser.id,
          action: "returned"
        }),
      });
    }

    // 2. Odhlásime sa z target usera
    await supabase.auth.signOut();
    
    // 3. Vyčistíme localStorage
    localStorage.removeItem("impersonator_admin_id");
    
    // 4. Presmerujeme na prihlásenie (admin sa musí znova prihlásiť pre bezpečnosť)
    // Alternatíva: Ak by sme mali uložený refresh token admina, mohli by sme ho použiť,
    // ale to je menej bezpečné. Najistejšie je nové prihlásenie.
    router.replace("/prihlasenie");
  };

  if (!isAdminMode) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-rose-600 text-white px-4 py-2 text-center flex items-center justify-center gap-4 shadow-lg animate-in slide-in-from-top duration-300">
      <span className="text-sm font-bold uppercase tracking-wider">
        ⚠️ Ste prihlásený v režime impersonácie
      </span>
      <button
        onClick={handleReturnToAdmin}
        className="bg-white text-rose-600 px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest hover:bg-zinc-100 transition-colors shadow-sm"
      >
        Vrátiť sa do admin účtu
      </button>
    </div>
  );
}
