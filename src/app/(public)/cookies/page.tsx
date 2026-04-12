"use client";

import Link from "next/link";

export default function CookiesPage() {
  return (
    <div className="min-h-screen bg-black text-white py-32 px-4 md:px-6">
      <div className="container mx-auto max-w-3xl">
        <h1 className="text-4xl md:text-6xl font-display uppercase tracking-tight mb-4 text-emerald-500">
          Zásady používania cookies
        </h1>
        <p className="text-zinc-500 text-sm mb-12">Posledná aktualizácia: 12. 4. 2026</p>

        <div className="space-y-12 text-zinc-300 leading-relaxed">
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Čo sú cookies?</h2>
            <p>
              Cookies sú malé textové súbory, ktoré sa ukladajú do vášho prehliadača pri návšteve našej webovej stránky. Pomáhajú nám zabezpečiť základné fungovanie webu, analyzovať návštevnosť a prispôsobiť obsah vašim potrebám.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Aké cookies používame?</h2>
            <div className="space-y-6">
              <div className="p-6 rounded-2xl bg-zinc-900/50 border border-white/5">
                <h3 className="text-emerald-400 font-bold uppercase text-xs tracking-widest mb-2">Nevyhnutné cookies</h3>
                <p className="text-sm">Tieto cookies sú nevyhnutné pre správne fungovanie našej webovej stránky (napr. prihlásenie, bezpečnosť, platby cez Stripe). Bez nich by stránka nefungovala správne.</p>
              </div>
              
              <div className="p-6 rounded-2xl bg-zinc-900/50 border border-white/5">
                <h3 className="text-emerald-400 font-bold uppercase text-xs tracking-widest mb-2">Analytické cookies</h3>
                <p className="text-sm">Umožňujú nám sledovať návštevnosť a správanie používateľov na webe (napr. ktoré stránky sú najobľúbenejšie). Tieto údaje sú anonymizované.</p>
              </div>

              <div className="p-6 rounded-2xl bg-zinc-900/50 border border-white/5">
                <h3 className="text-emerald-400 font-bold uppercase text-xs tracking-widest mb-2">Marketingové cookies</h3>
                <p className="text-sm">Používajú sa na sledovanie návštevníkov naprieč webovými stránkami. Cieľom je zobrazovať reklamy, ktoré sú pre vás relevantné a zaujímavé.</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Ako spravovať cookies?</h2>
            <p>
              Svoje nastavenia cookies môžete kedykoľvek zmeniť priamo na našej stránke cez tlačidlo „Nastavenia“ v cookie banneri, alebo vo svojom internetovom prehliadači.
            </p>
            <p className="mt-4">
              Väčšina prehliadačov umožňuje cookies vymazať, zablokovať ich ukladanie alebo nastaviť upozornenie pred ich uložením.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Kontakt</h2>
            <p>Ak máte akékoľvek otázky k našim zásadám cookies, kontaktujte nás na:</p>
            <a href="mailto:info@fitbase.sk" className="text-emerald-400 hover:text-emerald-300 font-bold underline">
              info@fitbase.sk
            </a>
          </section>
        </div>

        <div className="mt-20 pt-8 border-t border-white/5">
          <Link href="/" className="text-sm font-bold uppercase tracking-widest text-zinc-500 hover:text-white transition-colors">
            ← Späť na hlavnú stránku
          </Link>
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
