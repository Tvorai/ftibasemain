import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function getBearerToken(request: Request): string | null {
  const auth = request.headers.get("authorization");
  if (!auth) return null;
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || null;
}

function pickStripeSecretKey(): string | null {
  return (
    process.env.STRIPE_SECRET_KEY ||
    process.env.STRIPE_API_KEY ||
    process.env.STRIPE_SECRET ||
    null
  );
}

export async function GET(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const stripeSecretKey = pickStripeSecretKey();

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ ok: false, message: "Chýba konfigurácia Supabase." }, { status: 500 });
  }
  if (!stripeSecretKey) {
    return NextResponse.json({ ok: false, message: "Chýba STRIPE_SECRET_KEY." }, { status: 500 });
  }

  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ ok: false, message: "Unauthorized." }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const userRes = await supabase.auth.getUser(token);
  const user = userRes.data.user;
  if (!user) {
    return NextResponse.json({ ok: false, message: "Unauthorized." }, { status: 401 });
  }

  // 1. Načítaj stripe_account_id trénera z DB
  const trainerRes = await supabase
    .from("trainers")
    .select("id, stripe_account_id")
    .eq("profile_id", user.id)
    .maybeSingle<{ id: string; stripe_account_id: string | null }>();

  if (trainerRes.error) {
    return NextResponse.json({ ok: false, message: trainerRes.error.message }, { status: 500 });
  }
  if (!trainerRes.data?.id) {
    return NextResponse.json({ ok: false, message: "Používateľ nie je tréner." }, { status: 403 });
  }

  const stripeAccountId = trainerRes.data.stripe_account_id;
  if (!stripeAccountId) {
    return NextResponse.json({ 
      ok: true, 
      has_account: false,
      message: "Stripe účet nie je vytvorený." 
    });
  }

  const stripe = new Stripe(stripeSecretKey);

  try {
    // [STRIPE BALANCE] account id
    console.log(`[STRIPE BALANCE] fetching for account id: ${stripeAccountId}`);

    // 2. Zavolaj stripe.balance.retrieve({ stripeAccount: accountId })
    const balance = await stripe.balance.retrieve({
      stripeAccount: stripeAccountId,
    });

    // 3. Vráť available_amount a pending_amount (v eurách)
    // Stripe vracia balance v poli 'available' a 'pending' podľa mien
    const availableEur = balance.available.find((b) => b.currency === "eur")?.amount || 0;
    const pendingEur = balance.pending.find((b) => b.currency === "eur")?.amount || 0;

    const available_amount = availableEur / 100;
    const pending_amount = pendingEur / 100;

    // [STRIPE BALANCE] available / pending
    console.log(`[STRIPE BALANCE] account: ${stripeAccountId}, available: ${available_amount}, pending: ${pending_amount}`);

    return NextResponse.json({
      ok: true,
      has_account: true,
      available_amount,
      pending_amount,
      currency: "EUR"
    });
  } catch (error: unknown) {
    console.error("[STRIPE BALANCE] error:", error);
    const message = error instanceof Error ? error.message : "Stripe balance error.";
    return NextResponse.json(
      { ok: false, message },
      { status: 500 }
    );
  }
}
