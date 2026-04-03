"use server";

import { createClient } from "@supabase/supabase-js";
import * as z from "zod";
import { mealPlanRequestFormSchemaRaw } from "@/lib/meal-plan/mealPlanSchema";

const createMealPlanRequestSchema = mealPlanRequestFormSchemaRaw.extend({
  trainer_id: z.string().uuid(),
  access_token: z.string().min(1),
});

type CreateMealPlanRequestState =
  | { status: "success"; message: string }
  | { status: "error"; message: string };

export async function createMealPlanRequestAction(
  input: z.infer<typeof createMealPlanRequestSchema>
): Promise<CreateMealPlanRequestState> {
  const parsed = createMealPlanRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: "Neplatné údaje." };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return { status: "error", message: "Chýba konfigurácia servera." };
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const { trainer_id, access_token, ...form } = parsed.data;

    const userResult = await supabase.auth.getUser(access_token);
    const authUser = userResult.data.user;
    if (!authUser) {
      return { status: "error", message: "Neautorizované." };
    }

    const profileResult = await supabase.from("profiles").select("id, full_name").eq("id", authUser.id).maybeSingle();
    if (profileResult.error) {
      return { status: "error", message: "Nepodarilo sa načítať profil." };
    }

    if (!profileResult.data) {
      const insertProfile = await supabase
        .from("profiles")
        .insert({ id: authUser.id, full_name: form.name })
        .select("id")
        .maybeSingle();
      if (insertProfile.error) {
        return { status: "error", message: "Nepodarilo sa vytvoriť profil." };
      }
    }

    const insertRes = await supabase
      .from("meal_plan_requests")
      .insert({
        trainer_id,
        client_profile_id: authUser.id,
        name: form.name,
        email: form.email,
        phone: form.phone,
        goal: form.goal,
        height_cm: form.height_cm,
        age: form.age,
        gender: form.gender,
        allergens: form.allergens || null,
        favorite_foods: form.favorite_foods || null,
        status: "confirmed",
      })
      .select("id")
      .maybeSingle<{ id: string }>();

    if (insertRes.error) {
      return { status: "error", message: insertRes.error.message };
    }

    return { status: "success", message: "Požiadavka bola odoslaná." };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Nastala neočakávaná chyba.";
    return { status: "error", message };
  }
}
