"use client";

import Image from "next/image";
import Link from "next/link";
import Script from "next/script";
import { useEffect, useState, useRef } from "react";

export default function RoadmapPage() {
  const vantaRef = useRef<HTMLDivElement>(null);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    let effect: any = null;

    const initVanta = () => {
      if (typeof window !== "undefined" && (window as any).VANTA && (window as any).VANTA.TOPOLOGY && vantaRef.current && !effect) {
        try {
          effect = (window as any).VANTA.TOPOLOGY({
            el: vantaRef.current,
            mouseControls: false,
            touchControls: false,
            gyroControls: false,
            minHeight: 200.00,
            minWidth: 200.00,
            scale: 1.00,
            scaleMobile: 1.00,
            color: 0x56ca56,
            backgroundColor: 0x0,
            points: 8,
            maxDistance: 15,
            spacing: 20,
            forceAnimate: true
          });
        } catch (err) {
          console.error("Vanta init error:", err);
        }
      }
    };

    const timer = setTimeout(initVanta, 1000);
    return () => {
      clearTimeout(timer);
      if (effect) {
        effect.destroy();
        effect = null;
      }
    };
  }, []);

  const roadmapItems = [
    {
      title: "1. Pridanie predplatného",
      description: "Tréneri si budú môcť pridať paywall pre prémiový obsah pre predplatiteľov.",
      icon: (
        <svg className="w-6 h-6 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    },
    {
      title: "2. Interaktívna mapa",
      description: "Interaktívna mapa pre používateľov, na ktorej budú vidieť všetkých zaregistrovaných trénerov vo svojom okolí a budú ich môcť filtrovať, vyhľadávať atď.",
      icon: (
        <svg className="w-6 h-6 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      )
    }
  ];

  return (
    <>
      <div className="fixed inset-0 z-[-20] bg-black" />
      <div 
        ref={vantaRef} 
        className="fixed inset-0 z-[-10] opacity-40 pointer-events-none w-full h-full" 
        style={{ height: '100dvh' }}
      />

      <div className="min-h-screen text-white selection:bg-emerald-500/30 relative z-0">
        <Script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.1.9/p5.min.js" strategy="beforeInteractive" />
        <Script 
          src="https://cdn.jsdelivr.net/npm/vanta@latest/dist/vanta.topology.min.js" 
          strategy="afterInteractive"
          onLoad={() => {
            if ((window as any).VANTA?.TOPOLOGY && vantaRef.current) {
              (window as any).VANTA.TOPOLOGY({
                el: vantaRef.current,
                mouseControls: false,
                touchControls: false,
                gyroControls: false,
                minHeight: 200.00,
                minWidth: 200.00,
                scale: 1.00,
                scaleMobile: 1.00,
                color: 0x56ca56,
                backgroundColor: 0x0,
                points: 8,
                maxDistance: 15,
                spacing: 20,
                forceAnimate: true
              });
            }
          }}
        />

        <nav className="fixed top-0 left-0 right-0 z-50 px-4 md:px-6 pt-4 md:pt-6">
          <div className={`mx-auto max-w-6xl rounded-full border border-emerald-500/30 backdrop-blur-md shadow-[0_6px_18px_rgba(0,0,0,0.45)] transition-all duration-300 ${isScrolled ? "bg-black/85 py-0.5" : "bg-black/55 py-1"}`}>
            <div className="flex items-center justify-between px-8 md:px-12">
              <Link href="/" className="flex items-center gap-2">
                <Image src="/Fitbase logo.png" alt="Fitbase" width={120} height={28} priority className="h-auto w-[100px] md:w-[120px]" />
              </Link>
              <Link href="/" className="text-xs font-bold uppercase tracking-widest text-zinc-400 hover:text-white transition-colors">
                Späť na hlavnú stránku
              </Link>
            </div>
          </div>
        </nav>

        <section className="pt-40 pb-20 md:pt-48 md:pb-32 px-4 md:px-6">
          <div className="container mx-auto max-w-4xl text-center">
            <h1 className="font-display text-4xl md:text-6xl uppercase leading-[0.95] tracking-tight mb-8">
              Roadmap <br /> <span className="text-emerald-500">Budúcnosť Fitbase</span>
            </h1>
            <p className="text-zinc-400 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed mb-16">
              Ak bude aplikácia úspešná, toto sú najbližšie úpravy a vymoženosti, ktoré pre vás chystáme.
            </p>

            <div className="grid gap-8">
              {roadmapItems.map((item, index) => (
                <div 
                  key={index}
                  className="group relative overflow-hidden rounded-[2.5rem] border border-white/5 bg-zinc-900/20 p-8 md:p-12 text-left backdrop-blur-sm hover:border-emerald-500/30 transition-all duration-500"
                >
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                    <div className="absolute inset-0 bg-emerald-500/5" />
                  </div>
                  
                  <div className="relative flex flex-col md:flex-row gap-8 items-start">
                    <div className="shrink-0 w-16 h-16 rounded-2xl border border-emerald-500/20 bg-black/40 flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.1)] group-hover:shadow-[0_0_30px_rgba(16,185,129,0.2)] transition-all duration-500">
                      {item.icon}
                    </div>
                    <div className="space-y-4">
                      <h2 className="text-3xl md:text-4xl font-display uppercase tracking-tight text-white group-hover:text-emerald-400 transition-colors duration-500">
                        {item.title}
                      </h2>
                      <p className="text-zinc-400 text-lg md:text-xl leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-12 text-zinc-500 text-sm font-medium italic opacity-60">
              A omnoho viac...
            </div>
          </div>
        </section>

        <footer className="py-12 border-t border-white/5">
          <div className="container mx-auto px-4 md:px-6 flex flex-col md:flex-row justify-between items-center gap-8">
            <Image src="/Fitbase logo.png" alt="Fitbase" width={100} height={24} className="opacity-50" />
            <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">
              © 2026 Fitbase. Všetky práva vyhradené.
            </div>
            <div className="flex flex-wrap justify-center gap-x-8 gap-y-4 text-[10px] font-bold uppercase tracking-widest text-zinc-600">
              <Link href="/" className="hover:text-white transition-colors">Domov</Link>
              <Link href="/podpora" className="hover:text-white transition-colors">Podpora</Link>
              <Link href="/o-nas" className="hover:text-white transition-colors">O nás</Link>
            </div>
          </div>
        </footer>
      </div>

      <style jsx global>{`
        html, body {
          background-color: black;
        }
        @import url('https://fonts.googleapis.com/css2?family=League+Gothic&display=swap');
        .font-display {
          font-family: 'League Gothic', sans-serif;
        }
      `}</style>
    </>
  );
}
