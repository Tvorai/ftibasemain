"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import { createClient } from "@supabase/supabase-js";
import { supabaseUrl, supabaseAnonKey } from "@/lib/config";
import TrainerCalendar from "@/components/trainer/TrainerCalendar";
import CalendarSettings from "@/components/trainer/CalendarSettings";
import TrainerBookings from "@/components/booking/TrainerBookings";
import TrainerClientResults from "@/components/trainer/TrainerClientResults";
import { listTrainerReviewsForDashboardAction } from "@/lib/booking/actions";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

type TabId = "profil" | "rezervacie" | "sluzby" | "kalendar" | "online-konzultacie" | "recenzie" | "vysledky" | "znacky" | "nastavenia";
type CalendarTabId = "moj_kalendar" | "nastavenia_kalendara";
type BrandSubTabId = "pridat" | "zoznam";

type Brand = {
  id: string;
  logo: string;
  code: string;
  url?: string;
};

type ServiceKey = "personal_training" | "online_consultation" | "meal_plan" | "brands";
type ServicesVisibility = Record<ServiceKey, boolean>;

const defaultServicesVisibility: ServicesVisibility = {
  personal_training: true,
  online_consultation: true,
  meal_plan: true,
  brands: true
};

// Helper pre slugifikáciu
function toSlug(input: string) {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .replace(/-{2,}/g, "-");
}

export default function TrainerDashboardPage() {
  const [activeTab, setActiveTab] = useState<TabId>("profil");
  const [activeCalendarTab, setActiveCalendarTab] = useState<CalendarTabId>("moj_kalendar");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const servicesPersistLockRef = useRef(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  
  // State pre "Môj profil"
  const [trainerId, setTrainerId] = useState<string>("");
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [city, setCity] = useState("");
  const [bio, setBio] = useState("");
  const [images, setImages] = useState<(string | null)[]>([null, null, null, null]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State pre "Moje značky"
  const [activeBrandSubTab, setActiveBrandSubTab] = useState<BrandSubTabId>("pridat");
  const [newBrandLogo, setNewBrandLogo] = useState<string | null>(null);
  const [newBrandCode, setNewBrandCode] = useState("");
  const [newBrandUrl, setNewBrandUrl] = useState("");
  const [brands, setBrands] = useState<Brand[]>([]);
  const brandLogoInputRef = useRef<HTMLInputElement>(null);
  const [servicesVisibility, setServicesVisibility] = useState<ServicesVisibility>(defaultServicesVisibility);

  const siteUrl = "https://fitbasemain.vercel.app/";
  const profileUrl = `${siteUrl}${toSlug(username)}`;

  // Načítanie dát zo Supabase
  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: trainer, error } = await supabase
        .from("trainers")
        .select("*, profiles(full_name)")
        .eq("profile_id", user.id)
        .maybeSingle();

      if (error) throw error;

      if (trainer) {
        setTrainerId(trainer.id);
        setUsername(trainer.slug || "");
        setFullName((trainer as any).profiles?.full_name || "");
        setCity(trainer.city || "");
        setBio(trainer.bio || "");
        setBrands(trainer.brands || []);
        if (trainer.services && typeof trainer.services === "object") {
          setServicesVisibility({
            ...defaultServicesVisibility,
            ...(trainer.services as Partial<ServicesVisibility>)
          });
        } else {
          setServicesVisibility(defaultServicesVisibility);
        }
        // Načítanie fotiek
        if (trainer.images && Array.isArray(trainer.images)) {
          const loadedImages = [...trainer.images];
          while (loadedImages.length < 4) loadedImages.push(null);
          setImages(loadedImages.slice(0, 4));
        }
      }
    } catch (err) {
      console.error("Error loading profile:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

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

  // Uloženie dát profilu
  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const slug = toSlug(username);
      
      // 1. Update tabuľky profiles (meno)
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ full_name: fullName })
        .eq("id", user.id);
      
      if (profileError) throw profileError;

      // 2. Update tabuľky trainers (slug, bio, mesto, fotky)
      const { error: trainerError } = await supabase
        .from("trainers")
        .update({ 
          slug, 
          bio,
          city: city,
          images: images 
        })
        .eq("profile_id", user.id);

      if (trainerError) throw trainerError;
      
      setUsername(slug);
      alert("Profil bol úspešne uložený.");
    } catch (err) {
      console.error(err);
      alert("Chyba pri ukladaní profilu.");
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1024 * 1024) {
        alert("Fotka je príliš veľká. Prosím nahrajte obrázok do 1MB.");
        return;
      }

      const firstEmptyIndex = images.findIndex(img => img === null);
      if (firstEmptyIndex === -1) {
        alert("Môžete nahrať maximálne 4 fotky.");
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new (window as any).Image();
        img.src = reader.result;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const MAX_WIDTH = 800;
          const scale = MAX_WIDTH / img.width;
          canvas.width = MAX_WIDTH;
          canvas.height = img.height * scale;
          
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
          
          const compressedBase64 = canvas.toDataURL("image/webp", 0.7);
          const newImages = [...images];
          newImages[firstEmptyIndex] = compressedBase64;
          setImages(newImages);
        };
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = (index: number) => {
     const newImages = [...images];
     newImages[index] = null;
     // Posunúť ostatné fotky dopredu, aby nezostali diery
     const filtered = newImages.filter((img): img is string => img !== null);
     const result: (string | null)[] = [...filtered];
     while (result.length < 4) result.push(null);
     setImages(result);
   };

  const handleSaveBrand = async () => {
    if (!newBrandLogo || !newBrandCode.trim()) {
      alert("Nahrajte logo a zadajte kód.");
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert("Chyba: Používateľ nie je prihlásený.");
        return;
      }

      const newBrand: Brand = {
        id: Math.random().toString(36).substr(2, 9),
        logo: newBrandLogo,
        code: newBrandCode.trim(),
        url: newBrandUrl.trim()
      };

      const updatedBrands = [...brands, newBrand];

      const { error } = await supabase
        .from("trainers")
        .update({ brands: updatedBrands })
        .eq("profile_id", user.id);

      if (error) {
        console.error("Supabase error:", error);
        throw new Error(error.message);
      }

      setBrands(updatedBrands);
      setNewBrandLogo(null);
      setNewBrandCode("");
      setNewBrandUrl("");
      alert("Značka úspešne pridaná.");
    } catch (err: any) {
      console.error("Save error:", err);
      alert(`Chyba pri pridávaní značky: ${err.message || "Skontrolujte, či v databáze existuje stĺpec 'brands' (JSONB)."}`);
    } finally {
      setSaving(false);
    }
  };

  // Vymazanie značky
  const handleDeleteBrand = async (id: string) => {
    if (!confirm("Naozaj chcete vymazať túto značku?")) return;

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const updatedBrands = brands.filter(b => b.id !== id);

      const { error } = await supabase
        .from("trainers")
        .update({ brands: updatedBrands })
        .eq("profile_id", user.id);

      if (error) throw error;

      setBrands(updatedBrands);
    } catch (err) {
      console.error(err);
      alert("Chyba pri mazaní.");
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Základná kontrola veľkosti (max 1MB pre base64 v JSON)
      if (file.size > 1024 * 1024) {
        alert("Logo je príliš veľké. Prosím nahrajte obrázok do 1MB.");
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new (window as any).Image();
        img.src = reader.result;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const MAX_WIDTH = 400;
          const scale = MAX_WIDTH / img.width;
          canvas.width = MAX_WIDTH;
          canvas.height = img.height * scale;
          
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
          
          const compressedBase64 = canvas.toDataURL("image/webp", 0.7);
          setNewBrandLogo(compressedBase64);
        };
      };
      reader.readAsDataURL(file);
    }
  };

  const persistServicesVisibility = async (next: ServicesVisibility) => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("trainers")
        .update({ services: next })
        .eq("profile_id", user.id);

      if (error) throw error;
    } catch (err: any) {
      console.error(err);
      alert(`Chyba pri ukladaní služieb: ${err?.message || "Skontrolujte, či v databáze existuje stĺpec 'services' (JSONB)."}`);
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const handleSaveServices = async () => {
    try {
      await persistServicesVisibility(servicesVisibility);
      window.location.reload();
    } catch {}
  };

  const toggleService = async (key: ServiceKey) => {
    if (servicesPersistLockRef.current) return;
    setServicesVisibility((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      servicesPersistLockRef.current = true;
      persistServicesVisibility(next)
        .catch(() => {
          setServicesVisibility(prev);
        })
        .finally(() => {
          servicesPersistLockRef.current = false;
        });
      return next;
    });
  };

  type TrainerReviewItem = {
    id: string;
    client_name: string;
    rating: number;
    comment: string;
    photo_url: string | null;
    created_at: string;
  };

  function TrainerReviewsTab() {
    const [reviews, setReviews] = useState<TrainerReviewItem[]>([]);
    const [loadingReviews, setLoadingReviews] = useState(true);
    const [reviewsError, setReviewsError] = useState<string | null>(null);

    useEffect(() => {
      let cancelled = false;

      async function load() {
        setLoadingReviews(true);
        setReviewsError(null);
        try {
          const sessionRes = await supabase.auth.getSession();
          const accessToken = sessionRes.data.session?.access_token;
          if (!accessToken) {
            throw new Error("Pre zobrazenie recenzií sa musíte prihlásiť.");
          }

          const res = await listTrainerReviewsForDashboardAction({ access_token: accessToken });
          if (res.status !== "success") {
            throw new Error(res.message);
          }

          if (!cancelled) setReviews(res.reviews as TrainerReviewItem[]);
        } catch (err: unknown) {
          if (!cancelled) setReviewsError(err instanceof Error ? err.message : "Nepodarilo sa načítať recenzie.");
        } finally {
          if (!cancelled) setLoadingReviews(false);
        }
      }

      void load();
      return () => {
        cancelled = true;
      };
    }, []);

    if (loadingReviews) return <div className="text-zinc-500 animate-pulse">Načítavam recenzie...</div>;
    if (reviewsError) return <div className="text-red-400">Chyba: {reviewsError}</div>;

    if (reviews.length === 0) {
      return <div className="text-zinc-500 italic">Zatiaľ nemáte žiadne recenzie.</div>;
    }

    return (
      <div className="space-y-4">
        {reviews.map((r) => (
          <div key={r.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-white font-bold">{r.client_name}</div>
                <div className="text-zinc-500 text-xs">
                  {new Date(r.created_at).toLocaleDateString("sk-SK")}
                </div>
              </div>
              <div className="flex text-yellow-400">
                {[...Array(5)].map((_, i) => (
                  <svg
                    key={i}
                    viewBox="0 0 20 20"
                    className={`w-4 h-4 ${r.rating > i ? "fill-current" : "fill-transparent"} stroke-current`}
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
            </div>

            <div className="mt-3 text-zinc-200 text-sm whitespace-pre-wrap">{r.comment}</div>

            {r.photo_url && (
              <div className="mt-4">
                <img src={r.photo_url} alt="" className="w-full rounded-2xl border border-white/10" />
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  const renderTabContent = () => {
    if (loading) return <div className="flex items-center justify-center h-full text-zinc-500">Načítavam...</div>;

    switch (activeTab) {
      case "profil":
        return (
          <div className="flex flex-col gap-6 w-full max-w-[760px] ml-auto">
            <h2 className="text-4xl font-display uppercase tracking-wider mb-2 text-emerald-400">Môj profil</h2>

            <div className="flex items-center justify-between gap-3 border border-emerald-500/30 rounded-2xl bg-zinc-900/30 backdrop-blur-sm px-4 py-3">
              <div className="min-w-0">
                <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Link vášho profilu</div>
                <div className="text-white font-bold truncate">{profileUrl}</div>
              </div>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(profileUrl)}
                className="shrink-0 px-4 py-2 rounded-full bg-emerald-500 text-black text-[10px] font-bold uppercase tracking-widest hover:bg-emerald-400 transition-colors"
              >
                Kopírovať
              </button>
            </div>

            <div className="bg-zinc-900/30 border border-emerald-500/30 rounded-[30px] p-6 md:p-8 backdrop-blur-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <span className="text-zinc-400 text-[10px] uppercase tracking-widest font-bold ml-2">Meno a priezvisko</span>
                  <input
                    type="text"
                    placeholder="Vaše meno a priezvisko"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full bg-zinc-950/50 border border-emerald-500/40 rounded-xl px-5 py-4 text-white outline-none focus:ring-1 focus:ring-emerald-500 transition-all placeholder:text-zinc-700"
                  />
                </div>

                <div className="space-y-2">
                  <span className="text-zinc-400 text-[10px] uppercase tracking-widest font-bold ml-2">Lokalita</span>
                  <input
                    type="text"
                    placeholder="Lokalita (napr. Bratislava)"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full bg-zinc-950/50 border border-emerald-500/40 rounded-xl px-5 py-4 text-white outline-none focus:ring-1 focus:ring-emerald-500 transition-all placeholder:text-zinc-700"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <span className="text-zinc-400 text-[10px] uppercase tracking-widest font-bold ml-2">Používateľské meno (URL)</span>
                  <input
                    type="text"
                    placeholder="Používateľské meno (URL slug)"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-zinc-950/50 border border-emerald-500/40 rounded-xl px-5 py-4 text-white outline-none focus:ring-1 focus:ring-emerald-500 transition-all placeholder:text-zinc-700"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <div className="flex items-center justify-between gap-4 px-2">
                    <span className="text-zinc-400 text-[10px] uppercase tracking-widest font-bold">Bio</span>
                    <span className="text-[10px] text-zinc-600 font-bold">{bio.length}/100</span>
                  </div>
                  <textarea
                    placeholder="Bio"
                    value={bio}
                    onChange={(e) => setBio(e.target.value.slice(0, 100))}
                    maxLength={100}
                    className="w-full bg-zinc-950/50 border border-emerald-500/40 rounded-2xl px-5 py-4 text-white outline-none min-h-[110px] resize-none focus:ring-1 focus:ring-emerald-500 transition-all placeholder:text-zinc-700"
                  />
                </div>
              </div>

              <div className="mt-8 space-y-3">
                <span className="text-zinc-400 text-[10px] uppercase tracking-widest font-bold ml-2">Profilové fotky</span>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full aspect-[16/9] border border-emerald-500/50 border-dashed rounded-[30px] flex flex-col items-center justify-center cursor-pointer hover:bg-emerald-500/5 transition-colors overflow-hidden relative"
                >
                  <div className="text-emerald-500 text-5xl font-light mb-2">+</div>
                  <div className="text-zinc-500 text-[10px] uppercase tracking-widest font-bold">Nahrať profilové fotky</div>
                </div>
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />

                <div className="flex flex-wrap justify-center gap-3 pt-2">
                  {images.map((img, idx) => (
                    <div key={idx} className="relative w-16 h-16 md:w-20 md:h-20 rounded-2xl border border-emerald-500/30 overflow-hidden shrink-0 bg-zinc-950/40">
                      {img ? (
                        <>
                          <Image src={img} alt={`Profile ${idx}`} fill className="object-cover" />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeImage(idx);
                            }}
                            className="absolute top-2 right-2 bg-black/70 text-white rounded-full w-6 h-6 flex items-center justify-center text-[10px] hover:bg-black transition-colors z-20"
                            aria-label="Odstrániť fotku"
                          >
                            ✕
                          </button>
                        </>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-700 text-xs font-bold">—</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-10 flex justify-end">
                <button
                  onClick={handleSaveProfile}
                  disabled={saving}
                  className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-3 px-10 rounded-full text-sm uppercase tracking-widest transition-all disabled:opacity-50 shadow-lg shadow-emerald-500/20"
                >
                  {saving ? "Ukladám..." : "Uložiť"}
                </button>
              </div>
            </div>
          </div>
        );

      case "sluzby":
        return (
          <div className="flex flex-col gap-4 w-full max-w-[400px] ml-auto">
            <div className="flex items-center justify-between p-4 border border-emerald-500/30 rounded-xl bg-zinc-900/30 backdrop-blur-sm">
              <span className="text-white font-medium">Rezervovať osobný tréning</span>
              <button
                type="button"
                role="switch"
                aria-checked={servicesVisibility.personal_training}
                onClick={() => toggleService("personal_training")}
                disabled={saving}
                className={`relative w-12 h-6 rounded-full transition-colors ${servicesVisibility.personal_training ? "bg-emerald-500" : "bg-zinc-700"} disabled:opacity-60 disabled:cursor-not-allowed`}
              >
                <span
                  className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${servicesVisibility.personal_training ? "translate-x-6" : "translate-x-0"}`}
                />
              </button>
            </div>
            <div className="flex items-center justify-between p-4 border border-emerald-500/30 rounded-xl bg-zinc-900/30 backdrop-blur-sm">
              <span className="text-white font-medium">Rezervovať online konzultáciu</span>
              <button
                type="button"
                role="switch"
                aria-checked={servicesVisibility.online_consultation}
                onClick={() => toggleService("online_consultation")}
                disabled={saving}
                className={`relative w-12 h-6 rounded-full transition-colors ${servicesVisibility.online_consultation ? "bg-emerald-500" : "bg-zinc-700"} disabled:opacity-60 disabled:cursor-not-allowed`}
              >
                <span
                  className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${servicesVisibility.online_consultation ? "translate-x-6" : "translate-x-0"}`}
                />
              </button>
            </div>
            <div className="flex items-center justify-between p-4 border border-emerald-500/30 rounded-xl bg-zinc-900/30 backdrop-blur-sm">
              <span className="text-white font-medium">Objednať jedálniček</span>
              <button
                type="button"
                role="switch"
                aria-checked={servicesVisibility.meal_plan}
                onClick={() => toggleService("meal_plan")}
                disabled={saving}
                className={`relative w-12 h-6 rounded-full transition-colors ${servicesVisibility.meal_plan ? "bg-emerald-500" : "bg-zinc-700"} disabled:opacity-60 disabled:cursor-not-allowed`}
              >
                <span
                  className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${servicesVisibility.meal_plan ? "translate-x-6" : "translate-x-0"}`}
                />
              </button>
            </div>
            <div className="flex items-center justify-between p-4 border border-emerald-500/30 rounded-xl bg-zinc-900/30 backdrop-blur-sm">
              <span className="text-white font-medium">Moje odporúčané značky</span>
              <button
                type="button"
                role="switch"
                aria-checked={servicesVisibility.brands}
                onClick={() => toggleService("brands")}
                disabled={saving}
                className={`relative w-12 h-6 rounded-full transition-colors ${servicesVisibility.brands ? "bg-emerald-500" : "bg-zinc-700"} disabled:opacity-60 disabled:cursor-not-allowed`}
              >
                <span
                  className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${servicesVisibility.brands ? "translate-x-6" : "translate-x-0"}`}
                />
              </button>
            </div>

            <div className="flex justify-end mt-6">
              <button className="bg-emerald-500 text-black font-display text-xl px-12 py-2 rounded-full uppercase tracking-widest shadow-lg shadow-emerald-500/20">Uložiť</button>
            </div>
          </div>
        );

      case "kalendar":
        return (
          <div className="flex flex-col gap-6 w-full max-w-[760px] ml-auto">
            <h2 className="text-4xl font-display uppercase tracking-wider mb-4 text-emerald-400">Kalendár</h2>
            
            <div className="flex gap-4 mb-6 border-b border-zinc-900 pb-4">
              <button
                onClick={() => setActiveCalendarTab("moj_kalendar")}
                className={`px-6 py-2 rounded-full font-bold uppercase tracking-widest text-xs transition-all ${
                  activeCalendarTab === "moj_kalendar" 
                    ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20" 
                    : "text-zinc-500 hover:text-white"
                }`}
              >
                Môj kalendár
              </button>
              <button
                onClick={() => setActiveCalendarTab("nastavenia_kalendara")}
                className={`px-6 py-2 rounded-full font-bold uppercase tracking-widest text-xs transition-all ${
                  activeCalendarTab === "nastavenia_kalendara" 
                    ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20" 
                    : "text-zinc-500 hover:text-white"
                }`}
              >
                Nastavenia kalendára
              </button>
            </div>

            {activeCalendarTab === "moj_kalendar" ? (
              <TrainerCalendar trainerId={trainerId} serviceType="personal" slotDurationMinutes={60} />
            ) : (
              <CalendarSettings trainerId={trainerId} serviceType="personal" slotDurationMinutes={60} />
            )}
          </div>
        );

      case "online-konzultacie":
        return (
          <div className="flex flex-col gap-6 w-full max-w-[760px] ml-auto">
            <h2 className="text-4xl font-display uppercase tracking-wider mb-4">Online konzultácie</h2>
            
            <div className="flex gap-4 mb-6 border-b border-zinc-900 pb-4">
              <button
                onClick={() => setActiveCalendarTab("moj_kalendar")}
                className={`px-6 py-2 rounded-full font-bold uppercase tracking-widest text-xs transition-all ${
                  activeCalendarTab === "moj_kalendar" 
                    ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20" 
                    : "text-zinc-500 hover:text-white"
                }`}
              >
                Môj kalendár
              </button>
              <button
                onClick={() => setActiveCalendarTab("nastavenia_kalendara")}
                className={`px-6 py-2 rounded-full font-bold uppercase tracking-widest text-xs transition-all ${
                  activeCalendarTab === "nastavenia_kalendara" 
                    ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20" 
                    : "text-zinc-500 hover:text-white"
                }`}
              >
                Nastavenia kalendára
              </button>
            </div>

            {activeCalendarTab === "moj_kalendar" ? (
              <TrainerCalendar trainerId={trainerId} serviceType="online" slotDurationMinutes={30} />
            ) : (
              <CalendarSettings trainerId={trainerId} serviceType="online" slotDurationMinutes={30} />
            )}
          </div>
        );

      case "rezervacie":
        return (
          <div className="flex flex-col gap-6 w-full max-w-[760px] ml-auto">
            <h2 className="text-4xl font-display uppercase tracking-wider mb-4">Moje rezervácie</h2>
            <TrainerBookings trainerId={trainerId} />
          </div>
        );

      case "recenzie":
        return (
          <div className="flex flex-col gap-6 w-full max-w-[760px] ml-auto">
            <h2 className="text-4xl font-display uppercase tracking-wider mb-4">Recenzie</h2>
            <TrainerReviewsTab />
          </div>
        );

      case "vysledky":
        return (
          <div className="flex flex-col gap-6 w-full max-w-[760px] ml-auto">
            <h2 className="text-4xl font-display uppercase tracking-wider mb-4">Výsledky klientov</h2>
            <TrainerClientResults trainerId={trainerId} />
          </div>
        );

      case "znacky":
        return (
          <div className="flex flex-col gap-6 w-full max-w-[760px] ml-auto">
            <h2 className="text-4xl font-display uppercase tracking-wider mb-4">Moje značky</h2>
            
            <div className="flex gap-4 mb-8">
              <button 
                onClick={() => setActiveBrandSubTab("zoznam")}
                className={`px-6 py-2 rounded-full font-bold uppercase tracking-widest text-xs transition-all ${
                  activeBrandSubTab === "zoznam" 
                    ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20" 
                    : "bg-zinc-900/50 text-zinc-500 hover:text-white border border-white/5"
                }`}
              >
                Moje značky
              </button>
              <button 
                onClick={() => setActiveBrandSubTab("pridat")}
                className={`px-6 py-2 rounded-full font-bold uppercase tracking-widest text-xs transition-all ${
                  activeBrandSubTab === "pridat" 
                    ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20" 
                    : "bg-zinc-900/50 text-zinc-500 hover:text-white border border-white/5"
                }`}
              >
                + Pridať značku
              </button>
            </div>

            {activeBrandSubTab === "pridat" ? (
              <div className="bg-zinc-900/30 border border-emerald-500/30 rounded-[30px] p-8 backdrop-blur-sm max-w-[500px]">
                <div className="space-y-6">
                  <div className="space-y-3">
                    <span className="text-zinc-400 text-[10px] uppercase tracking-widest font-bold ml-2">Logo značky</span>
                    <div 
                      onClick={() => brandLogoInputRef.current?.click()}
                      className="w-full aspect-[2/1] border border-emerald-500/50 border-dashed rounded-2xl flex items-center justify-center cursor-pointer hover:bg-emerald-500/5 transition-colors overflow-hidden relative group"
                    >
                      {newBrandLogo ? (
                        <>
                          <Image src={newBrandLogo} alt="Logo" fill className="object-contain p-4" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold uppercase tracking-widest">
                            Zmeniť logo
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                          <span className="text-emerald-500 text-4xl font-light">+</span>
                          <span className="text-zinc-500 text-[10px] uppercase tracking-widest font-bold">Nahrať logo</span>
                        </div>
                      )}
                    </div>
                    <input type="file" ref={brandLogoInputRef} className="hidden" accept="image/*" onChange={handleLogoUpload} />
                  </div>

                  <div className="space-y-3">
                    <span className="text-zinc-400 text-[10px] uppercase tracking-widest font-bold ml-2">Váš promo kód</span>
                    <input 
                      type="text" 
                      placeholder="Napr. FITBASE10"
                      value={newBrandCode} 
                      onChange={(e) => setNewBrandCode(e.target.value)}
                      className="w-full bg-zinc-950/50 border border-emerald-500/50 rounded-xl px-6 py-4 text-white text-lg font-bold outline-none focus:ring-1 focus:ring-emerald-500 transition-all uppercase placeholder:text-zinc-700" 
                    />
                  </div>

                  <div className="space-y-3">
                    <span className="text-zinc-400 text-[10px] uppercase tracking-widest font-bold ml-2">URL stránky proma</span>
                    <input 
                      type="text" 
                      placeholder="https://www.znacka.sk/akcia"
                      value={newBrandUrl} 
                      onChange={(e) => setNewBrandUrl(e.target.value)}
                      className="w-full bg-zinc-950/50 border border-emerald-500/50 rounded-xl px-6 py-4 text-white text-lg font-bold outline-none focus:ring-1 focus:ring-emerald-500 transition-all placeholder:text-zinc-700" 
                    />
                  </div>

                  <div className="pt-4 flex justify-end">
                    <button 
                      onClick={handleSaveBrand}
                      disabled={saving}
                      className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-3 px-10 rounded-full text-sm uppercase tracking-widest transition-all disabled:opacity-50 shadow-lg shadow-emerald-500/20"
                    >
                      {saving ? "Ukladám..." : "Uložiť značku"}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {brands.length === 0 ? (
                  <div className="col-span-full bg-zinc-900/20 border border-zinc-800/50 rounded-[30px] py-16 flex flex-col items-center gap-4">
                    <div className="text-zinc-600 italic">Zatiaľ nemáte pridané žiadne značky.</div>
                    <button 
                      onClick={() => setActiveBrandSubTab("pridat")}
                      className="text-emerald-500 text-[10px] uppercase tracking-widest font-bold hover:text-emerald-400 transition-colors"
                    >
                      Pridať prvú značku
                    </button>
                  </div>
                ) : (
                  brands.map((brand) => (
                    <div key={brand.id} className="bg-zinc-900/30 border border-emerald-500/30 rounded-[25px] p-5 backdrop-blur-sm group hover:border-emerald-500/50 transition-colors flex flex-col gap-4">
                      <div className="relative aspect-[2/1] bg-zinc-950/40 rounded-xl overflow-hidden border border-zinc-800 flex items-center justify-center">
                        <Image src={brand.logo} alt="Logo" fill className="object-contain p-4" />
                      </div>
                      
                      <div className="flex items-center justify-between px-1">
                        <div className="space-y-1">
                          <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold block">Promo kód</span>
                          <span className="text-white font-bold text-lg tracking-wide uppercase">{brand.code}</span>
                        </div>
                        <button 
                          onClick={() => handleDeleteBrand(brand.id)}
                          className="px-4 py-2 rounded-full border border-red-500/30 text-red-500 hover:bg-red-500/10 transition-colors text-[10px] uppercase font-bold tracking-widest"
                        >
                          Vymazať
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        );

      default:
        return <div className="flex items-center justify-center h-full text-zinc-500 italic">Obsah sa pripravuje...</div>;
    }
  };

  const tabs: { id: TabId; label: string }[] = [
    { id: "profil", label: "Môj profil" },
    { id: "rezervacie", label: "Všetky rezervácie" },
    { id: "sluzby", label: "Služby" },
    { id: "kalendar", label: "Kalendár" },
    { id: "online-konzultacie", label: "Online konzultácie" },
    { id: "recenzie", label: "Recenzie" },
    { id: "vysledky", label: "Výsledky klientov" },
    { id: "znacky", label: "Moje značky" },
    { id: "nastavenia", label: "Nadstavenia" },
  ];

  return (
    <div className="min-h-screen bg-black text-white flex flex-col md:flex-row">
      <header className="md:hidden px-4 py-4 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-3">
          <Image src="/Fitbase logo.png" alt="Fitbase" width={130} height={30} priority className="h-auto w-[120px]" />
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right max-w-[45vw]">
            <div className="text-sm font-bold truncate">{fullName || "Tréner"}</div>
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
          <div className="absolute top-0 left-0 h-full w-[82vw] max-w-[320px] bg-zinc-950 border-r border-white/10 p-6">
            <div className="flex items-center justify-between mb-10">
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

            <div className="mb-6">
              <div className="text-xs text-zinc-500 uppercase tracking-widest font-bold">Prihlásený tréner</div>
              <div className="text-lg font-bold text-white truncate">{fullName || "Tréner"}</div>
            </div>

            <nav className="flex flex-col gap-2">
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
            </nav>
          </div>
        </div>
      )}

      <aside className="hidden md:flex w-[280px] p-10 flex-col gap-16 shrink-0">
        <Image src="/Fitbase logo.png" alt="Fitbase" width={150} height={35} priority className="h-auto w-[150px]" />
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
  );
}
