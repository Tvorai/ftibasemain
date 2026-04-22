import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { stripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function getBearerToken(request: Request): string | null {
  const auth = request.headers.get("authorization");
  if (!auth) return null;
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || null;
}

export async function GET(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ ok: false, message: "Chýba konfigurácia Supabase." }, { status: 500 });
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

  const trainerRes = await supabase
    .from("trainers")
    .select("id, stripe_account_id")
    .eq("profile_id", user.id)
    .maybeSingle<{ id: string; stripe_account_id: string | null }>();

  if (trainerRes.error) {
    console.error("[STRIPE BALANCE ERROR] DB error:", trainerRes.error.message);
    return NextResponse.json({ ok: false, message: trainerRes.error.message }, { status: 500 });
  }

  const stripeAccountId = trainerRes.data?.stripe_account_id;
  console.log("[STRIPE BALANCE] account id:", stripeAccountId);

  if (!stripeAccountId) {
    return NextResponse.json({ 
      ok: false, 
      message: "Stripe účet nie je vytvorený.",
      available_amount: 0,
      pending_amount: 0
    });
  }

  try {
    const balance = await stripe.balance.retrieve({
      stripeAccount: stripeAccountId,
    });

    const available = balance.available.reduce((sum, b) => sum + (b.currency === "eur" ? b.amount : 0), 0);
    const pending = balance.pending.reduce((sum, b) => sum + (b.currency === "eur" ? b.amount : 0), 0);

    const available_eur = available / 100;
    const pending_eur = pending / 100;

    console.log(`[STRIPE BALANCE] available: ${available_eur} EUR / pending: ${pending_eur} EUR`);

    return NextResponse.json({
      ok: true,
      available_amount: available_eur,
      pending_amount: pending_eur,
      currency: "EUR"
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Stripe error.";
    console.error("[STRIPE BALANCE ERROR] Stripe error:", message);
    return NextResponse.json({ 
      ok: false, 
      message: "Nepodarilo sa načítať zostatok zo Stripe.",
      available_amount: 0,
      pending_amount: 0
    }, { status: 500 });
  }
}
