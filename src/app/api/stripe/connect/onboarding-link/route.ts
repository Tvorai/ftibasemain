import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { siteUrl } from "@/lib/config";
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

function stripeErrorMessage(payload: unknown): string | null {
  if (!isRecord(payload)) return null;
  const err = payload.error;
  if (!isRecord(err)) return null;
  const msg = err.message;
  return typeof msg === "string" && msg.trim() ? msg : null;
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
  const stripeAccountId = trainerRes.data?.stripe_account_id || null;
  if (!stripeAccountId) {
    return NextResponse.json({ ok: false, message: "Stripe účet nie je vytvorený." }, { status: 400 });
  }

  const origin = request.headers.get("origin") || siteUrl || "https://fitbase.sk";
  const returnUrl = new URL("/ucet-trenera", origin);
  const refreshUrl = new URL("/ucet-trenera", origin);
  returnUrl.searchParams.set("stripe", "return");
  refreshUrl.searchParams.set("stripe", "refresh");

  try {
    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      type: "account_onboarding",
      return_url: returnUrl.toString(),
      refresh_url: refreshUrl.toString(),
    });

    return NextResponse.json({ ok: true, url: accountLink.url });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Stripe error.";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
