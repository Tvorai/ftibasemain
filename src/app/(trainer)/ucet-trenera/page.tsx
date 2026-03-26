"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import { createClient } from "@supabase/supabase-js";
import { supabaseUrl, supabaseAnonKey } from "@/lib/config";
import TrainerCalendar from "@/components/trainer/TrainerCalendar";
import CalendarSettings from "@/components/trainer/CalendarSettings";
import TrainerBookings from "@/components/booking/TrainerBookings";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

type TabId = "profil" | "rezervacie" | "sluzby" | "kalendar" | "recenzie" | "vysledky" | "znacky" | "nastavenia";
type CalendarTabId = "moj_kalendar" | "nastavenia_kalendara";
type BrandSubTabId = "pridat" | "zoznam";

type Brand = {
  id: string;
  logo: string;
  code: string;
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
        code: newBrandCode.trim()
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

  const renderTabContent = () => {
    if (loading) return <div className="flex items-center justify-center h-full text-zinc-500">Načítavam...</div>;

    switch (activeTab) {
      case "profil":
        return (
          <div className="flex flex-col gap-6 w-full max-w-[520px] ml-auto">
            <div className="flex items-center gap-2 bg-emerald-500 rounded-full px-4 py-2 w-full overflow-hidden">
              <span className="text-black text-xs font-medium truncate flex-1">
                Link vášho profilu: <span className="font-bold">{profileUrl}</span>
              </span>
              <button onClick={() => navigator.clipboard.writeText(profileUrl)} className="bg-black text-white text-[10px] px-3 py-1 rounded-full shrink-0">Kopírovať</button>
            </div>
            {/* Form sekcia */}
            <div className="space-y-4">
              <div className="relative w-full">
                <input
                  type="text"
                  placeholder="Vaše meno a priezvisko"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-transparent border border-emerald-500 rounded-full px-6 py-3 text-white outline-none focus:ring-1 focus:ring-emerald-500 transition-all"
                />
              </div>
              <div className="relative w-full">
                <input
                  type="text"
                  placeholder="Lokalita (napr. Bratislava)"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full bg-transparent border border-emerald-500 rounded-full px-6 py-3 text-white outline-none focus:ring-1 focus:ring-emerald-500 transition-all"
                />
              </div>
              <div className="relative w-full">
                <input
                  type="text"
                  placeholder="Používateľské meno (URL slug)"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-transparent border border-emerald-500 rounded-full px-6 py-3 text-white outline-none focus:ring-1 focus:ring-emerald-500 transition-all"
                />
              </div>
              <textarea placeholder="Bio" value={bio} onChange={(e) => setBio(e.target.value.slice(0, 100))} maxLength={100} className="w-full bg-transparent border border-emerald-500 rounded-3xl px-6 py-3 text-white outline-none min-h-[80px] resize-none" />
            </div>
            <div onClick={() => fileInputRef.current?.click()} className="w-full aspect-[16/9] border border-emerald-500 rounded-[40px] flex flex-col items-center justify-center cursor-pointer hover:bg-emerald-500/5 transition-colors group overflow-hidden relative">
              <div className="text-emerald-500 text-5xl font-light mb-1">+</div>
              <div className="text-zinc-500 text-sm uppercase tracking-widest">Nahrajte váš profilové fotky</div>
            </div>
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
            <div className="flex justify-center gap-3 w-full">
              {images.map((img, idx) => (
                <div key={idx} className="relative w-16 h-16 md:w-20 md:h-20 rounded-full border border-emerald-500 overflow-hidden shrink-0 bg-zinc-900/50">
                  {img && (
                    <>
                      <Image src={img} alt={`Profile ${idx}`} fill className="object-cover" />
                      <button 
                        onClick={(e) => { e.stopPropagation(); removeImage(idx); }}
                        className="absolute top-1 right-1 bg-black/70 text-white rounded-full w-4 h-4 flex items-center justify-center text-[8px] hover:bg-black transition-colors z-20"
                      >
                        ✕
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
            <button onClick={handleSaveProfile} disabled={saving} className="self-end bg-emerald-500 text-black font-display text-xl px-10 py-2 rounded-full uppercase disabled:opacity-50">
              {saving ? "Ukladám..." : "Uložiť"}
            </button>
          </div>
        );

      case "sluzby":
        return (
          <div className="flex flex-col gap-6 w-full max-w-[760px] ml-auto">
            {[
              { key: "personal_training" as const, label: "Rezervovať osobný tréning" },
              { key: "online_consultation" as const, label: "Rezervovať online konzultáciu" },
              { key: "meal_plan" as const, label: "Objednať jedálniček" },
              { key: "brands" as const, label: "Moje odporúčané značky" }
            ].map((item) => (
              <div key={item.key} className="flex items-center gap-6">
                <div className="flex-1 border border-emerald-500 rounded-xl px-6 py-3 text-white text-xl font-display tracking-wide">
                  {item.label}
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={servicesVisibility[item.key]}
                  onClick={() => toggleService(item.key)}
                  disabled={saving}
                  className={`relative w-20 h-10 rounded-full transition-colors ${servicesVisibility[item.key] ? "bg-emerald-500" : "bg-zinc-700"} disabled:opacity-60 disabled:cursor-not-allowed`}
                >
                  <span
                    className={`absolute top-1 left-1 w-8 h-8 bg-white rounded-full transition-transform ${servicesVisibility[item.key] ? "translate-x-10" : "translate-x-0"}`}
                  />
                </button>
              </div>
            ))}
            <div className="pt-6 self-end">
              <button
                onClick={handleSaveServices}
                disabled={saving}
                className="bg-emerald-500 hover:bg-emerald-400 text-black font-display text-2xl px-12 py-2 rounded-full tracking-wider transition-colors uppercase disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? "Ukladám..." : "ULOŽIŤ"}
              </button>
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
              <TrainerCalendar trainerId={trainerId} />
            ) : (
              <CalendarSettings trainerId={trainerId} />
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

      case "znacky":
        return (
          <div className="flex flex-col gap-10 w-full max-w-[600px] ml-auto">
            {/* Sub-tabs */}
            <div className="flex justify-end gap-10 mb-6">
              <button 
                onClick={() => setActiveBrandSubTab("pridat")}
                className={`text-2xl font-display tracking-wide transition-colors ${activeBrandSubTab === "pridat" ? "text-emerald-500" : "text-white"}`}
              >
                + Pridať značku
              </button>
              <button 
                onClick={() => setActiveBrandSubTab("zoznam")}
                className={`text-2xl font-display tracking-wide transition-colors ${activeBrandSubTab === "zoznam" ? "text-emerald-500" : "text-white"}`}
              >
                Moje značky
              </button>
            </div>

            {activeBrandSubTab === "pridat" ? (
              <div className="flex flex-col gap-8 items-center">
                <div className="w-full flex flex-col items-center gap-4">
                  <span className="text-white font-display text-2xl uppercase tracking-wider">Nahrajte logo</span>
                  <div 
                    onClick={() => brandLogoInputRef.current?.click()}
                    className="w-full aspect-[3/1] border border-emerald-500 rounded-[30px] flex items-center justify-center cursor-pointer overflow-hidden relative"
                  >
                    {newBrandLogo ? (
                      <Image src={newBrandLogo} alt="Logo" fill className="object-contain p-6" />
                    ) : (
                      <span className="text-emerald-500 text-7xl font-light">+</span>
                    )}
                  </div>
                  <input type="file" ref={brandLogoInputRef} className="hidden" accept="image/*" onChange={handleLogoUpload} />
                </div>

                <div className="w-full flex flex-col items-center gap-4">
                  <span className="text-white font-display text-2xl uppercase tracking-wider">Váš promo kód:</span>
                  <input 
                    type="text" 
                    value={newBrandCode} 
                    onChange={(e) => setNewBrandCode(e.target.value)}
                    className="w-3/4 bg-transparent border border-emerald-500 rounded-2xl px-6 py-4 text-white text-center text-xl font-bold outline-none" 
                  />
                </div>

                <button 
                  onClick={handleSaveBrand}
                  disabled={saving}
                  className="mt-10 self-end bg-emerald-500 text-black font-display text-2xl px-14 py-3 rounded-full uppercase tracking-widest disabled:opacity-50"
                >
                  {saving ? "Ukladám..." : "ULOŽIŤ"}
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-10">
                {brands.length === 0 ? (
                  <div className="text-zinc-500 italic text-center py-10 text-xl">Zatiaľ nemáte žiadne značky.</div>
                ) : (
                  brands.map((brand) => (
                    <div key={brand.id} className="flex items-center gap-6">
                      <div className="flex-1 flex flex-col items-center gap-3">
                        <span className="text-white font-display text-sm uppercase tracking-wider">Vaše logo</span>
                        <div className="w-full aspect-[2/1] border border-emerald-500 rounded-2xl overflow-hidden relative">
                          <Image src={brand.logo} alt="Logo" fill className="object-contain p-4" />
                        </div>
                      </div>
                      <div className="flex-1 flex flex-col items-center gap-3">
                        <span className="text-white font-display text-sm uppercase tracking-wider">Váš promo kód:</span>
                        <div className="w-full bg-transparent border border-emerald-500 rounded-2xl py-3 text-white text-center text-xl font-bold">
                          {brand.code}
                        </div>
                      </div>
                      <button 
                        onClick={() => handleDeleteBrand(brand.id)}
                        className="bg-emerald-500 text-black font-display text-lg px-8 py-3 rounded-full uppercase tracking-widest hover:bg-emerald-400 transition-colors shrink-0"
                      >
                        Vymazať
                      </button>
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
    { id: "rezervacie", label: "Rezervácie" },
    { id: "sluzby", label: "Služby" },
    { id: "kalendar", label: "Kalendár" },
    { id: "recenzie", label: "Recenzie" },
    { id: "vysledky", label: "Výsledky klientov" },
    { id: "znacky", label: "Moje značky" },
    { id: "nastavenia", label: "Nadstavenia" },
  ];

  return (
    <div className="min-h-screen bg-black text-white flex flex-col md:flex-row">
      <aside className="w-full md:w-[280px] p-6 md:p-10 flex flex-col gap-16 shrink-0">
        <Image src="/Fitbase logo.png" alt="Fitbase" width={150} height={35} priority className="h-auto w-[120px] md:w-[150px]" />
        <nav className="flex flex-col gap-4">
          {tabs.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`text-left text-2xl font-display tracking-wide transition-colors ${activeTab === tab.id ? "text-emerald-500" : "text-white hover:text-emerald-500/70"}`}>
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
