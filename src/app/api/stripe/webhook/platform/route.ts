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

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const meta: Record<string, unknown> = isRecord(session.metadata) ? session.metadata : {};
    
    const bookingIdFromMeta = getStringField(meta, "booking_id");
    const trainerId = getStringField(meta, "trainer_id");
    const userId = getStringField(meta, "user_id");
    const startsAt = getStringField(meta, "starts_at");
    const endsAt = getStringField(meta, "ends_at");
    const type = getStringField(meta, "type") || getStringField(meta, "service_type");

    const stripePaymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : null;

    // 1. Skúsime nájsť existujúci booking podľa session.id alebo bookingIdFromMeta
    let existingBookingId: string | null = null;
    
    const { data: existingBySession } = await supabase
      .from("bookings")
      .select("id")
      .eq("stripe_checkout_session_id", session.id)
      .maybeSingle<{ id: string }>();
    
    if (existingBySession?.id) {
      existingBookingId = existingBySession.id;
    } else if (bookingIdFromMeta) {
      const { data: existingByMetaId } = await supabase
        .from("bookings")
        .select("id")
        .eq("id", bookingIdFromMeta)
        .maybeSingle<{ id: string }>();
      if (existingByMetaId?.id) {
        existingBookingId = existingByMetaId.id;
      }
    }

    if (existingBookingId) {
      // Update existujúceho bookingu
      const { error: updateErr } = await supabase
        .from("bookings")
        .update({
          booking_status: "confirmed",
          payment_status: "paid",
          stripe_checkout_session_id: session.id,
          stripe_payment_intent_id: stripePaymentIntentId,
        })
        .eq("id", existingBookingId);
      
      if (updateErr) {
        console.error("[Platform Webhook] Error updating booking:", updateErr.message);
        return NextResponse.json({ message: updateErr.message }, { status: 500 });
      }
      return NextResponse.json({ received: true, action: "updated", booking_id: existingBookingId });
    } else {
      // Vytvorenie nového bookingu (pre flow z create-checkout, kde booking ešte nie je v DB)
      if (!trainerId || !userId || !startsAt || !endsAt || !type) {
        console.warn("[Platform Webhook] Missing metadata for new booking creation");
        return NextResponse.json({ message: "Chýbajú povinné metadata pre vytvorenie bookingu." }, { status: 400 });
      }

      const clientName = getStringField(meta, "client_name");
      const clientEmailFromMeta = getStringField(meta, "client_email");
      const clientPhone = getStringField(meta, "client_phone");
      const note = getStringField(meta, "note");

      const sessionEmail = session.customer_details?.email || null;
      const clientEmail = clientEmailFromMeta || sessionEmail || null;

      const currency = typeof session.currency === "string" ? session.currency.toLowerCase() : "eur";
      const amountTotal = typeof session.amount_total === "number" ? session.amount_total : null;
      const priceCentsFromMetaRaw = getStringField(meta, "price_cents");
      const priceCentsFromMeta = priceCentsFromMetaRaw ? Number(priceCentsFromMetaRaw) : null;
      const priceCents = amountTotal || priceCentsFromMeta || null;

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

      const { data: inserted, error: insertErr } = await supabase
        .from("bookings")
        .insert(insertPayload)
        .select("id")
        .maybeSingle<{ id: string }>();
      
      if (insertErr) {
        console.error("[Platform Webhook] Error inserting booking:", insertErr.message);
        return NextResponse.json({ message: insertErr.message }, { status: 500 });
      }
      return NextResponse.json({ received: true, action: "inserted", booking_id: inserted?.id });
    }
  }

  if (event.type === "payment_intent.succeeded") {
    const pi = event.data.object as Stripe.PaymentIntent;
    const meta: Record<string, unknown> = isRecord(pi.metadata) ? pi.metadata : {};
    const bookingIdFromMeta = getStringField(meta, "booking_id");

    if (bookingIdFromMeta) {
      const { error: updateErr } = await supabase
        .from("bookings")
        .update({
          payment_status: "paid",
          stripe_payment_intent_id: pi.id,
        })
        .eq("id", bookingIdFromMeta)
        // Ak už je confirmed, neprepisujeme ho (mohlo by byť už completed)
        .is("payment_status", "unpaid");
      
      if (updateErr) {
        console.error("[Platform Webhook] Error updating PI status:", updateErr.message);
      }
    }
    return NextResponse.json({ received: true, type: "payment_intent.succeeded" });
  }

  return NextResponse.json({ received: true });
}
