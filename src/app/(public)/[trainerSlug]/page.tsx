"use client";

import React, { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { createClient } from "@supabase/supabase-js";
import { supabaseUrl, supabaseAnonKey } from "@/lib/config";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

type TrainerProfile = {
  id: string;
  slug: string;
  bio: string | null;
  headline: string | null;
  city: string | null;
  brands: any[] | null;
  profile_id: string;
  profiles: {
    full_name: string | null;
  } | null;
};

export default function TrainerProfilePage({ params }: { params: { trainerSlug: string } }) {
  const [trainer, setTrainer] = useState<TrainerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  
  // Mockované dáta pre prvky, ktoré ešte nie sú v DB
  const mockImages = [
    "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=1000&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?q=80&w=1000&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1593079359745-560da59bc54c?q=80&w=1000&auto=format&fit=crop"
  ];

  const mockReviews = [
    { id: 1, author: "Janka Mišková", stars: 5, text: "Top skúsenosť. Rezervácia tréningu trvala asi minútu a všetko prebehlo bez problémov. Tréner presne vedel, čo robí." },
    { id: 2, author: "Peter Nagy", stars: 5, text: "Skvelý prístup a vysoko odborné znalosti. Odporúčam každému." },
    { id: 3, author: "Mária Tóthová", stars: 4, text: "Veľmi milý a ochotný tréner. Výsledky sa dostavili rýchlo." }
  ];

  const mockResults = [
    "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=400&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?q=80&w=400&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1526506118085-60ce8714f8c5?q=80&w=400&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1541534741688-6078c64b5903?q=80&w=400&auto=format&fit=crop"
  ];

  const loadTrainer = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("trainers")
        .select("*, profiles(full_name)")
        .eq("slug", params.trainerSlug)
        .maybeSingle();

      if (error) throw error;
      setTrainer(data);
    } catch (err) {
      console.error("Error loading trainer profile:", err);
    } finally {
      setLoading(false);
    }
  }, [params.trainerSlug]);

  useEffect(() => {
    loadTrainer();
  }, [loadTrainer]);

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-emerald-500">Načítavam profil...</div>;
  if (!trainer) return <div className="min-h-screen bg-black flex items-center justify-center text-white">Profil sa nenašiel.</div>;

  return (
    <div className="min-h-screen bg-black text-white pb-20 max-w-md mx-auto">
      {/* 1. BANNER / SLIDER */}
      <div className="relative w-full aspect-[3/4] overflow-hidden group">
        <Image 
          src={mockImages[activeImageIndex]} 
          alt="Trainer banner" 
          fill 
          className="object-cover transition-opacity duration-500"
        />
        {/* Slider indikátory */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
          {mockImages.map((_, idx) => (
            <button 
              key={idx}
              onClick={() => setActiveImageIndex(idx)}
              className={`w-2.5 h-2.5 rounded-full transition-all ${activeImageIndex === idx ? "bg-white scale-110" : "bg-white/40"}`}
            />
          ))}
        </div>
      </div>

      <div className="px-6 -mt-10 relative z-10">
        {/* 2. MENO A BIO */}
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">{trainer.profiles?.full_name || "Meno Trénera"}</h1>
          <p className="text-zinc-400 text-sm">{trainer.headline || "Špecialista na fitness a zdravý životný štýl"}</p>
          
          <div className="mt-2 inline-flex items-center bg-emerald-500 text-black text-[10px] font-bold px-3 py-1 rounded-full uppercase">
            {trainer.city || "Bratislava"}
          </div>
          
          {/* 3. RECENZIE (HVIEZDIČKY) */}
          <div className="flex items-center gap-2 mt-2">
            <div className="flex text-yellow-400">
              {[...Array(5)].map((_, i) => (
                <svg key={i} className="w-4 h-4 fill-current" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
              ))}
            </div>
            <span className="text-zinc-400 text-xs italic font-medium">67 recenzií</span>
          </div>
        </div>

        {/* 4. SLUŽBY (TLAČIDLÁ) */}
        <div className="mt-8 space-y-3">
          {[
            "Rezervovať osobný tréning",
            "Rezervovať online konzultáciu",
            "Objednať jedálniček",
            "Moje odporúčané značky"
          ].map((service, i) => (
            <button 
              key={i}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-4 px-6 rounded-[20px] text-lg transition-colors shadow-lg shadow-emerald-500/10"
            >
              {service}
            </button>
          ))}
        </div>

        {/* 5. RECENZIE (SLIDER) */}
        <div className="mt-12">
          <h2 className="text-3xl font-bold text-center mb-6">Recenzie</h2>
          <div className="relative group">
            <div className="border border-emerald-500/50 rounded-[25px] p-6 bg-zinc-900/30 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-4">
                <span className="font-bold text-lg">{mockReviews[0].author}</span>
                <div className="flex text-yellow-400">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} className="w-3 h-3 fill-current" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                  ))}
                </div>
              </div>
              <p className="text-zinc-300 italic text-sm leading-relaxed">"{mockReviews[0].text}"</p>
            </div>
            {/* Šípky */}
            <button className="absolute left-[-20px] top-1/2 -translate-y-1/2 text-emerald-500 text-2xl font-light hover:scale-110 transition-transform">&lt;</button>
            <button className="absolute right-[-20px] top-1/2 -translate-y-1/2 text-emerald-500 text-2xl font-light hover:scale-110 transition-transform">&gt;</button>
            
            {/* Bodky */}
            <div className="flex justify-center gap-1.5 mt-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className={`w-2 h-2 rounded-full ${i === 0 ? "bg-emerald-500" : "bg-emerald-500/30"}`} />
              ))}
            </div>
          </div>
          <button className="w-full text-center text-[10px] text-zinc-500 mt-4 hover:text-zinc-300 transition-colors uppercase tracking-widest font-bold">
            + Všetky recenzie
          </button>
        </div>

        {/* 6. VÝSLEDKY KLIENTOV */}
        <div className="mt-12">
          <h2 className="text-3xl font-bold text-center mb-6">Výsledky klientov</h2>
          <div className="grid grid-cols-2 gap-1 rounded-2xl overflow-hidden shadow-xl">
            {mockResults.map((url, i) => (
              <div key={i} className="relative aspect-square">
                <Image src={url} alt={`Result ${i}`} fill className="object-cover" />
              </div>
            ))}
          </div>
          <button className="w-full text-center text-[10px] text-zinc-500 mt-4 hover:text-zinc-300 transition-colors uppercase tracking-widest font-bold">
            + Všetky výsledky
          </button>
        </div>
      </div>
    </div>
  );
}
