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

  let reviews: unknown[] = [];
  const reviewsRes = await supabase
    .from("reviews")
    .select("id, client_profile_id, rating, body, created_at, is_public, photo_url")
    .eq("trainer_id", (data as { id: string }).id)
    .eq("is_public", true)
    .order("created_at", { ascending: false })
    .limit(20);

  if (!reviewsRes.error && Array.isArray(reviewsRes.data)) {
    const rows = reviewsRes.data as unknown[];
    const clientIds: string[] = [];
    for (const item of rows) {
      if (!item || typeof item !== "object") continue;
      const anyItem = item as Record<string, unknown>;
      const clientId = anyItem.client_profile_id;
      if (typeof clientId === "string") clientIds.push(clientId);
    }

    const uniqueClientIds = Array.from(new Set(clientIds));
    const nameByClientId = new Map<string, string>();
    if (uniqueClientIds.length > 0) {
      const profRes = await supabase.from("profiles").select("id, full_name").in("id", uniqueClientIds);
      if (!profRes.error && Array.isArray(profRes.data)) {
        for (const item of profRes.data as unknown[]) {
          if (!item || typeof item !== "object") continue;
          const anyItem = item as Record<string, unknown>;
          const id = anyItem.id;
          const fullName = anyItem.full_name;
          if (typeof id === "string" && typeof fullName === "string" && fullName.trim()) {
            nameByClientId.set(id, fullName);
          }
        }
      }
    }

    reviews = rows.flatMap((item): unknown[] => {
      if (!item || typeof item !== "object") return [];
      const anyItem = item as Record<string, unknown>;
      const id = anyItem.id;
      const clientId = anyItem.client_profile_id;
      const rating = anyItem.rating;
      const body = anyItem.body;
      const photoUrl = anyItem.photo_url;
      const createdAt = anyItem.created_at;
      if (typeof id !== "string") return [];
      if (typeof clientId !== "string") return [];
      if (typeof rating !== "number") return [];
      if (typeof body !== "string") return [];
      if (typeof createdAt !== "string") return [];
      if (!(typeof photoUrl === "string" || photoUrl === null || typeof photoUrl === "undefined")) return [];

      return [
        {
          id,
          client_name: nameByClientId.get(clientId) || "Klient",
          rating,
          comment: body,
          photo_url: typeof photoUrl === "string" ? photoUrl : null,
          created_at: createdAt,
        },
      ];
    });
  }

  return NextResponse.json({ ok: true, trainer: { ...data, reviews } }, { headers: noStoreHeaders });
}
