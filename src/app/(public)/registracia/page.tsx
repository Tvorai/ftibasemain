"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { featureFlags, supabaseAnonKey, supabaseUrl } from "@/lib/config";
import { useI18n } from "@/providers/i18n";

const supabase = featureFlags.supabaseEnabled ? createClient(supabaseUrl, supabaseAnonKey) : null;

type AuthMode = "user" | "trainer";

type ConsentErrors = {
  terms?: string;
  privacy?: string;
};

export default function UserRegistrationPage() {
  const { locale, messages } = useI18n();
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordRepeat, setPasswordRepeat] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>("user");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [consentErrors, setConsentErrors] = useState<ConsentErrors>({});

  const updateUrl = (mode: AuthMode) => {
    const url = new URL(window.location.href);
    if (mode === "trainer") {
      url.searchParams.set("mode", "trainer");
    } else {
      url.searchParams.delete("mode");
    }
    window.history.pushState({}, "", url.toString());
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get("mode");
    if (mode === "trainer" || mode === "trener") setAuthMode("trainer");
  }, []);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col md:flex-row">
      <div className="flex-1 flex flex-col px-4 py-6 md:px-12 md:py-6 lg:px-20 overflow-y-auto">
        <div className="mb-6">
          <Image
            src="/Fitbase logo.png"
            alt="Fitbase"
            width={190}
            height={44}
            priority
            className="h-auto w-[150px] md:w-[190px]"
          />
        </div>

        <div className="flex-1 flex items-start justify-center">
          <div className="w-full max-w-xl">
            <div className="inline-flex rounded-full bg-zinc-950/60 border border-zinc-800 p-1 mb-6">
              <button
                type="button"
                onClick={() => {
                  setAuthMode("user");
                  setStatus(null);
                  updateUrl("user");
                }}
                className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-colors ${
                  authMode === "user" ? "bg-emerald-500 text-black" : "text-zinc-300 hover:text-white"
                }`}
              >
                Registrácia
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode("trainer");
                  setStatus(null);
                  updateUrl("trainer");
                }}
                className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-colors ${
                  authMode === "trainer" ? "bg-emerald-500 text-black" : "text-zinc-300 hover:text-white"
                }`}
              >
                Registrovať sa ako tréner
              </button>
            </div>

            <h1 className="font-display text-4xl leading-[0.9] tracking-wide whitespace-nowrap md:text-6xl">
              {(authMode === "trainer" ? messages.pages.trainerRegistration.title : messages.pages.userRegistration.title).toUpperCase()}
            </h1>
            <p className="mt-3 text-sm italic text-white/70 md:text-base">
              {authMode === "trainer" ? messages.pages.trainerRegistration.subtitle : messages.pages.userRegistration.subtitle}
            </p>

            <form
              className="mt-7 space-y-3 md:mt-8"
              onSubmit={async (e) => {
                e.preventDefault();
                if (loading) return;
                setStatus(null);
                setConsentErrors({});

                const safeFullName = fullName.trim();
                const safePhoneNumber = phoneNumber.trim();
                const safeEmail = email.trim().toLowerCase();

                if (!safeFullName || !safePhoneNumber || !safeEmail || !password || !passwordRepeat) {
                  setStatus({ type: "error", text: "Vyplňte prosím všetky polia." });
                  return;
                }

                if (password !== passwordRepeat) {
                  setStatus({ type: "error", text: "Heslá sa nezhodujú." });
                  return;
                }

                const nextConsentErrors: ConsentErrors = {};
                if (!termsAccepted) {
                  nextConsentErrors.terms = "Musíte súhlasiť s obchodnými podmienkami.";
                }
                if (!privacyAccepted) {
                  nextConsentErrors.privacy =
                    "Musíte potvrdiť oboznámenie sa so zásadami ochrany osobných údajov.";
                }
                if (nextConsentErrors.terms || nextConsentErrors.privacy) {
                  setConsentErrors(nextConsentErrors);
                  return;
                }

                setLoading(true);
                const endpoint = authMode === "trainer" ? "/api/trainer-registration" : "/api/user-registration";
                const res = await fetch(endpoint, {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({
                    fullName: safeFullName,
                    phoneNumber: safePhoneNumber,
                    email: safeEmail,
                    password,
                    passwordRepeat,
                    locale,
                    termsAccepted,
                    privacyAccepted,
                    marketingConsent
                  })
                });

                const json = (await res.json().catch(() => null)) as
                  | { ok: boolean; message?: string }
                  | null;

                setLoading(false);

                if (!res.ok || !json?.ok) {
                  setStatus({
                    type: "error",
                    text: json?.message || "Registrácia zlyhala. Skúste to prosím znova."
                  });
                  return;
                }

                if (!supabase) {
                  setStatus({
                    type: "success",
                    text: json.message || "Registrácia prebehla úspešne. Skontrolujte e-mail pre potvrdenie účtu."
                  });
                  return;
                }

                const signInRes = await supabase.auth.signInWithPassword({ email: safeEmail, password });
                if (signInRes.error) {
                  setStatus({
                    type: "success",
                    text: json.message || "Registrácia prebehla úspešne. Skontrolujte e-mail pre potvrdenie účtu."
                  });
                  return;
                }

                // Auto-detect user type and redirect
                const userRes = await supabase.auth.getUser();
                const user = userRes.data.user;
                
                if (!user) {
                  router.push("/ucet");
                  return;
                }

                const trainerRes = await supabase
                  .from("trainers")
                  .select("id")
                  .eq("profile_id", user.id)
                  .maybeSingle<{ id: string }>();

                if (trainerRes.data?.id) {
                  router.push("/ucet-trenera");
                } else {
                  router.push("/ucet");
                }
              }}
            >
              <div>
                <label className="sr-only" htmlFor="fullName">
                  {(authMode === "trainer" ? messages.pages.trainerRegistration.fields.fullName : messages.pages.userRegistration.fields.fullName)}
                </label>
                <input
                  id="fullName"
                  name="fullName"
                  type="text"
                  placeholder={(authMode === "trainer" ? messages.pages.trainerRegistration.fields.fullName : messages.pages.userRegistration.fields.fullName)}
                  className="h-12 w-full rounded-full border border-emerald-500/80 bg-transparent px-5 text-white placeholder-white/70 outline-none ring-emerald-400 focus:ring-2"
                  autoComplete="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>

              <div>
                <label className="sr-only" htmlFor="phoneNumber">
                  Telefónne číslo
                </label>
                <input
                  id="phoneNumber"
                  name="phoneNumber"
                  type="tel"
                  placeholder="Telefónne číslo"
                  className="h-12 w-full rounded-full border border-emerald-500/80 bg-transparent px-5 text-white placeholder-white/70 outline-none ring-emerald-400 focus:ring-2"
                  autoComplete="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                />
              </div>

              <div>
                <label className="sr-only" htmlFor="email">
                  {(authMode === "trainer" ? messages.pages.trainerRegistration.fields.email : messages.pages.userRegistration.fields.email)}
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  placeholder={(authMode === "trainer" ? messages.pages.trainerRegistration.fields.email : messages.pages.userRegistration.fields.email)}
                  className="h-12 w-full rounded-full border border-emerald-500/80 bg-transparent px-5 text-white placeholder-white/70 outline-none ring-emerald-400 focus:ring-2"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div>
                <label className="sr-only" htmlFor="password">
                  {(authMode === "trainer" ? messages.pages.trainerRegistration.fields.password : messages.pages.userRegistration.fields.password)}
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  placeholder={(authMode === "trainer" ? messages.pages.trainerRegistration.fields.password : messages.pages.userRegistration.fields.password)}
                  className="h-12 w-full rounded-full border border-emerald-500/80 bg-transparent px-5 text-white placeholder-white/70 outline-none ring-emerald-400 focus:ring-2"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <div>
                <label className="sr-only" htmlFor="passwordRepeat">
                  {(authMode === "trainer" ? messages.pages.trainerRegistration.fields.passwordRepeat : messages.pages.userRegistration.fields.passwordRepeat)}
                </label>
                <input
                  id="passwordRepeat"
                  name="passwordRepeat"
                  type="password"
                  placeholder={(authMode === "trainer" ? messages.pages.trainerRegistration.fields.passwordRepeat : messages.pages.userRegistration.fields.passwordRepeat)}
                  className="h-12 w-full rounded-full border border-emerald-500/80 bg-transparent px-5 text-white placeholder-white/70 outline-none ring-emerald-400 focus:ring-2"
                  autoComplete="new-password"
                  value={passwordRepeat}
                  onChange={(e) => setPasswordRepeat(e.target.value)}
                />
              </div>

              <div className="mt-4 space-y-3 text-sm text-white/80">
                <div>
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={termsAccepted}
                      onChange={(e) => setTermsAccepted(e.target.checked)}
                      className="mt-1 h-4 w-4 accent-emerald-500"
                    />
                    <span>
                      Súhlasím s{" "}
                      <Link href="/obchodne-podmienky" className="font-semibold text-emerald-400 hover:text-emerald-300">
                        obchodnými podmienkami
                      </Link>
                    </span>
                  </label>
                  {consentErrors.terms ? <div className="pl-7 text-xs text-red-300">{consentErrors.terms}</div> : null}
                </div>

                <div>
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={privacyAccepted}
                      onChange={(e) => setPrivacyAccepted(e.target.checked)}
                      className="mt-1 h-4 w-4 accent-emerald-500"
                    />
                    <span>
                      Beriem na vedomie{" "}
                      <Link href="/gdpr" className="font-semibold text-emerald-400 hover:text-emerald-300">
                        zásady ochrany osobných údajov
                      </Link>
                    </span>
                  </label>
                  {consentErrors.privacy ? (
                    <div className="pl-7 text-xs text-red-300">{consentErrors.privacy}</div>
                  ) : null}
                </div>

                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={marketingConsent}
                    onChange={(e) => setMarketingConsent(e.target.checked)}
                    className="mt-1 h-4 w-4 accent-emerald-500"
                  />
                  <span>Súhlasím so zasielaním noviniek a marketingových informácií</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="font-display mt-4 h-12 w-full rounded-full bg-emerald-500 text-center text-2xl tracking-wide text-black hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {(authMode === "trainer" ? messages.pages.trainerRegistration.submit : messages.pages.userRegistration.submit).toUpperCase()}
              </button>

              {status ? (
                <div
                  className={
                    status.type === "success"
                      ? "mt-3 text-center text-sm text-emerald-300"
                      : "mt-3 text-center text-sm text-red-300"
                  }
                >
                  {status.text}
                </div>
              ) : null}

              <div className="mt-3 text-center text-sm text-white/80">
                <span>Máte účet? </span>
                <Link
                  href={authMode === "trainer" ? "/prihlasenie?mode=trainer" : "/prihlasenie"}
                  className="font-semibold text-emerald-400 hover:text-emerald-300"
                >
                  Prihlásiť sa
                </Link>
              </div>
            </form>
          </div>
        </div>
      </div>

      <div className="hidden md:block md:w-1/2 relative min-h-screen">
        <Image
          src="/uvod.jpg"
          alt="Fitbase registration"
          fill
          priority
          className="object-cover"
        />
      </div>

      <div className="md:hidden w-full h-[300px] relative">
        <Image
          src="/uvod.jpg"
          alt="Fitbase registration"
          fill
          priority
          className="object-cover"
        />
      </div>
    </div>
  );
}
