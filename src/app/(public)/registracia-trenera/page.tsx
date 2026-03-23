"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useI18n } from "@/providers/i18n";
import { featureFlags, supabaseAnonKey, supabaseUrl } from "@/lib/config";

const supabase = featureFlags.supabaseEnabled
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

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

export default function TrainerRegistrationPage() {
  const { messages } = useI18n();
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordRepeat, setPasswordRepeat] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; text: string } | null>(null);

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="w-full px-4 py-6 md:px-12 md:py-10 lg:px-20">
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

        <div className="grid gap-10 md:grid-cols-[minmax(380px,520px)_1fr] md:items-center md:gap-16">
          <div className="max-w-xl md:max-w-none">
            <h1 className="font-display text-5xl leading-[0.9] tracking-wide md:text-6xl">
              {messages.pages.trainerRegistration.title.toUpperCase()}
            </h1>
            <p className="mt-3 text-sm italic text-white/70 md:text-base">
              {messages.pages.trainerRegistration.subtitle}
            </p>

            <form
              className="mt-7 space-y-3 md:mt-8"
              onSubmit={async (e) => {
                e.preventDefault();
                if (loading) return;
                setStatus(null);

                if (!supabase) {
                  setStatus({
                    type: "error",
                    text: "Registrácia momentálne nie je dostupná. Skúste to neskôr."
                  });
                  return;
                }

                const safeFullName = fullName.trim();
                const safeEmail = email.trim().toLowerCase();

                if (!safeFullName || !safeEmail || !password || !passwordRepeat) {
                  setStatus({ type: "error", text: "Vyplňte prosím všetky polia." });
                  return;
                }

                if (password !== passwordRepeat) {
                  setStatus({ type: "error", text: "Heslá sa nezhodujú." });
                  return;
                }

                setLoading(true);
                const signup = await supabase.auth.signUp({
                  email: safeEmail,
                  password,
                  options: {
                    data: {
                      full_name: safeFullName,
                      role: "trainer",
                      locale: "sk"
                    }
                  }
                });

                if (signup.error) {
                  setLoading(false);
                  setStatus({ type: "error", text: mapSignupErrorToSk(signup.error.message) });
                  return;
                }

                const userId = signup.data.user?.id;
                if (!userId) {
                  setLoading(false);
                  setStatus({ type: "error", text: "Registrácia zlyhala. Skúste to prosím znova." });
                  return;
                }

                setLoading(false);

                if (signup.data.session) {
                  router.push("/ucet-trenera");
                  return;
                }

                setStatus({
                  type: "success",
                  text: "Registrácia prebehla úspešne. Skontrolujte e-mail pre potvrdenie účtu."
                });
              }}
            >
              <div>
                <label className="sr-only" htmlFor="fullName">
                  {messages.pages.trainerRegistration.fields.fullName}
                </label>
                <input
                  id="fullName"
                  name="fullName"
                  type="text"
                  placeholder={messages.pages.trainerRegistration.fields.fullName}
                  className="h-12 w-full rounded-full border border-emerald-500/80 bg-transparent px-5 text-white placeholder-white/70 outline-none ring-emerald-400 focus:ring-2"
                  autoComplete="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>

              <div>
                <label className="sr-only" htmlFor="email">
                  {messages.pages.trainerRegistration.fields.email}
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  placeholder={messages.pages.trainerRegistration.fields.email}
                  className="h-12 w-full rounded-full border border-emerald-500/80 bg-transparent px-5 text-white placeholder-white/70 outline-none ring-emerald-400 focus:ring-2"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div>
                <label className="sr-only" htmlFor="password">
                  {messages.pages.trainerRegistration.fields.password}
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  placeholder={messages.pages.trainerRegistration.fields.password}
                  className="h-12 w-full rounded-full border border-emerald-500/80 bg-transparent px-5 text-white placeholder-white/70 outline-none ring-emerald-400 focus:ring-2"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <div>
                <label className="sr-only" htmlFor="passwordRepeat">
                  {messages.pages.trainerRegistration.fields.passwordRepeat}
                </label>
                <input
                  id="passwordRepeat"
                  name="passwordRepeat"
                  type="password"
                  placeholder={messages.pages.trainerRegistration.fields.passwordRepeat}
                  className="h-12 w-full rounded-full border border-emerald-500/80 bg-transparent px-5 text-white placeholder-white/70 outline-none ring-emerald-400 focus:ring-2"
                  autoComplete="new-password"
                  value={passwordRepeat}
                  onChange={(e) => setPasswordRepeat(e.target.value)}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="font-display mt-4 h-12 w-full rounded-full bg-emerald-500 text-center text-2xl tracking-wide text-black hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {messages.pages.trainerRegistration.submit.toUpperCase()}
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
                  href="/prihlasenie-trenera"
                  className="font-semibold text-emerald-400 hover:text-emerald-300"
                >
                  Prihlásiť sa
                </Link>
              </div>
            </form>
          </div>

          <div className="hidden md:block">
            <div className="relative ml-auto h-[560px] w-full max-w-[720px]">
              <Image
                src="/Fitbase register.png"
                alt=""
                fill
                priority
                className="object-contain object-right"
              />
            </div>
          </div>
        </div>

        <div className="mt-10 md:hidden">
          <div className="relative mx-auto h-[320px] w-full max-w-[380px]">
            <Image
              src="/Fitbase register.png"
              alt=""
              fill
              priority
              className="object-contain object-bottom"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
