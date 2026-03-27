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
  created_at: string;
}

interface TrainerMealPlanRequestsProps {
  trainerId: string;
}

export default function TrainerMealPlanRequests({ trainerId }: TrainerMealPlanRequestsProps) {
  const [requests, setRequests] = useState<MealPlanRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    if (!trainerId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("meal_plan_requests")
        .select("*")
        .eq("trainer_id", trainerId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRequests(data || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Nepodarilo sa načítať požiadavky na jedálniček.");
    } finally {
      setLoading(false);
    }
  }, [trainerId]);

  useEffect(() => {
    void fetchRequests();
  }, [fetchRequests]);

  if (loading) return <div className="text-zinc-500 animate-pulse">Načítavam požiadavky...</div>;
  if (error) return <div className="text-red-400">Chyba: {error}</div>;

  if (requests.length === 0) {
    return <div className="px-6 py-8 text-zinc-500 italic">Žiadne požiadavky na jedálniček.</div>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/50">
      <table className="w-full text-left text-sm">
        <thead className="bg-zinc-800/80 text-zinc-400 font-bold uppercase tracking-wider text-[10px]">
          <tr>
            <th className="px-6 py-4">Klient</th>
            <th className="px-6 py-4">Cieľ a parametre</th>
            <th className="px-6 py-4">Preferencie</th>
            <th className="px-6 py-4">Status</th>
            <th className="px-6 py-4">Dátum</th>
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
              <td className="px-6 py-4">
                <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                  request.status === "new" ? "bg-yellow-500/20 text-yellow-500" :
                  request.status === "in_progress" ? "bg-sky-500/20 text-sky-400" :
                  request.status === "completed" ? "bg-emerald-500/20 text-emerald-500" :
                  "bg-zinc-700/50 text-zinc-400"
                }`}>
                  {request.status === "new" ? "Nová" : request.status}
                </span>
              </td>
              <td className="px-6 py-4 text-zinc-500 text-xs">
                {new Date(request.created_at).toLocaleDateString("sk-SK")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
