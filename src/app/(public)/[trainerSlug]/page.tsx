"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import Script from "next/script";
import { ModalWrapper } from "@/components/ModalWrapper";
import { Footer } from "@/components/Footer";
import AvailableSlots from "@/components/booking/AvailableSlots";
import BookingForm from "@/components/booking/BookingForm";
import { AvailableSlot } from "@/lib/booking/getAvailableSlots";
import MealPlanRequestForm from "@/components/meal-plan/MealPlanRequestForm";

type ServiceKey = "personal_training" | "online_consultation" | "meal_plan" | "brands" | "transformation";
type ServicesVisibility = Record<ServiceKey, boolean>;

type TrainerTransformation = {
  is_enabled: boolean;
  headline: string;
  subheadline: string;
  personal_sessions_count: number;
  online_calls_count: number;
  includes_meal_plan: boolean;
  price_month_cents: number;
  regular_price_cents: number;
};

type TrainerProfile = {
  id: string;
  slug: string;
  bio: string | null;
  headline: string | null;
  city: string | null;
  images: string[] | null;
  brands: {
    name?: string;
    logo?: string;
    code?: string;
    description?: string;
    url?: string;
  }[] | null;
  services: unknown;
  reviews?: unknown;
  client_results?: unknown;
  transformation?: TrainerTransformation | null;
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

type ClientResult = {
  id: string;
  before_image_url: string;
  after_image_url: string;
  client_name: string | null;
  note: string | null;
  created_at: string;
};

function formatName(fullName: string): string {
  if (!fullName) return "";
  const parts = fullName.trim().split(" ");
  if (parts.length === 1) {
    return parts[0];
  }
  const firstName = parts[0];
  const lastNameInitial = parts[1]?.charAt(0).toUpperCase();
  return `${firstName} ${lastNameInitial}.`;
}

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
  const vantaEffectRef = useRef<{ destroy: () => void } | null>(null);
  const [threeReady, setThreeReady] = useState(false);
  const [p5Ready, setP5Ready] = useState(false);
  const [vantaReady, setVantaReady] = useState(false);

  // States for popups
  const [isPersonalTrainingModalOpen, setIsPersonalTrainingModalOpen] = useState(false);
  const [isReviewsModalOpen, setIsReviewsModalOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);
  const [pendingFormValues, setPendingFormValues] = useState<{ client_name: string; client_email: string; client_phone: string; note: string } | null>(null);
  const [isOnlineConsultationModalOpen, setIsOnlineConsultationModalModalOpen] = useState(false);
  const [isMealPlanModalOpen, setIsMealPlanModalOpen] = useState(false);
  const [isTransformationModalOpen, setIsTransformationModalOpen] = useState(false);
  const [isBrandsModalOpen, setIsBrandsModalOpen] = useState(false);
  const [isAllResultsModalOpen, setIsAllResultsModalOpen] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

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
        const serviceType = url.searchParams.get("serviceType");
        if (serviceType === "online") {
          setIsOnlineConsultationModalModalOpen(true);
        } else {
          setIsPersonalTrainingModalOpen(true);
        }
      }
    } catch {}
  }, [trainer]);

  useEffect(() => {
    if (!trainer) return;
    if (typeof window === "undefined") return;
    try {
      const url = new URL(window.location.href);
      const shouldOpen = url.searchParams.get("openMealPlan");
      if (shouldOpen) {
        setIsMealPlanModalOpen(true);
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

  const clientResults: ClientResult[] = Array.isArray(trainer?.client_results)
    ? (trainer?.client_results as unknown[]).flatMap((item): ClientResult[] => {
        if (!item || typeof item !== "object") return [];
        const anyItem = item as Record<string, unknown>;
        const id = anyItem.id;
        const before = anyItem.before_image_url;
        const after = anyItem.after_image_url;
        const clientName = anyItem.client_name;
        const note = anyItem.note;
        const createdAt = anyItem.created_at;

        if (typeof id !== "string") return [];
        if (typeof before !== "string") return [];
        if (typeof after !== "string") return [];
        if (typeof createdAt !== "string") return [];

        return [
          {
            id,
            before_image_url: before,
            after_image_url: after,
            client_name: typeof clientName === "string" ? clientName : null,
            note: typeof note === "string" ? note : null,
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
    brands: true,
    transformation: false
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
    brands: coerceBoolean(servicesMerged.brands) ?? defaultServices.brands,
    transformation: coerceBoolean(servicesMerged.transformation) ?? defaultServices.transformation
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

    const nav = window.navigator as Navigator & { share?: (data: { title: string; url: string }) => Promise<void> };
    const name = trainer.profiles?.full_name?.trim() || "Fitbase tréner";
    const url = `${window.location.origin}/t/${trainer.id}`;

    setShareBusy(true);
    try {
      if (typeof nav.share === "function") {
        await nav.share({ title: name, url });
        return;
      }

      if (nav.clipboard && typeof nav.clipboard.writeText === "function") {
        await nav.clipboard.writeText(url);
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
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== "AbortError") console.error("Share failed:", err);
    } finally {
      setShareBusy(false);
    }
  }, [shareBusy, trainer]);

  if (loading) return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-6 animate-pulse">
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
        <div className="min-h-screen w-full max-w-md md:max-w-xl mx-auto bg-black text-white pb-0 overflow-x-hidden relative md:rounded-2xl md:shadow-2xl md:shadow-black/40">
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
              className="w-full bg-emerald-500 text-black font-bold py-4 md:py-5 px-4 md:px-6 rounded-[22px] text-[12px] sm:text-[13px] md:text-lg uppercase tracking-normal md:tracking-wide whitespace-nowrap leading-none border border-emerald-400/20 shadow-[0_18px_40px_-22px_rgba(16,185,129,0.75)] transition-all duration-200 hover:bg-emerald-400 hover:-translate-y-0.5 active:translate-y-0 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:ring-offset-2 focus:ring-offset-black"
            >
              Rezervovať osobný tréning
            </button>
          )}
          {services.online_consultation && (
            <button
              onClick={() => setIsOnlineConsultationModalModalOpen(true)}
              className="w-full bg-emerald-500 text-black font-bold py-4 md:py-5 px-4 md:px-6 rounded-[22px] text-[12px] sm:text-[13px] md:text-lg uppercase tracking-normal md:tracking-wide whitespace-nowrap leading-none border border-emerald-400/20 shadow-[0_18px_40px_-22px_rgba(16,185,129,0.75)] transition-all duration-200 hover:bg-emerald-400 hover:-translate-y-0.5 active:translate-y-0 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:ring-offset-2 focus:ring-offset-black"
            >
              Rezervovať online konzultáciu
            </button>
          )}
          {services.meal_plan && (
            <button
              onClick={() => setIsMealPlanModalOpen(true)}
              className="w-full bg-emerald-500 text-black font-bold py-4 md:py-5 px-4 md:px-6 rounded-[22px] text-[12px] sm:text-[13px] md:text-lg uppercase tracking-normal md:tracking-wide whitespace-nowrap leading-none border border-emerald-400/20 shadow-[0_18px_40px_-22px_rgba(16,185,129,0.75)] transition-all duration-200 hover:bg-emerald-400 hover:-translate-y-0.5 active:translate-y-0 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:ring-offset-2 focus:ring-offset-black"
            >
              Objednať jedálniček
            </button>
          )}
          {services.brands && trainer.brands && trainer.brands.length > 0 && (
            <button
              onClick={() => setIsBrandsModalOpen(true)}
              className="w-full bg-emerald-500 text-black font-bold py-4 md:py-5 px-4 md:px-6 rounded-[22px] text-[12px] sm:text-[13px] md:text-lg uppercase tracking-normal md:tracking-wide whitespace-nowrap leading-none border border-emerald-400/20 shadow-[0_18px_40px_-22px_rgba(16,185,129,0.75)] transition-all duration-200 hover:bg-emerald-400 hover:-translate-y-0.5 active:translate-y-0 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:ring-offset-2 focus:ring-offset-black"
            >
              Moje odporúčané značky
            </button>
          )}
          {services.transformation && (
            <button
              onClick={() => setIsTransformationModalOpen(true)}
              className="w-full group relative overflow-hidden bg-zinc-950 text-white font-bold py-5 md:py-6 px-4 md:px-6 rounded-[22px] text-[13px] sm:text-[14px] md:text-xl uppercase tracking-widest leading-none border-2 border-emerald-500/50 shadow-[0_0_30px_-10px_rgba(16,185,129,0.5)] transition-all duration-300 hover:border-emerald-500 hover:shadow-[0_0_40px_-5px_rgba(16,185,129,0.6)] hover:-translate-y-1 active:translate-y-0 focus:outline-none"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/0 via-emerald-500/10 to-emerald-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 ease-in-out" />
              <span className="relative z-10 flex items-center justify-center gap-3">
                <span className="text-xl md:text-2xl">✨</span>
                Mesačná premena
                <span className="text-xl md:text-2xl">✨</span>
              </span>
            </button>
          )}
        </div>
        {reviews.length > 0 && (
          <div className="mt-12">
            <h2 className="text-3xl font-bold text-center mb-6 font-display uppercase tracking-wider">Recenzie</h2>
            <div className="relative group">
              <div className="border border-emerald-500/50 rounded-[25px] p-6 bg-zinc-900/30 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-4">
                  <span className="font-bold text-lg">{formatName(reviews[0]?.client_name || "Klient")}</span>
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
              <button 
                onClick={() => setIsReviewsModalOpen(true)}
                className="w-full text-center text-[10px] text-zinc-500 mt-4 hover:text-zinc-300 transition-colors uppercase tracking-widest font-bold underline underline-offset-4 decoration-zinc-700 hover:decoration-zinc-400"
              >
                + Všetky recenzie
              </button>
            </div>
          </div>
        )}

        {clientResults.length > 0 && (
          <div className="mt-6">
            <h2 className="text-3xl font-bold text-center mb-6 font-display uppercase tracking-wider">Výsledky klientov</h2>
            <div className="space-y-6">
              {clientResults.slice(0, 2).map((result) => (
                <div key={result.id} className="bg-zinc-900/30 border border-emerald-500/30 rounded-[25px] p-4 backdrop-blur-sm overflow-hidden">
                  <div className="flex gap-2 aspect-[4/3] mb-4">
                    <div 
                      className="relative flex-1 rounded-2xl overflow-hidden border border-zinc-800 cursor-zoom-in"
                      onClick={() => setLightboxImage(result.before_image_url)}
                    >
                      <Image src={result.before_image_url} alt="Pred" fill className="object-cover" />
                      <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded text-[10px] uppercase font-bold text-white tracking-widest">
                        Pred
                      </div>
                    </div>
                    <div 
                      className="relative flex-1 rounded-2xl overflow-hidden border border-emerald-500/30 cursor-zoom-in"
                      onClick={() => setLightboxImage(result.after_image_url)}
                    >
                      <Image src={result.after_image_url} alt="Po" fill className="object-cover" />
                      <div className="absolute bottom-2 right-2 bg-emerald-500/80 backdrop-blur-md px-2 py-0.5 rounded text-[10px] uppercase font-bold text-black tracking-widest">
                        Po
                      </div>
                    </div>
                  </div>
                  {(result.client_name || result.note) && (
                    <div className="px-2">
                      {result.client_name && <div className="text-white font-bold">{formatName(result.client_name)}</div>}
                      {result.note && <div className="text-zinc-400 text-sm italic mt-1 leading-relaxed">&quot;{result.note}&quot;</div>}
                    </div>
                  )}
                </div>
              ))}
            </div>
            {clientResults.length > 0 && (
              <button 
                onClick={() => setIsAllResultsModalOpen(true)}
                className="w-full text-center text-[10px] text-zinc-500 mt-2 hover:text-zinc-300 transition-colors uppercase tracking-widest font-bold underline underline-offset-4 decoration-zinc-700 hover:decoration-zinc-400"
              >
                + Všetky výsledky
              </button>
            )}
          </div>
        )}
      </div>
      <div className="mt-2">
        <Footer />
      </div>
    </div>
  </div>

      <ModalWrapper
        isOpen={isPersonalTrainingModalOpen}
        onClose={() => {
          setIsPersonalTrainingModalOpen(false);
          setSelectedSlot(null);
        }}
        title="Rezervovať osobný tréning"
      >
        {!selectedSlot ? (
          <AvailableSlots 
            trainerId={trainer.id} 
            onSlotSelect={setSelectedSlot} 
            serviceType="personal"
            slotDuration={60}
          />
        ) : (
          <BookingForm 
            selectedSlot={selectedSlot} 
            trainerName={trainer.profiles?.full_name || ""} 
            onSuccess={() => {
              setIsPersonalTrainingModalOpen(false);
              setSelectedSlot(null);
              alert("Rezervácia bola úspešne odoslaná.");
            }}
            onCancel={() => {
              setSelectedSlot(null);
              setPendingFormValues(null);
            }}
          />
        )}
      </ModalWrapper>

      <ModalWrapper
        isOpen={isOnlineConsultationModalOpen}
        onClose={() => {
          setIsOnlineConsultationModalModalOpen(false);
          setSelectedSlot(null);
        }}
        title="Rezervovať online konzultáciu"
      >
        {!selectedSlot ? (
          <AvailableSlots 
            trainerId={trainer.id} 
            onSlotSelect={setSelectedSlot} 
            serviceType="online"
            slotDuration={30}
          />
        ) : (
          <BookingForm 
            selectedSlot={selectedSlot} 
            trainerName={trainer.profiles?.full_name || ""} 
            onSuccess={() => {
              setIsOnlineConsultationModalModalOpen(false);
              setSelectedSlot(null);
              alert("Rezervácia online konzultácie bola úspešne odoslaná.");
            }}
            onCancel={() => setSelectedSlot(null)}
            serviceType="online"
          />
        )}
      </ModalWrapper>

      <ModalWrapper
        isOpen={isMealPlanModalOpen}
        onClose={() => setIsMealPlanModalOpen(false)}
        title="Objednať jedálniček"
      >
        {trainer ? <MealPlanRequestForm trainerId={trainer.id} /> : null}
      </ModalWrapper>

      <ModalWrapper
        isOpen={isTransformationModalOpen}
        onClose={() => {
          setIsTransformationModalOpen(false);
          setSelectedSlot(null);
        }}
        title="Mesačná premena"
      >
        {!selectedSlot ? (
          <div className="flex flex-col items-center text-center">
            <div className="relative w-32 h-32 rounded-full overflow-hidden border-4 border-emerald-500/30 mb-6">
              {images[0] ? (
                <Image src={images[0]} alt={trainer.profiles?.full_name || ""} fill className="object-cover" />
              ) : (
                <div className="w-full h-full bg-zinc-800 flex items-center justify-center text-zinc-500">
                  {trainer.profiles?.full_name?.charAt(0) || "T"}
                </div>
              )}
            </div>

            <h3 className="text-2xl font-bold text-white mb-2">{trainer.profiles?.full_name}</h3>
            <div className="text-emerald-400 font-bold text-lg mb-6 uppercase tracking-widest">Mesačná premena</div>

            <div className="w-full bg-zinc-900/50 border border-emerald-500/20 rounded-[30px] p-6 mb-8 text-left">
              <div className="text-white font-bold text-xl mb-1">{trainer.transformation?.headline}</div>
              {trainer.transformation?.subheadline && (
                <div className="text-zinc-400 text-sm italic mb-6">{trainer.transformation.subheadline}</div>
              )}

              <div className="space-y-4">
                {trainer.transformation?.personal_sessions_count && trainer.transformation.personal_sessions_count > 0 ? (
                  <div className="flex items-center gap-3">
                    <span className="text-xl">💪</span>
                    <span className="text-zinc-200">
                      <span className="font-bold text-white">{trainer.transformation.personal_sessions_count}x</span> Osobný tréning
                    </span>
                  </div>
                ) : null}
                {trainer.transformation?.online_calls_count && trainer.transformation.online_calls_count > 0 ? (
                  <div className="flex items-center gap-3">
                    <span className="text-xl">📱</span>
                    <span className="text-zinc-200">
                      <span className="font-bold text-white">{trainer.transformation.online_calls_count}x</span> Online volanie
                    </span>
                  </div>
                ) : null}
                <div className="flex items-center gap-3">
                  <span className="text-xl">🥗</span>
                  <span className="text-zinc-200">
                    Jedálniček na mieru: <span className="font-bold text-white">{trainer.transformation?.includes_meal_plan ? "ÁNO" : "NIE"}</span>
                  </span>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-white/5 flex items-baseline justify-between gap-4">
                <div>
                  <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-1">Cena na mesiac</div>
                  <div className="text-3xl font-bold text-emerald-400">
                    {trainer.transformation ? (trainer.transformation.price_month_cents / 100).toFixed(2) : "0.00"}€
                  </div>
                </div>
                {trainer.transformation && trainer.transformation.regular_price_cents > 0 && (
                  <div className="text-right">
                    <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-1">Bežná cena</div>
                    <div className="text-lg text-zinc-500 line-through">
                      {(trainer.transformation.regular_price_cents / 100).toFixed(2)}€
                    </div>
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={() => {
                const now = new Date();
                const end = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
                setSelectedSlot({
                  trainer_id: trainer.id,
                  starts_at: now.toISOString(),
                  ends_at: end.toISOString(),
                  source_availability_slot_id: "transformation_placeholder"
                });
              }}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-5 px-8 rounded-[22px] text-lg uppercase tracking-wide transition-all shadow-lg shadow-emerald-500/20"
            >
              CHCEM ÍSŤ DO TOHO
            </button>
          </div>
        ) : (
          <BookingForm 
            selectedSlot={selectedSlot} 
            trainerName={trainer.profiles?.full_name || ""} 
            serviceType="transformation"
            onSuccess={() => {
              setIsTransformationModalOpen(false);
              setSelectedSlot(null);
              alert("Objednávka mesačnej premeny bola úspešne odoslaná.");
            }}
            onCancel={() => setSelectedSlot(null)}
          />
        )}
      </ModalWrapper>

      <ModalWrapper
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
                {brand.url && (
                  <a 
                    href={brand.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="shrink-0 p-2 hover:bg-white/5 rounded-full transition-colors"
                  >
                    <Image src="/urlicon.png" alt="Link" width={20} height={20} className="opacity-70 hover:opacity-100 transition-opacity" />
                  </a>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-zinc-400 italic">Pre tohto trénera nie sú zatiaľ dostupné žiadne odporúčané značky.</p>
        )}
      </ModalWrapper>

      <ModalWrapper
        isOpen={isReviewsModalOpen}
        onClose={() => setIsReviewsModalOpen(false)}
        title="Všetky recenzie"
      >
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
          {reviews.map((r) => (
            <div key={r.id} className="bg-zinc-900/40 border border-emerald-500/20 rounded-[25px] p-5">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <div className="text-white font-bold">{formatName(r.client_name)}</div>
                  <div className="text-zinc-500 text-[10px] uppercase tracking-widest font-bold mt-1">
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
              <div className="text-zinc-200 text-sm italic leading-relaxed">&quot;{r.comment}&quot;</div>
              {r.photo_url && (
                <div className="mt-4">
                  <img src={r.photo_url} alt="" className="w-full rounded-2xl border border-white/10 cursor-zoom-in" onClick={() => setLightboxImage(r.photo_url)} />
                </div>
              )}
            </div>
          ))}
          {reviews.length === 0 && (
            <p className="text-center text-zinc-500 italic py-10">Zatiaľ žiadne recenzie.</p>
          )}
        </div>
      </ModalWrapper>

      <ModalWrapper
        isOpen={isAllResultsModalOpen}
        onClose={() => setIsAllResultsModalOpen(false)}
        title="Všetky výsledky"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
          {clientResults.map((result) => (
            <div key={result.id} className="bg-zinc-900/50 border border-emerald-500/20 rounded-2xl p-3">
              <div className="flex gap-2 aspect-[4/3] mb-3">
                <div 
                  className="relative flex-1 rounded-xl overflow-hidden border border-zinc-800 cursor-zoom-in"
                  onClick={() => setLightboxImage(result.before_image_url)}
                >
                  <Image src={result.before_image_url} alt="Pred" fill className="object-cover" />
                </div>
                <div 
                  className="relative flex-1 rounded-xl overflow-hidden border border-emerald-500/30 cursor-zoom-in"
                  onClick={() => setLightboxImage(result.after_image_url)}
                >
                  <Image src={result.after_image_url} alt="Po" fill className="object-cover" />
                </div>
              </div>
              {result.client_name && <div className="text-white font-bold text-sm">{formatName(result.client_name)}</div>}
              {result.note && <div className="text-zinc-400 text-xs italic mt-1 line-clamp-2">{result.note}</div>}
            </div>
          ))}
        </div>
      </ModalWrapper>

      {lightboxImage && (
        <div 
          className="fixed inset-0 z-[110] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setLightboxImage(null)}
        >
          <button 
            className="absolute top-6 right-6 text-white/70 hover:text-white transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              setLightboxImage(null);
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="relative w-full max-w-4xl max-h-[85vh] aspect-auto flex items-center justify-center">
            <img 
              src={lightboxImage} 
              alt="Zväčšený náhľad" 
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
}
