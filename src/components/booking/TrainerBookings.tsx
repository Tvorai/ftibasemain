"use client";

import React, { useCallback, useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { supabaseUrl, supabaseAnonKey } from "@/lib/config";
import { BookingStatus } from "@/lib/types";
import { updateBookingStatusAction } from "@/lib/booking/actions";
import TrainerMealPlanRequests from "../trainer/TrainerMealPlanRequests";
import TrainerHistory from "../trainer/TrainerHistory";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface TrainerBookingsProps {
  trainerId: string;
}

type BookingCategory = "personal_training" | "online_consultation" | "meal_plan" | "transformation" | "history";

type TrainerBookingItem = {
  id: string;
  startsAt: string;
  endsAt: string;
  status: BookingStatus;
  paymentStatus: string | null;
  serviceId: string | null;
  serviceName: string | null;
  serviceType: string | null;
  category: BookingCategory;
  clientName: string;
  clientEmail: string | null;
  clientPhone: string | null;
  clientNote: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

const bookingStatuses: readonly BookingStatus[] = ["pending", "pending_payment", "confirmed", "completed", "cancelled"];

function isBookingStatus(value: unknown): value is BookingStatus {
  return typeof value === "string" && (bookingStatuses as readonly string[]).includes(value);
}

function inferBookingCategory(serviceType: string | null, serviceName: string | null): BookingCategory {
  // 1. Priorita: service_type priamo z tabuľky bookings
  if (serviceType === "online") return "online_consultation";
  if (serviceType === "personal") return "personal_training";
  if (serviceType === "transformation") return "transformation";

  // 2. Fallback: inferencia z názvu služby (pôvodná logika)
  const raw = (serviceName || "").toLowerCase();
  if (raw.includes("premena") || raw.includes("transformation")) return "transformation";
  if (raw.includes("online") || raw.includes("konzult")) return "online_consultation";
  if (raw.includes("jedál") || raw.includes("jedal") || raw.includes("meal") || raw.includes("plan")) return "meal_plan";
  
  return "personal_training";
}

function toTrainerBookingItem(value: unknown): TrainerBookingItem | null {
  if (!isRecord(value)) return null;
  const id = value.id;
  const startsAt = value.starts_at;
  const endsAt = value.ends_at;
  const paymentStatusRaw = value.payment_status;
  const serviceType = value.service_type;
  
  // Robustnejšie spracovanie statusu
  let statusRaw = value.booking_status;
  if (!statusRaw && paymentStatusRaw === "paid") {
    statusRaw = "confirmed";
  }
  if (!statusRaw) {
    statusRaw = "pending_payment";
  }

  if (typeof id !== "string" || typeof startsAt !== "string" || typeof endsAt !== "string") {
    return null;
  }

  const status: BookingStatus = isBookingStatus(statusRaw) ? statusRaw : "pending_payment";
  const serviceIdRaw = value.service_id;
  const clientNameRaw = value.client_name;
  const clientEmailRaw = value.client_email;
  const clientPhoneRaw = value.client_phone;
  const clientNoteRaw = value.client_note;

  const normalizedStatus: BookingStatus = status === "pending" ? "pending_payment" : status;

  return {
    id,
    startsAt,
    endsAt,
    status: normalizedStatus,
    paymentStatus: typeof paymentStatusRaw === "string" ? paymentStatusRaw : null,
    serviceId: typeof serviceIdRaw === "string" ? serviceIdRaw : null,
    serviceName: null,
    serviceType: typeof serviceType === "string" ? serviceType : null,
    category: "personal_training",
    clientName: typeof clientNameRaw === "string" && clientNameRaw.trim() ? clientNameRaw : "Bez mena",
    clientEmail: typeof clientEmailRaw === "string" ? clientEmailRaw : null,
    clientPhone: typeof clientPhoneRaw === "string" ? clientPhoneRaw : null,
    clientNote: typeof clientNoteRaw === "string" ? clientNoteRaw : null,
  };
}

function getStatusLabel(status: BookingStatus, paymentStatus: string | null): string {
  if (paymentStatus === "paid" || status === "confirmed") return "Potvrdené";
  if (status === "pending_payment") return "Čaká na platbu";
  if (status === "completed") return "Dokončené";
  if (status === "cancelled") return "Zrušené";
  return status;
}

export default function TrainerBookings({ trainerId }: TrainerBookingsProps) {
  const [bookings, setBookings] = useState<TrainerBookingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<BookingCategory>("personal_training");

  const fetchBookings = useCallback(async () => {
    if (!trainerId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("bookings")
        .select("*") // Načítame všetky stĺpce pre istotu
        .eq("trainer_id", trainerId)
        .order("starts_at", { ascending: true });

      if (error) throw error;
      const payload: unknown = data;
      console.log("[TrainerBookings] Načítané surové dáta:", payload);

      const mapped = Array.isArray(payload) ? payload.map(toTrainerBookingItem).filter((x): x is TrainerBookingItem => x !== null) : [];

      const serviceIds = Array.from(new Set(mapped.map((b) => b.serviceId).filter((x): x is string => typeof x === "string")));
      const serviceNameById = new Map<string, string>();

      if (serviceIds.length > 0) {
        const trySelect = async (select: string) => {
          return supabase.from("services").select(select).in("id", serviceIds);
        };

        let servicesRes = await trySelect("id, name");
        if (servicesRes.error) {
          const msg = servicesRes.error.message || "";
          if (servicesRes.error.code === "42703" || msg.toLowerCase().includes("column") || msg.toLowerCase().includes("name")) {
            servicesRes = await trySelect("id, title");
          }
        }

        if (!servicesRes.error && Array.isArray(servicesRes.data)) {
          for (const item of servicesRes.data as unknown[]) {
            if (!isRecord(item)) continue;
            const id = item.id;
            const name = (item as Record<string, unknown>).name ?? (item as Record<string, unknown>).title;
            if (typeof id === "string" && typeof name === "string" && name.trim()) {
              serviceNameById.set(id, name);
            }
          }
        }
      }

      const enriched = mapped.map((b) => {
        const serviceName = b.serviceId ? serviceNameById.get(b.serviceId) || null : null;
        const category = inferBookingCategory(b.serviceType, serviceName);
        return { ...b, serviceName, category };
      });

      console.log("[TrainerBookings] Enriched bookings:", enriched.map(b => ({ id: b.id, type: b.serviceType, category: b.category })));
      console.log("[TrainerBookings] Personal tab:", enriched.filter(b => b.category === "personal_training").length);
      console.log("[TrainerBookings] Online tab:", enriched.filter(b => b.category === "online_consultation").length);

      setBookings(enriched);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Nepodarilo sa načítať rezervácie.");
    } finally {
      setLoading(false);
    }
  }, [trainerId]);

  useEffect(() => {
    void fetchBookings();
  }, [fetchBookings]);

  type UpdatableBookingStatus = "completed" | "cancelled";

  const updateBookingStatus = useCallback(
    async (bookingId: string, status: UpdatableBookingStatus) => {
      console.log("[TrainerBookings] action click:", { bookingId, status });
      setError(null);
      setUpdatingId(bookingId);
      try {
        const sessionRes = await supabase.auth.getSession();
        const accessToken = sessionRes.data.session?.access_token;
        if (!accessToken) {
          console.log("[TrainerBookings] missing access token");
          throw new Error("Pre túto akciu sa musíte prihlásiť.");
        }

        console.log("[TrainerBookings] sending request:", { bookingId, status });
        const updateRes = await updateBookingStatusAction({
          booking_id: bookingId,
          booking_status: status,
          access_token: accessToken,
        });

        if (updateRes.status !== "success") {
          console.log("[TrainerBookings] request failed:", updateRes);
          throw new Error(updateRes.message);
        }

        console.log("[TrainerBookings] request success:", { bookingId, status });
        await fetchBookings();
      } catch (err: unknown) {
        console.log("[TrainerBookings] action error:", err);
        setError(err instanceof Error ? err.message : "Nepodarilo sa aktualizovať status rezervácie.");
      } finally {
        setUpdatingId(null);
        setOpenMenuId(null);
      }
    },
    [fetchBookings]
  );

  if (loading) return <div className="text-zinc-500 animate-pulse">Načítavam rezervácie...</div>;
  if (error) return <div className="text-red-400">Chyba: {error}</div>;

  const filteredBookings = bookings.filter((b) => {
    // Odfiltrujeme dokončené a zrušené bookingy, tie patria do histórie
    if (b.status === "completed" || b.status === "cancelled") return false;

    if (activeCategory === "personal_training") return b.serviceType === "personal" || b.serviceType === null;
    if (activeCategory === "online_consultation") return b.serviceType === "online";
    if (activeCategory === "transformation") return b.serviceType === "transformation";
    return false;
  });

  return (
    <div className="space-y-4">
      {openMenuId !== null && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setOpenMenuId(null)}
          onPointerDown={() => setOpenMenuId(null)}
        />
      )}

      <div className="flex flex-wrap gap-2 mb-8 p-1.5 bg-zinc-900/50 backdrop-blur-md rounded-2xl border border-white/5 w-fit">
        <button
          onClick={() => setActiveCategory("personal_training")}
          className={`px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${activeCategory === "personal_training" ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20" : "text-zinc-400 hover:text-white"}`}
        >
          Osobný tréning
        </button>
        <button
          onClick={() => setActiveCategory("online_consultation")}
          className={`px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${activeCategory === "online_consultation" ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20" : "text-zinc-400 hover:text-white"}`}
        >
          Online konzultácia
        </button>
        <button
          onClick={() => setActiveCategory("meal_plan")}
          className={`px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${activeCategory === "meal_plan" ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20" : "text-zinc-400 hover:text-white"}`}
        >
          Jedálniček na mieru
        </button>
        <button
          onClick={() => setActiveCategory("transformation")}
          className={`px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${activeCategory === "transformation" ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20" : "text-zinc-400 hover:text-white"}`}
        >
          Mesačná premena
        </button>
        <button
          onClick={() => setActiveCategory("history")}
          className={`px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${activeCategory === "history" ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20" : "text-zinc-400 hover:text-white"}`}
        >
          História
        </button>
      </div>

      {activeCategory === "meal_plan" ? (
        <TrainerMealPlanRequests trainerId={trainerId} />
      ) : activeCategory === "history" ? (
        <TrainerHistory trainerId={trainerId} />
      ) : bookings.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/50">
          {filteredBookings.length > 0 ? (
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-800/80 text-zinc-400 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-6 py-4">Meno klienta</th>
                  <th className="px-6 py-4">Termín</th>
                  <th className="px-6 py-4">Kontakt</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {filteredBookings.map((booking) => (
                  <tr key={booking.id} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="px-6 py-4 font-medium">
                      <div className="text-white font-bold mb-1">{booking.clientName}</div>
                      <div className="text-zinc-500 text-xs">{booking.clientEmail}</div>
                      <div className="text-zinc-500 text-xs">{booking.clientPhone}</div>
                      {booking.serviceType === "transformation" && (
                        <div className="mt-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 uppercase tracking-widest">
                          Mesačná premena
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-emerald-500 font-bold mb-1">
                        {booking.serviceName}
                      </div>
                      {booking.serviceType === "transformation" ? (
                        <div className="text-zinc-500 text-[10px] uppercase tracking-wider font-bold">
                          Program na 30 dní
                        </div>
                      ) : (
                        <>
                          <div className="text-zinc-300 font-bold">
                            {new Date(booking.startsAt).toLocaleDateString("sk-SK")}
                          </div>
                          <div className="text-[10px] text-zinc-500">
                            {new Date(booking.startsAt).toLocaleTimeString("sk-SK", { hour: "2-digit", minute: "2-digit" })} - {new Date(booking.endsAt).toLocaleTimeString("sk-SK", { hour: "2-digit", minute: "2-digit" })}
                          </div>
                        </>
                      )}
                    </td>
                    <td className="px-6 py-4 text-zinc-400">
                      {booking.clientNote ? (
                        <div className="text-xs opacity-60 mt-1">{booking.clientNote}</div>
                      ) : booking.clientNote === null ? (
                        // Fallback pre staršie záznamy ktoré môžu používať 'note' namiesto 'client_note'
                        <div className="text-xs opacity-60 mt-1">{(booking as any).note}</div>
                      ) : null}
                    </td>
                    <td className="px-6 py-4">
                      {(() => {
                        const label = getStatusLabel(booking.status, booking.paymentStatus);
                        const tone =
                          booking.status === "cancelled"
                            ? "cancelled"
                            : booking.status === "completed"
                              ? "completed"
                              : booking.paymentStatus === "paid" || booking.status === "confirmed"
                                ? "confirmed"
                                : booking.status === "pending_payment" || booking.status === "pending"
                                  ? "pending"
                                  : "other";
                        const cls =
                          tone === "confirmed"
                            ? "bg-emerald-500/20 text-emerald-500"
                            : tone === "pending"
                              ? "bg-yellow-500/20 text-yellow-500"
                              : tone === "completed"
                                ? "bg-sky-500/20 text-sky-400"
                                : tone === "cancelled"
                                  ? "bg-red-500/20 text-red-400"
                                  : "bg-zinc-700/50 text-zinc-400";
                        return (
                          <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${cls}`}>
                            {label}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="relative inline-block" onPointerDown={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-zinc-300 hover:text-white hover:bg-zinc-800/60 border border-white/5 disabled:opacity-50 disabled:hover:bg-transparent"
                          aria-label="Akcie"
                          disabled={updatingId === booking.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId((prev) => (prev === booking.id ? null : booking.id));
                          }}
                        >
                          ⋮
                        </button>

                        {openMenuId === booking.id && (
                          <div className="absolute right-0 mt-2 w-56 rounded-xl border border-zinc-700/60 bg-zinc-950 shadow-lg overflow-hidden z-50">
                            <div className="py-1">
                              {booking.status !== "cancelled" && booking.status !== "completed" && (
                                <button
                                  type="button"
                                  className="w-full text-left px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800/70 disabled:opacity-50"
                                  disabled={updatingId === booking.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    console.log("[TrainerBookings] menu item: completed", booking.id);
                                    void updateBookingStatus(booking.id, "completed");
                                  }}
                                >
                                  Tréning bol dokončený
                                </button>
                              )}

                              {booking.status !== "cancelled" && (
                                <button
                                  type="button"
                                  className="w-full text-left px-3 py-2 text-sm text-red-300 hover:bg-zinc-800/70 disabled:opacity-50"
                                  disabled={updatingId === booking.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    console.log("[TrainerBookings] menu item: cancelled", booking.id);
                                    void updateBookingStatus(booking.id, "cancelled");
                                  }}
                                >
                                  Zrušiť tréning
                                </button>
                              )}

                              {booking.status === "cancelled" && (
                                <div className="px-3 py-2 text-sm text-zinc-500">Žiadne akcie</div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="px-6 py-8 text-zinc-500 italic">Žiadne rezervácie v tejto kategórii.</div>
          )}
        </div>
      ) : (
        <p className="text-zinc-500 italic">Zatiaľ nemáte žiadne rezervácie.</p>
      )}
    </div>
  );
}
