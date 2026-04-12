"use client";

import { useState } from "react";
import Link from "next/link";

export default function PodporaPage() {
  const [category, setCategory] = useState<"klienti" | "treneri">("klienti");

  return (
    <div className="min-h-screen bg-black text-white pb-24">
      <div className="container mx-auto px-4 pt-32 max-w-4xl">
        <h1 className="text-4xl md:text-6xl font-display uppercase tracking-tight text-center mb-12">
          Centrum podpory
        </h1>

        {/* Toggle Buttons */}
        <div className="flex justify-center gap-4 mb-16 p-1.5 bg-zinc-900/50 backdrop-blur-md rounded-full border border-white/5 w-fit mx-auto">
          <button
            onClick={() => setCategory("klienti")}
            className={`px-8 py-3 rounded-full text-xs font-bold uppercase tracking-widest transition-all ${
              category === "klienti"
                ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            Klienti
          </button>
          <button
            onClick={() => setCategory("treneri")}
            className={`px-8 py-3 rounded-full text-xs font-bold uppercase tracking-widest transition-all ${
              category === "treneri"
                ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            Tréneri
          </button>
        </div>

        {/* Content Section */}
        <div className="space-y-8">
          {category === "klienti" ? (
            <>
              {/* KLIENTI - AKO SA ZAREGISTROVAŤ */}
              <div className="p-8 rounded-[2.5rem] bg-zinc-900/30 border border-white/5 hover:border-emerald-500/20 transition-all">
                <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                  <span>📝</span> Ako sa zaregistrovať?
                </h2>
                <div className="space-y-4 text-zinc-400">
                  <p className="font-bold text-white uppercase text-xs tracking-widest">Postup:</p>
                  <ol className="list-decimal pl-5 space-y-2">
                    <li>Prejdite na <Link href="https://fitbase.sk/registracia" className="text-emerald-400 hover:underline">https://fitbase.sk/registracia</Link></li>
                    <li>Zadajte:
                      <ul className="list-disc pl-5 mt-1">
                        <li>emailovú adresu</li>
                        <li>heslo</li>
                      </ul>
                    </li>
                    <li>Potvrďte registráciu</li>
                    <li>Prihláste sa do svojho účtu</li>
                  </ol>
                  <div className="mt-6 p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/10">
                    <p className="text-sm italic"><span className="font-bold text-emerald-500 not-italic uppercase text-[10px] tracking-widest mr-2">Tip:</span> 
                    Používajte email, ku ktorému máte prístup – budú vám naň chodiť rezervácie a dôležité informácie.</p>
                  </div>
                </div>
              </div>

              {/* KLIENTI - AKO SI REZERVOVAŤ TRÉNING */}
              <div className="p-8 rounded-[2.5rem] bg-zinc-900/30 border border-white/5 hover:border-emerald-500/20 transition-all">
                <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                  <span>🏋️</span> Ako si rezervovať tréning?
                </h2>
                <div className="space-y-4 text-zinc-400">
                  <p className="font-bold text-white uppercase text-xs tracking-widest">Postup:</p>
                  <ol className="list-decimal pl-5 space-y-2">
                    <li>Zvoľte typ služby:
                      <ul className="list-disc pl-5 mt-1">
                        <li>osobný tréning</li>
                        <li>online konzultácia</li>
                        <li>jedálniček na mieru</li>
                        <li>mesačná premena</li>
                      </ul>
                    </li>
                    <li>Vyberte si voľný termín</li>
                    <li>Kliknite na Rezervovať</li>
                    <li>Dokončite platbu</li>
                  </ol>
                  <div className="mt-6 p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/10">
                    <p className="text-sm italic"><span className="font-bold text-emerald-500 not-italic uppercase text-[10px] tracking-widest mr-2">Tip:</span> 
                    Vyberajte si termín, ktorý vám reálne vyhovuje.</p>
                  </div>
                </div>
              </div>

              {/* KLIENTI - AKO ZAPLATIŤ ZA SLUŽBU */}
              <div className="p-8 rounded-[2.5rem] bg-zinc-900/30 border border-white/5 hover:border-emerald-500/20 transition-all">
                <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                  <span>💳</span> Ako zaplatiť za službu?
                </h2>
                <div className="space-y-4 text-zinc-400">
                  <p className="font-bold text-white uppercase text-xs tracking-widest">Postup:</p>
                  <ol className="list-decimal pl-5 space-y-2">
                    <li>Po rezervácii budete presmerovaný na platobnú stránku Stripe</li>
                  </ol>
                  <p className="mt-4">Zaplatiť môžete nasledujúcimi spôsobmi:</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Apple Pay</li>
                    <li>zadanie údajov karty</li>
                    <li>Google Pay</li>
                    <li>Pay with Link</li>
                  </ul>
                  <p className="mt-2">2. Potvrďte platbu</p>
                </div>
              </div>

              {/* KLIENTI - KDE NÁJDEM SVOJE TRÉNINGY */}
              <div className="p-8 rounded-[2.5rem] bg-zinc-900/30 border border-white/5 hover:border-emerald-500/20 transition-all">
                <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                  <span>📅</span> Kde nájdem svoje tréningy?
                </h2>
                <div className="space-y-4 text-zinc-400">
                  <p className="font-bold text-white uppercase text-xs tracking-widest">Postup:</p>
                  <ol className="list-decimal pl-5 space-y-2">
                    <li>Prihláste sa do účtu ( <Link href="https://fitbase.sk/ucet" className="text-emerald-400 hover:underline">https://fitbase.sk/ucet</Link> )</li>
                    <li>Prejdite do sekcie Moje tréningy</li>
                    <li>Vyberte podľa sekcie:
                      <ul className="list-disc pl-5 mt-1">
                        <li>osobný tréning</li>
                        <li>online konzultácia</li>
                        <li>objednávka jedálničku</li>
                        <li>premena</li>
                        <li>história (minulé)</li>
                      </ul>
                    </li>
                  </ol>
                </div>
              </div>

              {/* KLIENTI - AKO NAPÍSAŤ RECENZIU */}
              <div className="p-8 rounded-[2.5rem] bg-zinc-900/30 border border-white/5 hover:border-emerald-500/20 transition-all">
                <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                  <span>⭐</span> Ako napísať recenziu?
                </h2>
                <div className="space-y-4 text-zinc-400">
                  <p className="font-bold text-white uppercase text-xs tracking-widest">Postup:</p>
                  <ol className="list-decimal pl-5 space-y-2">
                    <li>Prejdite do Histórie</li>
                    <li>Vyberte tréning</li>
                    <li>Kliknite na Napísať recenziu</li>
                    <li>Ohodnoťte trénera a napíšte skúsenosť</li>
                  </ol>
                  <div className="mt-6 p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/10">
                    <p className="text-sm italic"><span className="font-bold text-emerald-500 not-italic uppercase text-[10px] tracking-widest mr-2">Tip:</span> 
                    Recenzie pomáhajú ostatným klientom.</p>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* TRÉNERI - AKO ZAČAŤ AKO TRÉNER */}
              <div className="p-8 rounded-[2.5rem] bg-zinc-900/30 border border-white/5 hover:border-emerald-500/20 transition-all">
                <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                  <span>🚀</span> Ako začať ako tréner?
                </h2>
                <div className="space-y-4 text-zinc-400">
                  <p className="font-bold text-white uppercase text-xs tracking-widest">Postup:</p>
                  <ol className="list-decimal pl-5 space-y-2">
                    <li>Vytvorte si účet ( <Link href="https://fitbase.sk/registracia?mode=trainer" className="text-emerald-400 hover:underline">https://fitbase.sk/registracia?mode=trainer</Link> )</li>
                    <li>Vyplňte profil:
                      <ul className="list-disc pl-5 mt-1">
                        <li>meno a priezvisko</li>
                        <li>telefónne číslo</li>
                        <li>email</li>
                        <li>heslo</li>
                      </ul>
                    </li>
                    <li>Nastavte ceny</li>
                  </ol>
                </div>
              </div>

              {/* TRÉNERI - AKO NAPOJIŤ STRIPE */}
              <div className="p-8 rounded-[2.5rem] bg-zinc-900/30 border border-white/5 hover:border-emerald-500/20 transition-all">
                <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                  <span>💰</span> Ako napojiť Stripe (prijímanie platieb)?
                </h2>
                <div className="space-y-4 text-zinc-400">
                  <p className="font-bold text-white uppercase text-xs tracking-widest">Postup:</p>
                  <ol className="list-decimal pl-5 space-y-2">
                    <li>Choďte do Nastavení</li>
                    <li>Kliknite na Prepojiť Stripe</li>
                    <li>Vyplňte:
                      <ul className="list-disc pl-5 mt-1">
                        <li>bankový účet</li>
                        <li>osobné údaje</li>
                      </ul>
                    </li>
                    <li>Dokončite onboarding</li>
                  </ol>
                  <div className="mt-6 p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/10">
                    <p className="text-sm italic font-bold text-emerald-500 uppercase text-[10px] tracking-widest">
                      Dôležité: Bez Stripe nemôžete prijímať platby.
                    </p>
                  </div>
                </div>
              </div>

              {/* TRÉNERI - AKO OZNAČIŤ TRÉNING AKO DOKONČENÝ */}
              <div className="p-8 rounded-[2.5rem] bg-zinc-900/30 border border-white/5 hover:border-emerald-500/20 transition-all">
                <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                  <span>✅</span> Ako označiť tréning ako dokončený?
                </h2>
                <div className="space-y-4 text-zinc-400">
                  <p className="font-bold text-white uppercase text-xs tracking-widest">Postup:</p>
                  <ol className="list-decimal pl-5 space-y-2">
                    <li>Choďte do svojho účtu ( <Link href="https://fitbase.sk/ucet-trenera" className="text-emerald-400 hover:underline">https://fitbase.sk/ucet-trenera</Link> )</li>
                    <li>Prejdite do záložky „Všetky rezervácie“</li>
                    <li>Otvorte rezerváciu</li>
                    <li>Kliknite na Dokončené</li>
                  </ol>
                  <p className="font-bold text-white uppercase text-xs tracking-widest mt-6">Výsledok:</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>klient dostane email</li>
                    <li>môže napísať recenziu</li>
                    <li>môže si rezervovať ďalší tréning</li>
                  </ul>
                </div>
              </div>

              {/* TRÉNERI - AKO ZRUŠIŤ TRÉNING */}
              <div className="p-8 rounded-[2.5rem] bg-zinc-900/30 border border-white/5 hover:border-emerald-500/20 transition-all">
                <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                  <span>❌</span> Ako zrušiť tréning?
                </h2>
                <div className="space-y-4 text-zinc-400">
                  <p className="font-bold text-white uppercase text-xs tracking-widest">Postup:</p>
                  <ol className="list-decimal pl-5 space-y-2">
                    <li>Choďte do svojho účtu ( <Link href="https://fitbase.sk/ucet-trenera" className="text-emerald-400 hover:underline">https://fitbase.sk/ucet-trenera</Link> )</li>
                    <li>Prejdite do záložky „Všetky rezervácie“</li>
                    <li>Otvorte rezerváciu</li>
                    <li>Kliknite na Zrušiť</li>
                    <li>Vyberte dôvod</li>
                    <li>Potvrďte</li>
                  </ol>
                  <p className="font-bold text-white uppercase text-xs tracking-widest mt-6">Výsledok:</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>klient dostane email</li>
                    <li>vidí dôvod zrušenia</li>
                  </ul>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=League+Gothic&display=swap');
        .font-display {
          font-family: 'League Gothic', sans-serif;
        }
      `}</style>
    </div>
  );
}
