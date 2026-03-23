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
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

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

  const emailRedirectTo = siteUrl ? new URL("/prihlasenie", siteUrl).toString() : undefined;

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
        role: "user",
        locale
      }
    }
  });

  if (signup.error) {
    return json(mapSignupErrorToSk(signup.error.message), 400, { code: signup.error.code });
  }

  return json("Registrácia prebehla úspešne. Skontrolujte e-mail pre potvrdenie účtu.", 200, {
    userId: signup.data.user?.id ?? null
  });
}
