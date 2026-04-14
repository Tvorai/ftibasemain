"use client";

import Image from "next/image";
import Link from "next/link";
import Script from "next/script";
import { useEffect, useState, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import { supabaseAnonKey, supabaseUrl } from "@/lib/config";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Final trigger for deployment
export default function HomePage() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const vantaRef = useRef<HTMLDivElement>(null);
  const vantaEffectRef = useRef<{ destroy: () => void } | null>(null);
  const [threeReady, setThreeReady] = useState(false);
  const [p5Ready, setP5Ready] = useState(false);
  const [vantaReady, setVantaReady] = useState(false);
  const [activeIndex, setActiveIndex] = useState(2);
  const [user, setUser] = useState<any>(null);
  const [isTrainer, setIsTrainer] = useState(false);

  // Features Slider State
  const [activeFeature, setActiveFeature] = useState(0);

  const features = [
    {
      title: "Ponúkajte služby",
      description: "Ponúkajte nasledujúce služby: Osobný tréning, Online konzultácia, Jedálniček na mieru a Mesačná premena.",
      image: "/Funkcia1.webp"
    },
    {
      title: "Využite silu umelej inteligencie",
      description: "Používajte zdarma umelú inteligenciu na tvorbu jedálničkov podľa vyplnených údajov klienta. To, čo vám predtým trvalo hodiny, vám teraz bude trvať 30 sekúnd.",
      image: "/Funkcia2.webp"
    },
    {
      title: "Používajte štatistiky na zlepšenie",
      description: "V Stripe dashboarde uvidíte detailné štatistiky platieb a budete si môcť zanalizovať svoje zárobky každý deň.",
      image: "/Funkcia3.webp"
    },
    {
      title: "Opakovaný tréning na jeden klik",
      description: "Po úspešnom dokončení tréningu sa klientovi ihneď zobrazí tlačidlo „Opakovať tréning“. Po kliknutí sa okamžite zarezervuje ďalší termín.",
      image: "/Funkcia4.webp"
    },
    {
      title: "Recenzie",
      description: "Hneď po dokončení tréningu sa klientovi v profile zobrazí tlačidlo na napísanie recenzie. Vaši potenciálni klienti tak uvidia reálne hodnotenia, čo zvyšuje šancu na získanie nových spoluprác.",
      image: "/Funkcia5.webp"
    },
    {
      title: "Výsledky klientov",
      description: "Podobne ako pri recenziách, vaši potenciálni klienti uvidia reálne výsledky vašich klientov, ktoré môžete jednoducho pridávať do svojho profilu.",
      image: "/Funkcia6.webp"
    },
    {
      title: "Budujte dôveryhodnosť",
      description: "Vďaka kombinácii týchto funkcií budujete u klientov vyššiu dôveryhodnosť a efektívne si rozširujete svoju klientelu.",
      image: "/Funkcia7.webp"
    }
  ];

  // FAQ States
  const [faqCategory, setFaqCategory] = useState<"trainer" | "client">("trainer");
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  // Hero Slider State
  const [heroImageIndex, setHeroImageIndex] = useState(0);
  const heroImages = ["/uvod 1.webp", "/uvod 2.webp", "/uvod 3.webp"];

  useEffect(() => {
    const interval = setInterval(() => {
      setHeroImageIndex((prev) => (prev + 1) % heroImages.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const trainerFaqs = [
    { q: "Ako dlho trvá registrácia?", a: "Registrácia profilu a nastavenie služieb zaberie len pár minút. Následne prepojíte svoj Stripe účet a môžete prijímať platby od klientov." },
    { q: "Prečo by som mal začať používať Fitbase?", a: "Ak ste fitness tréner a ste unavený z neustáleho odpisovania klientom, z opakovaného posielania výsledkov, recenzií a podobne, platenia zahraničných platforiem alebo používania rezervačných platforiem, ktoré nie sú určené pre fitness. Fitbase je rezervačný systém na princípe Linktree, ktorý je svojimi funkciami navrhnutý pre trénerov." },
    { q: "Musím mať firmu alebo živnosť?", a: "Závisí to od Stripe onboarding procesu v danej krajine. Vo väčšine prípadov môžete začať aj ako fyzická osoba, avšak odporúčame konzultáciu s účtovníkom." },
    { q: "Môžem ponúkať len jednu službu?", a: "Áno, môžete si vybrať, či chcete ponúkať len osobné tréningy, online konzultácie, jedálničky alebo ich kombináciu." },
    { q: "Ako dostanem peniaze?", a: "Peniaze od klientov chodia priamo na váš prepojený Stripe účet, odkiaľ si ich môžete nechať posielať na svoj bankový účet." },
    { q: "Môžem si nastavovať ceny?", a: "Samozrejme, ceny za všetky svoje služby si určujete vy sami a kedykoľvek ich môžete zmeniť v nastaveniach profilu." },
    { q: "Je platforma platená?", a: "Nie, registrácia je úplne zadarmo. Jediný poplatok je 10 % z každej úspešnej transakcie." },
    { q: "Som na platformu viazaný?", a: "Nie, ak nebudete spokojný, tak ju jednoducho prestanete používať." },
    { q: "Akú mám istotu, že mi budú peniaze vyplatené?", a: "Všetky platby prebiehajú cez celosvetovo známu a dôveryhodnú platformu Stripe. Po platbe od klienta Stripe automaticky rozdelí peniaze medzi účet platformy a účet trénera. Platforma nemá prístup k vášmu Stripe účtu." }
  ];

  const clientFaqs = [
    { q: "Ako si zarezervujem tréning?", a: "Jednoducho si vyberiete trénera, konkrétnu službu a voľný termín v jeho kalendári. Po potvrdení a zaplatení je termín váš." },
    { q: "Musím platiť vopred?", a: "Áno, platba vopred cez zabezpečenú bránu garantuje váš termín a šetrí čas vám aj trénerovi." },
    { q: "Čo ak musím tréning zrušiť?", a: "V prvotnej fáze projektu je zrušenie zo strany klienta nemožné, ale ak budete potrebovať zmeniť termín, tak stačí kontaktovať trénera, ktorý váš termín zmení. Ak by ste chceli zrušiť tréning úplne a vrátiť peniaze, stačí kontaktovať našu podporu na info@fitbase.sk a peniaze vám budú vrátené do 24 hodín." },
    { q: "Sú moje platby bezpečné?", a: "Áno, všetky transakcie prebiehajú cez celosvetovo uznávanú a šifrovanú platobnú bránu Stripe." },
    { q: "Dostanem potvrdenie o platbe?", a: "Áno, po každej úspešnej platbe obdržíte potvrdzujúci email so všetkými detailmi vašej rezervácie." }
  ];

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      if (user) {
        const { data: trainer } = await supabase
          .from("trainers")
          .select("id")
          .eq("profile_id", user.id)
          .maybeSingle();
        setIsTrainer(!!trainer);
      }
    };
    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        supabase
          .from("trainers")
          .select("id")
          .eq("profile_id", session.user.id)
          .maybeSingle()
          .then(({ data: trainer }) => setIsTrainer(!!trainer));
      } else {
        setIsTrainer(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  const carouselImages = [
    { src: "/1.png", title: "Profil trénera" },
    { src: "/2.png", title: "Rezervácie" },
    { src: "/3.png", title: "Kalendár osobných tréningov" },
    { src: "/4.png", title: "Služby" },
    { src: "/5.png", title: "Objednávky" },
  ];

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (!threeReady || !vantaReady || !p5Ready) return;
    if (!vantaRef.current) return;
    if (vantaEffectRef.current) return;

    const VANTA = (window as any).VANTA;
    if (!VANTA?.TOPOLOGY) return;

    try {
      vantaEffectRef.current = VANTA.TOPOLOGY({
        el: vantaRef.current,
        mouseControls: true,
        touchControls: true,
        gyroControls: false,
        minHeight: 200.0,
        minWidth: 200.0,
        scale: 1.0,
        scaleMobile: 1.0,
        color: 0x97e6c0,
        backgroundColor: 0x0,
      });

      if (vantaEffectRef.current && (vantaEffectRef.current as any).resize) {
        setTimeout(() => (vantaEffectRef.current as any).resize(), 100);
      }
    } catch (err) {
      console.error("Vanta init error:", err);
    }

    const handleResize = () => {
      if (vantaEffectRef.current && (vantaEffectRef.current as any).resize) {
        (vantaEffectRef.current as any).resize();
      }
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
      vantaEffectRef.current?.destroy?.();
      vantaEffectRef.current = null;
    };
  }, [p5Ready, threeReady, vantaReady]);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      const offset = 80;
      const bodyRect = document.body.getBoundingClientRect().top;
      const elementRect = element.getBoundingClientRect().top;
      const elementPosition = elementRect - bodyRect;
      const offsetPosition = elementPosition - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth"
      });
    }
  };

  return (
    <div className="relative">
      {/* Vanta Background Container (Base layer) */}
      <div 
        ref={vantaRef} 
        className="fixed inset-0 w-full h-full pointer-events-none" 
        style={{ zIndex: 0 }}
      />

      {/* Global Black Overlay (Light overlay to improve readability) */}
      <div 
        className="fixed inset-0 w-full h-full pointer-events-none bg-black/45" 
        style={{ zIndex: 1 }}
      />

      <div className="relative z-10 min-h-screen text-white selection:bg-emerald-500/30 bg-transparent flex flex-col">
        <Script
          src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.1.9/p5.min.js"
          strategy="afterInteractive"
          onLoad={() => setP5Ready(true)}
        />
        <Script
          src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r121/three.min.js"
          strategy="afterInteractive"
          onLoad={() => setThreeReady(true)}
        />
        <Script
          src="https://cdn.jsdelivr.net/npm/vanta@latest/dist/vanta.topology.min.js"
          strategy="afterInteractive"
          onLoad={() => setVantaReady(true)}
        />

        {/* Navigation */}
        <nav className="fixed top-0 left-0 right-0 z-50 px-4 md:px-6 pt-4 md:pt-6">
          <div
            className={`mx-auto max-w-6xl rounded-full border border-emerald-500/30 backdrop-blur-md shadow-[0_6px_18px_rgba(0,0,0,0.45)] transition-all duration-300 ${
              isScrolled ? "bg-black/85 py-0.5" : "bg-black/55 py-1"
            }`}
          >
            <div className="flex items-center justify-between px-8 md:px-12">
              <Link href="/" className="flex items-center gap-2">
                <Image
                  src="/Fitbase logo.png"
                  alt="Fitbase"
                  width={120}
                  height={28}
                  priority
                  className="h-auto w-[100px] md:w-[120px]"
                />
              </Link>

              <div className="hidden lg:flex items-center gap-8 text-sm font-bold uppercase tracking-widest text-zinc-400">
                <button onClick={() => scrollToSection("why")} className="hover:text-emerald-400 transition-colors">
                  Prečo Fitbase
                </button>
                <button onClick={() => scrollToSection("how")} className="hover:text-emerald-400 transition-colors">
                  Ako to funguje
                </button>
                <button onClick={() => scrollToSection("services")} className="hover:text-emerald-400 transition-colors">
                  Funkcie
                </button>
                <button onClick={() => scrollToSection("faq")} className="hover:text-emerald-400 transition-colors">
                  FAQ
                </button>
                <a 
                  href="https://fitbase.sk/ukazka" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="hover:text-emerald-400 transition-colors"
                >
                  Demo ukážka
                </a>
              </div>

              <div className="flex items-center gap-4">
                {user ? (
                  <>
                    <div className="hidden sm:flex items-center gap-4">
                      <Link
                        href={isTrainer ? "/ucet-trenera" : "/ucet"}
                        className="text-xs font-bold uppercase tracking-widest text-zinc-400 hover:text-white transition-colors"
                      >
                        Účet
                      </Link>
                      <button
                        onClick={handleLogout}
                        className="bg-zinc-800 hover:bg-zinc-700 text-white px-5 py-2.5 rounded-full text-[10px] md:text-xs font-bold uppercase tracking-widest transition-all"
                      >
                        Odhlásiť sa
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="hidden sm:flex items-center gap-4">
                      <Link
                        href="/prihlasenie"
                        className="text-xs font-bold uppercase tracking-widest text-zinc-400 hover:text-white transition-colors"
                      >
                        Prihlásiť sa
                      </Link>
                      <Link
                        href="/registracia?mode=trainer"
                        className="bg-emerald-500 hover:bg-emerald-400 text-black px-5 py-2.5 rounded-full text-[10px] md:text-xs font-bold uppercase tracking-widest transition-all shadow-lg shadow-emerald-500/20"
                      >
                        Registrovať sa
                      </Link>
                    </div>
                  </>
                )}
                
                {/* Hamburger Button */}
                <button
                  onClick={() => setIsMenuOpen(true)}
                  className="lg:hidden w-10 h-10 rounded-full border border-white/10 flex items-center justify-center hover:bg-white/5 transition-colors"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </nav>

        {/* Mobile Drawer Menu */}
        <div className={`fixed inset-0 z-[100] transition-visibility duration-300 ${isMenuOpen ? 'visible' : 'invisible'}`}>
          {/* Backdrop */}
          <div 
            className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${isMenuOpen ? 'opacity-100' : 'opacity-0'}`}
            onClick={() => setIsMenuOpen(false)}
          />
          
          {/* Drawer Content */}
          <div className={`absolute top-0 right-0 h-full w-[280px] bg-zinc-950 border-l border-white/10 shadow-2xl transition-transform duration-500 ease-out flex flex-col ${isMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}>
            <div className="p-6 flex items-center justify-between border-b border-white/5">
              <Image
                src="/Fitbase logo.png"
                alt="Fitbase"
                width={100}
                height={24}
                className="h-auto w-[90px]"
              />
              <button 
                onClick={() => setIsMenuOpen(false)}
                className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center hover:bg-white/5 transition-colors"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-8 px-6 space-y-8">
              {user && (
                <div className="space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Prihlásený {isTrainer ? 'tréner' : 'používateľ'}</div>
                  <div className="text-white font-bold">{user.email?.split('@')[0]}</div>
                </div>
              )}

              <nav className="flex flex-col gap-4 text-sm font-bold uppercase tracking-widest">
                {[
                  { label: "Prečo Fitbase", id: "why" },
                  { label: "Ako to funguje", id: "how" },
                  { label: "Funkcie", id: "services" },
                  { label: "FAQ", id: "faq" }
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setIsMenuOpen(false);
                      scrollToSection(item.id);
                    }}
                    className="text-left text-zinc-400 hover:text-emerald-400 transition-colors py-2"
                  >
                    {item.label}
                  </button>
                ))}
                <a 
                  href="https://fitbase.sk/ukazka" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-left text-zinc-400 hover:text-emerald-400 transition-colors py-2"
                >
                  Demo ukážka
                </a>
              </nav>

              <div className="pt-8 border-t border-white/5 flex flex-col gap-4">
                {user ? (
                  <>
                    <Link
                      href={isTrainer ? "/ucet-trenera" : "/ucet"}
                      onClick={() => setIsMenuOpen(false)}
                      className="bg-emerald-500 text-black px-6 py-3 rounded-2xl text-xs font-bold uppercase tracking-widest text-center"
                    >
                      Môj profil
                    </Link>
                    <button
                      onClick={() => {
                        setIsMenuOpen(false);
                        handleLogout();
                      }}
                      className="text-rose-400/80 hover:text-rose-400 text-xs font-bold uppercase tracking-widest text-left py-2 px-2"
                    >
                      Odhlásiť sa
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      href="/prihlasenie"
                      onClick={() => setIsMenuOpen(false)}
                      className="text-white border border-white/10 px-6 py-3 rounded-2xl text-xs font-bold uppercase tracking-widest text-center hover:bg-white/5 transition-colors"
                    >
                      Prihlásiť sa
                    </Link>
                    <Link
                      href="/registracia?mode=trainer"
                      onClick={() => setIsMenuOpen(false)}
                      className="bg-emerald-500 text-black px-6 py-3 rounded-2xl text-xs font-bold uppercase tracking-widest text-center"
                    >
                      Registrovať sa
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Hero Section */}
        <section id="hero" className="relative pt-40 pb-20 md:pt-48 md:pb-32 overflow-hidden">
          <div className="container mx-auto px-4 md:px-6 relative z-10">
            <div className="grid lg:grid-cols-2 gap-14 lg:gap-16 items-center">
              <div className="text-center lg:text-left space-y-8 flex flex-col">
                <div className="order-1">
                  <h1 className="font-display text-4xl md:text-5xl lg:text-6xl uppercase leading-[0.95] tracking-tight">
                    Získavaj klientov, rezervácie
                    <br className="hidden md:block" />
                    a platby na jednom mieste.
                  </h1>
                </div>

                <div className="order-2 mt-8">
                  <p className="text-zinc-400 text-lg md:text-xl max-w-2xl mx-auto lg:mx-0 leading-relaxed">
                    Fitbase je platforma pre osobných trénerov a výživových poradcov, ktorí chcú mať profesionálny profil, online rezervácie, platby a jednoduchú správu služieb bez chaosu.
                  </p>
                </div>

                <div className="order-3 lg:hidden mt-12 mb-4">
                  <div className="relative w-full max-w-[670px] mx-auto fitbase-bannerFloat">
                    <div className="relative aspect-[9/19] overflow-hidden">
                      {heroImages.map((src, idx) => (
                        <Image
                          key={src}
                          src={src}
                          alt="Fitbase hero"
                          fill
                          className={`object-contain transition-opacity duration-1000 ${
                            idx === heroImageIndex ? "opacity-100" : "opacity-0"
                          }`}
                          priority={idx === 0}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="order-4 flex flex-col sm:flex-row items-center lg:items-start justify-center lg:justify-start gap-4 pt-2">
                  <Link
                    href="/registracia?mode=trainer"
                    className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-400 text-black px-10 py-4 rounded-full text-sm font-bold uppercase tracking-widest transition-all shadow-xl shadow-emerald-500/20 scale-105 hover:scale-110 active:scale-95"
                  >
                    Chcem sa registrovať
                  </Link>
                  <button
                    onClick={() => scrollToSection("services")}
                    className="w-full sm:w-auto px-10 py-4 rounded-full text-sm font-bold uppercase tracking-widest text-white border border-white/10 hover:bg-white/5 transition-all"
                  >
                    Pozrieť funkcie
                  </button>
                </div>
              </div>

              <div className="relative hidden lg:flex justify-center lg:justify-end">
                <div className="relative w-full max-w-[480px] fitbase-bannerFloat">
                  <div className="relative aspect-[9/19] overflow-hidden">
                    {heroImages.map((src, idx) => (
                      <Image
                        key={src}
                        src={src}
                        alt="Fitbase hero"
                        fill
                        className={`object-contain transition-opacity duration-1000 ${
                          idx === heroImageIndex ? "opacity-100" : "opacity-0"
                        }`}
                        priority={idx === 0}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Why Fitbase */}
        <section id="why" className="pt-12 pb-24 md:py-24">
          <div className="container mx-auto px-4 md:px-6">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <div className="space-y-6 text-center lg:text-left">
                <h2 className="font-display text-4xl md:text-6xl uppercase tracking-tight">
                  Menej chaosu, <br /> viac klientov.
                </h2>
                <p className="text-zinc-400 text-lg leading-relaxed">
                  Tréneri často riešia rezervácie cez správy, platby ručne, termíny chaoticky a prezentáciu cez Instagram alebo PDF. Fitbase ti pomôže mať všetko profesionálne na jednom mieste.
                </p>
              </div>
              
              <div className="grid sm:grid-cols-2 gap-6">
                {[
                  { title: "Rezervácie bez dohadovania", text: "Klienti si vyberú službu a termín online." },
                  { title: "Platby vopred", text: "Menej storien, viac istoty." },
                  { title: "Profesionálny profil trénera", text: "Lepšia dôveryhodnosť a prezentácia." },
                  { title: "Všetko na jednom mieste", text: "Tréningy, online konzultácie aj jedálničky." }
                ].map((box) => (
                  <div key={box.title} className="p-6 rounded-3xl bg-zinc-900/50 border border-white/5 hover:border-emerald-500/30 transition-all group">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-4 group-hover:bg-emerald-500/20 transition-colors">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_#10b981]" />
                    </div>
                    <h3 className="text-white font-bold mb-2 uppercase tracking-wide">
                      {box.title}
                    </h3>
                    <p className="text-zinc-500 text-sm">{box.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="pt-12 pb-24 md:py-24">
          <div className="container mx-auto px-4 md:px-6">
            <div className="max-w-3xl mx-auto text-center mb-16">
              <h2 className="font-display text-4xl md:text-6xl uppercase tracking-tight">
                Ako začať za pár minút
              </h2>
            </div>
            
            <div className="grid md:grid-cols-4 gap-8 relative">
              {[
                { step: "1", title: "Vytvoríš si profil trénera", text: "Vyplníš služby, ceny a informácie o sebe." },
                { step: "2", title: "Prepojíš platobný účet", text: "Cez Stripe budeš prijímať platby bezpečne online." },
                { step: "3", title: "Nastavíš dostupnosť a ponuku", text: "Osobné tréningy, online konzultácie alebo jedálničky." },
                { step: "4", title: "Získavaš rezervácie a objednávky", text: "Klienti si službu objednajú a zaplatia jednoducho cez web." }
              ].map((step, idx) => (
                <div key={step.step} className="relative space-y-4 text-center group">
                  <div className="w-16 h-16 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center mx-auto text-emerald-500 font-display text-3xl group-hover:bg-emerald-500 group-hover:text-black transition-all duration-500">
                    {step.step}
                  </div>
                  <h3 className="text-white font-bold uppercase tracking-wide">
                    {step.title}
                  </h3>
                  <p className="text-zinc-500 text-sm leading-relaxed">{step.text}</p>
                  {idx < 3 && <div className="hidden md:block absolute top-8 left-[calc(50%+40px)] w-[calc(100%-80px)] h-[1px] bg-white/10" />}
                </div>
              ))}
            </div>

            <div className="mt-16 text-center">
              <Link href="/registracia?mode=trainer" className="inline-block bg-emerald-500 hover:bg-emerald-400 text-black px-10 py-4 rounded-full text-sm font-bold uppercase tracking-widest transition-all">
                Začať teraz
              </Link>
            </div>
          </div>
        </section>

        {/* Features Slider */}
        <section id="features-slider" className="py-24 bg-zinc-950/30">
          <div className="container mx-auto px-4 md:px-6">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-24 items-center">
              {/* Left Content */}
              <div className="space-y-8 order-2 lg:order-1">
                <div className="space-y-4">
                  <h2 className="font-display text-4xl md:text-6xl uppercase tracking-tight text-emerald-500 transition-all duration-500">
                    {features[activeFeature].title}
                  </h2>
                  <p className="text-zinc-400 text-lg leading-relaxed max-w-xl transition-all duration-500">
                    {features[activeFeature].description}
                  </p>
                </div>

                {/* Slider Controls */}
                <div className="flex items-center gap-6 pt-4">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setActiveFeature((prev) => (prev - 1 + features.length) % features.length)}
                      className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center hover:bg-white/5 hover:border-emerald-500/30 transition-all text-white group"
                    >
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:-translate-x-1 transition-transform">
                        <path d="M19 12H5M12 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setActiveFeature((prev) => (prev + 1) % features.length)}
                      className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center hover:bg-white/5 hover:border-emerald-500/30 transition-all text-white group"
                    >
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:translate-x-1 transition-transform">
                        <path d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                  <div className="flex gap-2">
                    {features.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setActiveFeature(idx)}
                        className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                          idx === activeFeature ? "w-8 bg-emerald-500" : "bg-zinc-700"
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Image */}
              <div className="order-1 lg:order-2">
                <div className="relative aspect-square max-w-[500px] mx-auto rounded-[2rem] overflow-hidden border border-white/5 bg-zinc-900 shadow-2xl">
                  {features.map((feature, idx) => (
                    <div
                      key={idx}
                      className={`absolute inset-0 transition-all duration-700 ease-in-out transform ${
                        idx === activeFeature 
                          ? "opacity-100 scale-100 translate-x-0" 
                          : "opacity-0 scale-110 translate-x-12"
                      }`}
                    >
                      <Image
                        src={feature.image}
                        alt={feature.title}
                        fill
                        className="object-contain p-4"
                        priority={idx === 0}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent pointer-events-none" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Services */}
        <section id="services" className="pt-12 pb-24 md:py-24">
          <div className="container mx-auto px-4 md:px-6">
            <div className="max-w-3xl mx-auto text-center mb-16">
              <h2 className="font-display text-4xl md:text-6xl uppercase tracking-tight">
                Čo všetko Fitbase umožňuje
              </h2>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { title: "Osobné tréningy", text: "Klient si vyberie termín a zaplatí online. Ty máš prehľad o rezerváciách." },
                { title: "Online konzultácie", text: "Ponúkaj konzultácie na diaľku bez zložitého dohadovania." },
                { title: "Jedálničky na mieru", text: "Zbieraj údaje od klienta cez formulár a spravuj objednávky." },
                { title: "Profil trénera", text: "Prezentuj svoje služby, ceny a špecializáciu." },
                { title: "Platby a výplaty", text: "Bezpečné online platby cez Stripe Connect." },
                { title: "Zľavové kódy a cenník", text: "Nastavuj ceny, akcie a promo kódy." }
              ].map((service) => (
                <div key={service.title} className="p-8 rounded-[2rem] bg-zinc-900/30 border border-white/5 hover:border-emerald-500/20 transition-all group hover:bg-zinc-900/50">
                  <h3 className="text-emerald-400 font-bold mb-4 uppercase tracking-widest">
                    {service.title}
                  </h3>
                  <p className="text-zinc-400 text-sm leading-relaxed">{service.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Benefits */}
        <section id="benefits" className="pt-12 pb-24 md:py-24">
          <div className="container mx-auto px-4 md:px-6 flex justify-center">
            <div className="max-w-4xl w-full bg-emerald-500 rounded-[3rem] p-10 md:p-20 text-black relative overflow-hidden">
              <div className="relative z-10 flex flex-col items-center">
                <h2 className="font-display text-4xl md:text-6xl uppercase tracking-tight mb-12 text-center">
                  Čo tým získaš
                </h2>
                <div className="grid sm:grid-cols-2 gap-y-6 gap-x-12 w-full max-w-2xl">
                  {[
                    "Viac dôvery u klientov",
                    "Menej storno rezervácií",
                    "Rýchlejšie platby",
                    "Menej administratívy",
                    "Lepší prehľad o službách",
                    "Moderný online profil"
                  ].map((benefit) => (
                    <div key={benefit} className="flex items-center gap-4 justify-center sm:justify-start">
                      <div className="w-6 h-6 rounded-full bg-black flex items-center justify-center shrink-0">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4">
                          <path d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <span className="text-xl font-bold uppercase tracking-tight text-center sm:text-left">{benefit}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Preview */}
        <section id="preview" className="pt-12 pb-24 md:py-24 overflow-hidden relative">
          <div className="container mx-auto px-4 md:px-6 text-center relative z-10">
            <h2 className="font-display text-4xl md:text-6xl uppercase tracking-tight mb-4">
              Všetko navrhnuté jednoducho a prehľadne
            </h2>
            <p className="text-zinc-500 mb-16">Sústreď sa na klientov, nie na chaos okolo.</p>
            
            <div className="relative h-[300px] md:h-[500px] flex items-center justify-center">
              <div className="relative w-full max-w-4xl h-full flex items-center justify-center perspective-[2000px]">
                {carouselImages.map((image, idx) => {
                  const diff = idx - activeIndex;
                  const isActive = idx === activeIndex;
                  const absDiff = Math.abs(diff);
                  
                  // Visibility and 3D positioning
                  let opacity = 0;
                  let scale = 0.5;
                  let x = 0;
                  let z = -400;
                  let rotateY = 0;
                  let blur = "blur(8px)";
                  let zIndex = 0;

                  if (absDiff === 0) {
                    opacity = 1;
                    scale = 1;
                    x = 0;
                    z = 0;
                    blur = "blur(0px)";
                    zIndex = 10;
                  } else if (absDiff === 1) {
                    opacity = 0.8;
                    scale = 0.8;
                    x = diff * 50; // percentage
                    z = -200;
                    rotateY = diff * -25;
                    blur = "blur(2px)";
                    zIndex = 5;
                  } else if (absDiff === 2) {
                    opacity = 0.4;
                    scale = 0.6;
                    x = diff * 70; // percentage
                    z = -400;
                    rotateY = diff * -45;
                    blur = "blur(4px)";
                    zIndex = 2;
                  }

                  return (
                    <div
                      key={idx}
                      onClick={() => setActiveIndex(idx)}
                      className="absolute w-[80%] md:w-[60%] aspect-video transition-all duration-700 ease-out cursor-pointer"
                      style={{
                        transform: `translateX(${x}%) translateZ(${z}px) rotateY(${rotateY}deg) scale(${scale})`,
                        opacity,
                        filter: blur,
                        zIndex,
                      }}
                    >
                      <div className="relative w-full h-full rounded-2xl md:rounded-[2rem] overflow-hidden border border-white/10 shadow-2xl bg-zinc-900 group">
                        <Image
                          src={image.src}
                          alt={image.title}
                          fill
                          className="object-cover"
                        />
                        <div className={`absolute inset-0 bg-black/40 transition-opacity duration-500 ${isActive ? 'opacity-0' : 'opacity-100'}`} />
                        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-md px-6 py-2 rounded-full border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity">
                          <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">{image.title}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {/* Carousel Controls */}
              <div className="absolute bottom-[-20px] left-1/2 -translate-x-1/2 flex gap-3">
                {carouselImages.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveIndex(idx)}
                    className={`w-2 h-2 rounded-full transition-all duration-300 ${idx === activeIndex ? 'w-8 bg-emerald-500' : 'bg-zinc-700'}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* For Who */}
        <section id="for-who" className="pt-12 pb-24 md:py-24">
          <div className="container mx-auto px-4 md:px-6">
            <div className="relative max-w-5xl mx-auto">
              <div className="relative bg-zinc-900/40 border border-emerald-500/20 rounded-[3rem] p-10 md:p-16 backdrop-blur-sm shadow-[0_20px_80px_rgba(0,0,0,0.6)]">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-10">
                  <div className="space-y-4">
                    <h2 className="font-display text-4xl md:text-6xl uppercase tracking-tight text-emerald-400">
                      Fitbase je pre teba, ak
                    </h2>
                    <div className="text-zinc-500 text-sm">
                      Moderný profil, rezervácie aj platby bez chaosu.
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4 w-full lg:max-w-[640px]">
                    {[
                      "si osobný tréner a chceš viac klientov",
                      "robíš online coaching",
                      "ponúkaš jedálničky",
                      "chceš pôsobiť profesionálne",
                      "nechceš riešiť rezervácie ručne"
                    ].map((item) => (
                      <div
                        key={item}
                        className="flex items-start gap-3 rounded-2xl border border-white/5 bg-black/20 px-5 py-4 hover:border-emerald-500/30 transition-colors"
                      >
                        <div className="mt-0.5 h-6 w-6 rounded-full bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <path d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <div className="text-zinc-200">{item}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="pt-12 pb-24 md:py-24">
          <div className="container mx-auto px-4 md:px-6 max-w-4xl">
            <h2 className="font-display text-4xl md:text-6xl uppercase tracking-tight text-center mb-12">
              Časté otázky
            </h2>

            {/* Toggle Buttons */}
            <div className="flex justify-center gap-4 mb-12 p-1.5 bg-zinc-900/50 backdrop-blur-md rounded-full border border-white/5 w-fit mx-auto">
              <button
                onClick={() => {
                  setFaqCategory("trainer");
                  setOpenFaqIndex(null);
                }}
                className={`px-6 py-3 rounded-full text-xs font-bold uppercase tracking-widest transition-all ${
                  faqCategory === "trainer" 
                    ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20" 
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                Pre trénerov
              </button>
              <button
                onClick={() => {
                  setFaqCategory("client");
                  setOpenFaqIndex(null);
                }}
                className={`px-6 py-3 rounded-full text-xs font-bold uppercase tracking-widest transition-all ${
                  faqCategory === "client" 
                    ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20" 
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                Pre klientov
              </button>
            </div>

            <div className="grid gap-4">
              {(faqCategory === "trainer" ? trainerFaqs : clientFaqs).map((faq, idx) => {
                const isOpen = openFaqIndex === idx;
                return (
                  <div
                    key={faq.q}
                    className={`group relative overflow-hidden rounded-[2rem] border transition-all duration-300 ${
                      isOpen 
                        ? "border-emerald-500/40 bg-zinc-900/40" 
                        : "border-white/5 bg-zinc-900/25 hover:border-emerald-500/20"
                    }`}
                  >
                    <button
                      onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                      className="w-full px-8 py-7 flex items-center justify-between text-left"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`h-8 w-8 rounded-xl border flex items-center justify-center shrink-0 transition-colors ${
                          isOpen ? "border-emerald-500/40 bg-emerald-500/10" : "border-white/10 bg-black/20"
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full transition-all duration-300 ${
                            isOpen ? "bg-emerald-500 shadow-[0_0_12px_#10b981]" : "bg-zinc-600"
                          }`} />
                        </div>
                        <h3 className={`text-sm md:text-base font-bold uppercase tracking-tight transition-colors ${
                          isOpen ? "text-emerald-400" : "text-zinc-200"
                        }`}>
                          {faq.q}
                        </h3>
                      </div>
                      
                      <div className={`shrink-0 ml-4 transition-transform duration-300 ${isOpen ? "rotate-180 text-emerald-500" : "text-zinc-500"}`}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M6 9l6 6 6-6" />
                        </svg>
                      </div>
                    </button>

                    <div className={`overflow-hidden transition-all duration-300 ease-in-out ${
                      isOpen ? "max-h-[200px] opacity-100" : "max-h-0 opacity-0"
                    }`}>
                      <div className="px-8 pb-7 pl-[72px] text-zinc-400 text-sm leading-relaxed border-t border-white/5 pt-4">
                        {faq.a}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Contact */}
        <section id="contact" className="pt-12 pb-24 md:py-24">
          <div className="container mx-auto px-4 md:px-6 text-center">
            <h2 className="font-display text-4xl md:text-6xl uppercase tracking-tight mb-6">
              Máš otázky?
            </h2>
            <p className="text-zinc-400 text-lg mb-12 max-w-2xl mx-auto">
              Ak máš akékoľvek otázky alebo potrebuješ pomôcť, pokojne nás kontaktuj.
            </p>
            <div className="flex flex-col items-center gap-8">
              <a href="mailto:info@fitbase.sk" className="text-emerald-400 text-2xl font-bold hover:text-emerald-300 transition-colors">info@fitbase.sk</a>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section id="cta" className="py-24 md:py-48 relative overflow-hidden">
          <div className="container mx-auto px-4 md:px-6 text-center relative z-10">
            <h2 className="font-display text-5xl md:text-8xl uppercase tracking-tight mb-8">
              Začni budovať svoj <br /> tréningový biznis online.
            </h2>
            <p className="text-zinc-400 text-xl mb-12 max-w-xl mx-auto">
              Vytvor si profil a získavaj rezervácie a platby na jednom mieste.
            </p>
            <Link href="/registracia?mode=trainer" className="inline-block bg-emerald-500 hover:bg-emerald-400 text-black px-12 py-5 rounded-full text-md font-bold uppercase tracking-widest transition-all shadow-2xl shadow-emerald-500/40 scale-110 hover:scale-125 transition-all duration-500">
              Registrovať sa ako tréner
            </Link>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-12 border-t border-white/5">
          <div className="container mx-auto px-4 md:px-6 flex flex-col md:flex-row justify-between items-center gap-8">
            <Image src="/Fitbase logo.png" alt="Fitbase" width={100} height={24} className="opacity-50" />
            <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">
              © 2026 Fitbase. Všetky práva vyhradené.
            </div>
            <div className="flex flex-wrap justify-center gap-x-8 gap-y-4 text-[10px] font-bold uppercase tracking-widest text-zinc-600">
              <Link href="/roadmap" className="hover:text-white transition-colors">Roadmap</Link>
              <Link href="/podpora" className="hover:text-white transition-colors">Podpora</Link>
              <Link href="/podmienky" className="hover:text-white transition-colors">Podmienky</Link>
              <Link href="/podmienky-treneri" className="hover:text-white transition-colors">Podmienky pre trénerov</Link>
              <Link href="/sukromie" className="hover:text-white transition-colors">Súkromie</Link>
              <Link href="/cookies" className="hover:text-white transition-colors">Cookies</Link>
              <Link href="/disclaimer" className="hover:text-white transition-colors">Disclaimer</Link>
            </div>
          </div>
        </footer>
      </div>

      <style jsx global>{`
        html, body {
          background-color: black;
          margin: 0;
          padding: 0;
          overflow-x: hidden;
        }
        @keyframes fitbaseBannerFloat {
          0%,
          100% {
            transform: translate3d(0, 0, 0);
          }
          50% {
            transform: translate3d(0, -10px, 0);
          }
        }
        .fitbase-bannerFloat {
          animation: fitbaseBannerFloat 8s ease-in-out infinite;
          will-change: transform;
        }
      `}</style>
    </div>
  );
}

