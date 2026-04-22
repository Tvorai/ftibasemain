import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ message: "Server nie je správne nakonfigurovaný." }, { status: 500 });
  }

  const { token } = await request.json();

  if (!token) {
    return NextResponse.json({ message: "Chýbajúci token." }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const tokenHash = require("crypto").createHash("sha256").update(token).digest("hex");

  // 1. Nájdeme platný a nepoužitý token
  const { data: tokenData, error: tokenError } = await supabase
    .from("admin_impersonation_tokens")
    .select("*")
    .eq("token_hash", tokenHash)
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (tokenError || !tokenData) {
    return NextResponse.json({ message: "Neplatný, expirovaný alebo už použitý token." }, { status: 401 });
  }

  // 2. Označíme token ako použitý
  await supabase
    .from("admin_impersonation_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("id", tokenData.id);

  // 3. Audit log
  await supabase.from("admin_impersonation_logs").insert({
    admin_user_id: tokenData.admin_user_id,
    target_user_id: tokenData.target_user_id,
    token_id: tokenData.id,
    action: "used",
  });

  // 4. Vygenerujeme magic link alebo session pre target usera
  // Supabase nepodporuje priame "prihlásenie za niekoho" bez hesla cez API pre klienta,
  // ale môžeme použiť admin.generateLink alebo vytvoriť session.
  // Najbezpečnejšie je vytvoriť session cez admin.auth.getUserById ak máme service_role
  // ale Supabase Auth API neposkytuje priamy createSession pre iného usera.
  // Alternatíva: admin.auth.admin.generateLink({ type: 'magiclink' })
  
  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email: (await supabase.auth.admin.getUserById(tokenData.target_user_id)).data.user?.email || "",
  });

  if (linkError || !linkData) {
    return NextResponse.json({ message: "Nepodarilo sa vygenerovať prístupový link." }, { status: 500 });
  }

  // Pre zjednodušenie na frontende vrátime session data (ak by sme ich vedeli získať priamo)
  // Alebo vrátime magic link a front ho použije.
  // Supabase exchangeCodeForSession by fungoval ak by sme mali code.
  
  // Oprava: Admin API umožňuje createSession nepriamo cez exchange.
  // Najjednoduchšie je vrátiť email a admin v UI urobí redirect na magic link bez posielania emailu.
  
  return NextResponse.json({ 
    magic_link: linkData.properties.action_link,
    admin_id: tokenData.admin_user_id
  });
}
