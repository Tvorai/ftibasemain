import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;
const noStoreHeaders = {
  "Cache-Control": "no-store, max-age=0",
  Pragma: "no-cache",
  Expires: "0"
};

export async function GET(
  _request: Request,
  { params }: { params: { trainerSlug: string } }
) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { ok: false, message: "Server nie je správne nakonfigurovaný." },
      { status: 500, headers: noStoreHeaders }
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const primary = await supabase
    .from("trainers")
    .select("id,slug,bio,headline,city,images,brands,services,profiles(full_name,email)")
    .eq("slug", params.trainerSlug)
    .maybeSingle();

  let data = primary.data;
  let error = primary.error;

  if (error && (error.code === "42703" || error.message.includes("services"))) {
    const fallback = await supabase
      .from("trainers")
      .select("id,slug,bio,headline,city,images,brands,profiles(full_name,email)")
      .eq("slug", params.trainerSlug)
      .maybeSingle();
    data = fallback.data ? { ...fallback.data, services: null } : fallback.data;
    error = fallback.error;
  }

  if (error) {
    return NextResponse.json(
      { ok: false, message: error.message },
      { status: 500, headers: noStoreHeaders }
    );
  }

  if (!data) {
    return NextResponse.json(
      { ok: false, message: "Profil sa nenašiel." },
      { status: 404, headers: noStoreHeaders }
    );
  }

  return NextResponse.json({ ok: true, trainer: data }, { headers: noStoreHeaders });
}
