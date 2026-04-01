import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

export async function POST(request: Request) {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!stripeSecretKey || !webhookSecret) {
    return NextResponse.json({ message: "Chýba Stripe Connect konfigurácia." }, { status: 500 });
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

  if (event.type === "account.updated") {
    const account = event.data.object as Stripe.Account;
    const stripeAccountId = account.id;

    const chargesEnabled = getBoolean(account.charges_enabled);
    const payoutsEnabled = getBoolean(account.payouts_enabled);
    const detailsSubmitted = getBoolean(account.details_submitted);

    const stripe_onboarding_completed = Boolean(detailsSubmitted);
    const stripe_charges_enabled = Boolean(chargesEnabled);
    const stripe_payouts_enabled = Boolean(payoutsEnabled);

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const updateRes = await supabase
      .from("trainers")
      .update({
        stripe_onboarding_completed,
        stripe_charges_enabled,
        stripe_payouts_enabled,
      })
      .eq("stripe_account_id", stripeAccountId);

    if (updateRes.error) {
      console.error("[Connect Webhook] Error updating trainer:", updateRes.error.message);
      return NextResponse.json({ message: updateRes.error.message }, { status: 500 });
    }

    return NextResponse.json({ received: true, type: "account.updated", account_id: stripeAccountId });
  }

  return NextResponse.json({ received: true });
}
