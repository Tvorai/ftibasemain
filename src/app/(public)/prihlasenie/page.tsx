"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { siteUrl, supabaseAnonKey, supabaseUrl, featureFlags } from "@/lib/config";
import { useI18n } from "@/providers/i18n";

const supabase = featureFlags.supabaseEnabled ? createClient(supabaseUrl, supabaseAnonKey) : null;

type AuthMode = "user" | "trainer";

export default function UserLoginPage() {
  const { messages } = useI18n();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("user");
  const [modeError, setModeError] = useState<string | null>(null);
  const [view, setView] = useState<"login" | "forgot-password">("login");
  const [resetStatus, setResetStatus] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // [LOG] Google login restriction added
  const handleGoogleLogin = async () => {
    if (!supabase) return;
    console.log("[GOOGLE LOGIN] button clicked on /prihlasenie");
    console.log("[GOOGLE LOGIN] mode param =", authMode);
    
    setLoading(true);
    try {
      const targetPath = authMode === "trainer" ? "/ucet-trenera" : "/ucet";
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(targetPath)}`;
      console.log("[GOOGLE LOGIN] redirectTo =", redirectTo);
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
        },
      });

      if (error) {
        console.error("[GOOGLE LOGIN] error:", error.message);
        setModeError(error.message);
      }
    } catch (err) {
      console.error("[GOOGLE LOGIN] unexpected error:", err);
    } finally {
      setLoading(false);
    }
  };

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

    // Check for access_token in hash (Implicit Flow fallback)
    if (window.location.hash.includes("access_token=")) {
      console.log("[AUTH] detected access_token in hash");
      // Give Supabase a moment to process the hash/session internally
      const timer = setTimeout(() => {
        const targetPath = authMode === "trainer" ? "/ucet-trenera" : "/ucet";
        console.log("[AUTH] redirecting to", targetPath, "after hash detection");
        router.push(targetPath);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [router, authMode]);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col md:flex-row">
      <div className="flex-1 flex flex-col px-4 py-6 md:px-12 md:py-10 lg:px-20 overflow-y-auto">
        <div className="mb-6 md:mb-10">
          <Image
            src="/Fitbase logo.png"
            alt="Fitbase"
            width={190}
            height={44}
            priority
            className="h-auto w-[150px] md:w-[190px]"
          />
        </div>

        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-xl">
            <div className="inline-flex rounded-full bg-zinc-950/60 border border-zinc-800 p-1 mb-6">
              <button
                type="button"
                onClick={() => {
                  setAuthMode("user");
                  setModeError(null);
                  setShowForgotPassword(false);
                  setView("login");
                  setResetStatus(null);
                  updateUrl("user");
                }}
                className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-colors ${
                  authMode === "user" ? "bg-emerald-500 text-black" : "text-zinc-300 hover:text-white"
                }`}
              >
                Prihlásenie
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode("trainer");
                  setModeError(null);
                  setShowForgotPassword(false);
                  setView("login");
                  setResetStatus(null);
                  updateUrl("trainer");
                }}
                className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-colors ${
                  authMode === "trainer" ? "bg-emerald-500 text-black" : "text-zinc-300 hover:text-white"
                }`}
              >
                Prihlásiť sa ako tréner
              </button>
            </div>

            <h1 className="font-display text-4xl leading-[0.9] tracking-wide whitespace-nowrap md:text-6xl">
              {view === "forgot-password" 
                ? messages.pages.userLogin.forgotPasswordTitle.toUpperCase()
                : (authMode === "trainer" ? "Prihlásenie trénera" : messages.pages.userLogin.title).toUpperCase()}
            </h1>
            {view === "forgot-password" && (
              <p className="mt-3 text-sm italic text-white/70 md:text-base">
                {messages.pages.userLogin.forgotPasswordSubtitle}
              </p>
            )}

            {view === "login" ? (
              <div className="mt-7 md:mt-8">
                {authMode === "user" && (
                  <>
                    <button
                      type="button"
                      disabled={loading}
                      onClick={handleGoogleLogin}
                      className="w-full rounded-full border border-zinc-800 bg-zinc-900 px-5 py-3 text-sm font-bold text-white hover:bg-zinc-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-3"
                    >
                      <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                        <path d="M17.64 9.20455C17.64 8.56636 17.5827 7.95273 17.4764 7.36364H9V10.845H13.8436C13.635 11.97 13.0009 12.9232 12.0477 13.5614V15.8195H14.9564C16.6582 14.2527 17.64 11.9455 17.64 9.20455Z" fill="#4285F4"/>
                        <path d="M9 18C11.43 18 13.4673 17.1941 14.9564 15.8195L12.0477 13.5614C11.2418 14.1014 10.2109 14.4205 9 14.4205C6.65591 14.4205 4.67182 12.8373 3.96409 10.71H0.957273V13.0418C2.43818 15.9832 5.48182 18 9 18Z" fill="#34A853"/>
                        <path d="M3.96409 10.71C3.78409 10.17 3.68182 9.59318 3.68182 9C3.68182 8.40682 3.78409 7.83 3.96409 7.29V4.95818H0.957273C0.347727 6.17318 0 7.54773 0 9C0 10.4523 0.347727 11.8268 0.957273 13.0418L3.96409 10.71Z" fill="#FBBC05"/>
                        <path d="M9 3.57955C10.3214 3.57955 11.5077 4.03364 12.4405 4.92545L15.0218 2.34409C13.4632 0.891818 11.4259 0 9 0C5.48182 0 2.43818 2.01682 0.957273 4.95818L3.96409 7.29C4.67182 5.16273 6.65591 3.57955 9 3.57955Z" fill="#EA4335"/>
                      </svg>
                      Pokračovať cez Google
                    </button>

                    <div className="my-6 flex items-center gap-3">
                      <div className="h-px flex-1 bg-zinc-800" />
                      <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">alebo</span>
                      <div className="h-px flex-1 bg-zinc-800" />
                    </div>
                  </>
                )}

                <form
                  className="space-y-3"
                  onSubmit={async (e) => {
                  e.preventDefault();
                  if (loading) return;

                  setShowForgotPassword(false);
                  setModeError(null);

                  if (!supabase) return;
                  if (!email.trim() || !password) return;

                  setLoading(true);
                  const { error } = await supabase.auth.signInWithPassword({
                    email: email.trim(),
                    password
                  });
                  setLoading(false);

                  if (error) {
                    setShowForgotPassword(true);
                    return;
                  }

                  const targetPath = authMode === "trainer" ? "/ucet-trenera" : "/ucet";
                  console.log("[LOGIN] email login success, mode =", authMode, "target =", targetPath);
                  router.push(targetPath);
                }}
              >
                <div>
                  <label className="sr-only" htmlFor="email">
                    {messages.pages.userLogin.fields.email}
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    placeholder={messages.pages.userLogin.fields.email}
                    className="h-12 w-full rounded-full border border-emerald-500/80 bg-transparent px-5 text-white placeholder-white/70 outline-none ring-emerald-400 focus:ring-2"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <div>
                  <label className="sr-only" htmlFor="password">
                    {messages.pages.userLogin.fields.password}
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    placeholder={messages.pages.userLogin.fields.password}
                    className="h-12 w-full rounded-full border border-emerald-500/80 bg-transparent px-5 text-white placeholder-white/70 outline-none ring-emerald-400 focus:ring-2"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="font-display mt-4 h-12 w-full rounded-full bg-emerald-500 text-center text-2xl tracking-wide text-black hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {messages.pages.userLogin.submit.toUpperCase()}
                </button>

                {modeError ? (
                  <div className="mt-3 text-center text-sm text-red-300">
                    {modeError}
                  </div>
                ) : null}

                {showForgotPassword ? (
                  <div className="mt-3 text-center text-sm text-white/80">
                    <button
                      type="button"
                      onClick={() => {
                        setView("forgot-password");
                        setShowForgotPassword(false);
                      }}
                      className="text-emerald-400 hover:text-emerald-300 underline"
                    >
                      {messages.pages.userLogin.forgotPasswordHint}
                    </button>
                  </div>
                ) : null}

                <div className="mt-3 text-center text-sm text-white/80">
                    <span>Nemáte účet? </span>
                    <Link
                      href={authMode === "trainer" ? "/registracia?mode=trainer" : "/registracia"}
                      className="font-semibold text-emerald-400 hover:text-emerald-300"
                    >
                      Registrovať sa
                    </Link>
                  </div>
                </form>
              </div>
            ) : (
              <form
                className="mt-7 space-y-3 md:mt-8"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (loading) return;

                  setResetStatus(null);
                  if (!supabase) return;
                  if (!email.trim()) return;

                  setLoading(true);
                  const redirectTo = `${siteUrl.replace(/\/$/, "")}/auth/callback?next=/reset-hesla`;
                  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
                    redirectTo
                  });
                  setLoading(false);

                  if (error) {
                    setResetStatus({ type: "error", text: error.message });
                    return;
                  }

                  setResetStatus({ type: "success", text: messages.pages.userLogin.resetEmailSent });
                }}
              >
                <div>
                  <label className="sr-only" htmlFor="reset-email">
                    {messages.pages.userLogin.fields.email}
                  </label>
                  <input
                    id="reset-email"
                    name="email"
                    type="email"
                    placeholder={messages.pages.userLogin.fields.email}
                    className="h-12 w-full rounded-full border border-emerald-500/80 bg-transparent px-5 text-white placeholder-white/70 outline-none ring-emerald-400 focus:ring-2"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="font-display mt-4 h-12 w-full rounded-full bg-emerald-500 text-center text-2xl tracking-wide text-black hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {messages.pages.userLogin.forgotPasswordSubmit.toUpperCase()}
                </button>

                {resetStatus ? (
                  <div className={`mt-3 text-center text-sm ${resetStatus.type === "success" ? "text-emerald-300" : "text-red-300"}`}>
                    {resetStatus.text}
                  </div>
                ) : null}

                <div className="mt-3 text-center text-sm text-white/80">
                  <button
                    type="button"
                    onClick={() => {
                      setView("login");
                      setResetStatus(null);
                    }}
                    className="font-semibold text-emerald-400 hover:text-emerald-300"
                  >
                    {messages.pages.userLogin.backToLogin}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>

      <div className="hidden md:block md:w-1/2 relative min-h-screen">
        <Image
          src="/uvod.jpg"
          alt="Fitbase login"
          fill
          priority
          className="object-cover"
        />
      </div>

      <div className="md:hidden w-full h-[300px] relative">
        <Image
          src="/uvod.jpg"
          alt="Fitbase login"
          fill
          priority
          className="object-cover"
        />
      </div>
    </div>
  );
}
