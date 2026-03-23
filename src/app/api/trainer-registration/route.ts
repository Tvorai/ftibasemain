export const runtime = "nodejs";

type RequestBody = {
  email: string;
  password: string;
  passwordRepeat: string;
  fullName: string;
  locale?: string;
};

function json(message: string, status: number, extra?: Record<string, unknown>) {
  return Response.json({ ok: status >= 200 && status < 300, message, ...extra }, { status });
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  const anyErr = err as { code?: string; message?: string };
  return anyErr.code === "23505" || Boolean(anyErr.message?.toLowerCase().includes("duplicate"));
}

function mapSignupErrorToSk(message: string) {
  const m = message.toLowerCase();
  if (m.includes("already registered") || m.includes("user already registered")) {
    return "Tento email je už zaregistrovaný.";
  }
  if (m.includes("password") && m.includes("length")) {
    return "Heslo je príliš krátke.";
  }
  return "Registrácia zlyhala. Skúste to prosím znova.";
}

export async function POST(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return json("Server nie je správne nakonfigurovaný pre registráciu.", 500);
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return json("Neplatné dáta požiadavky.", 400);
  }

  const fullName = body.fullName?.trim();
  const email = body.email?.trim().toLowerCase();
  const password = body.password || "";
  const passwordRepeat = body.passwordRepeat || "";
  const locale = (body.locale || "sk").trim();

  if (!fullName || !email || !password || !passwordRepeat) {
    return json("Vyplňte prosím všetky polia.", 400);
  }

  if (password !== passwordRepeat) {
    return json("Heslá sa nezhodujú.", 400);
  }

  const { createClient } = await import("@supabase/supabase-js");

  const emailRedirectTo = siteUrl ? new URL("/prihlasenie-trenera", siteUrl).toString() : undefined;

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const signup = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo,
      data: {
        full_name: fullName,
        role: "trainer",
        locale
      }
    }
  });

  if (signup.error) {
    return json(mapSignupErrorToSk(signup.error.message), 400, { code: signup.error.code });
  }

  const userId = signup.data.user?.id;
  if (!userId) {
    return json("Registrácia zlyhala. Skúste to prosím znova.", 500);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  let profileFullName = fullName;
  let profileReady = false;

  for (let i = 0; i < 10; i++) {
    const prof = await admin
      .from("profiles")
      .select("id, role, full_name")
      .eq("id", userId)
      .maybeSingle<{ id: string; role: string | null; full_name: string | null }>();

    if (!prof.error && prof.data) {
      profileReady = true;
      if (prof.data.full_name) profileFullName = prof.data.full_name;
      if (prof.data.role && prof.data.role !== "trainer") {
        console.error("trainer-registration: profile role is not trainer", {
          userId,
          role: prof.data.role
        });
      }
      break;
    }

    await wait(250);
  }

  if (!profileReady) {
    console.error("trainer-registration: profile not found after signup", { userId });
  }

  const existingTrainer = await admin
    .from("trainers")
    .select("id, slug")
    .eq("profile_id", userId)
    .maybeSingle<{ id: string; slug: string }>();

  if (existingTrainer.error) {
    console.error("trainer-registration: trainers select error", {
      userId,
      code: existingTrainer.error.code,
      message: existingTrainer.error.message
    });
    return json("Nepodarilo sa dokončiť registráciu trénera.", 500);
  }

  if (existingTrainer.data) {
    return json("Registrácia prebehla úspešne. Skontrolujte e-mail pre potvrdenie účtu.", 200, {
      userId,
      slug: existingTrainer.data.slug
    });
  }

  const base = toSlugBase(profileFullName);

  for (let attempt = 0; attempt < 50; attempt++) {
    const slug = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const insert = await admin.from("trainers").insert({
      profile_id: userId,
      slug,
      headline: "",
      bio: "",
      city: "",
      is_online: true,
      is_active: false
    });

    if (!insert.error) {
      return json("Registrácia prebehla úspešne. Skontrolujte e-mail pre potvrdenie účtu.", 200, {
        userId,
        slug
      });
    }

    if (isUniqueViolation(insert.error)) {
      continue;
    }

    console.error("trainer-registration: trainers insert error", {
      userId,
      code: insert.error.code,
      message: insert.error.message
    });
    return json("Nepodarilo sa vytvoriť trénerský profil.", 500);
  }

  console.error("trainer-registration: could not generate unique slug", { userId, base });
  return json("Nepodarilo sa vygenerovať unikátny slug.", 500);
}
