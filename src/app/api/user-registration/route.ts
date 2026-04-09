export const runtime = "nodejs";

type RequestBody = {
  email: string;
  password: string;
  passwordRepeat: string;
  fullName: string;
  phoneNumber?: string;
  locale?: string;
};

function json(message: string, status: number, extra?: Record<string, unknown>) {
  return Response.json({ ok: status >= 200 && status < 300, message, ...extra }, { status });
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
  const configSiteUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://fitbase.sk";

  if (!supabaseUrl || !supabaseAnonKey) {
    return json("Server nie je správne nakonfigurovaný pre registráciu.", 500);
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return json("Neplatné dáta požiadavky.", 400);
  }

  const fullName = body.fullName?.trim();
  const phoneNumber = body.phoneNumber?.trim();
  const email = body.email?.trim().toLowerCase();
  const password = body.password || "";
  const passwordRepeat = body.passwordRepeat || "";
  const locale = (body.locale || "sk").trim();

  if (!fullName || !phoneNumber || !email || !password || !passwordRepeat) {
    return json("Vyplňte prosím všetky polia.", 400);
  }

  if (password !== passwordRepeat) {
    return json("Heslá sa nezhodujú.", 400);
  }

  const { createClient } = await import("@supabase/supabase-js");

  const emailRedirectTo = new URL("/auth/callback?next=/prihlasenie", configSiteUrl).toString();

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
        phone_number: phoneNumber,
        locale
      }
    }
  });

  if (signup.error) {
    return json(mapSignupErrorToSk(signup.error.message), 400, { code: signup.error.code });
  }

  const userId = signup.data.user?.id;
  if (userId && serviceRoleKey) {
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    for (let i = 0; i < 10; i++) {
      const updateRes = await admin
        .from("profiles")
        .update({ phone_number: phoneNumber })
        .eq("id", userId);

      if (!updateRes.error) break;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  return json("Registrácia prebehla úspešne. Skontrolujte e-mail pre potvrdenie účtu.", 200, {
    userId: userId ?? null
  });
}
