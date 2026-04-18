"use client";

import React, { useCallback, useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { supabaseUrl, supabaseAnonKey } from "@/lib/config";
import { BookingStatus } from "@/lib/types";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface HistoryItem {
  id: string;
  type: "personal_training" | "online_consultation" | "meal_plan" | "transformation";
  clientName: string;
  clientEmail: string | null;
  clientPhone: string | null;
  status: string;
  date: string; // Pre zobrazenie
  endsAt?: string; // Len pre bookingy
  timestamp: number; // Pre zoradenie
  cancelledReason?: string | null;
}

interface TrainerHistoryProps {
  trainerId: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function inferBookingCategory(serviceType: string | null, serviceName: string | null): "personal_training" | "online_consultation" | "meal_plan" | "transformation" {
  if (serviceType === "online") return "online_consultation";
  if (serviceType === "personal") return "personal_training";
  if (serviceType === "transformation") return "transformation";

  const raw = (serviceName || "").toLowerCase();
  if (raw.includes("premena") || raw.includes("transformation")) return "transformation";
  if (raw.includes("online") || raw.includes("konzult")) return "online_consultation";
  if (raw.includes("jedál") || raw.includes("jedal") || raw.includes("meal") || raw.includes("plan")) return "meal_plan";
  
  return "personal_training";
}

export default function TrainerHistory({ trainerId }: TrainerHistoryProps) {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    if (!trainerId) return;
    setLoading(true);
    try {
      // 1. Načítať uzavreté bookingy
      const bookingsPromise = supabase
        .from("bookings")
        .select("id, starts_at, ends_at, booking_status, client_name, client_email, client_phone, service_id, service_type, cancelled_reason")
        .eq("trainer_id", trainerId)
        .in("booking_status", ["completed", "cancelled"]);

      // 2. Načítať uzavreté meal_plan_requests
      const mealPlansPromise = supabase
        .from("meal_plan_requests")
        .select("id, created_at, status, name, email, phone")
        .eq("trainer_id", trainerId)
        .in("status", ["completed", "cancelled"]);

      const [bookingsRes, mealPlansRes] = await Promise.all([bookingsPromise, mealPlansPromise]);

      if (bookingsRes.error) throw bookingsRes.error;
      if (mealPlansRes.error) throw mealPlansRes.error;

      // Spracovanie bookingov
      const bookingItems: HistoryItem[] = [];
      if (Array.isArray(bookingsRes.data)) {
        // Potrebujeme názvy služieb pre určenie typu
        const serviceIds = Array.from(new Set(bookingsRes.data.map(b => b.service_id).filter((id): id is string => !!id)));
        const serviceNameById = new Map<string, string>();

        if (serviceIds.length > 0) {
          const servicesRes = await supabase.from("services").select("id, name, title").in("id", serviceIds);
          if (!servicesRes.error && Array.isArray(servicesRes.data)) {
            servicesRes.data.forEach((s: { id: string; name?: string; title?: string }) => {
              serviceNameById.set(s.id, s.name || s.title || "");
            });
          }
        }

        bookingsRes.data.forEach((b: { 
          id: string; 
          service_id?: string; 
          service_type?: string;
          client_name?: string; 
          client_email?: string; 
          client_phone?: string; 
          booking_status: string; 
          starts_at: string; 
          ends_at: string; 
          cancelled_reason?: string | null;
        }) => {
          const serviceName = b.service_id ? serviceNameById.get(b.service_id) || null : null;
          const type = inferBookingCategory(b.service_type || null, serviceName);
          bookingItems.push({
            id: b.id,
            type,
            clientName: b.client_name || "Bez mena",
            clientEmail: b.client_email || null,
            clientPhone: b.client_phone || null,
            status: b.booking_status,
            date: b.starts_at,
            endsAt: b.ends_at,
            timestamp: new Date(b.starts_at).getTime(),
            cancelledReason: b.cancelled_reason || null,
          });
        });
      }

      // Spracovanie meal planov
      const mealPlanItems: HistoryItem[] = [];
      if (Array.isArray(mealPlansRes.data)) {
        mealPlansRes.data.forEach((m: {
          id: string;
          name?: string;
          email?: string;
          phone?: string;
          status: string;
          created_at: string;
        }) => {
          mealPlanItems.push({
            id: m.id,
            type: "meal_plan",
            clientName: m.name || "Bez mena",
            clientEmail: m.email || null,
            clientPhone: m.phone || null,
            status: m.status,
            date: m.created_at,
            timestamp: new Date(m.created_at).getTime(),
          });
        });
      }

      // Spojenie a zoradenie (najnovšie prvé)
      const combined = [...bookingItems, ...mealPlanItems].sort((a, b) => b.timestamp - a.timestamp);
      setHistory(combined);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Nepodarilo sa načítať históriu.");
    } finally {
      setLoading(false);
    }
  }, [trainerId]);

  useEffect(() => {
    console.log("[FETCH LOOP CHECK] TrainerHistory useEffect [fetchHistory]");
    void fetchHistory();
  }, [fetchHistory]);

  if (loading) return <div className="text-zinc-500 animate-pulse">Načítavam históriu...</div>;
  if (error) return <div className="text-red-400">Chyba: {error}</div>;

  if (history.length === 0) {
    return <div className="px-6 py-8 text-zinc-500 italic">História je zatiaľ prázdna.</div>;
  }

  const getTypeLabel = (type: HistoryItem["type"]) => {
    switch (type) {
      case "personal_training": return "Osobný tréning";
      case "online_consultation": return "Online konzultácia";
      case "meal_plan": return "Jedálniček na mieru";
      case "transformation": return "Mesačná premena";
      default: return "Neznámy typ";
    }
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/50">
      <table className="w-full text-left text-sm">
        <thead className="bg-zinc-800/80 text-zinc-400 font-bold uppercase tracking-wider text-[10px]">
          <tr>
            <th className="px-6 py-4">Typ</th>
            <th className="px-6 py-4">Meno klienta</th>
            <th className="px-6 py-4">Termín / Dátum</th>
            <th className="px-6 py-4">Kontakt</th>
            <th className="px-6 py-4">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800">
          {history.map((item) => (
            <tr key={item.id} className="hover:bg-zinc-800/30 transition-colors">
              <td className="px-6 py-4">
                <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-md ${
                  item.type === "meal_plan" ? "bg-purple-500/10 text-purple-400" :
                  item.type === "online_consultation" ? "bg-blue-500/10 text-blue-400" :
                  item.type === "transformation" ? "bg-amber-500/10 text-amber-400" :
                  "bg-emerald-500/10 text-emerald-400"
                }`}>
                  {getTypeLabel(item.type)}
                </span>
              </td>
              <td className="px-6 py-4 font-medium text-white">
                {item.clientName}
              </td>
              <td className="px-6 py-4 text-zinc-300">
                <div className="font-bold">
                  {new Date(item.date).toLocaleDateString("sk-SK")}
                </div>
                {item.endsAt && (
                  <div className="text-[10px] text-zinc-500">
                    {new Date(item.date).toLocaleTimeString("sk-SK", { hour: "2-digit", minute: "2-digit" })} - {new Date(item.endsAt).toLocaleTimeString("sk-SK", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                )}
                {!item.endsAt && (
                  <div className="text-[10px] text-zinc-500 uppercase tracking-tighter">
                    Požiadavka vytvorená
                  </div>
                )}
              </td>
              <td className="px-6 py-4 text-zinc-400">
                <div className="text-xs">{item.clientEmail || "—"}</div>
                {item.clientPhone && <div className="text-[10px] opacity-60">{item.clientPhone}</div>}
              </td>
              <td className="px-6 py-4">
                <div className="flex flex-col gap-1">
                  <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-md w-fit ${
                    item.status === "completed" ? "bg-sky-500/10 text-sky-400" :
                    item.status === "cancelled" ? "bg-red-500/10 text-red-400" :
                    "bg-zinc-700/50 text-zinc-400"
                  }`}>
                    {item.status === "completed" ? "Dokončené" : item.status === "cancelled" ? "Zrušené trénerom" : item.status}
                  </span>
                  {item.status === "cancelled" && item.cancelledReason && (
                    <div className="text-[11px] text-zinc-500 italic max-w-[200px] leading-tight">
                      <span className="font-semibold not-italic">Dôvod:</span> {item.cancelledReason}
                    </div>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
