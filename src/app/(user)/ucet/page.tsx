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

type TabId = "profil" | "sluzby" | "support";

export default function UserAccountPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>("profil");
  const [userId, setUserId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const vantaElRef = useRef<HTMLDivElement | null>(null);
  const vantaEffectRef = useRef<{ destroy: () => void } | null>(null);
  const [threeReady, setThreeReady] = useState(false);
  const [p5Ready, setP5Ready] = useState(false);
  const [vantaReady, setVantaReady] = useState(false);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");

  const handleLogout = async () => {
    try {
      await supabase?.auth.signOut();
    } finally {
      router.push("/prihlasenie");
    }
  };

  useEffect(() => {
    if (!threeReady || !vantaReady || !p5Ready) return;
    if (!vantaElRef.current) return;
    if (vantaEffectRef.current) return;

    const VANTA = (window as unknown as { VANTA: { TOPOLOGY: (config: Record<string, unknown>) => { destroy: () => void } } }).VANTA;
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
    console.log("[UCET] loadProfile starting...");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      console.log("[UCET] loadProfile session:", !!session);

      if (!session) {
        console.log("[UCET] No session in loadProfile, redirecting to /prihlasenie");
        router.replace("/prihlasenie");
        return;
      }

      const user = session.user;
      setUserId(user.id);
      setEmail(user.email || "");

      const prof = await supabase
        .from("profiles")
        .select("full_name, phone_number")
        .eq("id", user.id)
        .maybeSingle<{ full_name: string | null; phone_number: string | null }>();

      if (!prof.error && prof.data?.full_name) setFullName(prof.data.full_name);
      if (!prof.error && typeof prof.data?.phone_number === "string") setPhoneNumber(prof.data.phone_number);
    } catch (err) {
      console.error("[UCET] loadProfile error:", err);
    } finally {
      setLoading(false);
      setAuthChecking(false);
    }
  }, [router]);

  useEffect(() => {
    if (!supabase) {
      setAuthChecking(false);
      return;
    }

    console.log("[UCET] Initializing auth check...");
    
    // 1. Okamžitá kontrola session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log("[UCET] Initial session check:", !!session);
      if (session) {
        setAuthChecking(false);
        loadProfile();
      } else {
        // 2. Ak nie je session, počkáme krátko (či neprebieha OAuth sync)
        console.log("[UCET] No initial session, waiting 1s for sync...");
        const timer = setTimeout(() => {
          supabase.auth.getSession().then(({ data: { session: finalSession } }) => {
            console.log("[UCET] Final session check after 1s:", !!finalSession);
            if (!finalSession) {
              console.log("[UCET] Definitely no session, redirecting to login");
              router.replace("/prihlasenie");
            } else {
              setAuthChecking(false);
              loadProfile();
            }
          });
        }, 1000); // Skrátené na 1s
        return () => clearTimeout(timer);
      }
    });

    // 3. Počúvame na SIGNED_IN (ak by prišlo neskôr)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("[UCET] Auth event:", event, !!session);
      if (event === "SIGNED_IN" && session) {
        loadProfile();
      }
    });

    return () => subscription.unsubscribe();
  }, [loadProfile, router]);

  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const tab = url.searchParams.get("tab") as TabId;
      const hasReviewId = url.searchParams.has("reviewBookingId") || url.searchParams.has("openReview");

      if (hasReviewId) {
        setActiveTab("sluzby");
      } else if (tab && (tab === "profil" || tab === "sluzby" || tab === "support")) {
        setActiveTab(tab);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (!isMobileNavOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsMobileNavOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [isMobileNavOpen]);

  const handleSaveProfile = async () => {
    if (!supabase) return;
    if (saving) return;
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) {
        router.replace("/prihlasenie");
        return;
      }

      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName.trim(), phone_number: phoneNumber.trim() || null })
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

    if (authChecking) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-4">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <div className="text-zinc-500 font-display text-xl uppercase tracking-widest">Overujem prihlásenie...</div>
        </div>
      );
    }

    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-6 py-20 animate-pulse">
          <Image 
            src="/simplelogo.webp" 
            alt="Fitbase" 
            width={60} 
            height={60} 
            className="w-[60px] h-[60px] opacity-80"
          />
          <div className="flex flex-col items-center gap-3">
            <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <div className="text-zinc-500 font-display text-xl uppercase tracking-widest">Načítavam profil...</div>
          </div>
        </div>
      );
    }

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

              <div className="relative w-full">
                <span className="block text-white font-display text-2xl tracking-wide mb-2">Telefónne číslo</span>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="w-full bg-transparent border border-emerald-500 rounded-xl px-6 py-3 text-white outline-none focus:ring-1 focus:ring-emerald-500 transition-all"
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
            <ClientBookings userId={userId} userEmail={email} kind="booking" />
          </div>
        );

      case "support":
        return (
          <div className="flex flex-col gap-8 w-full max-w-[760px] ml-auto">
            <div className="bg-black/30 border border-emerald-500/30 rounded-[30px] p-8 md:p-10 backdrop-blur-md">
              <div className="max-w-[600px] space-y-8">
                <div className="space-y-4">
                  <h3 className="text-3xl font-display text-emerald-400 uppercase tracking-wider">Podpora</h3>
                  <p className="text-zinc-200 leading-relaxed text-lg">
                    Veľmi si vážim že ste začali používať našu platformu. Chceme Vám byť čo najviac nápomocný, aby ste predišli akým koľvek problémom... Pre viac informácií alebo ak sa vyskytne nejaký problém sa kludne na mňa obráťte.
                  </p>
                </div>

                <div className="space-y-4 pt-6 border-t border-white/10">
                  <div className="text-sm font-bold text-emerald-400 uppercase tracking-widest">Moje kontaktné údaje:</div>
                  <div className="space-y-4">
                    <div className="flex items-center gap-6 text-zinc-200">
                      <span className="w-24 text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Instagram:</span>
                      <a href="https://instagram.com/_patris.21" target="_blank" rel="noopener noreferrer" className="text-xl font-display hover:text-emerald-400 transition-colors">_patris.21</a>
                    </div>
                    <div className="flex items-center gap-6 text-zinc-200">
                      <span className="w-24 text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Mail:</span>
                      <span className="text-zinc-500 italic">...</span>
                    </div>
                  </div>
                </div>

                <div className="pt-8">
                  <a
                    href="https://fitbase.sk/podpora"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center bg-zinc-950/50 text-emerald-400 border border-emerald-500/50 hover:bg-emerald-500 hover:text-black font-display text-2xl px-12 py-3 rounded-full uppercase tracking-widest transition-all shadow-lg shadow-emerald-500/10 group"
                  >
                    <span>užitočné návody a rady</span>
                    <svg
                      className="ml-3 w-5 h-5 transition-transform group-hover:translate-x-1"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </a>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return <div className="flex items-center justify-center h-full text-zinc-500 italic">Obsah sa pripravuje...</div>;
    }
  };

  const tabs: { id: TabId; label: string }[] = [
    { id: "profil", label: "Môj profil" },
    { id: "sluzby", label: "Moje tréningy" },
    { id: "support", label: "Podpora" }
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
        <header className="md:hidden px-4 py-4 flex items-center justify-between border-b border-white/5">
          <div className="flex items-center gap-3">
            <Image src="/Fitbase logo.png" alt="Fitbase" width={130} height={30} priority className="h-auto w-[120px]" />
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right max-w-[45vw]">
              <div className="text-sm font-bold truncate">{fullName || "Používateľ"}</div>
            </div>
            <button
              type="button"
              onClick={() => setIsMobileNavOpen(true)}
              className="h-10 w-10 inline-flex items-center justify-center rounded-full border border-white/10 bg-zinc-950/40 hover:bg-zinc-900/60 transition-colors"
              aria-label="Menu"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </header>

        {isMobileNavOpen && (
          <div className="md:hidden fixed inset-0 z-[200]">
            <div
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setIsMobileNavOpen(false)}
            />
            <div className="absolute top-0 left-0 h-full w-[82vw] max-w-[320px] bg-zinc-950 border-r border-white/10 px-6 pt-4 pb-6 flex flex-col min-h-0 overflow-hidden">
              <div className="flex items-center justify-between mb-6">
                <Image src="/Fitbase logo.png" alt="Fitbase" width={140} height={32} priority className="h-auto w-[120px]" />
                <button
                  type="button"
                  onClick={() => setIsMobileNavOpen(false)}
                  className="h-10 w-10 inline-flex items-center justify-center rounded-full border border-white/10 bg-zinc-950/40 hover:bg-zinc-900/60 transition-colors"
                  aria-label="Zatvoriť"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="mb-4">
                <div className="text-xs text-zinc-500 uppercase tracking-widest font-bold">Prihlásený používateľ</div>
                <div className="text-lg font-bold text-white truncate">{fullName || "Používateľ"}</div>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain -mx-2 px-2">
                <nav className="flex flex-col gap-2 pb-6">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => {
                        setActiveTab(tab.id);
                        setIsMobileNavOpen(false);
                      }}
                      className={`text-left px-4 py-3 rounded-2xl font-display text-xl tracking-wide transition-colors ${
                        activeTab === tab.id ? "bg-emerald-500 text-black" : "text-white hover:bg-white/5"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                  <div className="pt-4 mt-4 border-t border-white/10">
                    <button
                      type="button"
                      onClick={async () => {
                        setIsMobileNavOpen(false);
                        await handleLogout();
                      }}
                      className="w-full text-left px-4 py-3 rounded-2xl font-display text-xl tracking-wide transition-colors text-red-400 hover:bg-red-500/10 hover:text-red-300"
                    >
                      Odhlásiť sa
                    </button>
                  </div>
                </nav>
              </div>
            </div>
          </div>
        )}

        <aside className="hidden md:flex w-[280px] p-10 flex-col gap-16 shrink-0 h-screen overflow-y-auto">
          <Image src="/Fitbase logo.png" alt="Fitbase" width={150} height={35} priority className="h-auto w-[150px]" />
          <div>
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
            <div className="pt-6 mt-6 border-t border-white/10">
              <button
                type="button"
                onClick={handleLogout}
                className="text-left text-2xl font-display tracking-wide transition-colors text-red-400 hover:text-red-300"
              >
                Odhlásiť sa
              </button>
            </div>
          </div>
        </aside>
        <main className="flex-1 p-6 md:p-10 flex flex-col">
          <div className="md:mt-[4px]">{renderTabContent()}</div>
        </main>
        <style jsx global>{`@import url('https://fonts.googleapis.com/css2?family=League+Gothic&display=swap');`}</style>
      </div>
    </div>
  );
}
