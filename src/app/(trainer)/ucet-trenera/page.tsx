"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useI18n } from "@/providers/i18n";
import { featureFlags, supabaseAnonKey, supabaseUrl } from "@/lib/config";
import { ensureTrainerRowAfterLogin } from "@/lib/trainerBootstrap";

const supabase = featureFlags.supabaseEnabled
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export default function TrainerDashboardPage() {
  const { messages } = useI18n();
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!supabase) return;

      const userRes = await supabase.auth.getUser();
      const userId = userRes.data.user?.id;
      if (!userId) return;

      const ensured = await ensureTrainerRowAfterLogin(supabase, userId);
      if (!ensured.ok && !cancelled) {
        setErrorText(ensured.message);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{messages.pages.trainerDashboard.title}</h1>
      <p className="text-gray-600">{messages.pages.trainerDashboard.description}</p>
      {errorText ? <div className="text-sm text-red-600">{errorText}</div> : null}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-lg border p-4">Widget: kalendár</div>
        <div className="rounded-lg border p-4">Widget: klienti</div>
      </div>
    </div>
  );
}
