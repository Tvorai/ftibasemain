import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { stripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getBearerToken(request: Request): string | null {
  const auth = request.headers.get("authorization");
  if (!auth) return null;
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || null;
}

export async function POST(request: Request) {
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
    return NextResponse.json({ ok: false, message: trainerRes.error.message }, { status: 500 });
  }
  if (!trainerRes.data?.id) {
    return NextResponse.json({ ok: false, message: "Používateľ nie je tréner." }, { status: 403 });
  }

  const stripeAccountId = trainerRes.data.stripe_account_id;
  if (!stripeAccountId) {
    return NextResponse.json({ ok: true, synced: false, message: "Stripe účet nie je vytvorený." });
  }

  try {
    const account = await stripe.accounts.retrieve(stripeAccountId);

    const stripe_onboarding_completed = account.details_submitted;
    const stripe_charges_enabled = account.charges_enabled;
    const stripe_payouts_enabled = account.payouts_enabled;

    const updateRes = await supabase
      .from("trainers")
      .update({
        stripe_onboarding_completed,
        stripe_charges_enabled,
        stripe_payouts_enabled,
      })
      .eq("id", trainerRes.data.id);

    if (updateRes.error) {
      return NextResponse.json({ ok: false, message: updateRes.error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      synced: true,
      stripe_onboarding_completed,
      stripe_charges_enabled,
      stripe_payouts_enabled,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Stripe error.";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

