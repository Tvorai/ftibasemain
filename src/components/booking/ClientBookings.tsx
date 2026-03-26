"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { supabaseUrl, supabaseAnonKey } from "@/lib/config";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface ClientBookingsProps {
  userId: string;
  userEmail: string;
}

type ClientBookingItem = {
  id: string;
  startsAt: string;
  endsAt: string;
  status: string;
  trainerId: string;
  trainerName: string;
  trainerEmail: string | null;
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
};

function toBookingRow(value: unknown): BookingRow | null {
  if (!isRecord(value)) return null;
  const id = value.id;
  const trainerId = value.trainer_id;
  const startsAt = value.starts_at;
  const endsAt = value.ends_at;
  const status = value.booking_status;
  if (
    typeof id !== "string" ||
    typeof trainerId !== "string" ||
    typeof startsAt !== "string" ||
    typeof endsAt !== "string" ||
    typeof status !== "string"
  ) {
    return null;
  }
  return { id, trainer_id: trainerId, starts_at: startsAt, ends_at: endsAt, booking_status: status };
}

type TrainerContact = { name: string; email: string | null };

function toTrainerContact(value: unknown): { trainerId: string; contact: TrainerContact } | null {
  if (!isRecord(value)) return null;
  const trainerId = value.id;
  if (typeof trainerId !== "string") return null;

  const profiles = getNested(value, "profiles");
  const fullName = isRecord(profiles) && typeof profiles.full_name === "string" ? profiles.full_name : null;
  const email = isRecord(profiles) && typeof profiles.email === "string" ? profiles.email : null;

  return {
    trainerId,
    contact: { name: fullName && fullName.trim() ? fullName : "Neznámy tréner", email },
  };
}

export default function ClientBookings({ userId, userEmail }: ClientBookingsProps) {
  const [bookings, setBookings] = useState<ClientBookingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
            ? apiPayload.filter((x): x is ClientBookingItem => {
                return (
                  isRecord(x) &&
                  typeof x.id === "string" &&
                  typeof x.trainerId === "string" &&
                  typeof x.startsAt === "string" &&
                  typeof x.endsAt === "string" &&
                  typeof x.status === "string" &&
                  typeof x.trainerName === "string" &&
                  (typeof x.trainerEmail === "string" || x.trainerEmail === null)
                );
              })
            : [];

          setBookings(mappedFromApi);
          setError(null);
          return;
        }

        const query = supabase
          .from("bookings")
          .select("id, trainer_id, starts_at, ends_at, booking_status, client_profile_id, client_email")
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
            .select("id, profiles(full_name,email)")
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
          return {
            id: r.id,
            trainerId: r.trainer_id,
            startsAt: r.starts_at,
            endsAt: r.ends_at,
            status: r.booking_status,
            trainerName: contact?.name || "Neznámy tréner",
            trainerEmail: contact?.email || null,
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

  return (
    <div className="space-y-4">
      {bookings.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {bookings.map((booking) => (
            <div key={booking.id} className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/40 backdrop-blur-sm group hover:border-emerald-500/30 transition-all">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-1">Tréner</p>
                  <p className="text-lg font-bold text-white group-hover:text-emerald-400 transition-colors">
                    {booking.trainerName}
                  </p>
                </div>
                <span className={`px-2 py-1 rounded-full text-[9px] font-bold uppercase ${
                  booking.status === "confirmed" ? "bg-emerald-500/20 text-emerald-500" : "bg-zinc-800 text-zinc-500"
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
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-zinc-500 italic text-center py-10">Zatiaľ ste si nezarezervovali žiadne služby.</p>
      )}
    </div>
  );
}
