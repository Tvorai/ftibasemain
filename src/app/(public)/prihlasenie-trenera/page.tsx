"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { featureFlags, supabaseAnonKey, supabaseUrl } from "@/lib/config";
import { ensureTrainerRowAfterLogin } from "@/lib/trainerBootstrap";

const supabase = featureFlags.supabaseEnabled
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

function mapLoginErrorToSk(message: string) {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "Nesprávny email alebo heslo.";
  if (m.includes("email not confirmed") || m.includes("confirm") || m.includes("not confirmed")) {
    return "Email ešte nie je potvrdený. Skontrolujte si poštu.";
  }
  return "Prihlásenie zlyhalo. Skúste to prosím znova.";
}

export default function TrainerLoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

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
              PRIHLÁSENIE TRÉNERA
            </h1>
            <p className="mt-3 text-sm italic text-white/70 md:text-base">
              Posuňte svoju profesiu na nový level
            </p>

            <form
              className="mt-7 space-y-3 md:mt-8"
              onSubmit={async (e) => {
                e.preventDefault();
                if (loading) return;

                setShowForgotPassword(false);
                setErrorText(null);

                if (!supabase) return;
                if (!email.trim() || !password) return;

                setLoading(true);
                const { error } = await supabase.auth.signInWithPassword({
                  email: email.trim(),
                  password
                });

                if (error) {
                  setLoading(false);
                  setShowForgotPassword(true);
                  setErrorText(mapLoginErrorToSk(error.message));
                  return;
                }

                const userRes = await supabase.auth.getUser();
                const userId = userRes.data.user?.id;
                if (!userId) {
                  setLoading(false);
                  setErrorText("Prihlásenie zlyhalo. Skúste to prosím znova.");
                  return;
                }

                const ensured = await ensureTrainerRowAfterLogin(supabase, userId);
                setLoading(false);

                if (!ensured.ok) {
                  setErrorText(ensured.message);
                  return;
                }

                router.push("/ucet-trenera");
              }}
            >
              <div>
                <label className="sr-only" htmlFor="email">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="Email"
                  className="h-12 w-full rounded-full border border-emerald-500/80 bg-transparent px-5 text-white placeholder-white/70 outline-none ring-emerald-400 focus:ring-2"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div>
                <label className="sr-only" htmlFor="password">
                  Heslo
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="Heslo"
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
                PRIHLÁSIŤ SA
              </button>

              {showForgotPassword ? (
                <div className="mt-3 text-center text-sm text-white/80">
                  Zabudli ste heslo?
                </div>
              ) : null}

              {errorText ? (
                <div className="mt-2 text-center text-sm text-red-300">{errorText}</div>
              ) : null}
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
