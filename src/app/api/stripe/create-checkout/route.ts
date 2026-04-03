import { NextResponse } from "next/server";
import Stripe from "stripe";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const bodySchema = z.object({
  trainer_id: z.string().uuid(),
  starts_at: z.string().datetime().optional(),
  ends_at: z.string().datetime().optional(),
  service_type: z.enum(["personal", "online", "meal_plan"]),
  client_name: z.string().min(2),
  client_email: z.string().email(),
  client_phone: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  access_token: z.string().min(1),
  // Dodatočné polia pre meal plan ak sú potrebné
  goal: z.string().optional(),
  height_cm: z.number().optional(),
  age: z.number().optional(),
  gender: z.string().optional(),
  allergens: z.string().optional(),
  favorite_foods: z.string().optional(),
  discount_code: z.string().optional(),
  validate_only: z.boolean().optional(),
});

type TrainerRow = {
  id: string;
  stripe_account_id: string | null;
  price_personal_cents: number | null;
  price_online_cents: number | null;
  price_meal_plan_cents: number | null;
};

function getDateTimePartsInBratislava(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-CA", { timeZone: "Europe/Bratislava" });
  const time = d.toLocaleTimeString("en-GB", { timeZone: "Europe/Bratislava", hour: "2-digit", minute: "2-digit", hour12: false });
  return { date, time };
}

function getServiceLabel(serviceType: "personal" | "online" | "meal_plan"): string {
  if (serviceType === "online") return "Online konzultácia";
  if (serviceType === "meal_plan") return "Jedálniček na mieru";
  return "Osobný tréning";
}

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ message: "Server nie je správne nakonfigurovaný." }, { status: 500 });
  }
  if (!stripeSecretKey) {
    return NextResponse.json({ message: "Chýba STRIPE_SECRET_KEY." }, { status: 500 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ message: "Neplatné dáta." }, { status: 400 });
  }

  const input = parsed.data;

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const userRes = await supabase.auth.getUser(input.access_token);
  const authUser = userRes.data.user;
  if (!authUser) {
    return NextResponse.json({ message: "Neautorizované." }, { status: 401 });
  }

  const trainerRes = await supabase
    .from("trainers")
    .select("id, stripe_account_id, price_personal_cents, price_online_cents, price_meal_plan_cents")
    .eq("id", input.trainer_id)
    .maybeSingle<TrainerRow>();

  if (trainerRes.error) {
    return NextResponse.json({ message: trainerRes.error.message }, { status: 500 });
  }
  if (!trainerRes.data) {
    return NextResponse.json({ message: "Tréner neexistuje." }, { status: 404 });
  }

  let priceCents = 0;
  if (input.service_type === "online") {
    priceCents = trainerRes.data.price_online_cents || 0;
  } else if (input.service_type === "meal_plan") {
    priceCents = trainerRes.data.price_meal_plan_cents || 0;
  } else {
    priceCents = trainerRes.data.price_personal_cents || 0;
  }

  const originalPriceCents = priceCents;
  let finalPriceCents = priceCents;
  let discountAmountCents = 0;
  let validatedDiscountCode: string | null = null;
  let isValid = false;
  let discountMessage = "";

  if (input.discount_code) {
    const { data: discount, error: discountErr } = await supabase
      .from("trainer_discounts")
      .select("*")
      .eq("trainer_id", input.trainer_id)
      .eq("code", input.discount_code.toUpperCase())
      .eq("service_type", input.service_type)
      .eq("is_active", true)
      .maybeSingle();

    if (discountErr) {
      console.error("Discount lookup error:", discountErr);
    }

    if (discount) {
      const isUsageValid = !discount.max_uses || discount.used_count < discount.max_uses;
      if (isUsageValid) {
        // Použijeme stĺpce 'type' a 'value' podľa reálneho stavu v DB
        const dType = discount.type;
        const dValue = discount.value;

        if (dType === "percent") {
          discountAmountCents = Math.round((priceCents * dValue) / 100);
        } else if (dType === "fixed") {
          discountAmountCents = dValue * 100;
        }
        
        finalPriceCents = Math.max(0, priceCents - discountAmountCents);
        validatedDiscountCode = discount.code;
        isValid = true;
      } else {
        discountMessage = "Kód už dosiahol maximálny počet použití.";
      }
    } else {
      discountMessage = "Neplatný alebo neaktívny zľavový kód pre túto službu.";
    }
  }

  if (input.validate_only) {
    return NextResponse.json({
      is_valid: isValid,
      discount_code: validatedDiscountCode,
      discount_amount_cents: discountAmountCents,
      final_price_cents: finalPriceCents,
      original_price_cents: originalPriceCents,
      message: discountMessage
    });
  }

  if (!trainerRes.data.stripe_account_id) {
     return NextResponse.json({ message: "Tréner nemá prepojený Stripe účet." }, { status: 400 });
   }

   if (typeof finalPriceCents !== "number" || !Number.isInteger(finalPriceCents) || (finalPriceCents <= 0 && originalPriceCents > 0)) {
     // Ak je cena 0 po zľave, je to OK, ale pôvodná cena musí byť validná
     if (originalPriceCents <= 0) {
       return NextResponse.json({ message: "Tréner nemá nastavenú cenu pre túto službu." }, { status: 400 });
     }
   }

  if (input.service_type !== "meal_plan") {
    if (!input.starts_at || !input.ends_at) {
      return NextResponse.json({ message: "Chýba časový rozsah pre rezerváciu." }, { status: 400 });
    }
    const overlapRes = await supabase
      .from("bookings")
      .select("id")
      .eq("trainer_id", input.trainer_id)
      .eq("service_type", input.service_type)
      .in("booking_status", ["confirmed", "pending_payment"])
      .lt("starts_at", input.ends_at)
      .gt("ends_at", input.starts_at)
      .limit(1);
    if (!overlapRes.error && Array.isArray(overlapRes.data) && overlapRes.data.length > 0) {
      return NextResponse.json({ message: "Tento termín už nie je dostupný." }, { status: 409 });
    }
  }

  const { date, time } = input.starts_at ? getDateTimePartsInBratislava(input.starts_at) : { date: "", time: "" };
  const stripe = new Stripe(stripeSecretKey);

  const metadata: Record<string, string> = {
    trainer_id: input.trainer_id,
    user_id: authUser.id,
    type: input.service_type,
    client_name: input.client_name,
    client_email: input.client_email,
    client_phone: input.client_phone || "",
    note: input.note || "",
    price_cents: String(finalPriceCents),
    original_price_cents: String(originalPriceCents),
    discount_amount_cents: String(discountAmountCents),
    discount_code: validatedDiscountCode || "",
    currency: "eur",
  };

  if (input.starts_at) metadata.starts_at = input.starts_at;
  if (input.ends_at) metadata.ends_at = input.ends_at;
  if (date) metadata.date = date;
  if (time) metadata.time = time;

  // Meal plan specific metadata
  if (input.service_type === "meal_plan") {
    if (input.goal) metadata.goal = input.goal;
    if (input.height_cm) metadata.height_cm = String(input.height_cm);
    if (input.age) metadata.age = String(input.age);
    if (input.gender) metadata.gender = input.gender;
    if (input.allergens) metadata.allergens = input.allergens;
    if (input.favorite_foods) metadata.favorite_foods = input.favorite_foods;
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "eur",
          unit_amount: finalPriceCents,
          product_data: { name: getServiceLabel(input.service_type) },
        },
      },
    ],
    success_url: `https://fitbasemain.vercel.app/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: "https://fitbasemain.vercel.app/cancel",
    customer_email: input.client_email,
    metadata,
    payment_intent_data: {
      transfer_data: { destination: trainerRes.data.stripe_account_id },
      metadata: {
        trainer_id: input.trainer_id,
        user_id: authUser.id,
        type: input.service_type,
      },
    },
  });

  if (!session.url) {
    return NextResponse.json({ message: "Stripe session.url nie je dostupné." }, { status: 500 });
  }

  return NextResponse.json({ url: session.url });
}
