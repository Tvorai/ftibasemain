import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { siteUrl } from "@/lib/config";

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

function pickStripeSecretKey(): string | null {
  return (
    process.env.STRIPE_SECRET_KEY ||
    process.env.STRIPE_API_KEY ||
    process.env.STRIPE_SECRET ||
    null
  );
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

  const form = new URLSearchParams();
  form.set("account", stripeAccountId);
  form.set("type", "account_onboarding");
  form.set("return_url", returnUrl.toString());
  form.set("refresh_url", refreshUrl.toString());

  const stripeRes = await fetch("https://api.stripe.com/v1/account_links", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeSecretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });

  const stripePayload: unknown = await stripeRes.json().catch(() => null);
  if (!stripeRes.ok) {
    return NextResponse.json(
      { ok: false, message: stripeErrorMessage(stripePayload) || "Stripe error." },
      { status: 500 }
    );
  }

  const url =
    isRecord(stripePayload) && typeof stripePayload.url === "string" && stripePayload.url.trim()
      ? stripePayload.url
      : null;

  if (!url) {
    return NextResponse.json({ ok: false, message: "Stripe nevrátil onboarding url." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, url });
}
