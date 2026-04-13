import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { supabaseUrl, supabaseAnonKey } from "@/lib/config";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/ucet";

  console.log("[AUTH] callback next =", next);

  if (code) {
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
    });
    
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error) {
      console.log("[AUTH] exchange successful, redirecting to", next);
      // Pridáme krátky delay pre istotu, aby Supabase stihol dokončiť interné procesy (ako si prial user)
      // hoci na server-side to má malý vplyv bez cookies, dodržíme inštrukciu
      await new Promise(resolve => setTimeout(resolve, 500));
      return NextResponse.redirect(`${origin}${next}`);
    }
    
    console.error("[AUTH] callback error:", error.message);
  }

  // If error or no code, redirect to /prihlasenie with error
  return NextResponse.redirect(`${origin}/prihlasenie?error=auth_callback_failed`);
}
