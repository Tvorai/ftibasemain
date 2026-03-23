"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";

type TrainerProfile = {
  slug: string;
  bio: string | null;
  headline: string | null;
  city: string | null;
  images: any[] | null;
  brands: any[] | null;
  profiles: {
    full_name: string | null;
  } | null;
};

export default function TrainerProfilePage({ params }: { params: { trainerSlug: string } }) {
  const [trainer, setTrainer] = useState<TrainerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const swipeRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    isDown: boolean;
    hasSwiped: boolean;
  } | null>(null);
  const suppressClickRef = useRef(false);

  const loadTrainer = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/public-trainer/${params.trainerSlug}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        setTrainer(null);
        return;
      }
      setTrainer(json.trainer);
    } catch (err) {
      console.error("Error loading trainer profile:", err);
    } finally {
      setLoading(false);
    }
  }, [params.trainerSlug]);

  useEffect(() => {
    loadTrainer();
  }, [loadTrainer]);

  // Ak sú polia prázdne, v UI ich skryjeme
  const images: string[] = trainer?.images && Array.isArray(trainer.images)
    ? trainer.images.filter((img): img is string => img !== null)
    : [];
  const reviews: any[] = [];   // Tu budú recenzie z DB (zatiaľ prázdne pre test skrytia)
  const results: string[] = []; // Tu budú výsledky z DB (zatiaľ prázdne pre test skrytia)

  useEffect(() => {
    if (images.length === 0) {
      if (activeImageIndex !== 0) setActiveImageIndex(0);
      return;
    }
    if (activeImageIndex > images.length - 1) setActiveImageIndex(0);
  }, [activeImageIndex, images.length]);

  const goPrev = useCallback(() => {
    if (suppressClickRef.current) return;
    if (images.length <= 1) return;
    setActiveImageIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  }, [images.length]);

  const goNext = useCallback(() => {
    if (suppressClickRef.current) return;
    if (images.length <= 1) return;
    setActiveImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  }, [images.length]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (images.length <= 1) return;
    if (e.pointerType !== "touch" && e.pointerType !== "pen") return;
    swipeRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      lastX: e.clientX,
      lastY: e.clientY,
      isDown: true,
      hasSwiped: false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const state = swipeRef.current;
    if (!state || !state.isDown || state.pointerId !== e.pointerId) return;
    state.lastX = e.clientX;
    state.lastY = e.clientY;

    const dx = state.lastX - state.startX;
    const dy = state.lastY - state.startY;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    if (absX > 12 && absX > absY * 1.1) {
      state.hasSwiped = true;
      e.preventDefault();
    }
  };

  const finishSwipe = (pointerId: number) => {
    const state = swipeRef.current;
    if (!state || !state.isDown || state.pointerId !== pointerId) return;

    const dx = state.lastX - state.startX;
    const dy = state.lastY - state.startY;
    swipeRef.current = null;

    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    if (absX < 40 || absX <= absY) return;

    suppressClickRef.current = true;
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 250);

    if (dx < 0) goNext();
    else goPrev();
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    finishSwipe(e.pointerId);
  };

  const onPointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    const state = swipeRef.current;
    if (state && state.pointerId === e.pointerId) swipeRef.current = null;
  };

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-emerald-500">Načítavam profil...</div>;
  if (!trainer) return <div className="min-h-screen bg-black flex items-center justify-center text-white">Profil sa nenašiel.</div>;

  return (
    <div className="min-h-screen bg-black text-white pb-20 max-w-md mx-auto overflow-x-hidden relative">
      {/* 1. BANNER / SLIDER - Zobrazí sa len ak sú fotky */}
      {images.length > 0 ? (
        <div
          className="relative w-full aspect-[3/4] overflow-hidden group touch-pan-y"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
        >
          {images.map((img, idx) => (
            <div 
              key={idx}
              className={`absolute inset-0 transition-opacity duration-500 ease-in-out ${activeImageIndex === idx ? "opacity-100 z-10" : "opacity-0 z-0"}`}
            >
              <Image 
                src={img} 
                alt={`Trainer banner ${idx + 1}`} 
                fill 
                className="object-cover"
                priority={idx === 0}
              />
            </div>
          ))}
          
          {/* Klikateľné zóny pre prepínanie (vľavo/vpravo) */}
          {images.length > 1 && (
            <>
              <div 
                className="absolute inset-y-0 left-0 w-1/2 z-20 cursor-pointer" 
                onClick={goPrev}
              />
              <div 
                className="absolute inset-y-0 right-0 w-1/2 z-20 cursor-pointer" 
                onClick={goNext}
              />
            </>
          )}

          {/* Slider indikátory */}
          {images.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-30">
              {images.map((_, idx) => (
                <button 
                  key={idx}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveImageIndex(idx);
                  }}
                  className={`w-2.5 h-2.5 rounded-full transition-all ${activeImageIndex === idx ? "bg-white scale-110" : "bg-white/40"}`}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="w-full aspect-[3/4] bg-zinc-900 flex items-center justify-center text-zinc-700 italic">
          Žiadne profilové fotky
        </div>
      )}

      <div className="px-6 mt-6 relative z-10">
        {/* 2. MENO A BIO */}
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">{trainer.profiles?.full_name || "Bez mena"}</h1>
          {trainer.bio && <p className="text-zinc-300 text-sm leading-relaxed mt-2">{trainer.bio}</p>}
          {trainer.headline && <p className="text-zinc-400 text-xs italic">{trainer.headline}</p>}
          
          <div className="mt-3 inline-flex items-center bg-emerald-500 text-black text-[10px] font-bold px-3 py-1 rounded-full uppercase">
            {trainer.city || "Slovensko"}
          </div>
          
          {/* 3. RECENZIE (SÚHRN) - Zobrazí sa len ak sú recenzie */}
          {reviews.length > 0 && (
            <div className="flex items-center gap-2 mt-2">
              <div className="flex text-yellow-400">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} className="w-4 h-4 fill-current" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                ))}
              </div>
              <span className="text-zinc-400 text-xs italic font-medium">{reviews.length} recenzií</span>
            </div>
          )}
        </div>

        {/* 4. SLUŽBY (TLAČIDLÁ) */}
        <div className="mt-8 space-y-3">
          <button className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-4 px-6 rounded-[20px] text-lg transition-colors shadow-lg shadow-emerald-500/10 uppercase tracking-wide">
            Rezervovať osobný tréning
          </button>
          <button className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-4 px-6 rounded-[20px] text-lg transition-colors shadow-lg shadow-emerald-500/10 uppercase tracking-wide">
            Rezervovať online konzultáciu
          </button>
          <button className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-4 px-6 rounded-[20px] text-lg transition-colors shadow-lg shadow-emerald-500/10 uppercase tracking-wide">
            Objednať jedálniček
          </button>
          {trainer.brands && trainer.brands.length > 0 && (
            <button className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-4 px-6 rounded-[20px] text-lg transition-colors shadow-lg shadow-emerald-500/10 uppercase tracking-wide">
              Moje odporúčané značky
            </button>
          )}
        </div>

        {/* 5. RECENZIE (SLIDER) - Skryté ak nie sú recenzie */}
        {reviews.length > 0 && (
          <div className="mt-12">
            <h2 className="text-3xl font-bold text-center mb-6 font-display uppercase tracking-wider">Recenzie</h2>
            <div className="relative group">
              <div className="border border-emerald-500/50 rounded-[25px] p-6 bg-zinc-900/30 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-4">
                  <span className="font-bold text-lg">{reviews[0].author}</span>
                  <div className="flex text-yellow-400">
                    {[...Array(5)].map((_, i) => (
                      <svg key={i} className="w-3 h-3 fill-current" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                    ))}
                  </div>
                </div>
                <p className="text-zinc-300 italic text-sm leading-relaxed">&quot;{reviews[0].text}&quot;</p>
              </div>
            </div>
            <button className="w-full text-center text-[10px] text-zinc-500 mt-4 hover:text-zinc-300 transition-colors uppercase tracking-widest font-bold">
              + Všetky recenzie
            </button>
          </div>
        )}

        {/* 6. VÝSLEDKY KLIENTOV - Skryté ak nie sú fotky */}
        {results.length > 0 && (
          <div className="mt-12">
            <h2 className="text-3xl font-bold text-center mb-6 font-display uppercase tracking-wider">Výsledky klientov</h2>
            <div className="grid grid-cols-2 gap-1 rounded-2xl overflow-hidden shadow-xl">
              {results.map((url, i) => (
                <div key={i} className="relative aspect-square">
                  <Image src={url} alt={`Result ${i}`} fill className="object-cover" />
                </div>
              ))}
            </div>
            <button className="w-full text-center text-[10px] text-zinc-500 mt-4 hover:text-zinc-300 transition-colors uppercase tracking-widest font-bold">
              + Všetky výsledky
            </button>
          </div>
        )}
      </div>
      
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=League+Gothic&display=swap');
        .font-display { font-family: 'League Gothic', sans-serif; }
      `}</style>
    </div>
  );
}
