"use client";

import Link from "next/link";

export default function PodmienkyPage() {
  return (
    <div className="min-h-screen bg-black text-white py-32 px-4 md:px-6">
      <div className="container mx-auto max-w-3xl">
        <h1 className="text-4xl md:text-6xl font-display uppercase tracking-tight mb-4 text-emerald-500">
          Obchodné podmienky
        </h1>
        <p className="text-zinc-500 text-sm mb-12">Posledná aktualizácia: 12. 4. 2026</p>

        <div className="space-y-12 text-zinc-300 leading-relaxed">
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">1. Úvod</h2>
            <p>Tieto obchodné podmienky upravujú používanie platformy Fitbase.</p>
            <p className="mt-4">Fitbase je online platforma, ktorá prepája klientov a trénerov za účelom poskytovania fitness služieb.</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">2. Služby</h2>
            <p>Platforma umožňuje:</p>
            <ul className="list-disc pl-6 mt-2 space-y-2">
              <li>rezerváciu osobných tréningov</li>
              <li>online konzultácie</li>
              <li>objednávku jedálničkov</li>
              <li>mesačné programy (premeny)</li>
            </ul>
            <p className="mt-4 italic">Fitbase nie je poskytovateľom samotných tréningových služieb, ale sprostredkovateľom.</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">3. Registrácia a účet</h2>
            <p>Používateľ je povinný:</p>
            <ul className="list-disc pl-6 mt-2 space-y-2">
              <li>uvádzať pravdivé údaje</li>
              <li>chrániť svoje prihlasovacie údaje</li>
              <li>neumožniť prístup tretím osobám</li>
            </ul>
            <p className="mt-4">Fitbase si vyhradzuje právo účet zablokovať pri porušení podmienok.</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">4. Platby</h2>
            <p>Platby sú spracovávané prostredníctvom služby Stripe.</p>
            <div className="mt-4 space-y-2">
              <p>Fitbase:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>neuchováva údaje o platobných kartách</li>
                <li>nezodpovedá za chyby platobnej brány</li>
              </ul>
            </div>
            <p className="mt-4 font-bold text-emerald-400">Cena služby je vždy uvedená pred platbou.</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">5. Zrušenie a zmeny rezervácie</h2>
            <p>Rezerváciu môže zrušiť klient alebo tréner.</p>
            <div className="mt-4 space-y-2">
              <p>V prípade zrušenia:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>klient je informovaný emailom</li>
                <li>môže dôjsť k dohode na náhradnom termíne</li>
              </ul>
            </div>
            <p className="mt-4 italic">Fitbase negarantuje automatické refundy. Refundy sú riešené individuálne medzi klientom a trénerom.</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">6. Zodpovednosť</h2>
            <p>Fitbase nezodpovedá za:</p>
            <ul className="list-disc pl-6 mt-2 space-y-2">
              <li>kvalitu služieb trénera</li>
              <li>správanie používateľov</li>
              <li>výsledky tréningu alebo jedálnička</li>
            </ul>
            <p className="mt-4 font-bold">Každý používateľ využíva služby na vlastnú zodpovednosť.</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">7. Recenzie</h2>
            <p>Používatelia môžu zanechať hodnotenie trénera.</p>
            <p className="mt-2">Fitbase si vyhradzuje právo odstrániť nevhodné alebo nepravdivé recenzie.</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">8. Ukončenie účtu</h2>
            <p>Používateľ môže požiadať o zrušenie účtu.</p>
            <p className="mt-2">Fitbase si vyhradzuje právo účet zrušiť pri porušení podmienok.</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">9. Zmeny podmienok</h2>
            <p>Fitbase si vyhradzuje právo tieto podmienky kedykoľvek upraviť.</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">10. Kontakt</h2>
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
