"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { supabaseUrl, supabaseAnonKey } from "@/lib/config";
import { BookingStatus } from "@/lib/types";
import { Modal } from "@/components/Modal";
import { createTrainerReviewAction } from "@/lib/booking/actions";
import { useRouter } from "next/navigation";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface ClientBookingsProps {
  userId: string;
  userEmail: string;
}

type ClientBookingItem = {
  id: string;
  startsAt: string;
  endsAt: string;
  status: BookingStatus;
  serviceType: "personal" | "online" | null;
  trainerId: string;
  trainerName: string;
  trainerEmail: string | null;
  trainerSlug: string | null;
};

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
};

const bookingStatuses: readonly BookingStatus[] = ["pending", "confirmed", "completed", "cancelled"];

function isBookingStatus(value: unknown): value is BookingStatus {
  return typeof value === "string" && (bookingStatuses as readonly string[]).includes(value);
}

function toBookingRow(value: unknown): BookingRow | null {
  if (!isRecord(value)) return null;
  const id = value.id;
  const trainerId = value.trainer_id;
  const startsAt = value.starts_at;
  const endsAt = value.ends_at;
  const status = value.booking_status;
  const serviceType = value.service_type;
  if (
    typeof id !== "string" ||
    typeof trainerId !== "string" ||
    typeof startsAt !== "string" ||
    typeof endsAt !== "string" ||
    typeof status !== "string" ||
    !(typeof serviceType === "string" || serviceType === null)
  ) {
    return null;
  }
  return { id, trainer_id: trainerId, starts_at: startsAt, ends_at: endsAt, booking_status: status, service_type: serviceType };
}

type TrainerContact = { name: string; email: string | null; slug: string | null };

function toTrainerContact(value: unknown): { trainerId: string; contact: TrainerContact } | null {
  if (!isRecord(value)) return null;
  const trainerId = value.id;
  if (typeof trainerId !== "string") return null;

  const slug = typeof value.slug === "string" ? value.slug : null;
  const profiles = getNested(value, "profiles");
  const fullName = isRecord(profiles) && typeof profiles.full_name === "string" ? profiles.full_name : null;
  const email = isRecord(profiles) && typeof profiles.email === "string" ? profiles.email : null;

  return {
    trainerId,
    contact: { name: fullName && fullName.trim() ? fullName : "Neznámy tréner", email, slug },
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

export default function ClientBookings({ userId, userEmail }: ClientBookingsProps) {
  const router = useRouter();
  const [bookings, setBookings] = useState<ClientBookingItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<"personal_training" | "online_consultation" | "history">(
    "personal_training"
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewBooking, setReviewBooking] = useState<{
    bookingId: string;
    trainerId: string;
    trainerName: string;
  } | null>(null);
  const [reviewRating, setReviewRating] = useState<number>(0);
  const [reviewHover, setReviewHover] = useState<number>(0);
  const [reviewText, setReviewText] = useState<string>("");
  const [reviewPhotoUrl, setReviewPhotoUrl] = useState<string | null>(null);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchBookings() {
      setLoading(true);
      try {
        console.log("[ClientBookings] userId:", userId, "userEmail:", userEmail);

        const sessionRes = await supabase.auth.getSession();
        const accessToken = sessionRes.data.session?.access_token;
        console.log("[ClientBookings] has session:", Boolean(sessionRes.data.session), "has accessToken:", Boolean(accessToken));

        if (!accessToken) {
          setBookings([]);
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
                .map((x): ClientBookingItem | null => {
                  if (!isRecord(x)) return null;
                  if (typeof x.id !== "string") return null;
                  if (typeof x.trainerId !== "string") return null;
                  if (typeof x.startsAt !== "string") return null;
                  if (typeof x.endsAt !== "string") return null;
                  if (!isBookingStatus(x.status)) return null;
                  const serviceTypeRaw = isRecord(x) ? x.serviceType : null;
                  const serviceType =
                    serviceTypeRaw === "personal" || serviceTypeRaw === "online" ? serviceTypeRaw : null;
                  if (typeof x.trainerName !== "string") return null;
                  if (!(typeof x.trainerEmail === "string" || x.trainerEmail === null)) return null;
                  return {
                    id: x.id,
                    trainerId: x.trainerId,
                    startsAt: x.startsAt,
                    endsAt: x.endsAt,
                    status: x.status,
                    serviceType,
                    trainerName: x.trainerName,
                    trainerEmail: x.trainerEmail,
                    trainerSlug: null,
                  };
                })
                .filter((x): x is ClientBookingItem => x !== null)
            : [];

          const trainerIds = Array.from(new Set(mappedFromApi.map((b) => b.trainerId))).filter((id) => id);
          const slugsByTrainerId = new Map<string, string>();
          if (trainerIds.length > 0) {
            const trainerRes = await supabase.from("trainers").select("id, slug").in("id", trainerIds);
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

          setBookings(
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
          .select("id, trainer_id, starts_at, ends_at, booking_status, service_type, client_profile_id, client_email")
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
            .select("id, slug, profiles(full_name,email)")
            .in("id", trainerIds);

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
          const serviceType = r.service_type === "personal" || r.service_type === "online" ? r.service_type : null;
          return {
            id: r.id,
            trainerId: r.trainer_id,
            startsAt: r.starts_at,
            endsAt: r.ends_at,
            status: isBookingStatus(r.booking_status) ? r.booking_status : "pending",
            serviceType,
            trainerName: contact?.name || "Neznámy tréner",
            trainerEmail: contact?.email || null,
            trainerSlug: contact?.slug || null,
          };
        });

        setBookings(mappedFromDb);
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

  const categorized = bookings.map((b) => {
    const category =
      b.serviceType === "online" ? "online_consultation" : b.serviceType === "personal" ? "personal_training" : "personal_training";
    return { ...b, category } as const;
  });

  const filteredBookings =
    activeCategory === "history" ? categorized : categorized.filter((b) => b.category === activeCategory);

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-full bg-zinc-950/60 border border-zinc-800 p-1">
        <button
          type="button"
          onClick={() => setActiveCategory("personal_training")}
          className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-colors ${
            activeCategory === "personal_training" ? "bg-emerald-500 text-black" : "text-zinc-300 hover:text-white"
          }`}
        >
          Osobný tréning
        </button>
        <button
          type="button"
          onClick={() => setActiveCategory("online_consultation")}
          className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-colors ${
            activeCategory === "online_consultation" ? "bg-emerald-500 text-black" : "text-zinc-300 hover:text-white"
          }`}
        >
          Online konzultácia
        </button>
        <button
          type="button"
          onClick={() => setActiveCategory("history")}
          className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-colors ${
            activeCategory === "history" ? "bg-emerald-500 text-black" : "text-zinc-300 hover:text-white"
          }`}
        >
          História
        </button>
      </div>

      {bookings.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {filteredBookings.map((booking) => (
            <div key={booking.id} className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/40 backdrop-blur-sm group hover:border-emerald-500/30 transition-all">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-1">Tréner</p>
                  <p className="text-lg font-bold text-white group-hover:text-emerald-400 transition-colors">
                    {booking.trainerName}
                  </p>
                </div>
                <span className={`px-2 py-1 rounded-full text-[9px] font-bold uppercase ${
                  booking.status === "confirmed" ? "bg-emerald-500/20 text-emerald-500" :
                  booking.status === "pending" ? "bg-yellow-500/20 text-yellow-500" :
                  booking.status === "completed" ? "bg-sky-500/20 text-sky-400" :
                  booking.status === "cancelled" ? "bg-red-500/20 text-red-400" :
                  "bg-zinc-800 text-zinc-500"
                }`}>
                  {booking.status}
                </span>
              </div>
              
              <div className="space-y-3 pt-4 border-t border-zinc-800/50">
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-emerald-500">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-bold text-zinc-200">{new Date(booking.startsAt).toLocaleDateString("sk-SK")}</p>
                    <p className="text-xs text-zinc-500">
                      {new Date(booking.startsAt).toLocaleTimeString("sk-SK", { hour: "2-digit", minute: "2-digit" })} - {new Date(booking.endsAt).toLocaleTimeString("sk-SK", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-sm">
                  <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-emerald-500">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <p className="text-zinc-400">{booking.trainerEmail || "Bez kontaktu"}</p>
                </div>

                {booking.status === "completed" && (
                  <div className="pt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setReviewBooking({
                          bookingId: booking.id,
                          trainerId: booking.trainerId,
                          trainerName: booking.trainerName,
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
                        const target = booking.trainerSlug
                          ? `/${booking.trainerSlug}?openBooking=1`
                          : `/t/${booking.trainerId}?openBooking=1`;
                        router.push(target);
                      }}
                      className="px-4 py-2 rounded-full bg-emerald-500 text-black hover:bg-emerald-400 transition-colors text-xs font-bold uppercase tracking-wider cursor-pointer"
                    >
                      Ďalší tréning
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {bookings.length > 0 && filteredBookings.length === 0 ? (
        <p className="text-zinc-500 italic text-center py-10">V tejto kategórii nemáte žiadne služby.</p>
      ) : bookings.length === 0 ? (
        <p className="text-zinc-500 italic text-center py-10">Zatiaľ ste si nezarezervovali žiadne služby.</p>
      ) : null}

      <Modal
        isOpen={reviewOpen}
        onClose={() => {
          if (reviewSubmitting) return;
          setReviewOpen(false);
        }}
        title={`Napísať recenziu na "${reviewBooking?.trainerName || "trénera"}"`}
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

          <button
            type="button"
            disabled={reviewSubmitting || !reviewBooking || reviewRating === 0 || reviewText.trim().length === 0}
            onClick={async () => {
              if (!reviewBooking) return;
              setReviewError(null);
              setReviewSubmitting(true);
              try {
                const sessionRes = await supabase.auth.getSession();
                const accessToken = sessionRes.data.session?.access_token;
                if (!accessToken) throw new Error("Pre odoslanie recenzie sa musíte prihlásiť.");

                const res = await createTrainerReviewAction({
                  booking_id: reviewBooking.bookingId,
                  trainer_id: reviewBooking.trainerId,
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
