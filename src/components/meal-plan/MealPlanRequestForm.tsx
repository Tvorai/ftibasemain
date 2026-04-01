"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createClient } from "@supabase/supabase-js";
import { featureFlags, supabaseAnonKey, supabaseUrl } from "@/lib/config";
import BookingAuthModal from "@/components/booking/BookingAuthModal";
import { mealPlanRequestFormSchema, mealPlanRequestFormSchemaRaw, MealPlanRequestFormValues } from "@/lib/meal-plan/mealPlanSchema";
import { createMealPlanRequestAction } from "@/lib/meal-plan/createMealPlanRequest";

const PENDING_KEY = "fitbase_pending_meal_plan_request";

type Props = {
  trainerId: string;
};

type PendingMealPlanPayload = {
  trainer_id: string;
  form: MealPlanRequestFormValues;
  createdAt: number;
};

type SubmitState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parsePending(raw: string): PendingMealPlanPayload | null {
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(parsed)) return null;
  const trainerId = parsed.trainer_id;
  const form = parsed.form;
  const createdAt = parsed.createdAt;
  if (typeof trainerId !== "string") return null;
  if (!isRecord(form)) return null;
  if (typeof createdAt !== "number") return null;

  const safe = mealPlanRequestFormSchema.safeParse(form);
  if (!safe.success) return null;
  return { trainer_id: trainerId, form: safe.data, createdAt };
}

export default function MealPlanRequestForm({ trainerId }: Props) {
  const supabase = useMemo(() => {
    return featureFlags.supabaseEnabled ? createClient(supabaseUrl, supabaseAnonKey) : null;
  }, []);

  const [authOpen, setAuthOpen] = useState(false);
  const [submitState, setSubmitState] = useState<SubmitState>({ status: "idle" });
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [accountName, setAccountName] = useState<string | null>(null);
  const [accountPhone, setAccountPhone] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);

  const form = useForm<MealPlanRequestFormValues>({
    resolver: zodResolver<MealPlanRequestFormValues, unknown, MealPlanRequestFormValues>(mealPlanRequestFormSchemaRaw),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      goal: "",
      height_cm: 170,
      age: 25,
      gender: "male",
      allergens: "",
      favorite_foods: "",
    },
    mode: "onSubmit",
  });

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(async ({ data }) => {
      const user = data.session?.user;
      if (!user) {
        setAccountEmail(null);
        setAccountName(null);
        setAccountPhone(null);
        return;
      }
      setAccountEmail(typeof user.email === "string" ? user.email : null);
      try {
        const res = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle<{ full_name: string | null }>();
        const full = res.data?.full_name;
        setAccountName(full && full.trim() ? full : null);
      } catch {
        setAccountName(null);
      }
    });
  }, [supabase]);

  const finalize = async (pending: PendingMealPlanPayload, accessToken: string) => {
    setSubmitState({ status: "loading" });
    const res = await createMealPlanRequestAction({
      trainer_id: pending.trainer_id,
      access_token: accessToken,
      ...pending.form,
    });

    if (res.status !== "success") {
      setSubmitState({ status: "error", message: res.message });
      return;
    }

    sessionStorage.removeItem(PENDING_KEY);
    setSubmitState({ status: "success", message: res.message });
  };

  useEffect(() => {
    if (!supabase) return;
    const raw = sessionStorage.getItem(PENDING_KEY);
    if (!raw) return;
    const pending = parsePending(raw);
    if (!pending) {
      sessionStorage.removeItem(PENDING_KEY);
      return;
    }
    if (pending.trainer_id !== trainerId) return;
    supabase.auth.getSession().then(({ data }) => {
      const token = data.session?.access_token;
      if (!token) return;
      void finalize(pending, token);
    });
  }, [supabase, trainerId]);

  const onSubmit = async (values: MealPlanRequestFormValues) => {
    if (!supabase) {
      setSubmitState({ status: "error", message: "Auth nie je dostupný." });
      return;
    }

    setSubmitState({ status: "idle" });

    const resolvedName = accountEmail && !editMode ? (accountName || values.name || "Klient") : values.name;
    const resolvedEmail = accountEmail && !editMode ? accountEmail : values.email;
    const resolvedPhone = accountEmail && !editMode ? (accountPhone || "") : (values.phone || "");

    const pending: PendingMealPlanPayload = {
      trainer_id: trainerId,
      form: { ...values, name: resolvedName, email: resolvedEmail, phone: resolvedPhone },
      createdAt: Date.now(),
    };

    try {
      const sessionResult = await supabase.auth.getSession();
      const token = sessionResult.data.session?.access_token;

      if (!token) {
        sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending));
        setAuthOpen(true);
        return;
      }

      await finalize(pending, token);
    } catch {
      setSubmitState({ status: "error", message: "Nastala neočakávaná chyba pri komunikácii so serverom." });
    }
  };

  const disabled = submitState.status === "loading";

  return (
    <div className="space-y-4">
      {submitState.status === "success" ? (
        <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-4 text-sm text-emerald-200">
          {submitState.message}
        </div>
      ) : (
        <>
          {submitState.status === "error" && (
            <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-4 text-sm text-red-200">
              {submitState.message}
            </div>
          )}

          <form className="space-y-3" onSubmit={form.handleSubmit(onSubmit)}>
            {accountEmail ? (
              <>
                {!editMode ? (
                  <div className="flex items-center justify-between rounded-xl border border-zinc-700 bg-zinc-900/40 p-3">
                    <div className="text-xs text-zinc-400">
                      <span className="font-bold uppercase tracking-wider">Ste prihlásený pod účtom: </span>
                      <span className="text-white">{accountEmail}</span>
                    </div>
                    <button
                      type="button"
                      className="px-3 py-1 rounded-lg border border-white/10 text-zinc-300 hover:bg-white/5 text-[10px] uppercase font-bold tracking-widest"
                      onClick={() => {
                        setEditMode(true);
                        setTimeout(() => {
                          form.reset({
                            ...form.getValues(),
                            name: accountName || "",
                            email: accountEmail || "",
                            phone: accountPhone || "",
                          });
                        }, 0);
                      }}
                    >
                      Upraviť
                    </button>
                  </div>
                ) : (
                  <>
                    <input
                      type="text"
                      placeholder="Meno"
                      disabled={disabled}
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
                      {...form.register("name")}
                    />
                    {form.formState.errors.name?.message && <div className="text-xs text-red-300">{form.formState.errors.name.message}</div>}

                    <input
                      type="email"
                      placeholder="Email"
                      disabled={disabled}
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
                      {...form.register("email")}
                    />
                    {form.formState.errors.email?.message && <div className="text-xs text-red-300">{form.formState.errors.email.message}</div>}

                    <input
                      type="tel"
                      placeholder="Tel. číslo"
                      disabled={disabled}
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
                      {...form.register("phone")}
                    />
                    {form.formState.errors.phone?.message && <div className="text-xs text-red-300">{form.formState.errors.phone.message}</div>}
                    <div className="flex justify-end">
                      <button
                        type="button"
                        className="px-3 py-1 rounded-lg border border-white/10 text-zinc-300 hover:bg-white/5 text-[10px] uppercase font-bold tracking-widest"
                        onClick={() => {
                          setEditMode(false);
                          form.reset({
                            ...form.getValues(),
                            name: "",
                            email: "",
                            phone: "",
                          });
                        }}
                      >
                        Zavrieť
                      </button>
                    </div>
                  </>
                )}
              </>
            ) : (
              <>
                <input
                  type="text"
                  placeholder="Meno"
                  disabled={disabled}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
                  {...form.register("name")}
                />
                {form.formState.errors.name?.message && <div className="text-xs text-red-300">{form.formState.errors.name.message}</div>}

                <input
                  type="email"
                  placeholder="Email"
                  disabled={disabled}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
                  {...form.register("email")}
                />
                {form.formState.errors.email?.message && <div className="text-xs text-red-300">{form.formState.errors.email.message}</div>}

                <input
                  type="tel"
                  placeholder="Tel. číslo"
                  disabled={disabled}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
                  {...form.register("phone")}
                />
                {form.formState.errors.phone?.message && <div className="text-xs text-red-300">{form.formState.errors.phone.message}</div>}
              </>
            )}

            <textarea
              placeholder="Cieľ"
              disabled={disabled}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 min-h-[90px]"
              {...form.register("goal")}
            />
            {form.formState.errors.goal?.message && <div className="text-xs text-red-300">{form.formState.errors.goal.message}</div>}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="Výška (cm)"
                  disabled={disabled}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
                  {...form.register("height_cm", { valueAsNumber: true })}
                />
                {form.formState.errors.height_cm?.message && (
                  <div className="mt-1 text-xs text-red-300">{form.formState.errors.height_cm.message}</div>
                )}
              </div>
              <div>
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="Vek"
                  disabled={disabled}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
                  {...form.register("age", { valueAsNumber: true })}
                />
                {form.formState.errors.age?.message && (
                  <div className="mt-1 text-xs text-red-300">{form.formState.errors.age.message}</div>
                )}
              </div>
            </div>

            <select
              disabled={disabled}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
              {...form.register("gender")}
            >
              <option value="male">Muž</option>
              <option value="female">Žena</option>
              <option value="other">Iné</option>
            </select>
            {form.formState.errors.gender?.message && <div className="text-xs text-red-300">{form.formState.errors.gender.message}</div>}

            <input
              type="text"
              placeholder="Alergény (voliteľné)"
              disabled={disabled}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
              {...form.register("allergens")}
            />

            <input
              type="text"
              placeholder="Obľúbené potraviny (voliteľné)"
              disabled={disabled}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
              {...form.register("favorite_foods")}
            />

            <button
              type="submit"
              disabled={disabled}
              className="w-full rounded-[16px] bg-emerald-500 px-4 py-3 text-sm font-bold text-black hover:bg-emerald-400 transition-colors disabled:opacity-50 uppercase tracking-wide"
            >
              {submitState.status === "loading" ? "Odosielam..." : "Odoslať"}
            </button>
          </form>
        </>
      )}

      <BookingAuthModal
        isOpen={authOpen}
        onClose={() => setAuthOpen(false)}
        onAuthed={async () => {
          if (!supabase) return;
          const raw = sessionStorage.getItem(PENDING_KEY);
          if (!raw) return;
          const pending = parsePending(raw);
          if (!pending) {
            sessionStorage.removeItem(PENDING_KEY);
            return;
          }
          const sessionRes = await supabase.auth.getSession();
          const token = sessionRes.data.session?.access_token;
          if (!token) return;
          await finalize(pending, token);
          setAuthOpen(false);
        }}
        initialEmail={form.getValues("email")}
      />
    </div>
  );
}
