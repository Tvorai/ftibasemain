"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { featureFlags, supabaseAnonKey, supabaseUrl } from "@/lib/config";
import { useI18n } from "@/providers/i18n";

const supabase = featureFlags.supabaseEnabled ? createClient(supabaseUrl, supabaseAnonKey) : null;

export default function UserLoginPage() {
  const { messages } = useI18n();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);

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
              {messages.pages.userLogin.title.toUpperCase()}
            </h1>
            <p className="mt-3 text-sm italic text-white/70 md:text-base">
              {messages.pages.userLogin.subtitle}
            </p>

            <form
              className="mt-7 space-y-3 md:mt-8"
              onSubmit={async (e) => {
                e.preventDefault();
                if (loading) return;

                setShowForgotPassword(false);

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

                router.push("/ucet");
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

              {showForgotPassword ? (
                <div className="mt-3 text-center text-sm text-white/80">
                  {messages.pages.userLogin.forgotPasswordHint}
                </div>
              ) : null}

              <div className="mt-3 text-center text-sm text-white/80">
                <span>Nemáte účet? </span>
                <Link href="/registracia" className="font-semibold text-emerald-400 hover:text-emerald-300">
                  Registrovať sa
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
