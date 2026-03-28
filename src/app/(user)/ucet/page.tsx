"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { createClient } from "@supabase/supabase-js";
import { featureFlags, supabaseAnonKey, supabaseUrl } from "@/lib/config";
import ClientBookings from "@/components/booking/ClientBookings";

const supabase = featureFlags.supabaseEnabled ? createClient(supabaseUrl, supabaseAnonKey) : null;

type TabId = "profil" | "sluzby" | "historia";

export default function UserAccountPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>("profil");
  const [userId, setUserId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const vantaElRef = useRef<HTMLDivElement | null>(null);
  const vantaEffectRef = useRef<any>(null);
  const [threeReady, setThreeReady] = useState(false);
  const [p5Ready, setP5Ready] = useState(false);
  const [vantaReady, setVantaReady] = useState(false);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (!threeReady || !vantaReady || !p5Ready) return;
    if (!vantaElRef.current) return;
    if (vantaEffectRef.current) return;

    const VANTA = (window as any).VANTA;
    if (!VANTA?.TOPOLOGY) return;

    vantaEffectRef.current = VANTA.TOPOLOGY({
      el: vantaElRef.current,
      mouseControls: true,
      touchControls: true,
      gyroControls: false,
      minHeight: 200.0,
      minWidth: 200.0,
      scale: 1.0,
      scaleMobile: 1.0,
      color: 0x97e6c0,
      backgroundColor: 0x0,
    });

    return () => {
      vantaEffectRef.current?.destroy?.();
      vantaEffectRef.current = null;
    };
  }, [p5Ready, threeReady, vantaReady]);

  const loadProfile = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) {
        router.replace("/prihlasenie");
        return;
      }

      setUserId(user.id);
      setEmail(user.email || "");

      const prof = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle<{ full_name: string | null }>();

      if (!prof.error && prof.data?.full_name) setFullName(prof.data.full_name);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleSaveProfile = async () => {
    if (!supabase) return;
    if (saving) return;
    setSaving(true);
    try {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) {
        router.replace("/prihlasenie");
        return;
      }

      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName.trim() })
        .eq("id", user.id);

      if (error) throw error;
      alert("Profil bol úspešne uložený.");
    } catch (err) {
      console.error(err);
      alert("Chyba pri ukladaní profilu.");
    } finally {
      setSaving(false);
    }
  };

  const renderTabContent = () => {
    if (!supabase) {
      return <div className="flex items-center justify-center h-full text-zinc-500 italic">Supabase nie je nakonfigurovaný.</div>;
    }

    if (loading) return <div className="flex items-center justify-center h-full text-zinc-500">Načítavam...</div>;

    switch (activeTab) {
      case "profil":
        return (
          <div className="flex flex-col gap-6 w-full max-w-[520px] ml-auto">
            <div className="space-y-4">
              <div className="relative w-full">
                <span className="block text-white font-display text-2xl tracking-wide mb-2">Meno a priezvisko</span>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-transparent border border-emerald-500 rounded-xl px-6 py-3 text-white outline-none focus:ring-1 focus:ring-emerald-500 transition-all"
                />
              </div>

              <div className="relative w-full">
                <span className="block text-white font-display text-2xl tracking-wide mb-2">Email</span>
                <input
                  type="email"
                  value={email}
                  disabled
                  className="w-full bg-transparent border border-emerald-500/50 rounded-xl px-6 py-3 text-white/70 outline-none"
                />
              </div>
            </div>

            <button
              onClick={handleSaveProfile}
              disabled={saving}
              className="self-end bg-emerald-500 text-black font-display text-2xl px-14 py-3 rounded-full uppercase tracking-widest disabled:opacity-50"
            >
              {saving ? "Ukladám..." : "ULOŽIŤ"}
            </button>
          </div>
        );

      case "sluzby":
        return (
          <div className="flex flex-col gap-6 w-full max-w-[760px] ml-auto">
            <ClientBookings userId={userId} userEmail={email} />
          </div>
        );

      case "historia":
        return (
          <div className="flex flex-col gap-6 w-full max-w-[760px] ml-auto">
            <Link
              href="/historia-rezervacii"
              className="w-full border border-emerald-500 rounded-[25px] px-8 py-5 text-white text-2xl font-display tracking-wide hover:text-emerald-300 hover:border-emerald-300 transition-colors"
            >
              História rezervácií
            </Link>
            <Link
              href="/historia-platieb"
              className="w-full border border-emerald-500 rounded-[25px] px-8 py-5 text-white text-2xl font-display tracking-wide hover:text-emerald-300 hover:border-emerald-300 transition-colors"
            >
              História platieb
            </Link>
          </div>
        );

      default:
        return <div className="flex items-center justify-center h-full text-zinc-500 italic">Obsah sa pripravuje...</div>;
    }
  };

  const tabs: { id: TabId; label: string }[] = [
    { id: "profil", label: "Môj profil" },
    { id: "sluzby", label: "Zakúpené služby" },
    { id: "historia", label: "História" }
  ];

  return (
    <div className="fixed inset-0 z-50 text-white overflow-auto">
      <div ref={vantaElRef} className="fixed inset-0" style={{ zIndex: 0 }} />

      <Script
        src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.1.9/p5.min.js"
        strategy="afterInteractive"
        onLoad={() => setP5Ready(true)}
      />
      <Script
        src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r121/three.min.js"
        strategy="afterInteractive"
        onLoad={() => setThreeReady(true)}
      />
      <Script
        src="https://cdn.jsdelivr.net/npm/vanta@latest/dist/vanta.topology.min.js"
        strategy="afterInteractive"
        onLoad={() => setVantaReady(true)}
      />

      <div className="relative z-10 min-h-screen bg-transparent text-white flex flex-col md:flex-row">
        <aside className="w-full md:w-[280px] p-6 md:p-10 flex flex-col gap-16 shrink-0">
          <Image src="/Fitbase logo.png" alt="Fitbase" width={150} height={35} priority className="h-auto w-[120px] md:w-[150px]" />
          <nav className="flex flex-col gap-4">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`text-left text-2xl font-display tracking-wide transition-colors ${activeTab === tab.id ? "text-emerald-500" : "text-white hover:text-emerald-500/70"}`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </aside>
        <main className="flex-1 p-6 md:p-10 flex flex-col">
          <div className="md:mt-[4px]">{renderTabContent()}</div>
        </main>
        <style jsx global>{`@import url('https://fonts.googleapis.com/css2?family=League+Gothic&display=swap');`}</style>
      </div>
    </div>
  );
}
