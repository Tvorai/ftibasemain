import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ message: "Server nie je správne nakonfigurovaný." }, { status: 500 });
  }

  const { admin_id, target_id, action } = await request.json();

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  await supabase.from("admin_impersonation_logs").insert({
    admin_user_id: admin_id,
    target_user_id: target_id,
    action: action, // napr. 'returned'
    metadata: { ip: request.headers.get("x-forwarded-for") || "unknown" }
  });

  return NextResponse.json({ ok: true });
}
