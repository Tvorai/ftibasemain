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
            <p className="mt-3 text-sm italic text-white/70 md:text-base">
              {view === "forgot-password"
                ? messages.pages.userLogin.forgotPasswordSubtitle
                : (authMode === "trainer" ? "Posuňte svoju profesiu na nový level" : messages.pages.userLogin.subtitle)}
            </p>

            {view === "login" ? (
              <form
                className="mt-7 space-y-3 md:mt-8"
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
                  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
                    redirectTo: `${window.location.origin}/reset-hesla`
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
