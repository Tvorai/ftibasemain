"use client";

import Link from "next/link";
import Image from "next/image";

export function Footer() {
  return (
    <footer className="w-full bg-black pt-6 pb-8 px-6 rounded-b-[30px] md:rounded-b-2xl">
      <div className="max-w-md mx-auto bg-zinc-950/50 border border-white/5 rounded-[40px] p-8 flex flex-col items-center text-center shadow-2xl">
        <div className="flex items-center gap-2 mb-4">
          <Image src="/simplelogo.png" alt="Fitbase" width={28} height={28} />
          <span className="text-xl font-display font-black tracking-tighter uppercase italic">Fitbase</span>
        </div>
        
        <h3 className="text-xl md:text-2xl font-display font-bold uppercase tracking-tight mb-2 leading-tight">
          Si tréner? Pridaj sa k nám!
        </h3>
        
        <Link 
          href="/registracia-trenera"
          className="text-[14px] text-emerald-500 font-bold hover:text-emerald-400 transition-colors underline underline-offset-4 decoration-emerald-500/30 hover:decoration-emerald-500"
        >
          Registrovať sa zdarma
        </Link>
      </div>
      
      <div className="mt-4 text-center text-[10px] text-zinc-600 uppercase tracking-widest font-bold">
        © {new Date().getFullYear()} Fitbase. Všetky práva vyhradené.
      </div>
    </footer>
  );
}
