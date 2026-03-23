"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useI18n } from "@/providers/i18n";

export default function UserRegistrationPage() {
  const { locale, messages } = useI18n();

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
              {messages.pages.userRegistration.title.toUpperCase()}
            </h1>
            <p className="mt-3 text-sm italic text-white/70 md:text-base">
              {messages.pages.userRegistration.subtitle}
            </p>

            <form
              className="mt-7 space-y-3 md:mt-8"
              onSubmit={async (e) => {
                e.preventDefault();
                if (loading) return;
                setStatus(null);

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
                const res = await fetch("/api/user-registration", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({
                    fullName: safeFullName,
                    email: safeEmail,
                    password,
                    passwordRepeat,
                    locale
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

                setStatus({
                  type: "success",
                  text: json.message || "Registrácia prebehla úspešne. Skontrolujte e-mail pre potvrdenie účtu."
                });
              }}
            >
              <div>
                <label className="sr-only" htmlFor="fullName">
                  {messages.pages.userRegistration.fields.fullName}
                </label>
                <input
                  id="fullName"
                  name="fullName"
                  type="text"
                  placeholder={messages.pages.userRegistration.fields.fullName}
                  className="h-12 w-full rounded-full border border-emerald-500/80 bg-transparent px-5 text-white placeholder-white/70 outline-none ring-emerald-400 focus:ring-2"
                  autoComplete="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>

              <div>
                <label className="sr-only" htmlFor="email">
                  {messages.pages.userRegistration.fields.email}
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  placeholder={messages.pages.userRegistration.fields.email}
                  className="h-12 w-full rounded-full border border-emerald-500/80 bg-transparent px-5 text-white placeholder-white/70 outline-none ring-emerald-400 focus:ring-2"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div>
                <label className="sr-only" htmlFor="password">
                  {messages.pages.userRegistration.fields.password}
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  placeholder={messages.pages.userRegistration.fields.password}
                  className="h-12 w-full rounded-full border border-emerald-500/80 bg-transparent px-5 text-white placeholder-white/70 outline-none ring-emerald-400 focus:ring-2"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <div>
                <label className="sr-only" htmlFor="passwordRepeat">
                  {messages.pages.userRegistration.fields.passwordRepeat}
                </label>
                <input
                  id="passwordRepeat"
                  name="passwordRepeat"
                  type="password"
                  placeholder={messages.pages.userRegistration.fields.passwordRepeat}
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
                {messages.pages.userRegistration.submit.toUpperCase()}
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
                <Link href="/prihlasenie" className="font-semibold text-emerald-400 hover:text-emerald-300">
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
