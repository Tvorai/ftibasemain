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
  format?: "structured" | "text";
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
    
    // If it's explicitly text format or we have raw_text
    if (plan.format === "text" || plan.raw_text) {
      return plan.raw_text || "";
    }

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

      let result;
      const responseText = await response.text();
      
      try {
        result = JSON.parse(responseText);
      } catch (e) {
        console.error("Failed to parse AI response as JSON:", responseText);
        throw new Error("AI generovanie zlyhalo (neplatná odpoveď zo servera). Skúste to znova.");
      }

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
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 px-2">Požiadavky</h3>
        <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
          {requests.map((req) => (
            <button
              key={req.id}
              onClick={() => setSelectedRequestId(req.id)}
              className={`w-full text-left p-4 rounded-2xl border transition-all ${
                selectedRequestId === req.id
                  ? "bg-emerald-500/10 border-emerald-500/50 ring-1 ring-emerald-500/20"
                  : "bg-zinc-900/30 border-zinc-800/50 hover:border-emerald-500/30"
              }`}
            >
              <div className="font-bold text-white mb-1">{req.name}</div>
              <div className="text-[10px] text-emerald-500 font-bold uppercase tracking-wider mb-2">{req.goal}</div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                  {new Date(req.created_at).toLocaleDateString("sk-SK")}
                </span>
                <span className={`text-[10px] font-bold uppercase tracking-widest ${
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
          <div className="bg-zinc-900/30 border border-emerald-500/20 rounded-[30px] overflow-hidden backdrop-blur-sm">
            {/* Header / Client Info */}
            <div className="p-6 md:p-8 border-b border-emerald-500/10 bg-zinc-800/20">
              <div className="flex flex-wrap justify-between items-start gap-4 mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-white">{selectedRequest.name}</h2>
                  <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest mt-1">{selectedRequest.email} • {selectedRequest.phone}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-500/50 text-black text-[10px] font-bold uppercase tracking-widest rounded-full transition-all shadow-lg shadow-emerald-500/20"
                  >
                    {isGenerating ? "Generujem..." : selectedRequest.ai_generated_plan ? "Regenerovať" : "Vygenerovať návrh"}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                <div>
                  <div className="text-zinc-500 uppercase font-bold text-[10px] tracking-widest mb-1.5">Cieľ</div>
                  <div className="text-emerald-400 font-bold text-sm">{selectedRequest.goal}</div>
                </div>
                <div>
                  <div className="text-zinc-500 uppercase font-bold text-[10px] tracking-widest mb-1.5">Parametre</div>
                  <div className="text-zinc-300 text-sm font-medium">
                    {selectedRequest.gender === "male" ? "Muž" : "Žena"}, {selectedRequest.age} r., {selectedRequest.height_cm} cm
                  </div>
                </div>
                <div>
                  <div className="text-zinc-500 uppercase font-bold text-[10px] tracking-widest mb-1.5">Alergény</div>
                  <div className="text-red-400/80 text-sm font-bold">{selectedRequest.allergens || "Žiadne"}</div>
                </div>
                <div>
                  <div className="text-zinc-500 uppercase font-bold text-[10px] tracking-widest mb-1.5">Obľúbené jedlá</div>
                  <div className="text-zinc-300 text-sm font-medium">{selectedRequest.favorite_foods || "Žiadne"}</div>
                </div>
              </div>
            </div>

            {/* AI Settings and Editor */}
            <div className="p-6 md:p-8 space-y-8">
              {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400 text-xs font-bold uppercase tracking-widest">
                  {error}
                </div>
              )}

              {/* Trainer Notes for AI */}
              <div className="space-y-3">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-2">
                  Poznámky pre AI (nepovinné)
                </label>
                <textarea
                  value={trainerNotes}
                  onChange={(e) => setTrainerNotes(e.target.value)}
                  placeholder="Napr. 'Zameraj sa na vysoký obsah bielkovín', 'Vynechaj ryžu', 'Navrhni 4 jedlá denne'..."
                  className="w-full h-24 bg-zinc-950/50 border border-emerald-500/20 rounded-2xl p-4 text-sm text-zinc-300 focus:border-emerald-500 outline-none transition-all resize-none placeholder:text-zinc-700"
                />
              </div>

              {/* Editable Draft */}
              <div className="space-y-3">
                <div className="flex justify-between items-center px-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                    Draft jedálnička (editovateľný)
                  </label>
                  {selectedRequest.ai_generated_at && (
                    <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">
                      Vygenerované: {new Date(selectedRequest.ai_generated_at).toLocaleString("sk-SK")}
                    </span>
                  )}
                </div>
                <textarea
                  value={editedPlan}
                  onChange={(e) => setEditedPlan(e.target.value)}
                  placeholder="Tu sa zobrazí vygenerovaný jedálniček, ktorý môžete upraviť..."
                  className="w-full h-[500px] bg-zinc-950/50 border border-emerald-500/20 rounded-2xl p-5 text-sm text-zinc-300 font-mono focus:border-emerald-500 outline-none transition-all resize-y custom-scrollbar placeholder:text-zinc-700"
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={handleSaveDraft}
                  disabled={isSaving || !editedPlan}
                  className="px-10 py-3.5 bg-white hover:bg-zinc-200 disabled:bg-zinc-800 disabled:text-zinc-500 text-black text-[10px] font-bold uppercase tracking-widest rounded-full transition-all shadow-xl"
                >
                  {isSaving ? "Ukladám..." : "Uložiť draft"}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-[500px] flex flex-col items-center justify-center text-center bg-zinc-900/20 border border-emerald-500/20 border-dashed rounded-[30px] p-8 backdrop-blur-sm">
            <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mb-6">
              <span className="text-3xl">✨</span>
            </div>
            <h3 className="text-xl font-bold text-white mb-3">Vyberte objednávku</h3>
            <p className="text-sm text-zinc-500 max-w-xs font-medium">
              Vyberte klienta zo zoznamu vľavo pre vygenerovanie alebo úpravu AI draftu jedálnička.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
