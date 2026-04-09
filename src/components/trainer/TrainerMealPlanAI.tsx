"use client";

import React, { useCallback, useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { supabaseUrl, supabaseAnonKey } from "@/lib/config";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface MealPlanMeal {
  name: string;
  description: string;
  approx_calories: string;
}

interface MealPlanDay {
  day: string;
  meals: MealPlanMeal[];
}

interface AiMealPlan {
  client_summary?: string;
  goal_summary?: string;
  calorie_target?: string;
  macros?: {
    protein: string;
    carbs: string;
    fats: string;
  };
  recommendations?: string[];
  meal_plan_days?: MealPlanDay[];
  raw_text?: string;
}

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
  ai_generation_status: "idle" | "generating" | "ready" | "failed";
  ai_generated_plan: AiMealPlan | null;
  trainer_edited_plan: string | null;
  ai_last_error: string | null;
  ai_generated_at: string | null;
}

interface TrainerMealPlanAIProps {
  trainerId: string;
}

export default function TrainerMealPlanAI({ trainerId }: TrainerMealPlanAIProps) {
  const [requests, setRequests] = useState<MealPlanRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [trainerNotes, setTrainerNotes] = useState("");
  const [editedPlan, setEditedPlan] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const fetchRequests = useCallback(async () => {
    if (!trainerId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("meal_plan_requests")
        .select("*")
        .eq("trainer_id", trainerId)
        .in("status", ["confirmed", "in_progress", "completed"])
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

  const selectedRequest = requests.find((r) => r.id === selectedRequestId);

  useEffect(() => {
    if (selectedRequest) {
      // If there's an edited plan, use it. Otherwise, format the AI plan or leave empty.
      if (selectedRequest.trainer_edited_plan) {
        setEditedPlan(selectedRequest.trainer_edited_plan);
      } else if (selectedRequest.ai_generated_plan) {
        setEditedPlan(formatAiPlan(selectedRequest.ai_generated_plan));
      } else {
        setEditedPlan("");
      }
    }
  }, [selectedRequest]);

  const formatAiPlan = (plan: AiMealPlan): string => {
    if (!plan) return "";
    if (plan.raw_text) return plan.raw_text;

    // Structured JSON to readable text for editing
    let text = "";
    if (plan.client_summary) text += `ZHRNUTIE KLIENTA:\n${plan.client_summary}\n\n`;
    if (plan.goal_summary) text += `CIEĽ:\n${plan.goal_summary}\n\n`;
    if (plan.calorie_target) text += `KALORICKÝ CIEĽ: ${plan.calorie_target}\n`;
    if (plan.macros) {
      text += `MAKROŽIVINY: B:${plan.macros.protein}, S:${plan.macros.carbs}, T:${plan.macros.fats}\n\n`;
    }
    if (plan.recommendations && Array.isArray(plan.recommendations)) {
      text += `ODPORÚČANIA:\n${plan.recommendations.map((r: string) => `- ${r}`).join("\n")}\n\n`;
    }
    if (plan.meal_plan_days && Array.isArray(plan.meal_plan_days)) {
      text += `JEDÁLNIČEK:\n`;
      plan.meal_plan_days.forEach((day: MealPlanDay) => {
        text += `\n[ ${day.day} ]\n`;
        if (day.meals && Array.isArray(day.meals)) {
          day.meals.forEach((meal: MealPlanMeal) => {
            text += `- ${meal.name}: ${meal.description} (${meal.approx_calories})\n`;
          });
        }
      });
    }
    return text;
  };

  const handleGenerate = async () => {
    if (!selectedRequestId) return;
    setIsGenerating(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Neprihlásený používateľ.");

      const response = await fetch("/api/ai/meal-plan/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          mealPlanRequestId: selectedRequestId,
          trainerNotes
        })
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Chyba pri generovaní.");

      await fetchRequests(); // Refresh data to get the new AI draft
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Generovanie zlyhalo.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!selectedRequestId) return;
    setIsSaving(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Neprihlásený používateľ.");

      const response = await fetch("/api/ai/meal-plan/save-draft", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          mealPlanRequestId: selectedRequestId,
          editedPlan
        })
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Chyba pri ukladaní.");

      await fetchRequests();
      alert("Draft bol úspešne uložený.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ukladanie zlyhalo.");
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) return <div className="text-zinc-500 animate-pulse">Načítavam požiadavky...</div>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Sidebar - List of requests */}
      <div className="lg:col-span-1 space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-500 px-2">Požiadavky</h3>
        <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
          {requests.map((req) => (
            <button
              key={req.id}
              onClick={() => setSelectedRequestId(req.id)}
              className={`w-full text-left p-4 rounded-xl border transition-all ${
                selectedRequestId === req.id
                  ? "bg-emerald-500/10 border-emerald-500/50 ring-1 ring-emerald-500/20"
                  : "bg-zinc-900/50 border-zinc-800 hover:border-zinc-700"
              }`}
            >
              <div className="font-bold text-white mb-1">{req.name}</div>
              <div className="text-xs text-zinc-400 mb-2">{req.goal}</div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-zinc-500">
                  {new Date(req.created_at).toLocaleDateString("sk-SK")}
                </span>
                <span className={`text-[10px] font-bold uppercase ${
                  req.ai_generation_status === "ready" ? "text-emerald-500" :
                  req.ai_generation_status === "generating" ? "text-orange-400 animate-pulse" :
                  req.ai_generation_status === "failed" ? "text-red-400" :
                  "text-zinc-600"
                }`}>
                  {req.ai_generation_status === "ready" ? "Draft pripravený" :
                   req.ai_generation_status === "generating" ? "Generujem..." :
                   req.ai_generation_status === "failed" ? "Chyba" : "Bez AI draftu"}
                </span>
              </div>
            </button>
          ))}
          {requests.length === 0 && (
            <div className="p-4 text-zinc-500 italic text-sm">Žiadne požiadavky.</div>
          )}
        </div>
      </div>

      {/* Main Content - Detail and AI Editor */}
      <div className="lg:col-span-2 space-y-6">
        {selectedRequest ? (
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden">
            {/* Header / Client Info */}
            <div className="p-6 border-b border-zinc-800 bg-zinc-800/30">
              <div className="flex flex-wrap justify-between items-start gap-4 mb-4">
                <div>
                  <h2 className="text-xl font-bold text-white">{selectedRequest.name}</h2>
                  <p className="text-sm text-zinc-400">{selectedRequest.email} | {selectedRequest.phone}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-500/50 text-black text-xs font-bold rounded-lg transition-colors flex items-center gap-2"
                  >
                    {isGenerating ? "Generujem..." : selectedRequest.ai_generated_plan ? "Regenerovať" : "Vygenerovať návrh"}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div>
                  <div className="text-zinc-500 uppercase font-bold text-[10px] mb-1">Cieľ</div>
                  <div className="text-emerald-500 font-bold">{selectedRequest.goal}</div>
                </div>
                <div>
                  <div className="text-zinc-500 uppercase font-bold text-[10px] mb-1">Parametre</div>
                  <div className="text-zinc-300">
                    {selectedRequest.gender === "male" ? "Muž" : "Žena"}, {selectedRequest.age} r., {selectedRequest.height_cm} cm
                  </div>
                </div>
                <div>
                  <div className="text-zinc-500 uppercase font-bold text-[10px] mb-1">Alergény</div>
                  <div className="text-red-400">{selectedRequest.allergens || "Žiadne"}</div>
                </div>
                <div>
                  <div className="text-zinc-500 uppercase font-bold text-[10px] mb-1">Obľúbené jedlá</div>
                  <div className="text-zinc-300">{selectedRequest.favorite_foods || "Žiadne"}</div>
                </div>
              </div>
            </div>

            {/* AI Settings and Editor */}
            <div className="p-6 space-y-6">
              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400 text-sm">
                  {error}
                </div>
              )}

              {/* Trainer Notes for AI */}
              <div>
                <label className="block text-xs font-bold uppercase text-zinc-500 mb-2">
                  Poznámky pre AI (nepovinné)
                </label>
                <textarea
                  value={trainerNotes}
                  onChange={(e) => setTrainerNotes(e.target.value)}
                  placeholder="Napr. 'Zameraj sa na vysoký obsah bielkovín', 'Vynechaj ryžu', 'Navrhni 4 jedlá denne'..."
                  className="w-full h-20 bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-sm text-zinc-300 focus:border-emerald-500 outline-none transition-colors resize-none"
                />
              </div>

              {/* Editable Draft */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-bold uppercase text-zinc-500">
                    Draft jedálnička (editovateľný)
                  </label>
                  {selectedRequest.ai_generated_at && (
                    <span className="text-[10px] text-zinc-600">
                      Vygenerované: {new Date(selectedRequest.ai_generated_at).toLocaleString("sk-SK")}
                    </span>
                  )}
                </div>
                <textarea
                  value={editedPlan}
                  onChange={(e) => setEditedPlan(e.target.value)}
                  placeholder="Tu sa zobrazí vygenerovaný jedálniček, ktorý môžete upraviť..."
                  className="w-full h-96 bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-sm text-zinc-300 font-mono focus:border-emerald-500 outline-none transition-colors resize-y"
                />
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleSaveDraft}
                  disabled={isSaving || !editedPlan}
                  className="px-6 py-3 bg-white hover:bg-zinc-200 disabled:bg-zinc-700 text-black font-bold rounded-xl transition-all flex items-center gap-2"
                >
                  {isSaving ? "Ukladám..." : "Uložiť draft"}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-[400px] flex flex-col items-center justify-center text-center bg-zinc-900/30 border border-zinc-800 border-dashed rounded-2xl p-8">
            <div className="w-16 h-16 bg-zinc-800/50 rounded-full flex items-center justify-center mb-4">
              <span className="text-2xl text-zinc-500">✨</span>
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Vyberte objednávku</h3>
            <p className="text-sm text-zinc-500 max-w-xs">
              Vyberte klienta zo zoznamu vľavo pre vygenerovanie alebo úpravu AI draftu jedálnička.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
