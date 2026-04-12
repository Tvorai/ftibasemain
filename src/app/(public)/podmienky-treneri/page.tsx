"use client";

import Link from "next/link";

export default function PodmienkyTreneriPage() {
  return (
    <div className="min-h-screen bg-black text-white py-32 px-4 md:px-6">
      <div className="container mx-auto max-w-3xl">
        <h1 className="text-4xl md:text-6xl font-display uppercase tracking-tight mb-4 text-emerald-500">
          Podmienky pre trénerov
        </h1>
        <p className="text-zinc-500 text-sm mb-12">Posledná aktualizácia: 12. 4. 2026</p>

        <div className="space-y-12 text-zinc-300 leading-relaxed">
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">1. Úvod</h2>
            <p>Tieto podmienky upravujú používanie platformy Fitbase zo strany trénerov.</p>
            <p className="mt-4 text-emerald-400 font-medium">Fitbase je platforma, ktorá prepája trénerov a klientov. Fitbase neposkytuje samotné tréningové služby, ale sprostredkúva kontakt medzi používateľmi.</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">2. Registrácia trénera</h2>
            <p>Tréner je povinný:</p>
            <ul className="list-disc pl-6 mt-2 space-y-2">
              <li>uvádzať pravdivé a aktuálne údaje</li>
              <li>používať vlastný účet</li>
              <li>nezdielať prihlasovacie údaje s tretími osobami</li>
            </ul>
            <p className="mt-4">Fitbase si vyhradzuje právo odmietnuť alebo zrušiť účet trénera.</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">3. Profil trénera</h2>
            <p>Tréner je zodpovedný za:</p>
            <ul className="list-disc pl-6 mt-2 space-y-2">
              <li>správnosť informácií v profile</li>
              <li>kvalitu popisu služieb</li>
              <li>aktuálnosť cien</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">4. Platby a Stripe</h2>
            <p>Tréner je povinný mať aktívne Stripe konto a správne vyplniť onboarding v Stripe.</p>
            <div className="mt-4 space-y-2">
              <p>Platby:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>sú spracované cez Stripe</li>
                <li>Fitbase neuchováva údaje o kartách</li>
              </ul>
            </div>
            <div className="mt-4 p-4 rounded-xl bg-red-500/5 border border-red-500/10">
              <p className="text-sm font-bold uppercase text-red-400 mb-2">Fitbase nezodpovedá za:</p>
              <ul className="list-disc pl-6 space-y-1 text-sm">
                <li>chyby Stripe</li>
                <li>oneskorené platby</li>
                <li>bankové problémy</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">5. Poskytovanie služieb</h2>
            <p>Tréner je plne zodpovedný za:</p>
            <ul className="list-disc pl-6 mt-2 space-y-2">
              <li>priebeh tréningu</li>
              <li>komunikáciu s klientom</li>
              <li>bezpečnosť klienta počas tréningu</li>
            </ul>
            <p className="mt-4 italic">Fitbase nenesie zodpovednosť za kvalitu alebo výsledok služby.</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">6. Zrušenie rezervácie</h2>
            <p>Ak tréner zruší rezerváciu:</p>
            <ul className="list-disc pl-6 mt-2 space-y-2">
              <li>musí uviesť dôvod</li>
              <li>klient je informovaný emailom</li>
            </ul>
            <p className="mt-4 font-bold text-emerald-400">Odporúča sa ponúknuť náhradný termín.</p>
            <p className="mt-2 text-zinc-500">Fitbase nenesie zodpovednosť za finančné dohody medzi trénerom a klientom.</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">7. Recenzie</h2>
            <p>Klienti môžu hodnotiť trénera. Tréner súhlasí so zverejnením hodnotení a s tým, že recenzie môžu ovplyvniť jeho profil.</p>
            <p className="mt-2 text-sm">Fitbase si vyhradzuje právo odstrániť nevhodné recenzie.</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">8. Zakázané správanie</h2>
            <p>Tréner nesmie:</p>
            <ul className="list-disc pl-6 mt-2 space-y-2">
              <li>poskytovať nepravdivé informácie</li>
              <li>obchádzať platby mimo platformy</li>
              <li>správať sa nevhodne voči klientom</li>
            </ul>
            <p className="mt-4 text-red-400">Pri porušení môže byť účet pozastavený alebo zrušený.</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">9. Zodpovednosť</h2>
            <p>Tréner berie na vedomie, že klient využíva služby dobrovoľne a tréning prebieha na vlastnú zodpovednosť klienta.</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">10. Ukončenie spolupráce</h2>
            <p>Fitbase môže ukončiť spoluprácu s trénerom bez udania dôvodu alebo pri porušení podmienok.</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">11. Zmeny podmienok</h2>
            <p>Fitbase si vyhradzuje právo tieto podmienky meniť.</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">12. Kontakt</h2>
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
