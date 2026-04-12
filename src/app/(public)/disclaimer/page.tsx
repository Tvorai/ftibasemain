import Link from "next/link";

export default function DisclaimerPage() {
  return (
    <div className="min-h-screen bg-black text-white py-32 px-4 md:px-6">
      <div className="container mx-auto max-w-3xl">
        <h1 className="text-4xl md:text-6xl font-display uppercase tracking-tight mb-4 text-emerald-500">
          Disclaimer
        </h1>
        <h2 className="text-2xl font-bold mb-12">ZDRAVOTNÉ UPOZORNENIE</h2>

        <div className="space-y-8 text-zinc-300 leading-relaxed text-lg">
          <p>Fitbase neposkytuje zdravotnícke služby ani lekárske poradenstvo.</p>
          
          <p>Tréningy a jedálničky sprostredkované cez platformu slúžia na všeobecné zlepšenie kondície a dosiahnutie osobných fitness cieľov.</p>

          <div className="bg-zinc-900/50 border border-white/5 p-8 rounded-[2rem] space-y-4">
            <p className="font-bold text-white uppercase text-xs tracking-widest">Každý používateľ:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>cvičí na vlastnú zodpovednosť</li>
              <li>by mal pred začatím akéhokoľvek nového cvičebného programu konzultovať svoj zdravotný stav s lekárom</li>
            </ul>
          </div>

          <p className="text-zinc-400 italic">Fitbase nezodpovedá za akékoľvek zranenia, zdravotné komplikácie alebo iné škody vzniknuté v súvislosti s využívaním služieb trénerov.</p>
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
