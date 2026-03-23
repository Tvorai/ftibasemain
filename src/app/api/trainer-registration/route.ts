import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type RequestBody = {
  userId: string;
  email: string;
  fullName: string;
  locale?: string;
};

function json(message: string, status: number, extra?: Record<string, unknown>) {
  return Response.json({ ok: status >= 200 && status < 300, message, ...extra }, { status });
}

function toSlugBase(input: string) {
  const normalized = input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const slug = normalized
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .replace(/-{2,}/g, "-");
  return slug || "trainer";
}

function isUniqueViolation(err: unknown) {
  if (!err || typeof err !== "object") return false;
  const anyErr = err as { code?: string; message?: string; details?: string };
  return anyErr.code === "23505" || Boolean(anyErr.message?.toLowerCase().includes("duplicate"));
}

export async function POST(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return json("Server nie je správne nakonfigurovaný pre registráciu.", 500);
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return json("Neplatné dáta požiadavky.", 400);
  }

  const userId = body.userId?.trim();
  const email = body.email?.trim().toLowerCase();
  const fullName = body.fullName?.trim();
  const locale = (body.locale || "sk").trim();

  if (!userId || !email || !fullName) {
    return json("Chýbajú povinné údaje.", 400);
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const profileSelect = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (profileSelect.error) {
    return json("Nepodarilo sa overiť profil.", 500, { code: profileSelect.error.code });
  }

  if (profileSelect.data) {
    const profileUpdate = await supabaseAdmin
      .from("profiles")
      .update({
        email,
        full_name: fullName,
        role: "trainer",
        locale
      })
      .eq("id", userId);

    if (profileUpdate.error) {
      return json("Nepodarilo sa aktualizovať profil.", 500, { code: profileUpdate.error.code });
    }
  } else {
    const profileInsert = await supabaseAdmin.from("profiles").insert({
      id: userId,
      email,
      full_name: fullName,
      avatar_url: null,
      role: "trainer",
      locale
    });

    if (profileInsert.error) {
      if (isUniqueViolation(profileInsert.error)) {
        const profileUpdate = await supabaseAdmin
          .from("profiles")
          .update({
            email,
            full_name: fullName,
            role: "trainer",
            locale
          })
          .eq("id", userId);

        if (profileUpdate.error) {
          return json("Nepodarilo sa aktualizovať profil.", 500, { code: profileUpdate.error.code });
        }
      } else {
        return json("Nepodarilo sa vytvoriť profil.", 500, { code: profileInsert.error.code });
      }
    }
  }

  const trainerSelect = await supabaseAdmin
    .from("trainers")
    .select("id, slug")
    .eq("profile_id", userId)
    .maybeSingle();

  if (trainerSelect.error) {
    return json("Nepodarilo sa overiť trénerský profil.", 500, { code: trainerSelect.error.code });
  }

  if (trainerSelect.data) {
    return json("Trénerský profil už existuje.", 200, { slug: trainerSelect.data.slug });
  }

  const base = toSlugBase(fullName);

  for (let attempt = 0; attempt < 50; attempt++) {
    const slug = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const insert = await supabaseAdmin.from("trainers").insert({
      profile_id: userId,
      slug,
      headline: "",
      bio: "",
      city: "",
      is_online: true,
      is_active: false
    });

    if (!insert.error) {
      return json("Trénerský profil bol vytvorený.", 201, { slug });
    }

    if (isUniqueViolation(insert.error)) {
      const trainerNow = await supabaseAdmin
        .from("trainers")
        .select("id, slug")
        .eq("profile_id", userId)
        .maybeSingle();

      if (!trainerNow.error && trainerNow.data) {
        return json("Trénerský profil už existuje.", 200, { slug: trainerNow.data.slug });
      }
      continue;
    }

    return json("Nepodarilo sa vytvoriť trénerský profil.", 500, { code: insert.error.code });
  }

  return json("Nepodarilo sa vygenerovať unikátny slug.", 500);
}
