"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import { createClient } from "@supabase/supabase-js";
import { supabaseUrl, supabaseAnonKey } from "@/lib/config";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

type TabId = "profil" | "rezervacie" | "sluzby" | "kalendar" | "recenzie" | "vysledky" | "znacky" | "nastavenia";
type BrandSubTabId = "pridat" | "zoznam";

type Brand = {
  id: string;
  logo: string;
  code: string;
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // State pre "Môj profil"
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [images, setImages] = useState<(string | null)[]>([null, null, null, null]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State pre "Moje značky"
  const [activeBrandSubTab, setActiveBrandSubTab] = useState<BrandSubTabId>("pridat");
  const [newBrandLogo, setNewBrandLogo] = useState<string | null>(null);
  const [newBrandCode, setNewBrandCode] = useState("");
  const [brands, setBrands] = useState<Brand[]>([]);
  const brandLogoInputRef = useRef<HTMLInputElement>(null);

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
        .select("*")
        .eq("profile_id", user.id)
        .maybeSingle();

      if (error) throw error;

      if (trainer) {
        setUsername(trainer.slug || "");
        setBio(trainer.bio || "");
        // Načítanie značiek (ak existujú v JSONB stĺpci, inak [] )
        setBrands(trainer.brands || []);
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
      const { error } = await supabase
        .from("trainers")
        .update({ slug, bio })
        .eq("profile_id", user.id);

      if (error) throw error;
      setUsername(slug);
      alert("Profil bol uložený.");
    } catch (err) {
      console.error(err);
      alert("Chyba pri ukladaní.");
    } finally {
      setSaving(false);
    }
  };

  // Uloženie novej značky
  const handleSaveBrand = async () => {
    if (!newBrandLogo || !newBrandCode.trim()) {
      alert("Nahrajte logo a zadajte kód.");
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

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

      if (error) throw error;

      setBrands(updatedBrands);
      setNewBrandLogo(null);
      setNewBrandCode("");
      alert("Značka pridaná.");
    } catch (err) {
      console.error(err);
      alert("Chyba pri pridávaní značky.");
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
      const reader = new FileReader();
      reader.onloadend = () => setNewBrandLogo(reader.result as string);
      reader.readAsDataURL(file);
    }
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
            <div className="space-y-4">
              <input type="text" placeholder="Používateľské meno" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full bg-transparent border border-emerald-500 rounded-full px-6 py-3 text-white outline-none" />
              <textarea placeholder="Bio" value={bio} onChange={(e) => setBio(e.target.value.slice(0, 100))} maxLength={100} className="w-full bg-transparent border border-emerald-500 rounded-3xl px-6 py-3 text-white outline-none min-h-[80px] resize-none" />
            </div>
            <div onClick={() => fileInputRef.current?.click()} className="w-full aspect-[16/9] border border-emerald-500 rounded-[40px] flex flex-col items-center justify-center cursor-pointer">
              <div className="text-emerald-500 text-5xl font-light">+</div>
              <div className="text-zinc-500 text-sm uppercase tracking-widest">Nahrajte váš profilové fotky</div>
            </div>
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" />
            <div className="flex justify-center gap-3 w-full">
              {images.map((img, idx) => (
                <div key={idx} className="relative w-16 h-16 md:w-20 md:h-20 rounded-full border border-emerald-500 overflow-hidden shrink-0" />
              ))}
            </div>
            <button onClick={handleSaveProfile} disabled={saving} className="self-end bg-emerald-500 text-black font-display text-xl px-10 py-2 rounded-full uppercase disabled:opacity-50">
              {saving ? "Ukladám..." : "Uložiť"}
            </button>
          </div>
        );

      case "znacky":
        return (
          <div className="flex flex-col gap-8 w-full max-w-[520px] ml-auto">
            {/* Sub-tabs */}
            <div className="flex justify-end gap-8 mb-4">
              <button 
                onClick={() => setActiveBrandSubTab("pridat")}
                className={`text-lg transition-colors ${activeBrandSubTab === "pridat" ? "text-emerald-500" : "text-white"}`}
              >
                + Pridať značku
              </button>
              <button 
                onClick={() => setActiveBrandSubTab("zoznam")}
                className={`text-lg transition-colors ${activeBrandSubTab === "zoznam" ? "text-emerald-500" : "text-white"}`}
              >
                Moje značky
              </button>
            </div>

            {activeBrandSubTab === "pridat" ? (
              <div className="flex flex-col gap-6 items-center">
                <div className="w-full flex flex-col items-center gap-2">
                  <span className="text-white font-display text-xl uppercase tracking-wider">Nahrajte logo</span>
                  <div 
                    onClick={() => brandLogoInputRef.current?.click()}
                    className="w-full aspect-[3/1] border border-emerald-500 rounded-[30px] flex items-center justify-center cursor-pointer overflow-hidden relative"
                  >
                    {newBrandLogo ? (
                      <Image src={newBrandLogo} alt="Logo" fill className="object-contain p-4" />
                    ) : (
                      <span className="text-emerald-500 text-6xl font-light">+</span>
                    )}
                  </div>
                  <input type="file" ref={brandLogoInputRef} className="hidden" accept="image/*" onChange={handleLogoUpload} />
                </div>

                <div className="w-full flex flex-col items-center gap-2">
                  <span className="text-white font-display text-xl uppercase tracking-wider">Váš promo kód:</span>
                  <input 
                    type="text" 
                    value={newBrandCode} 
                    onChange={(e) => setNewBrandCode(e.target.value)}
                    className="w-1/2 bg-transparent border border-emerald-500 rounded-xl px-4 py-2 text-white text-center outline-none" 
                  />
                </div>

                <button 
                  onClick={handleSaveBrand}
                  disabled={saving}
                  className="mt-8 self-end bg-emerald-500 text-black font-display text-xl px-12 py-2 rounded-full uppercase tracking-widest disabled:opacity-50"
                >
                  {saving ? "Ukladám..." : "ULOŽIŤ"}
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-8">
                {brands.length === 0 ? (
                  <div className="text-zinc-500 italic text-center py-10">Zatiaľ nemáte žiadne značky.</div>
                ) : (
                  brands.map((brand) => (
                    <div key={brand.id} className="flex items-center gap-4">
                      <div className="flex-1 flex flex-col items-center gap-1">
                        <span className="text-white font-display text-xs uppercase tracking-tighter">Vaše logo</span>
                        <div className="w-full aspect-[2/1] border border-emerald-500 rounded-2xl overflow-hidden relative">
                          <Image src={brand.logo} alt="Logo" fill className="object-contain p-2" />
                        </div>
                      </div>
                      <div className="flex-1 flex flex-col items-center gap-1">
                        <span className="text-white font-display text-xs uppercase tracking-tighter">Váš promo kód:</span>
                        <div className="w-full bg-transparent border border-emerald-500 rounded-xl py-2 text-white text-center font-bold">
                          {brand.code}
                        </div>
                      </div>
                      <button 
                        onClick={() => handleDeleteBrand(brand.id)}
                        className="bg-emerald-500 text-black font-display text-sm px-6 py-2 rounded-full uppercase tracking-widest hover:bg-emerald-400 transition-colors"
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
