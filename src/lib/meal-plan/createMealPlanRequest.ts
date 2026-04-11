"use server";

import { createClient } from "@supabase/supabase-js";
import * as z from "zod";
import { mealPlanRequestFormSchemaRaw } from "@/lib/meal-plan/mealPlanSchema";
import { sendEmail, getEmailTemplateHtml } from "@/lib/email/emailService";

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

    // ODOVZDANIE EMAILY PO VYTVORENÍ POŽIADAVKY (Meal Plan Reservation)
    try {
      // 1. Email klientovi
      const { data: trainerData } = await supabase
        .from("trainers")
        .select("full_name, email, profile_id, price_meal_plan_cents")
        .eq("id", trainer_id)
        .maybeSingle();
      
      const trainerName = trainerData?.full_name || "Váš tréner";
      const priceStr = trainerData?.price_meal_plan_cents 
        ? `${(trainerData.price_meal_plan_cents / 100).toFixed(2)} €` 
        : "neuvedená";

      const clientHtml = getEmailTemplateHtml({
        title: "Nová požiadavka - Jedálniček na mieru",
        clientName: form.name,
        serviceName: "Jedálniček na mieru",
        trainerName: trainerName,
        price: priceStr,
        content: `Vaša požiadavka na jedálniček na mieru bola prijatá. Pre začatie prác je potrebné dokončiť platbu v ďalšom kroku.`
      });

      await sendEmail({
        to: form.email,
        subject: "Nová požiadavka na jedálniček - Fitbase",
        html: clientHtml
      });

      // 2. Email trénerovi (Robustné načítanie)
      console.log("[TRAINER EMAIL] meal plan request created");
      console.log("[TRAINER EMAIL] trainer_id:", trainer_id);

      const trainerEmailFromTrainer = trainerData?.email;
      let trainerEmailFromProfile: string | null = null;

      if (!trainerEmailFromTrainer && trainerData?.profile_id) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("email")
          .eq("id", trainerData.profile_id)
          .maybeSingle();
        trainerEmailFromProfile = profileData?.email || null;
      }

      const finalTrainerEmail = trainerEmailFromTrainer || trainerEmailFromProfile;

      console.log("[TRAINER EMAIL] trainers.email:", trainerEmailFromTrainer);
      console.log("[TRAINER EMAIL] fallback profiles.email:", trainerEmailFromProfile);
      console.log("[TRAINER EMAIL] final recipient:", finalTrainerEmail);

      if (finalTrainerEmail) {
        console.log("[TRAINER EMAIL] about to send");
        const trainerHtml = getEmailTemplateHtml({
          title: "NOVÁ POŽIADAVKA - Jedálniček",
          clientName: "tréner",
          serviceName: "Jedálniček na mieru",
          trainerName: trainerName,
          price: priceStr,
          content: `Klient <strong>${form.name}</strong> práve vytvoril požiadavku na jedálniček na mieru. Požiadavka čaká na zaplatenie.`
        });

        const result = await sendEmail({
          to: finalTrainerEmail,
          subject: "🔥 NOVÁ REZERVÁCIA – Skontroluj Fitbase",
          html: trainerHtml
        });
        console.log("[TRAINER EMAIL] send success", result);
      } else {
        console.warn("[TRAINER EMAIL] missing trainer email, skipping send");
      }
    } catch (emailErr: unknown) {
      console.error("[TRAINER EMAIL] send failed", emailErr);
    }

    return { status: "success", message: "Požiadavka bola odoslaná." };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Nastala neočakávaná chyba.";
    return { status: "error", message };
  }
}
