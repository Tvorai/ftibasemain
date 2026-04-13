"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { supabaseUrl, supabaseAnonKey, featureFlags } from "@/lib/config";

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!featureFlags.supabaseEnabled) {
      router.replace("/prihlasenie");
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const code = searchParams.get("code");
    const next = searchParams.get("next") || "/ucet";

    console.log("[AUTH CALLBACK] start. next =", next, "code exists =", !!code);

    const handleExchange = async () => {
      if (code) {
        console.log("[AUTH CALLBACK] exchanging code for session...");
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          console.error("[AUTH CALLBACK] exchange error:", error.message);
          router.replace(`/prihlasenie?error=${encodeURIComponent(error.message)}`);
          return;
        }
        console.log("[AUTH CALLBACK] exchange successful");
      }

      // Check for session to be sure
      const { data: { session } } = await supabase.auth.getSession();
      console.log("[AUTH CALLBACK] session exists =", !!session);

      if (session) {
        console.log("[AUTH CALLBACK] redirecting to", next);
        router.replace(next);
      } else {
        console.warn("[AUTH CALLBACK] no session found, redirecting to /prihlasenie");
        router.replace("/prihlasenie?error=no_session_after_callback");
      }
    };

    handleExchange();
  }, [router, searchParams]);

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-6">
      <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      <div className="flex flex-col items-center gap-2">
        <h2 className="text-white font-display text-2xl uppercase tracking-widest">
          Dokončujem prihlásenie
        </h2>
        <p className="text-zinc-500 text-sm animate-pulse">
          Prosím počkajte chvíľu...
        </p>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <CallbackHandler />
    </Suspense>
  );
}
