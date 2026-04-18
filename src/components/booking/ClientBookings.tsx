"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { supabaseUrl, supabaseAnonKey } from "@/lib/config";
import { BookingStatus } from "@/lib/types";
import { Modal } from "@/components/Modal";
import { createTrainerMealPlanReviewAction, createTrainerReviewAction } from "@/lib/booking/actions";
import { useRouter } from "next/navigation";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface ClientBookingsProps {
  userId: string;
  userEmail: string;
  kind?: "booking" | "meal_plan";
}

type ClientBookingItem = {
  kind: "booking";
  id: string;
  startsAt: string;
  endsAt: string;
  status: BookingStatus;
  serviceType: "personal" | "online" | "transformation" | null;
  trainerId: string;
  trainerName: string;
  trainerEmail: string | null;
  trainerPhone: string | null;
  trainerSlug: string | null;
  cancelledReason: string | null;
};

type ClientMealPlanItem = {
  kind: "meal_plan";
  id: string;
  createdAt: string;
  status: string;
  trainerId: string;
  trainerName: string;
  trainerEmail: string | null;
  trainerPhone: string | null;
  trainerSlug: string | null;
};

type ClientServiceItem = ClientBookingItem | ClientMealPlanItem;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getNested(obj: Record<string, unknown>, key: string): unknown {
  return obj[key];
}

type BookingRow = {
  id: string;
  trainer_id: string;
  starts_at: string;
  ends_at: string;
  booking_status: string;
  service_type: string | null;
  cancelled_reason: string | null;
};

type MealPlanRow = {
  id: string;
  trainer_id: string;
  created_at: string;
  status: string;
};

const bookingStatuses: readonly BookingStatus[] = ["pending", "pending_payment", "confirmed", "completed", "cancelled"];

function isBookingStatus(value: unknown): value is BookingStatus {
  return typeof value === "string" && (bookingStatuses as readonly string[]).includes(value);
}

function normalizeBookingStatus(status: BookingStatus): BookingStatus {
  return status === "pending" ? "pending_payment" : status;
}

function getBookingStatusLabel(status: BookingStatus): string {
  if (status === "pending_payment") return "Čaká na platbu";
  if (status === "confirmed") return "Potvrdené";
  if (status === "completed") return "Dokončené";
  if (status === "cancelled") return "Zrušené";
  return status;
}

function toBookingRow(value: unknown): BookingRow | null {
  if (!isRecord(value)) return null;
  const id = value.id;
  const trainerId = value.trainer_id;
  const startsAt = value.starts_at;
  const endsAt = value.ends_at;
  const status = value.booking_status;
  const serviceType = value.service_type;
  const cancelledReason = value.cancelled_reason;
  if (
    typeof id !== "string" ||
    typeof trainerId !== "string" ||
    typeof startsAt !== "string" ||
    typeof endsAt !== "string" ||
    typeof status !== "string" ||
    !(typeof serviceType === "string" || serviceType === null) ||
    !(typeof cancelledReason === "string" || cancelledReason === null)
  ) {
    return null;
  }
  return { id, trainer_id: trainerId, starts_at: startsAt, ends_at: endsAt, booking_status: status, service_type: serviceType, cancelled_reason: cancelledReason };
}

function toMealPlanRow(value: unknown): MealPlanRow | null {
  if (!isRecord(value)) return null;
  const id = value.id;
  const trainerId = value.trainer_id;
  const createdAt = value.created_at;
  const status = value.status;
  if (typeof id !== "string" || typeof trainerId !== "string" || typeof createdAt !== "string" || typeof status !== "string") {
    return null;
  }
  return { id, trainer_id: trainerId, created_at: createdAt, status };
}

type TrainerContact = { name: string; email: string | null; phone: string | null; slug: string | null };

function toTrainerContact(value: unknown): { trainerId: string; contact: TrainerContact } | null {
  if (!isRecord(value)) return null;
  const trainerId = value.id;
  if (typeof trainerId !== "string") return null;

  const slug = typeof value.slug === "string" ? value.slug : null;
  const profiles = getNested(value, "profiles");
  const fullName = isRecord(profiles) && typeof profiles.full_name === "string" ? profiles.full_name : null;
  const email = isRecord(profiles) && typeof profiles.email === "string" ? profiles.email : null;
  const phone = isRecord(profiles) && typeof profiles.phone_number === "string" ? profiles.phone_number : null;

  return {
    trainerId,
    contact: { name: fullName && fullName.trim() ? fullName : "Neznámy tréner", email, phone, slug },
  };
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") resolve(result);
      else reject(new Error("Invalid file result"));
    };
    reader.onerror = () => reject(reader.error || new Error("File read failed"));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image load failed"));
    img.src = src;
  });
}

async function resizeImageDataUrl(dataUrl: string, maxSize: number = 1024): Promise<string> {
  const img = await loadImage(dataUrl);
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  if (!w || !h) return dataUrl;

  const scale = Math.min(1, maxSize / Math.max(w, h));
  const targetW = Math.max(1, Math.round(w * scale));
  const targetH = Math.max(1, Math.round(h * scale));

  if (targetW === w && targetH === h) return dataUrl;

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, targetW, targetH);
  return canvas.toDataURL("image/jpeg", 0.85);
}

export default function ClientBookings({ userId, userEmail, kind }: ClientBookingsProps) {
  const router = useRouter();
  const [items, setItems] = useState<ClientServiceItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<
    "personal_training" | "online_consultation" | "meal_plan" | "transformation" | "history"
  >(kind === "meal_plan" ? "meal_plan" : "personal_training");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<
    | { kind: "booking"; bookingId: string; trainerId: string; trainerName: string }
    | { kind: "meal_plan"; mealPlanRequestId: string; trainerId: string; trainerName: string }
    | null
  >(null);
  const [reviewRating, setReviewRating] = useState<number>(0);
  const [reviewHover, setReviewHover] = useState<number>(0);
  const [reviewText, setReviewText] = useState<string>("");
  const [reviewPhotoUrl, setReviewPhotoUrl] = useState<string | null>(null);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  useEffect(() => {
    if (loading || items.length === 0) return;
    
    try {
      const url = new URL(window.location.href);
      const openReviewId = url.searchParams.get("reviewBookingId") || url.searchParams.get("openReview");
      if (openReviewId) {
        const item = items.find(x => x.id === openReviewId);
        if (item && item.status === "completed") {
          setActiveCategory("history");
          
          if (item.kind === "meal_plan") {
            setReviewTarget({
              kind: "meal_plan",
              mealPlanRequestId: item.id,
              trainerId: item.trainerId,
              trainerName: item.trainerName
            });
          } else {
            setReviewTarget({
              kind: "booking",
              bookingId: item.id,
              trainerId: item.trainerId,
              trainerName: item.trainerName
            });
          }
          
          setReviewRating(0);
          setReviewHover(0);
          setReviewText("");
          setReviewPhotoUrl(null);
          setReviewError(null);
          setReviewOpen(true);
          
          // Vyčistíme URL paramy aby sa modal neotváral opakovane
          const newUrl = new URL(window.location.href);
          newUrl.searchParams.delete("reviewBookingId");
          newUrl.searchParams.delete("openReview");
          window.history.replaceState({}, "", newUrl.toString());
        }
      }
    } catch (err) {
      console.error("[ClientBookings] Error auto-opening review:", err);
    }
  }, [loading, items]);

  useEffect(() => {
    async function fetchBookings() {
      setLoading(true);
      try {
        console.log("[ClientBookings] userId:", userId, "userEmail:", userEmail);

        const sessionRes = await supabase.auth.getSession();
        const accessToken = sessionRes.data.session?.access_token;
        console.log("[ClientBookings] has session:", Boolean(sessionRes.data.session), "has accessToken:", Boolean(accessToken));

        if (!accessToken) {
          setItems([]);
          setError("Pre zobrazenie rezervácií sa musíte prihlásiť.");
          return;
        }

        const apiRes = await fetch("/api/user/bookings", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        const apiPayload: unknown = await apiRes.json().catch(() => null);
        console.log("[ClientBookings] /api/user/bookings status:", apiRes.status, "payload:", apiPayload);

        if (!apiRes.ok) {
          const message =
            isRecord(apiPayload) && typeof apiPayload.message === "string"
              ? apiPayload.message
              : "Nepodarilo sa načítať vaše služby.";
          console.warn("[ClientBookings] API failed, falling back to direct Supabase query:", message);
          setError(null);
        } else {
          const mappedFromApi = Array.isArray(apiPayload)
            ? apiPayload
                .map((x): ClientServiceItem | null => {
                  if (!isRecord(x)) return null;
                  const kind = x.kind;
                  if (kind === "booking") {
                    if (typeof x.id !== "string") return null;
                    if (typeof x.trainerId !== "string") return null;
                    if (typeof x.startsAt !== "string") return null;
                    if (typeof x.endsAt !== "string") return null;
                    if (!isBookingStatus(x.status)) return null;
                    const serviceTypeRaw = x.serviceType;
                    const serviceType =
                      serviceTypeRaw === "personal" ||
                      serviceTypeRaw === "online" ||
                      serviceTypeRaw === "transformation"
                        ? (serviceTypeRaw as "personal" | "online" | "transformation")
                        : "personal";
                    if (typeof x.trainerName !== "string") return null;
                    if (!(typeof x.trainerEmail === "string" || x.trainerEmail === null)) return null;
                    if (!(typeof (x as Record<string, unknown>).trainerPhone === "string" || (x as Record<string, unknown>).trainerPhone === null || typeof (x as Record<string, unknown>).trainerPhone === "undefined")) return null;
                    const trainerPhoneRaw = (x as Record<string, unknown>).trainerPhone;
                    const trainerPhone = typeof trainerPhoneRaw === "string" ? trainerPhoneRaw : null;
                    const normalizedStatus = normalizeBookingStatus(x.status);
                    return {
                      kind: "booking",
                      id: x.id,
                      trainerId: x.trainerId,
                      startsAt: x.startsAt,
                      endsAt: x.endsAt,
                      status: normalizedStatus,
                      serviceType,
                      trainerName: x.trainerName,
                      trainerEmail: x.trainerEmail,
                      trainerPhone,
                      trainerSlug: null,
                      cancelledReason: (x as any).cancelledReason || null,
                    };
                  }
                  if (kind === "meal_plan") {
                    if (typeof x.id !== "string") return null;
                    if (typeof x.trainerId !== "string") return null;
                    if (typeof x.createdAt !== "string") return null;
                    if (typeof x.status !== "string") return null;
                    if (typeof x.trainerName !== "string") return null;
                    if (!(typeof x.trainerEmail === "string" || x.trainerEmail === null)) return null;
                    if (!(typeof (x as Record<string, unknown>).trainerPhone === "string" || (x as Record<string, unknown>).trainerPhone === null || typeof (x as Record<string, unknown>).trainerPhone === "undefined")) return null;
                    const trainerPhoneRaw = (x as Record<string, unknown>).trainerPhone;
                    const trainerPhone = typeof trainerPhoneRaw === "string" ? trainerPhoneRaw : null;
                    return {
                      kind: "meal_plan",
                      id: x.id,
                      trainerId: x.trainerId,
                      createdAt: x.createdAt,
                      status: x.status,
                      trainerName: x.trainerName,
                      trainerEmail: x.trainerEmail,
                      trainerPhone,
                      trainerSlug: null,
                    };
                  }
                  return null;
                })
                .filter((x): x is ClientServiceItem => x !== null)
            : [];

          const trainerIds = Array.from(new Set(mappedFromApi.map((b) => b.trainerId))).filter((id) => id);
          const slugsByTrainerId = new Map<string, string>();
          if (trainerIds.length > 0) {
            const trainerRes = await supabase.from("trainers").select("id, slug").in("id", trainerIds);
          
          console.log("[FETCH AUDIT] ClientBookings = fetchBookings (slugs lookup)");
          console.log("[FETCH AUDIT] table = trainers");
          console.log("[FETCH AUDIT] old select = id, slug");
          console.log("[FETCH AUDIT] new select = id, slug");
          console.log("[FETCH AUDIT] limit added = false");
            const trainerPayload: unknown = trainerRes.data;
            if (!trainerRes.error && Array.isArray(trainerPayload)) {
              for (const item of trainerPayload as unknown[]) {
                if (!isRecord(item)) continue;
                const id = item.id;
                const slug = item.slug;
                if (typeof id === "string" && typeof slug === "string" && slug.trim()) {
                  slugsByTrainerId.set(id, slug);
                }
              }
            }
          }

          setItems(
            mappedFromApi.map((b) => ({
              ...b,
              trainerSlug: slugsByTrainerId.get(b.trainerId) || null,
            }))
          );
          setError(null);
          return;
        }

        const query = supabase
          .from("bookings")
          .select("id, trainer_id, starts_at, ends_at, booking_status, service_type, client_profile_id, client_email, cancelled_reason")
          .order("starts_at", { ascending: false });

        const trimmedEmail = userEmail.trim().toLowerCase();
        const escapedEmail = trimmedEmail.replace(/"/g, '\\"');

        const { data, error } = trimmedEmail
          ? await query.or(`client_profile_id.eq.${userId},client_email.eq."${escapedEmail}"`)
          : await query.eq("client_profile_id", userId);

        if (error) throw error;
        const payload: unknown = data;
        const rowsMaybe = Array.isArray(payload) ? (payload as unknown[]).map(toBookingRow) : [];
        const rows = rowsMaybe.filter((x): x is BookingRow => x !== null);

        const trainerIds = Array.from(new Set(rows.map((r: BookingRow) => r.trainer_id))).filter((id) => id);

        const contactsByTrainerId = new Map<string, TrainerContact>();
        if (trainerIds.length > 0) {
          const trainerRes = await supabase
            .from("trainers")
            .select("id, slug, profiles(full_name,email,phone_number)")
            .in("id", trainerIds);

          console.log("[FETCH AUDIT] ClientBookings = fetchBookings (contacts lookup)");
          console.log("[FETCH AUDIT] table = trainers");
          console.log("[FETCH AUDIT] old select = id, slug, profiles(full_name,email,phone_number)");
          console.log("[FETCH AUDIT] new select = id, slug, profiles(full_name,email,phone_number)");
          console.log("[FETCH AUDIT] limit added = false");

          const trainerPayload: unknown = trainerRes.data;
          if (!trainerRes.error && Array.isArray(trainerPayload)) {
            for (const item of trainerPayload as unknown[]) {
              const parsed = toTrainerContact(item);
              if (parsed !== null) contactsByTrainerId.set(parsed.trainerId, parsed.contact);
            }
          }
        }

        const mappedFromDb: ClientBookingItem[] = rows.map((r: BookingRow) => {
          const contact = contactsByTrainerId.get(r.trainer_id);
          const serviceType =
            r.service_type === "personal" ||
            r.service_type === "online" ||
            r.service_type === "transformation"
              ? (r.service_type as "personal" | "online" | "transformation")
              : "personal";
          const normalized = isBookingStatus(r.booking_status) ? normalizeBookingStatus(r.booking_status) : "pending_payment";
          return {
            kind: "booking",
            id: r.id,
            trainerId: r.trainer_id,
            startsAt: r.starts_at,
            endsAt: r.ends_at,
            status: normalized,
            serviceType,
            trainerName: contact?.name || "Neznámy tréner",
            trainerEmail: contact?.email || null,
            trainerPhone: contact?.phone || null,
            trainerSlug: contact?.slug || null,
            cancelledReason: r.cancelled_reason || null,
          };
        });

        setItems(mappedFromDb);
      } catch (err: unknown) {
        console.error("[ClientBookings] error:", err);
        setError(err instanceof Error ? err.message : "Nepodarilo sa načítať vaše služby.");
      } finally {
        setLoading(false);
      }
    }

    if (userId) {
      fetchBookings();
    }
  }, [userId, userEmail]);

  if (loading) return <div className="text-zinc-500 animate-pulse">Načítavam služby...</div>;
  if (error) return <div className="text-red-400 text-sm">Chyba: {error}</div>;

  const categorized = items.map((item) => {
    if (item.kind === "meal_plan") {
      return { ...item, category: "meal_plan" as const, isHistory: item.status === "completed" || item.status === "cancelled" };
    }
    const category =
      item.serviceType === "online"
        ? "online_consultation"
        : item.serviceType === "transformation"
        ? "transformation"
        : "personal_training";
    const normalizedStatus = normalizeBookingStatus(item.status);
    const isHistory = normalizedStatus === "completed" || normalizedStatus === "cancelled";
    return { ...item, status: normalizedStatus, category, isHistory } as const;
  });

  const filteredItems =
    activeCategory === "history"
      ? categorized.filter((x) => x.isHistory)
      : categorized.filter((x) => x.category === activeCategory && !x.isHistory);

  const sortedItems = filteredItems.slice().sort((a, b) => {
    const aTs =
      a.kind === "booking" ? new Date(a.startsAt).getTime() : new Date(a.createdAt).getTime();
    const bTs =
      b.kind === "booking" ? new Date(b.startsAt).getTime() : new Date(b.createdAt).getTime();
    return activeCategory === "history" ? bTs - aTs : aTs - bTs;
  });

  return (
    <div className="space-y-4">
      <div className="w-full overflow-x-auto custom-scrollbar-hidden">
        <div className="inline-flex rounded-full bg-zinc-950/60 border border-zinc-800 p-1 min-w-max">
          <button
            type="button"
            onClick={() => setActiveCategory("personal_training")}
            className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-colors whitespace-nowrap ${
              activeCategory === "personal_training" ? "bg-emerald-500 text-black" : "text-zinc-300 hover:text-white"
            }`}
          >
            Osobný tréning
          </button>
          <button
            type="button"
            onClick={() => setActiveCategory("online_consultation")}
            className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-colors whitespace-nowrap ${
              activeCategory === "online_consultation" ? "bg-emerald-500 text-black" : "text-zinc-300 hover:text-white"
            }`}
          >
            Online konzultácia
          </button>
          <button
            type="button"
            onClick={() => setActiveCategory("meal_plan")}
            className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-colors whitespace-nowrap ${
              activeCategory === "meal_plan" ? "bg-emerald-500 text-black" : "text-zinc-300 hover:text-white"
            }`}
          >
            Objednávka jedálničku
          </button>
          <button
            type="button"
            onClick={() => setActiveCategory("transformation")}
            className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-colors whitespace-nowrap ${
              activeCategory === "transformation" ? "bg-emerald-500 text-black" : "text-zinc-300 hover:text-white"
            }`}
          >
            Premena
          </button>
          <button
            type="button"
            onClick={() => setActiveCategory("history")}
            className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-colors whitespace-nowrap ${
              activeCategory === "history" ? "bg-emerald-500 text-black" : "text-zinc-300 hover:text-white"
            }`}
          >
            História
          </button>
        </div>
      </div>

      {items.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {sortedItems.map((item) => (
            <div key={`${item.kind}-${item.id}`} className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/40 backdrop-blur-sm group hover:border-emerald-500/30 transition-all">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-1">Tréner</p>
                  <Link
                    href={item.trainerSlug ? `/${item.trainerSlug}` : `/t/${item.trainerId}`}
                    className="text-lg font-bold text-white group-hover:text-emerald-400 transition-colors"
                  >
                    {item.trainerName}
                  </Link>
                </div>
                {(() => {
                  const label =
                    item.kind === "booking"
                      ? getBookingStatusLabel(item.status)
                      : item.status;
                  const cls =
                    item.kind === "booking"
                      ? item.status === "confirmed"
                        ? "bg-emerald-500/20 text-emerald-500"
                        : item.status === "pending_payment"
                          ? "bg-yellow-500/20 text-yellow-500"
                          : item.status === "completed"
                            ? "bg-sky-500/20 text-sky-400"
                            : item.status === "cancelled"
                              ? "bg-red-500/20 text-red-400"
                              : "bg-zinc-800 text-zinc-500"
                      : item.status === "completed"
                        ? "bg-sky-500/20 text-sky-400"
                        : item.status === "cancelled"
                          ? "bg-red-500/20 text-red-400"
                          : "bg-zinc-800 text-zinc-500";
                  return (
                    <div className="flex flex-col items-end gap-1">
                      <span className={`px-2 py-1 rounded-full text-[9px] font-bold uppercase ${cls}`}>
                        {item.kind === "booking" && item.status === "cancelled" ? "Zrušené trénerom" : label}
                      </span>
                      {item.kind === "booking" && item.status === "cancelled" && item.cancelledReason && (
                        <div className="text-[10px] text-zinc-500 italic text-right max-w-[150px] leading-tight">
                          Dôvod: {item.cancelledReason}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
              
              <div className="space-y-3 pt-4 border-t border-zinc-800/50">
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-emerald-500">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    {item.kind === "booking" ? (
                      <>
                        <p className="font-bold text-zinc-200">
                          {item.serviceType === "transformation" ? "Program na 30 dní" : new Date(item.startsAt).toLocaleDateString("sk-SK")}
                        </p>
                        {item.serviceType !== "transformation" && (
                          <p className="text-xs text-zinc-500">
                            {new Date(item.startsAt).toLocaleTimeString("sk-SK", { hour: "2-digit", minute: "2-digit" })} - {new Date(item.endsAt).toLocaleTimeString("sk-SK", { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        )}
                        <p className="text-xs text-zinc-500">
                          {item.serviceType === "online" 
                            ? "Online konzultácia" 
                            : item.serviceType === "transformation"
                            ? "Mesačná premena"
                            : "Osobný tréning"}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="font-bold text-zinc-200">{new Date(item.createdAt).toLocaleDateString("sk-SK")}</p>
                        <p className="text-xs text-zinc-500">Objednávka jedálničku</p>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 text-sm">
                  <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-emerald-500">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-zinc-400 truncate">{item.trainerEmail || "Bez kontaktu"}</p>
                  </div>
                </div>

                {item.trainerPhone ? (
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-emerald-500">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.492a1 1 0 01-.502 1.21l-1.96.98a11.037 11.037 0 005.516 5.516l.98-1.96a1 1 0 011.21-.502l4.492 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                        />
                      </svg>
                    </div>
                    <p className="text-zinc-400">{item.trainerPhone}</p>
                  </div>
                ) : null}

                {item.kind === "booking" && item.status === "completed" && (
                  <div className="pt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setReviewTarget({ kind: "booking", bookingId: item.id, trainerId: item.trainerId, trainerName: item.trainerName });
                        setReviewRating(0);
                        setReviewHover(0);
                        setReviewText("");
                        setReviewPhotoUrl(null);
                        setReviewError(null);
                        setReviewOpen(true);
                      }}
                      className="px-4 py-2 rounded-full border border-emerald-500/60 text-emerald-300 hover:border-emerald-400 hover:text-emerald-200 transition-colors text-xs font-bold uppercase tracking-wider"
                    >
                      Napísať recenziu
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const target = item.trainerSlug
                          ? `/${item.trainerSlug}?openBooking=1`
                          : `/t/${item.trainerId}?openBooking=1`;
                        router.push(target);
                      }}
                      className="px-4 py-2 rounded-full bg-emerald-500 text-black hover:bg-emerald-400 transition-colors text-xs font-bold uppercase tracking-wider cursor-pointer"
                    >
                      Ďalší tréning
                    </button>
                  </div>
                )}

                {item.kind === "meal_plan" && item.status === "completed" && (
                  <div className="pt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setReviewTarget({
                          kind: "meal_plan",
                          mealPlanRequestId: item.id,
                          trainerId: item.trainerId,
                          trainerName: item.trainerName,
                        });
                        setReviewRating(0);
                        setReviewHover(0);
                        setReviewText("");
                        setReviewPhotoUrl(null);
                        setReviewError(null);
                        setReviewOpen(true);
                      }}
                      className="px-4 py-2 rounded-full border border-emerald-500/60 text-emerald-300 hover:border-emerald-400 hover:text-emerald-200 transition-colors text-xs font-bold uppercase tracking-wider"
                    >
                      Napísať recenziu
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const target = item.trainerSlug
                          ? `/${item.trainerSlug}?openMealPlan=1`
                          : `/t/${item.trainerId}?openMealPlan=1`;
                        router.push(target);
                      }}
                      className="px-4 py-2 rounded-full bg-emerald-500 text-black hover:bg-emerald-400 transition-colors text-xs font-bold uppercase tracking-wider cursor-pointer"
                    >
                      Ďalší jedálniček
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {items.length > 0 && sortedItems.length === 0 ? (
        <p className="text-zinc-500 italic text-center py-10">V tejto kategórii nemáte žiadne služby.</p>
      ) : items.length === 0 ? (
        <p className="text-zinc-500 italic text-center py-10">Zatiaľ ste si nezarezervovali žiadne služby.</p>
      ) : null}

      <Modal
        isOpen={reviewOpen}
        onClose={() => {
          if (reviewSubmitting) return;
          setReviewOpen(false);
        }}
        title={`Napísať recenziu na "${reviewTarget?.trainerName || "trénera"}"`}
      >
        <div className="space-y-4">
          {reviewError && <div className="text-red-400 text-sm">{reviewError}</div>}

          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5].map((n) => {
              const active = (reviewHover || reviewRating) >= n;
              return (
                <button
                  key={n}
                  type="button"
                  onMouseEnter={() => setReviewHover(n)}
                  onMouseLeave={() => setReviewHover(0)}
                  onClick={() => setReviewRating(n)}
                  disabled={reviewSubmitting}
                  className="p-1 disabled:opacity-50"
                  aria-label={`Hodnotenie ${n} z 5`}
                >
                  <svg
                    viewBox="0 0 20 20"
                    className={`w-7 h-7 ${active ? "fill-yellow-400" : "fill-transparent"} stroke-yellow-400`}
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                </button>
              );
            })}
          </div>

          <textarea
            value={reviewText}
            onChange={(e) => setReviewText(e.target.value)}
            disabled={reviewSubmitting}
            className="w-full bg-transparent border border-zinc-700 rounded-xl px-4 py-3 text-white outline-none focus:ring-1 focus:ring-emerald-500 transition-all min-h-[120px]"
            placeholder="Napíšte recenziu..."
          />

          {/* Dočasne skryté nahranie fotky */}
          {/* 
          <div className="space-y-2">
            <input
              type="file"
              accept="image/*"
              disabled={reviewSubmitting}
              onChange={async (e) => {
                const file = e.target.files?.[0] || null;
                if (!file) return;
                setReviewError(null);
                try {
                  const dataUrl = await fileToDataUrl(file);
                  const resized = await resizeImageDataUrl(dataUrl, 1024);
                  setReviewPhotoUrl(resized);
                } catch (err: unknown) {
                  setReviewError(err instanceof Error ? err.message : "Nepodarilo sa načítať fotku.");
                }
              }}
              className="block w-full text-sm text-zinc-300 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-zinc-800 file:text-zinc-200 hover:file:bg-zinc-700"
            />

            {reviewPhotoUrl && (
              <div className="relative">
                <img src={reviewPhotoUrl} alt="" className="w-full rounded-2xl border border-white/10" />
                <button
                  type="button"
                  onClick={() => setReviewPhotoUrl(null)}
                  disabled={reviewSubmitting}
                  className="absolute top-2 right-2 px-3 py-1 rounded-full bg-black/60 text-white text-xs hover:bg-black/80 disabled:opacity-50"
                >
                  Odstrániť
                </button>
              </div>
            )}
          </div>
          */}

          <button
            type="button"
            disabled={reviewSubmitting || !reviewTarget || reviewRating === 0 || reviewText.trim().length === 0}
            onClick={async () => {
              if (!reviewTarget) return;
              setReviewError(null);
              setReviewSubmitting(true);
              try {
                const sessionRes = await supabase.auth.getSession();
                const accessToken = sessionRes.data.session?.access_token;
                if (!accessToken) throw new Error("Pre odoslanie recenzie sa musíte prihlásiť.");

                const res =
                  reviewTarget.kind === "booking"
                    ? await createTrainerReviewAction({
                        booking_id: reviewTarget.bookingId,
                        trainer_id: reviewTarget.trainerId,
                        rating: reviewRating,
                        comment: reviewText,
                        photo_url: reviewPhotoUrl,
                        access_token: accessToken,
                      })
                    : await createTrainerMealPlanReviewAction({
                        meal_plan_request_id: reviewTarget.mealPlanRequestId,
                        trainer_id: reviewTarget.trainerId,
                        rating: reviewRating,
                        comment: reviewText,
                        photo_url: reviewPhotoUrl,
                        access_token: accessToken,
                      });

                if (res.status !== "success") throw new Error(res.message);
                setReviewOpen(false);
              } catch (err: unknown) {
                setReviewError(err instanceof Error ? err.message : "Nepodarilo sa odoslať recenziu.");
              } finally {
                setReviewSubmitting(false);
              }
            }}
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-3 px-6 rounded-[16px] transition-colors uppercase tracking-wide disabled:opacity-50"
          >
            {reviewSubmitting ? "Odosielam..." : "Odoslať recenziu"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
