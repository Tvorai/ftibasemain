"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import Script from "next/script";
import { Modal } from "@/components/Modal";
import AvailableSlots from "@/components/booking/AvailableSlots";
import BookingForm from "@/components/booking/BookingForm";
import { AvailableSlot } from "@/lib/booking/getAvailableSlots";
import MealPlanRequestForm from "@/components/meal-plan/MealPlanRequestForm";

type ServiceKey = "personal_training" | "online_consultation" | "meal_plan" | "brands";
type ServicesVisibility = Record<ServiceKey, boolean>;

type TrainerProfile = {
  id: string;
  slug: string;
  bio: string | null;
  headline: string | null;
  city: string | null;
  images: any[] | null;
  brands: any[] | null;
  services: unknown;
  reviews?: unknown;
  profiles: {
    full_name: string | null;
    email?: string | null;
  } | null;
};

type TrainerReview = {
  id: string;
  client_name: string;
  rating: number;
  comment: string;
  photo_url: string | null;
  created_at: string;
};

export default function TrainerProfilePage({ params }: { params: { trainerSlug: string } }) {
  const [trainer, setTrainer] = useState<TrainerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [shareBusy, setShareBusy] = useState(false);
  const swipeRef = useRef<{
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    isDown: boolean;
  } | null>(null);
  const suppressClickRef = useRef(false);
  const vantaElRef = useRef<HTMLDivElement | null>(null);
  const vantaEffectRef = useRef<any>(null);
  const [threeReady, setThreeReady] = useState(false);
  const [p5Ready, setP5Ready] = useState(false);
  const [vantaReady, setVantaReady] = useState(false);

  // States for popups
  const [isPersonalTrainingModalOpen, setIsPersonalTrainingModalOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);
  const [pendingFormValues, setPendingFormValues] = useState<{ client_name: string; client_email: string; client_phone: string; note: string } | null>(null);
  const [isOnlineConsultationModalOpen, setIsOnlineConsultationModalModalOpen] = useState(false);
  const [isMealPlanModalOpen, setIsMealPlanModalOpen] = useState(false);
  const [isBrandsModalOpen, setIsBrandsModalOpen] = useState(false);

  const loadTrainer = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/public-trainer/${params.trainerSlug}?t=${Date.now()}`, {
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

  useEffect(() => {
    if (!trainer) return;
    if (typeof window === "undefined") return;
    try {
      const url = new URL(window.location.href);
      const shouldOpen = url.searchParams.get("openBooking");
      if (shouldOpen) {
        setIsPersonalTrainingModalOpen(true);
      }
    } catch {}
  }, [trainer]);

  useEffect(() => {
    if (!trainer) return;
    if (typeof window === "undefined") return;

    const raw = sessionStorage.getItem("fitbase_pending_booking");
    if (!raw) return;

    const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

    let parsed: unknown = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      sessionStorage.removeItem("fitbase_pending_booking");
      return;
    }

    if (!isRecord(parsed)) return;
    const slot = parsed.slot;
    const form = parsed.form;
    if (!isRecord(slot) || !isRecord(form)) return;
    if (typeof slot.trainer_id !== "string" || slot.trainer_id !== trainer.id) return;
    if (typeof slot.starts_at !== "string" || typeof slot.ends_at !== "string" || typeof slot.source_availability_slot_id !== "string") return;
    if (typeof form.client_name !== "string" || typeof form.client_email !== "string") return;

    setSelectedSlot(slot as AvailableSlot);
    setPendingFormValues({
      client_name: form.client_name,
      client_email: form.client_email,
      client_phone: typeof form.client_phone === "string" ? form.client_phone : "",
      note: typeof form.note === "string" ? form.note : "",
    });
    setIsPersonalTrainingModalOpen(true);
  }, [trainer]);

  useEffect(() => {
    if (!trainer) return;
    if (typeof window === "undefined") return;

    const raw = sessionStorage.getItem("fitbase_pending_meal_plan_request");
    if (!raw) return;

    const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

    let parsed: unknown = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      sessionStorage.removeItem("fitbase_pending_meal_plan_request");
      return;
    }

    if (!isRecord(parsed)) return;
    const pendingTrainerId = parsed.trainer_id;
    if (typeof pendingTrainerId !== "string") return;
    if (pendingTrainerId !== trainer.id) return;

    setIsMealPlanModalOpen(true);
  }, [trainer]);

  const images: string[] = trainer?.images && Array.isArray(trainer.images)
    ? trainer.images.filter((img): img is string => img !== null)
    : [];
  const reviews: TrainerReview[] = Array.isArray(trainer?.reviews)
    ? (trainer?.reviews as unknown[]).flatMap((item): TrainerReview[] => {
        if (!item || typeof item !== "object") return [];
        const anyItem = item as Record<string, unknown>;
        const id = anyItem.id;
        const clientName = anyItem.client_name;
        const rating = anyItem.rating;
        const comment = anyItem.comment;
        const photoUrl = anyItem.photo_url;
        const createdAt = anyItem.created_at;
        if (typeof id !== "string") return [];
        if (typeof clientName !== "string") return [];
        if (typeof rating !== "number") return [];
        if (typeof comment !== "string") return [];
        if (!(typeof photoUrl === "string" || photoUrl === null)) return [];
        if (typeof createdAt !== "string") return [];
        return [
          {
            id,
            client_name: clientName,
            rating,
            comment,
            photo_url: photoUrl,
            created_at: createdAt,
          },
        ];
      })
    : [];
  const results: string[] = [];
  const defaultServices: ServicesVisibility = {
    personal_training: true,
    online_consultation: true,
    meal_plan: true,
    brands: true
  };

  const coerceBoolean = (value: unknown): boolean | undefined => {
    if (value === true || value === false) return value;
    if (value === "true") return true;
    if (value === "false") return false;
    if (value === 1) return true;
    if (value === 0) return false;
    return undefined;
  };

  let servicesRaw: Record<string, unknown> | null = null;
  if (trainer?.services && typeof trainer.services === "string") {
    try {
      const parsed = JSON.parse(trainer.services);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) servicesRaw = parsed as Record<string, unknown>;
    } catch {}
  } else if (trainer?.services && typeof trainer.services === "object" && !Array.isArray(trainer.services)) {
    servicesRaw = trainer.services as Record<string, unknown>;
  }

  const servicesMerged = { ...defaultServices, ...(servicesRaw || {}) } as Record<string, unknown>;
  const services: ServicesVisibility = {
    personal_training: coerceBoolean(servicesMerged.personal_training) ?? defaultServices.personal_training,
    online_consultation: coerceBoolean(servicesMerged.online_consultation) ?? defaultServices.online_consultation,
    meal_plan: coerceBoolean(servicesMerged.meal_plan) ?? defaultServices.meal_plan,
    brands: coerceBoolean(servicesMerged.brands) ?? defaultServices.brands
  };

  const avgRating = reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0;
  const avgRounded = Math.round(avgRating * 10) / 10;

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

  const finishSwipe = () => {
    const state = swipeRef.current;
    if (!state || !state.isDown) return;

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

  const onTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (images.length <= 1) return;
    const t = e.touches[0];
    if (!t) return;
    swipeRef.current = {
      startX: t.clientX,
      startY: t.clientY,
      lastX: t.clientX,
      lastY: t.clientY,
      isDown: true,
    };
  };

  const onTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    const state = swipeRef.current;
    if (!state || !state.isDown) return;
    const t = e.touches[0];
    if (!t) return;
    state.lastX = t.clientX;
    state.lastY = t.clientY;
  };

  const onTouchEnd = () => {
    finishSwipe();
  };

  const onTouchCancel = () => {
    swipeRef.current = null;
  };

  useEffect(() => {
    if (!threeReady || !vantaReady) return;
    if (typeof window === "undefined") return;
    if (window.innerWidth < 768) return;
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
      backgroundColor: 0x0
    });

    return () => {
      vantaEffectRef.current?.destroy?.();
      vantaEffectRef.current = null;
    };
  }, [p5Ready, threeReady, vantaReady]);

  const handleShare = useCallback(async () => {
    if (!trainer) return;
    if (typeof window === "undefined") return;
    if (shareBusy) return;

    const nav = window.navigator;
    const name = trainer.profiles?.full_name?.trim() || "Fitbase tréner";
    const url = `${window.location.origin}/t/${trainer.id}`;

    setShareBusy(true);
    try {
      const share = (nav as any).share;
      if (typeof share === "function") {
        await share.call(nav, { title: name, url });
        return;
      }

      const clipboard = (nav as any).clipboard;
      if (clipboard && typeof clipboard.writeText === "function") {
        await clipboard.writeText(url);
        alert("Link profilu skopírovaný.");
        return;
      }

      const textarea = document.createElement("textarea");
      textarea.value = url;
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
      alert("Link profilu skopírovaný.");
    } catch (err: any) {
      if (err?.name !== "AbortError") console.error("Share failed:", err);
    } finally {
      setShareBusy(false);
    }
  }, [shareBusy, trainer]);

  if (loading) return (
    <div className="min-h-screen bg-black flex items-center justify-center text-emerald-500">
      Načítavam profil...
    </div>
  );
  if (!trainer) return (
    <div className="min-h-screen bg-black flex items-center justify-center text-white">
      Profil sa nenašiel.
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white">
      <div ref={vantaElRef} className="fixed inset-0 bg-[#0e0e0e]" style={{ zIndex: 0 }} />

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

      <div className="relative z-10 min-h-screen md:px-10 md:py-10">
        <div className="min-h-screen w-full max-w-md md:max-w-xl mx-auto bg-black text-white pb-20 overflow-x-hidden relative md:rounded-2xl md:shadow-2xl md:shadow-black/40">
      {images.length > 0 ? (
        <div
          className="relative w-full aspect-[4/3] overflow-hidden group touch-pan-y"
          style={{ touchAction: "pan-y" }}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onTouchCancel={onTouchCancel}
        >
          <Image src="/simplelogo.png" alt="" width={60} height={60} className="absolute left-4 top-4 z-40" />
          <button
            type="button"
            onClick={handleShare}
            disabled={shareBusy}
            className="absolute right-4 top-4 z-40 w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center disabled:opacity-60"
            aria-label="Zdieľať profil"
          >
            <Image src="/share%20icon.png" alt="" width={18} height={18} />
          </button>
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
        <div className="relative w-full aspect-[4/3] bg-zinc-900 flex items-center justify-center text-zinc-700 italic">
          <Image src="/simplelogo.png" alt="" width={60} height={60} className="absolute left-4 top-4 z-40" />
          <button
            type="button"
            onClick={handleShare}
            disabled={shareBusy}
            className="absolute right-4 top-4 z-40 w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center disabled:opacity-60"
            aria-label="Zdieľať profil"
          >
            <Image src="/share%20icon.png" alt="" width={18} height={18} />
          </button>
          Žiadne profilové fotky
        </div>
      )}
      <div className="px-6 mt-6 relative z-10">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">{trainer.profiles?.full_name || "Bez mena"}</h1>
          {trainer.bio && <p className="text-zinc-300 text-sm leading-relaxed mt-2">{trainer.bio}</p>}
          {trainer.headline && <p className="text-zinc-400 text-xs italic">{trainer.headline}</p>}
          
          <div className="mt-3 inline-flex items-center bg-emerald-500 text-black text-[10px] font-bold px-3 py-1 rounded-full uppercase">
            {trainer.city || "Slovensko"}
          </div>
          
          {reviews.length > 0 && (
            <div className="flex items-center gap-2 mt-2">
              <div className="flex text-yellow-400">
                {[...Array(5)].map((_, i) => (
                  <svg
                    key={i}
                    className={`w-4 h-4 ${i < Math.round(avgRating) ? "fill-current" : "fill-transparent"} stroke-current`}
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <span className="text-zinc-400 text-xs italic font-medium">{avgRounded} • {reviews.length} recenzií</span>
            </div>
          )}
        </div>
        <div className="mt-8 space-y-3">
          {services.personal_training && (
            <button
              onClick={() => setIsPersonalTrainingModalOpen(true)}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-4 px-6 rounded-[20px] text-lg transition-colors shadow-lg shadow-emerald-500/10 uppercase tracking-wide"
            >
              Rezervovať osobný tréning
            </button>
          )}
          {services.online_consultation && (
            <button
              onClick={() => setIsOnlineConsultationModalModalOpen(true)}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-4 px-6 rounded-[20px] text-lg transition-colors shadow-lg shadow-emerald-500/10 uppercase tracking-wide"
            >
              Rezervovať online konzultáciu
            </button>
          )}
          {services.meal_plan && (
            <button
              onClick={() => setIsMealPlanModalOpen(true)}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-4 px-6 rounded-[20px] text-lg transition-colors shadow-lg shadow-emerald-500/10 uppercase tracking-wide"
            >
              Objednať jedálniček
            </button>
          )}
          {services.brands && trainer.brands && trainer.brands.length > 0 && (
            <button
              onClick={() => setIsBrandsModalOpen(true)}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-4 px-6 rounded-[20px] text-lg transition-colors shadow-lg shadow-emerald-500/10 uppercase tracking-wide"
            >
              Moje odporúčané značky
            </button>
          )}
        </div>
        {reviews.length > 0 && (
          <div className="mt-12">
            <h2 className="text-3xl font-bold text-center mb-6 font-display uppercase tracking-wider">Recenzie</h2>
            <div className="relative group">
              <div className="border border-emerald-500/50 rounded-[25px] p-6 bg-zinc-900/30 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-4">
                  <span className="font-bold text-lg">{reviews[0]?.client_name || "Klient"}</span>
                  <div className="flex text-yellow-400">
                    {[...Array(5)].map((_, i) => (
                      <svg
                        key={i}
                        className={`w-3 h-3 ${(reviews[0]?.rating || 0) > i ? "fill-current" : "fill-transparent"} stroke-current`}
                        viewBox="0 0 20 20"
                      >
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                </div>
                <p className="text-zinc-300 italic text-sm leading-relaxed">&quot;{reviews[0]?.comment || ""}&quot;</p>
                {reviews[0]?.photo_url && (
                  <div className="mt-4">
                    <img src={reviews[0].photo_url} alt="" className="w-full rounded-2xl border border-white/10" />
                  </div>
                )}
              </div>
              <button className="w-full text-center text-[10px] text-zinc-500 mt-4 hover:text-zinc-300 transition-colors uppercase tracking-widest font-bold">
                + Všetky recenzie
              </button>
            </div>
          </div>
        )}

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
    </div>
  </div>

      <Modal
        isOpen={isPersonalTrainingModalOpen}
        onClose={() => {
          setIsPersonalTrainingModalOpen(false);
          setSelectedSlot(null);
          setPendingFormValues(null);
        }}
        title="Rezervovať osobný tréning"
      >
        {!selectedSlot ? (
          <div className="text-gray-800">
            <AvailableSlots 
              trainerId={trainer.id} 
              onSlotSelect={(slot) => setSelectedSlot(slot)}
              selectedSlot={selectedSlot}
            />
          </div>
        ) : (
          <BookingForm 
            selectedSlot={selectedSlot}
            trainerName={trainer.profiles?.full_name || "Tréner"}
            trainerEmail={trainer.profiles?.email || undefined}
            initialValues={pendingFormValues || undefined}
            onSuccess={() => {
              setIsPersonalTrainingModalOpen(false);
              setSelectedSlot(null);
              setPendingFormValues(null);
            }}
            onCancel={() => {
              setSelectedSlot(null);
              setPendingFormValues(null);
            }}
          />
        )}
      </Modal>

      <Modal
        isOpen={isOnlineConsultationModalOpen}
        onClose={() => setIsOnlineConsultationModalModalOpen(false)}
        title="Rezervovať online konzultáciu"
      >
        <p>Tu bude obsah pre online konzultáciu.</p>
      </Modal>

      <Modal
        isOpen={isMealPlanModalOpen}
        onClose={() => setIsMealPlanModalOpen(false)}
        title="Objednať jedálniček"
      >
        {trainer ? <MealPlanRequestForm trainerId={trainer.id} /> : null}
      </Modal>

      <Modal
        isOpen={isBrandsModalOpen}
        onClose={() => setIsBrandsModalOpen(false)}
        title="Moje odporúčané značky"
      >
        {trainer.brands && trainer.brands.length > 0 ? (
          <div className="space-y-4">
            {trainer.brands.map((brand: any, index: number) => (
              <div key={index} className="flex items-center gap-4 p-3 border border-zinc-700 rounded-lg bg-zinc-800/50">
                {brand.logo && (
                  <Image src={brand.logo} alt={brand.name || "Brand logo"} width={64} height={64} className="rounded-md object-contain" />
                )}
                <div className="flex-grow">
                  {brand.name && <h3 className="text-lg font-semibold">{brand.name}</h3>}
                  {brand.code && (
                    <div className="mt-1 text-sm text-zinc-300">
                      Kód: <span className="font-mono bg-emerald-900/50 text-emerald-300 px-2 py-0.5 rounded text-xs">{brand.code}</span>
                    </div>
                  )}
                  {brand.description && <p className="text-zinc-400 text-xs mt-1">{brand.description}</p>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-zinc-400 italic">Pre tohto trénera nie sú zatiaľ dostupné žiadne odporúčané značky.</p>
        )}
      </Modal>
    </div>
  );
}
