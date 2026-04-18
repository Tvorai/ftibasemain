"use client";

import React, { useCallback, useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { supabaseUrl, supabaseAnonKey } from "@/lib/config";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface MealPlanRequest {
  id: string;
  trainer_id: string;
  client_profile_id: string;
  name: string;
  email: string;
  phone: string;
  goal: string;
  height_cm: number;
  age: number;
  gender: string;
  allergens: string | null;
  favorite_foods: string | null;
  status: string;
  payment_status: string | null;
  price_cents: number | null;
  created_at: string;
}

interface TrainerMealPlanRequestsProps {
  trainerId: string;
}

export default function TrainerMealPlanRequests({ trainerId }: TrainerMealPlanRequestsProps) {
  const [requests, setRequests] = useState<MealPlanRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    if (!trainerId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("meal_plan_requests")
        .select("id, name, email, phone, goal, height_cm, age, gender, allergens, favorite_foods, status, payment_status, price_cents, created_at")
        .eq("trainer_id", trainerId)
        .in("status", ["confirmed", "in_progress"])
        .order("created_at", { ascending: false });

      console.log("[FETCH AUDIT] TrainerMealPlanRequests = fetchRequests");
      console.log("[FETCH AUDIT] table = meal_plan_requests");
      console.log("[FETCH AUDIT] old select = *");
      console.log("[FETCH AUDIT] new select = id, name, email, phone, goal, height_cm, age, gender, allergens, favorite_foods, status, payment_status, price_cents, created_at");

      if (error) throw error;
      setRequests((data as any) || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Nepodarilo sa načítať požiadavky na jedálniček.");
    } finally {
      setLoading(false);
    }
  }, [trainerId]);

  useEffect(() => {
    void fetchRequests();
  }, [fetchRequests]);

  const updateMealPlanStatus = useCallback(
    async (id: string, status: string) => {
      setError(null);
      setUpdatingId(id);
      try {
        const { error } = await supabase
          .from("meal_plan_requests")
          .update({ status })
          .eq("id", id);

        if (error) throw error;
        await fetchRequests();
      } catch (err: unknown) {
        console.error("[TrainerMealPlanRequests] update error:", err);
        setError(err instanceof Error ? err.message : "Nepodarilo sa aktualizovať status požiadavky.");
      } finally {
        setUpdatingId(null);
        setOpenMenuId(null);
      }
    },
    [fetchRequests]
  );

  if (loading) return <div className="text-zinc-500 animate-pulse">Načítavam požiadavky...</div>;
  if (error) return <div className="text-red-400">Chyba: {error}</div>;

  if (requests.length === 0) {
    return <div className="px-6 py-8 text-zinc-500 italic">Žiadne požiadavky na jedálniček.</div>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/50">
      {openMenuId !== null && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setOpenMenuId(null)}
          onPointerDown={() => setOpenMenuId(null)}
        />
      )}
      <table className="w-full text-left text-sm">
        <thead className="bg-zinc-800/80 text-zinc-400 font-bold uppercase tracking-wider text-[10px]">
          <tr>
            <th className="px-6 py-4">Klient</th>
            <th className="px-6 py-4">Cieľ a parametre</th>
            <th className="px-6 py-4">Preferencie</th>
            <th className="px-6 py-4">Cena</th>
            <th className="px-6 py-4">Status</th>
            <th className="px-6 py-4">Dátum</th>
            <th className="px-6 py-4 text-right"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800">
          {requests.map((request) => (
            <tr key={request.id} className="hover:bg-zinc-800/30 transition-colors">
              <td className="px-6 py-4">
                <div className="font-medium text-white">{request.name}</div>
                <div className="text-xs text-zinc-400">{request.email}</div>
                <div className="text-xs text-zinc-500">{request.phone}</div>
              </td>
              <td className="px-6 py-4 text-zinc-300">
                <div className="font-bold text-emerald-500 mb-1">{request.goal}</div>
                <div className="text-xs">
                  {request.gender === "male" ? "Muž" : "Žena"}, {request.age} r., {request.height_cm} cm
                </div>
              </td>
              <td className="px-6 py-4 text-zinc-400 max-w-xs">
                {request.allergens && (
                  <div className="mb-1">
                    <span className="text-red-400/80 font-bold text-[10px] uppercase">Alergény:</span>
                    <div className="text-xs">{request.allergens}</div>
                  </div>
                )}
                {request.favorite_foods && (
                  <div>
                    <span className="text-emerald-500/80 font-bold text-[10px] uppercase">Obľúbené jedlá:</span>
                    <div className="text-xs">{request.favorite_foods}</div>
                  </div>
                )}
                {!request.allergens && !request.favorite_foods && <span className="italic">Žiadne špeciálne požiadavky</span>}
              </td>
              <td className="px-6 py-4 text-white font-bold">
                {request.price_cents ? `${(request.price_cents / 100).toFixed(2)} €` : "—"}
              </td>
              <td className="px-6 py-4">
                <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                  request.status === "confirmed" || request.payment_status === "paid" ? "bg-emerald-500/20 text-emerald-500" :
                  request.status === "pending_payment" ? "bg-yellow-500/20 text-yellow-500" :
                  request.status === "in_progress" ? "bg-orange-500/20 text-orange-400" :
                  "bg-zinc-700/50 text-zinc-400"
                }`}>
                  {request.status === "confirmed" || request.payment_status === "paid" ? "Zaplatené" : 
                   request.status === "pending_payment" ? "Čaká na platbu" :
                   request.status === "in_progress" ? "V procese" : 
                   request.status === "new" ? "Nová" : request.status}
                </span>
              </td>
              <td className="px-6 py-4 text-zinc-500 text-xs">
                {new Date(request.created_at).toLocaleDateString("sk-SK")}
              </td>
              <td className="px-6 py-4 text-right">
                <div className="relative inline-block" onPointerDown={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-zinc-300 hover:text-white hover:bg-zinc-800/60 border border-white/5 disabled:opacity-50 disabled:hover:bg-transparent"
                    aria-label="Akcie"
                    disabled={updatingId === request.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenMenuId((prev) => (prev === request.id ? null : request.id));
                    }}
                  >
                    ⋮
                  </button>

                  {openMenuId === request.id && (
                    <div className="absolute right-0 mt-2 w-48 rounded-xl border border-zinc-700/60 bg-zinc-950 shadow-lg overflow-hidden z-50">
                      <div className="py-1">
                        {request.status !== "in_progress" && (
                          <button
                            type="button"
                            className="w-full text-left px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800/70 disabled:opacity-50"
                            disabled={updatingId === request.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              void updateMealPlanStatus(request.id, "in_progress");
                            }}
                          >
                            V procese
                          </button>
                        )}

                        <button
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm text-emerald-400 hover:bg-zinc-800/70 disabled:opacity-50"
                          disabled={updatingId === request.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            void updateMealPlanStatus(request.id, "completed");
                          }}
                        >
                          Dokončené
                        </button>
                      </div>
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
