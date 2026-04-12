import Link from "next/link";

export default function SukromiePage() {
  return (
    <div className="min-h-screen bg-black text-white py-32 px-4 md:px-6">
      <div className="container mx-auto max-w-3xl">
        <h1 className="text-4xl md:text-6xl font-display uppercase tracking-tight mb-4 text-emerald-500">
          Ochrana osobných údajov (GDPR)
        </h1>
        <p className="text-zinc-500 text-sm mb-12">Posledná aktualizácia: 12. 4. 2026</p>

        <div className="space-y-12 text-zinc-300 leading-relaxed">
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">1. Prevádzkovateľ</h2>
            <p>Prevádzkovateľom platformy je Fitbase.</p>
            <p className="mt-2">Email: <a href="mailto:info@fitbase.sk" className="text-emerald-400 underline">info@fitbase.sk</a></p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">2. Spracúvané údaje</h2>
            <p>Spracúvame nasledujúce kategórie údajov:</p>
            <ul className="list-disc pl-6 mt-2 space-y-2">
              <li>meno a priezvisko</li>
              <li>email</li>
              <li>telefónne číslo</li>
              <li>údaje o rezerváciách a zakúpených službách</li>
              <li>komunikáciu medzi používateľmi v rámci platformy</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">3. Účel spracovania</h2>
            <ul className="list-disc pl-6 mt-2 space-y-2">
              <li>správa a prevádzka používateľského účtu</li>
              <li>sprostredkovanie rezervácií a fitness služieb</li>
              <li>spracovanie platieb a fakturácia</li>
              <li>zabezpečenie vzájomnej komunikácie medzi klientom a trénerom</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">4. Platby</h2>
            <p>Platby sú spracované cez zabezpečenú bránu Stripe. Fitbase neuchováva ani nespracúva údaje o vašich platobných kartách.</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">5. Uchovávanie údajov</h2>
            <p>Vaše údaje uchovávame:</p>
            <ul className="list-disc pl-6 mt-2 space-y-2">
              <li>počas celej doby trvania vášho účtu</li>
              <li>v nevyhnutnom rozsahu podľa zákonných a archivačných povinností</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">6. Práva používateľa</h2>
            <p>V súvislosti s GDPR máte právo:</p>
            <ul className="list-disc pl-6 mt-2 space-y-2">
              <li>na prístup k vašim osobným údajom</li>
              <li>na opravu nesprávnych údajov</li>
              <li>na vymazanie údajov („právo na zabudnutie“)</li>
              <li>na obmedzenie spracovania údajov</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">7. Kontakt</h2>
            <p>V prípade akýchkoľvek otázok ohľadom spracovania vašich údajov nás kontaktujte na:</p>
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
