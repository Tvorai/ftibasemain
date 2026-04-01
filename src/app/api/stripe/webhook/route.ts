import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getStringField(obj: Record<string, unknown>, key: string): string | null {
  const value = obj[key];
  return typeof value === "string" && value.trim() ? value : null;
}

export async function POST(request: Request) {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!stripeSecretKey || !webhookSecret) {
    return NextResponse.json({ message: "Chýba Stripe konfigurácia." }, { status: 500 });
  }
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ message: "Chýba Supabase konfigurácia." }, { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ message: "Chýba stripe-signature." }, { status: 400 });
  }

  const rawBody = Buffer.from(await request.arrayBuffer());
  const stripe = new Stripe(stripeSecretKey);

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    return NextResponse.json({ message }, { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const meta: Record<string, unknown> = isRecord(session.metadata) ? session.metadata : {};
  const trainerId = getStringField(meta, "trainer_id");
  const userId = getStringField(meta, "user_id");
  const startsAt = getStringField(meta, "starts_at");
  const endsAt = getStringField(meta, "ends_at");
  const type = getStringField(meta, "type");

  if (!trainerId || !userId || !startsAt || !endsAt || !type) {
    return NextResponse.json({ message: "Chýbajú povinné metadata polia." }, { status: 400 });
  }
  if (type !== "personal" && type !== "online") {
    return NextResponse.json({ message: "Neplatný type v metadata." }, { status: 400 });
  }

  const stripePaymentIntentId =
    typeof session.payment_intent === "string" ? session.payment_intent : null;

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const existingRes = await supabase
    .from("bookings")
    .select("id")
    .eq("stripe_checkout_session_id", session.id)
    .maybeSingle<{ id: string }>();
  if (!existingRes.error && existingRes.data?.id) {
    return NextResponse.json({ received: true, booking_id: existingRes.data.id, trainer_id: trainerId, type });
  }

  const clientName = getStringField(meta, "client_name");
  const clientEmailFromMeta = getStringField(meta, "client_email");
  const clientPhone = getStringField(meta, "client_phone");
  const note = getStringField(meta, "note");

  const sessionEmail =
    session.customer_details && typeof session.customer_details.email === "string"
      ? session.customer_details.email
      : null;
  const clientEmail = clientEmailFromMeta || sessionEmail || null;

  const currency = typeof session.currency === "string" ? session.currency.toLowerCase() : "eur";
  const amountTotal = typeof session.amount_total === "number" ? session.amount_total : null;
  const priceCentsFromMetaRaw = getStringField(meta, "price_cents");
  const priceCentsFromMeta = priceCentsFromMetaRaw ? Number(priceCentsFromMetaRaw) : null;
  const priceCents =
    typeof amountTotal === "number" && Number.isInteger(amountTotal) && amountTotal > 0
      ? amountTotal
      : typeof priceCentsFromMeta === "number" && Number.isInteger(priceCentsFromMeta) && priceCentsFromMeta > 0
        ? priceCentsFromMeta
        : null;

  const insertPayload: Record<string, unknown> = {
    trainer_id: trainerId,
    client_profile_id: userId,
    starts_at: startsAt,
    ends_at: endsAt,
    booking_status: "confirmed",
    payment_status: "paid",
    stripe_checkout_session_id: session.id,
    stripe_payment_intent_id: stripePaymentIntentId,
    service_type: type,
    currency,
  };
  if (priceCents !== null) insertPayload.price_cents = priceCents;
  if (clientName) insertPayload.client_name = clientName;
  if (clientEmail) insertPayload.client_email = clientEmail;
  if (clientPhone) insertPayload.client_phone = clientPhone;
  if (note) insertPayload.client_note = note;

  const insertRes = await supabase.from("bookings").insert(insertPayload).select("id").maybeSingle<{ id: string }>();
  if (insertRes.error) {
    if (insertRes.error.code === "23505") {
      const retry = await supabase
        .from("bookings")
        .select("id")
        .eq("stripe_checkout_session_id", session.id)
        .maybeSingle<{ id: string }>();
      return NextResponse.json({ received: true, booking_id: retry.data?.id || null, trainer_id: trainerId, type });
    }
    return NextResponse.json({ message: insertRes.error.message }, { status: 500 });
  }

  return NextResponse.json({ received: true, booking_id: insertRes.data?.id || null, trainer_id: trainerId, type });
}
