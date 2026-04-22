import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ message: "Server nie je správne nakonfigurovaný." }, { status: 500 });
  }

  const { target_user_id, access_token } = await request.json();

  if (!target_user_id || !access_token) {
    return NextResponse.json({ message: "Chýbajúce údaje." }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1. Overenie admina
  const { data: { user: adminUser }, error: authError } = await supabase.auth.getUser(access_token);
  if (authError || !adminUser) {
    return NextResponse.json({ message: "Neautorizované." }, { status: 401 });
  }

  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", adminUser.id)
    .single();

  if (adminProfile?.role !== "admin") {
    return NextResponse.json({ message: "Prístup zamietnutý. Len pre adminov." }, { status: 403 });
  }

  // 2. Generovanie bezpečného tokenu
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minút

  // 3. Uloženie tokenu a audit log
  const { data: tokenData, error: tokenError } = await supabase
    .from("admin_impersonation_tokens")
    .insert({
      admin_user_id: adminUser.id,
      target_user_id: target_user_id,
      token_hash: tokenHash,
      expires_at: expiresAt.toISOString(),
    })
    .select()
    .single();

  if (tokenError) {
    return NextResponse.json({ message: "Chyba pri vytváraní tokenu." }, { status: 500 });
  }

  await supabase.from("admin_impersonation_logs").insert({
    admin_user_id: adminUser.id,
    target_user_id: target_user_id,
    token_id: tokenData.id,
    action: "created",
    metadata: { ip: request.headers.get("x-forwarded-for") || "unknown" }
  });

  return NextResponse.json({ token });
}
