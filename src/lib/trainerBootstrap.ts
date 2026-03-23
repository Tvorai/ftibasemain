import type { SupabaseClient } from "@supabase/supabase-js";

type EnsureResult =
  | { ok: true; slug?: string }
  | { ok: false; message: string; code?: string };

type ProfileRow = {
  id: string;
  role: string | null;
  full_name: string | null;
};

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
  const anyErr = err as { code?: string; message?: string };
  return anyErr.code === "23505" || Boolean(anyErr.message?.toLowerCase().includes("duplicate"));
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function ensureTrainerRowAfterLogin(
  supabase: SupabaseClient,
  userId: string
): Promise<EnsureResult> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const profileRes = await supabase
      .from("profiles")
      .select("id, role, full_name")
      .eq("id", userId)
      .maybeSingle<ProfileRow>();

    if (profileRes.error) {
      return {
        ok: false,
        message: "Nepodarilo sa načítať profil používateľa.",
        code: profileRes.error.code
      };
    }

    if (!profileRes.data) {
      await wait(250);
      continue;
    }

    if (profileRes.data.role !== "trainer") {
      return { ok: true };
    }

    const trainerRes = await supabase
      .from("trainers")
      .select("id, slug")
      .eq("profile_id", userId)
      .maybeSingle<{ id: string; slug: string }>();

    if (trainerRes.error) {
      return {
        ok: false,
        message: "Nepodarilo sa overiť trénerský profil.",
        code: trainerRes.error.code
      };
    }

    if (trainerRes.data) {
      return { ok: true, slug: trainerRes.data.slug };
    }

    const base = toSlugBase(profileRes.data.full_name || "");

    for (let s = 0; s < 50; s++) {
      const slug = s === 0 ? base : `${base}-${s + 1}`;
      const insertRes = await supabase.from("trainers").insert({
        profile_id: userId,
        slug,
        headline: "",
        bio: "",
        city: "",
        is_online: true,
        is_active: false
      });

      if (!insertRes.error) {
        return { ok: true, slug };
      }

      if (isUniqueViolation(insertRes.error)) {
        const nowRes = await supabase
          .from("trainers")
          .select("id, slug")
          .eq("profile_id", userId)
          .maybeSingle<{ id: string; slug: string }>();

        if (!nowRes.error && nowRes.data) {
          return { ok: true, slug: nowRes.data.slug };
        }

        continue;
      }

      return {
        ok: false,
        message: "Nepodarilo sa vytvoriť trénerský profil.",
        code: insertRes.error.code
      };
    }

    return { ok: false, message: "Nepodarilo sa vygenerovať unikátny slug." };
  }

  return { ok: false, message: "Profil používateľa sa nepodarilo načítať." };
}
