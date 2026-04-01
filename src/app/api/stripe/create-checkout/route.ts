import { NextResponse } from "next/server";
import Stripe from "stripe";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const bodySchema = z.object({
  trainer_id: z.string().uuid(),
  starts_at: z.string().datetime(),
  ends_at: z.string().datetime(),
  service_type: z.enum(["personal", "online"]),
  client_name: z.string().min(2),
  client_email: z.string().email(),
  client_phone: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  access_token: z.string().min(1),
});

type TrainerRow = {
  id: string;
  stripe_account_id: string | null;
  price_personal_cents: number | null;
  price_online_cents: number | null;
};

function getDateTimePartsInBratislava(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-CA", { timeZone: "Europe/Bratislava" });
  const time = d.toLocaleTimeString("en-GB", { timeZone: "Europe/Bratislava", hour: "2-digit", minute: "2-digit", hour12: false });
  return { date, time };
}

function getServiceLabel(serviceType: "personal" | "online"): string {
  return serviceType === "online" ? "Online konzultácia" : "Osobný tréning";
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
    .select("id, stripe_account_id, price_personal_cents, price_online_cents")
    .eq("id", input.trainer_id)
    .maybeSingle<TrainerRow>();

  if (trainerRes.error) {
    return NextResponse.json({ message: trainerRes.error.message }, { status: 500 });
  }
  if (!trainerRes.data) {
    return NextResponse.json({ message: "Tréner neexistuje." }, { status: 404 });
  }
  if (!trainerRes.data.stripe_account_id) {
    return NextResponse.json({ message: "Tréner nemá prepojený Stripe účet." }, { status: 400 });
  }

  const priceCents =
    input.service_type === "online" ? trainerRes.data.price_online_cents : trainerRes.data.price_personal_cents;
  if (typeof priceCents !== "number" || !Number.isInteger(priceCents) || priceCents <= 0) {
    return NextResponse.json({ message: "Tréner nemá nastavenú cenu pre túto službu." }, { status: 400 });
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

  const { date, time } = getDateTimePartsInBratislava(input.starts_at);
  const stripe = new Stripe(stripeSecretKey);

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "eur",
          unit_amount: priceCents,
          product_data: { name: getServiceLabel(input.service_type) },
        },
      },
    ],
    success_url: `https://fitbasemain.vercel.app/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: "https://fitbasemain.vercel.app/cancel",
    customer_email: input.client_email,
    metadata: {
      trainer_id: input.trainer_id,
      user_id: authUser.id,
      date,
      time,
      type: input.service_type,
      starts_at: input.starts_at,
      ends_at: input.ends_at,
      client_name: input.client_name,
      client_email: input.client_email,
      client_phone: input.client_phone || "",
      note: input.note || "",
      price_cents: String(priceCents),
      currency: "eur",
    },
    payment_intent_data: {
      transfer_data: { destination: trainerRes.data.stripe_account_id },
      metadata: {
        trainer_id: input.trainer_id,
        user_id: authUser.id,
        date,
        time,
        type: input.service_type,
      },
    },
  });

  if (!session.url) {
    return NextResponse.json({ message: "Stripe session.url nie je dostupné." }, { status: 500 });
  }

  return NextResponse.json({ url: session.url });
}
