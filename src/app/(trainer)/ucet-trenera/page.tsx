"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { supabaseUrl, supabaseAnonKey, siteUrl } from "@/lib/config";
import TrainerCalendar from "@/components/trainer/TrainerCalendar";
import CalendarSettings from "@/components/trainer/CalendarSettings";
import TrainerBookings from "@/components/booking/TrainerBookings";
import TrainerClientResults from "@/components/trainer/TrainerClientResults";
import TrainerMealPlanAI from "@/components/trainer/TrainerMealPlanAI";
import { listTrainerReviewsForDashboardAction } from "@/lib/booking/actions";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

type TabId = "profil" | "rezervacie" | "sluzby" | "kalendar" | "online-konzultacie" | "recenzie" | "vysledky" | "znacky" | "ai-jedalnicek" | "nastavenia" | "transformation";
type CalendarTabId = "moj_kalendar" | "nastavenia_kalendara";
type BrandSubTabId = "pridat" | "zoznam";
type SettingsTabId = "payment_account" | "pricing" | "support";

const settingsTabs: { id: SettingsTabId; label: string }[] = [
  { id: "payment_account", label: "Platobný účet" },
  { id: "pricing", label: "Cenník" },
  { id: "support", label: "Podpora" }
];

type Brand = {
  id: string;
  logo: string;
  code: string;
  url?: string;
};

type ServiceKey = "personal_training" | "online_consultation" | "meal_plan" | "brands" | "transformation";
type ServicesVisibility = Record<ServiceKey, boolean>;

const defaultServicesVisibility: ServicesVisibility = {
  personal_training: true,
  online_consultation: true,
  meal_plan: true,
  brands: true,
  transformation: false
};

type TrainerTransformation = {
  trainer_id: string;
  is_enabled: boolean;
  headline: string;
  subheadline: string;
  personal_sessions_count: number;
  online_calls_count: number;
  includes_meal_plan: boolean;
  price_month_cents: number;
  regular_price_cents: number;
};

type TrainerRow = {
  id: string;
  profile_id: string;
  slug: string | null;
  city: string | null;
  bio: string | null;
  images: (string | null)[] | null;
  brands: Brand[] | null;
  services: Partial<ServicesVisibility> | null;
  stripe_account_id: string | null;
  stripe_onboarding_completed: boolean | null;
  stripe_charges_enabled: boolean | null;
  stripe_payouts_enabled: boolean | null;
  profiles: { full_name: string | null; phone_number?: string | null } | null;
  price_personal_cents?: number | null;
  price_online_cents?: number | null;
  price_meal_plan_cents?: number | null;
  platform_fee_percent?: number | null;
};

// Helper pre slugifikáciu
function toSlug(input: string) {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .replace(/-{2,}/g, "-");
}

function parseLocation(value: string): { city: string; gym: string } {
  const raw = value.trim();
  if (!raw) return { city: "", gym: "" };
  const match = raw.match(/^(.+?)\s*-\s*(.+)$/);
  if (!match) return { city: raw, gym: "" };
  return { city: match[1].trim(), gym: match[2].trim() };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getStringField(payload: unknown, key: string): string | null {
  if (!isRecord(payload)) return null;
  const value = payload[key];
  return typeof value === "string" && value.trim() ? value : null;
}

type Discount = {
  id: string;
  code: string;
  type: "percent" | "fixed";
  value: number;
  service_type: "personal" | "online" | "meal_plan" | "transformation";
  max_uses: number | null;
  used_count: number;
  is_active: boolean;
};

export default function TrainerDashboardPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>("profil");
  const [activeCalendarTab, setActiveCalendarTab] = useState<CalendarTabId>("moj_kalendar");
  const [activeSettingsTab, setActiveSettingsTab] = useState<SettingsTabId>("payment_account");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const servicesPersistLockRef = useRef(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  
  // State pre "Môj profil"
  const [trainerId, setTrainerId] = useState<string>("");
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [city, setCity] = useState("");
  const [gymName, setGymName] = useState("");
  const [bio, setBio] = useState("");
  const [images, setImages] = useState<(string | null)[]>([null, null, null, null]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State pre "Moje značky"
  const [activeBrandSubTab, setActiveBrandSubTab] = useState<BrandSubTabId>("pridat");
  const [newBrandLogo, setNewBrandLogo] = useState<string | null>(null);
  const [newBrandCode, setNewBrandCode] = useState("");
  const [newBrandUrl, setNewBrandUrl] = useState("");
  const [brands, setBrands] = useState<Brand[]>([]);
  const brandLogoInputRef = useRef<HTMLInputElement>(null);
  const [servicesVisibility, setServicesVisibility] = useState<ServicesVisibility>(defaultServicesVisibility);

  const [stripeAccountId, setStripeAccountId] = useState<string | null>(null);
  const [stripeOnboardingCompleted, setStripeOnboardingCompleted] = useState(false);
  const [stripeChargesEnabled, setStripeChargesEnabled] = useState(false);
  const [stripePayoutsEnabled, setStripePayoutsEnabled] = useState(false);
  const [stripeBusy, setStripeBusy] = useState<null | "connect" | "onboarding" | "dashboard">(null);
  const [stripeError, setStripeError] = useState<string | null>(null);

  const displaySiteUrl = typeof window !== "undefined" && window.location.hostname === "localhost" ? "https://fitbase.sk" : siteUrl;
  const profileUrl = `${displaySiteUrl.replace(/\/$/, "")}/${toSlug(username)}`;
  const locationText = [city.trim(), gymName.trim()].filter(Boolean).join(" - ");

  const [pricePersonalEuro, setPricePersonalEuro] = useState("");
  const [priceOnlineEuro, setPriceOnlineEuro] = useState("");
  const [priceMealPlanEuro, setPriceMealPlanEuro] = useState("");
  const [platformFeePercent, setPlatformFeePercent] = useState("10");

  // State pre "Mesačná premena"
  const [transformation, setTransformation] = useState<TrainerTransformation>({
    trainer_id: "",
    is_enabled: false,
    headline: "",
    subheadline: "",
    personal_sessions_count: 0,
    online_calls_count: 0,
    includes_meal_plan: false,
    price_month_cents: 0,
    regular_price_cents: 0,
  });

  // State pre "Zľavové kódy"
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [newDiscount, setNewDiscount] = useState({
    code: "",
    type: "percent" as "percent" | "fixed",
    value: "",
    service_type: "personal" as "personal" | "online" | "meal_plan" | "transformation",
    max_uses: ""
  });

  const loadProfile = useCallback(async () => {
    console.log("[UCET-TRENERA] loadProfile starting...");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      console.log("[UCET-TRENERA] loadProfile session:", session);

      if (!session) {
        console.log("[UCET-TRENERA] No session in loadProfile, redirecting...");
        router.replace("/prihlasenie");
        return;
      }
      const user = session.user;

      const { data: trainer, error } = await supabase
        .from("trainers")
        .select("*, profiles(full_name, phone_number)")
        .eq("profile_id", user.id)
        .maybeSingle<TrainerRow>();

      if (error) throw error;

      if (trainer) {
        setTrainerId(trainer.id);
        setUsername(trainer.slug || "");
        setFullName(trainer.profiles?.full_name || "");
        setPhoneNumber(typeof trainer.profiles?.phone_number === "string" ? trainer.profiles.phone_number : "");
        const parsedLocation = parseLocation(trainer.city || "");
        setCity(parsedLocation.city);
        setGymName(parsedLocation.gym);
        setBio(trainer.bio || "");
        setBrands(trainer.brands || []);
        if (trainer.services) {
          setServicesVisibility({
            ...defaultServicesVisibility,
            ...trainer.services
          });
        } else {
          setServicesVisibility(defaultServicesVisibility);
        }
        setStripeAccountId(trainer.stripe_account_id || null);
        setStripeOnboardingCompleted(Boolean(trainer.stripe_onboarding_completed));
        setStripeChargesEnabled(Boolean(trainer.stripe_charges_enabled));
        setStripePayoutsEnabled(Boolean(trainer.stripe_payouts_enabled));
        if (trainer.images && Array.isArray(trainer.images)) {
          const loadedImages = [...trainer.images];
          while (loadedImages.length < 4) loadedImages.push(null);
          setImages(loadedImages.slice(0, 4));
        }
        const pPersonal = typeof (trainer as TrainerRow).price_personal_cents === "number" ? (trainer as TrainerRow).price_personal_cents : null;
        const pOnline = typeof (trainer as TrainerRow).price_online_cents === "number" ? (trainer as TrainerRow).price_online_cents : null;
        const pMealPlan = (trainer as TrainerRow).price_meal_plan_cents;
        setPricePersonalEuro(pPersonal && pPersonal > 0 ? (pPersonal / 100).toFixed(2) : "");
        setPriceOnlineEuro(pOnline && pOnline > 0 ? (pOnline / 100).toFixed(2) : "");
        setPriceMealPlanEuro(typeof pMealPlan === "number" && pMealPlan > 0 ? (pMealPlan / 100).toFixed(2) : "");
        setPlatformFeePercent(String((trainer as TrainerRow).platform_fee_percent ?? 10));

        const { data: dscRes } = await supabase
          .from("trainer_discounts")
          .select("*")
          .eq("trainer_id", trainer.id)
          .order("created_at", { ascending: false });
        if (dscRes) setDiscounts(dscRes as Discount[]);

        // Načítanie "Mesačná premena"
        const { data: transRes, error: transErr } = await supabase
          .from("trainer_transformations")
          .select("*")
          .eq("trainer_id", trainer.id)
          .maybeSingle();

        if (transRes) {
          setTransformation(transRes as TrainerTransformation);
        } else if (!transErr) {
          // Vytvoriť default row
          const defaultTrans = {
            trainer_id: trainer.id,
            is_enabled: false,
            headline: "",
            subheadline: "",
            personal_sessions_count: 0,
            online_calls_count: 0,
            includes_meal_plan: false,
            price_month_cents: 0,
            regular_price_cents: 0
          };
          const { data: newTrans } = await supabase
            .from("trainer_transformations")
            .insert(defaultTrans)
            .select()
            .maybeSingle();
          if (newTrans) setTransformation(newTrans as TrainerTransformation);
        }
      }
    } catch (err) {
      console.error("Error loading profile:", err);
    } finally {
      setLoading(false);
    }
  }, [router]);

  const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const sessionRes = await supabase.auth.getSession();
    const token = sessionRes.data.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const openStripeOnboarding = useCallback(async () => {
    const headers = await getAuthHeaders();
    const res = await fetch("/api/stripe/connect/onboarding-link", { method: "POST", headers });
    const payload: unknown = await res.json().catch(() => null);
    const url = getStringField(payload, "url");
    if (!res.ok || !url) {
      const message = getStringField(payload, "message") || "Nepodarilo sa získať onboarding link.";
      throw new Error(message);
    }
    window.location.href = url;
  }, [getAuthHeaders]);

  const openStripeDashboard = useCallback(async () => {
    const headers = await getAuthHeaders();
    const res = await fetch("/api/stripe/connect/dashboard-link", { method: "POST", headers });
    const payload: unknown = await res.json().catch(() => null);
    const url = getStringField(payload, "url");
    if (!res.ok || !url) {
      const message = getStringField(payload, "message") || "Nepodarilo sa získať Stripe dashboard link.";
      throw new Error(message);
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }, [getAuthHeaders]);

  const syncStripeAccount = useCallback(async () => {
    const headers = await getAuthHeaders();
    await fetch("/api/stripe/connect/sync-account", { method: "POST", headers });
  }, [getAuthHeaders]);

  const handleStripeConnect = useCallback(async () => {
    if (stripeBusy) return;
    setStripeError(null);
    setStripeBusy("connect");
    try {
      const headers = await getAuthHeaders();
      const createRes = await fetch("/api/stripe/connect/create-account", { method: "POST", headers });
      const createPayload: unknown = await createRes.json().catch(() => null);
      if (!createRes.ok) {
        const message = getStringField(createPayload, "message") || "Nepodarilo sa vytvoriť Stripe účet.";
        throw new Error(message);
      }

      const onboardRes = await fetch("/api/stripe/connect/onboarding-link", { method: "POST", headers });
      const onboardPayload: unknown = await onboardRes.json().catch(() => null);
      const url = getStringField(onboardPayload, "url");
      if (!onboardRes.ok || !url) {
        const message = getStringField(onboardPayload, "message") || "Nepodarilo sa získať onboarding link.";
        throw new Error(message);
      }

      window.location.href = url;
    } catch (err: unknown) {
      setStripeError(err instanceof Error ? err.message : "Nepodarilo sa prepojiť Stripe.");
    } finally {
      setStripeBusy(null);
    }
  }, [getAuthHeaders, stripeBusy]);

  const handleStripeOnboarding = useCallback(async () => {
    if (stripeBusy) return;
    setStripeError(null);
    setStripeBusy("onboarding");
    try {
      await openStripeOnboarding();
    } catch (err: unknown) {
      setStripeError(err instanceof Error ? err.message : "Nepodarilo sa otvoriť onboarding.");
      setStripeBusy(null);
    }
  }, [openStripeOnboarding, stripeBusy]);

  const handleStripeDashboard = useCallback(async () => {
    if (stripeBusy) return;
    setStripeError(null);
    setStripeBusy("dashboard");
    try {
      await openStripeDashboard();
    } catch (err: unknown) {
      setStripeError(err instanceof Error ? err.message : "Nepodarilo sa otvoriť Stripe dashboard.");
    } finally {
      setStripeBusy(null);
    }
  }, [openStripeDashboard, stripeBusy]);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      router.push("/prihlasenie");
    }
  };

  useEffect(() => {
    if (!supabase) return;

    console.log("[UCET-TRENERA] Initializing auth check...");
    let timeoutId: NodeJS.Timeout | null = null;
    
    // 1. Skúsime získať session okamžite
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log("[UCET-TRENERA] Initial session check:", session);
      if (session) {
        loadProfile();
      } else {
        // 2. Ak nie je session, počkáme chvíľu (OAuth spracovanie)
        console.log("[UCET-TRENERA] No initial session, waiting for auth state change...");
        timeoutId = setTimeout(() => {
          supabase.auth.getSession().then(({ data: { session: finalSession } }) => {
            if (!finalSession) {
              console.log("[UCET-TRENERA] Still no session after delay, redirecting to login");
              router.replace("/prihlasenie");
            } else {
              loadProfile();
            }
          });
        }, 1500); // 1.5s delay pre istotu
      }
    });

    // 3. Počúvame na zmeny (SIGNED_IN)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("[UCET-TRENERA] Auth event:", event, !!session);
      if (event === "SIGNED_IN" && session) {
        if (timeoutId) clearTimeout(timeoutId);
        loadProfile();
      }
    });

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, [loadProfile, router]);

  useEffect(() => {
    if (activeTab !== "nastavenia") return;
    if (activeSettingsTab !== "payment_account") return;
    const onFocus = () => {
      syncStripeAccount()
        .catch(() => {})
        .finally(() => loadProfile());
    };
    const onVisibility = () => {
      if (document.hidden) return;
      syncStripeAccount()
        .catch(() => {})
        .finally(() => loadProfile());
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [activeSettingsTab, activeTab, loadProfile, syncStripeAccount]);

  useEffect(() => {
    if (!isMobileNavOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsMobileNavOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [isMobileNavOpen]);

  // Uloženie dát profilu
  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return;

      const slug = toSlug(username);
      
      // 1. Update tabuľky profiles (meno)
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ full_name: fullName, phone_number: phoneNumber.trim() || null })
        .eq("id", user.id);
      
      if (profileError) throw profileError;

      // 2. Update tabuľky trainers (slug, bio, mesto, fotky)
      const { error: trainerError } = await supabase
        .from("trainers")
        .update({ 
          slug, 
          bio,
          city: locationText,
          images: images 
        })
        .eq("profile_id", user.id);

      if (trainerError) throw trainerError;
      
      setUsername(slug);
      alert("Profil bol úspešne uložený.");
    } catch (err) {
      console.error(err);
      alert("Chyba pri ukladaní profilu.");
    } finally {
      setSaving(false);
    }
  };

  const handleSavePricing = async () => {
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return;
      const toCents = (val: string): number | null => {
        const num = Number(val.replace(",", "."));
        if (!Number.isFinite(num) || num <= 0) return null;
        const cents = Math.round(num * 100);
        return cents > 0 ? cents : null;
      };
      const personalCents = toCents(pricePersonalEuro);
      const onlineCents = toCents(priceOnlineEuro);
      const mealPlanCents = toCents(priceMealPlanEuro);

      const payload: Record<string, number | null> = {
        price_personal_cents: personalCents,
        price_online_cents: onlineCents,
        price_meal_plan_cents: mealPlanCents
      };
      const { error } = await supabase
        .from("trainers")
        .update(payload)
        .eq("profile_id", user.id);
      if (error) throw error;
      alert("Cenník bol uložený.");
    } catch {
      alert("Chyba pri ukladaní cenníka.");
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1024 * 1024) {
        alert("Fotka je príliš veľká. Prosím nahrajte obrázok do 1MB.");
        return;
      }

      const firstEmptyIndex = images.findIndex(img => img === null);
      if (firstEmptyIndex === -1) {
        alert("Môžete nahrať maximálne 4 fotky.");
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new window.Image();
        const result = reader.result;
        if (typeof result !== "string") return;
        img.src = result;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const MAX_WIDTH = 800;
          const scale = MAX_WIDTH / img.width;
          canvas.width = MAX_WIDTH;
          canvas.height = img.height * scale;
          
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
          
          const compressedBase64 = canvas.toDataURL("image/webp", 0.7);
          const newImages = [...images];
          newImages[firstEmptyIndex] = compressedBase64;
          setImages(newImages);
        };
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = (index: number) => {
     const newImages = [...images];
     newImages[index] = null;
     // Posunúť ostatné fotky dopredu, aby nezostali diery
     const filtered = newImages.filter((img): img is string => img !== null);
     const result: (string | null)[] = [...filtered];
     while (result.length < 4) result.push(null);
     setImages(result);
   };

  const handleSaveBrand = async () => {
    if (!newBrandLogo || !newBrandCode.trim()) {
      alert("Nahrajte logo a zadajte kód.");
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert("Chyba: Používateľ nie je prihlásený.");
        return;
      }

      const newBrand: Brand = {
        id: Math.random().toString(36).substr(2, 9),
        logo: newBrandLogo,
        code: newBrandCode.trim(),
        url: newBrandUrl.trim()
      };

      const updatedBrands = [...brands, newBrand];

      const { error } = await supabase
        .from("trainers")
        .update({ brands: updatedBrands })
        .eq("profile_id", user.id);

      if (error) {
        console.error("Supabase error:", error);
        throw new Error(error.message);
      }

      setBrands(updatedBrands);
      setNewBrandLogo(null);
      setNewBrandCode("");
      setNewBrandUrl("");
      alert("Značka úspešne pridaná.");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Skontrolujte, či v databáze existuje stĺpec 'brands' (JSONB).";
      console.error("Save error:", message);
      alert(`Chyba pri pridávaní značky: ${message}`);
    } finally {
      setSaving(false);
    }
  };

  // Vymazanie značky
  const handleDeleteBrand = async (id: string) => {
    if (!confirm("Naozaj chcete vymazať túto značku?")) return;

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const updatedBrands = brands.filter(b => b.id !== id);

      const { error } = await supabase
        .from("trainers")
        .update({ brands: updatedBrands })
        .eq("profile_id", user.id);

      if (error) throw error;

      setBrands(updatedBrands);
    } catch (err) {
      console.error(err);
      alert("Chyba pri mazaní.");
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Základná kontrola veľkosti (max 1MB pre base64 v JSON)
      if (file.size > 1024 * 1024) {
        alert("Logo je príliš veľké. Prosím nahrajte obrázok do 1MB.");
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new window.Image();
        const result = reader.result;
        if (typeof result !== "string") return;
        img.src = result;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const MAX_WIDTH = 400;
          const scale = MAX_WIDTH / img.width;
          canvas.width = MAX_WIDTH;
          canvas.height = img.height * scale;
          
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
          
          const compressedBase64 = canvas.toDataURL("image/webp", 0.7);
          setNewBrandLogo(compressedBase64);
        };
      };
      reader.readAsDataURL(file);
    }
  };

  const persistServicesVisibility = async (next: ServicesVisibility) => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("trainers")
        .update({ services: next })
        .eq("profile_id", user.id);

      if (error) throw error;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Skontrolujte, či v databáze existuje stĺpec 'services' (JSONB).";
      console.error(message);
      alert(`Chyba pri ukladaní služieb: ${message}`);
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const handleSaveServices = async () => {
    try {
      await persistServicesVisibility(servicesVisibility);
      window.location.reload();
    } catch {}
  };

  const toggleService = async (key: ServiceKey) => {
    if (servicesPersistLockRef.current) return;
    setServicesVisibility((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      servicesPersistLockRef.current = true;
      
      const updatePromise = async () => {
        if (key === "transformation") {
          await supabase
            .from("trainer_transformations")
            .update({ is_enabled: next.transformation })
            .eq("trainer_id", trainerId);
        }
        await persistServicesVisibility(next);
      };

      updatePromise()
        .catch(() => {
          setServicesVisibility(prev);
        })
        .finally(() => {
          servicesPersistLockRef.current = false;
        });
      return next;
    });
  };

  const handleSaveTransformation = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("trainer_transformations")
        .update({
          headline: transformation.headline,
          subheadline: transformation.subheadline,
          personal_sessions_count: transformation.personal_sessions_count,
          online_calls_count: transformation.online_calls_count,
          includes_meal_plan: transformation.includes_meal_plan,
          price_month_cents: transformation.price_month_cents,
          regular_price_cents: transformation.regular_price_cents,
        })
        .eq("trainer_id", trainerId);
      if (error) throw error;
      alert("Mesačná premena bola uložená.");
    } catch {
      alert("Chyba pri ukladaní.");
    } finally {
      setSaving(false);
    }
  };

  const handleAddDiscount = async () => {
    if (!newDiscount.code || !newDiscount.value) return;
    setSaving(true);
    try {
      const val = parseInt(newDiscount.value);
      const mx = newDiscount.max_uses ? parseInt(newDiscount.max_uses) : null;
      
      const { error } = await supabase
        .from("trainer_discounts")
        .insert({
          trainer_id: trainerId,
          code: newDiscount.code.toUpperCase(),
          type: newDiscount.type,
          value: val,
          service_type: newDiscount.service_type,
          max_uses: mx
        });

      if (error) throw error;

      setNewDiscount({ code: "", type: "percent", value: "", service_type: "personal", max_uses: "" });
      loadProfile();
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Chyba pri pridávaní zľavy.");
    } finally {
      setSaving(false);
    }
  };

  const toggleDiscountActive = async (id: string, current: boolean) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("trainer_discounts")
        .update({ is_active: !current })
        .eq("id", id);
      if (error) throw error;
      loadProfile();
    } catch (err: any) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const deleteDiscount = async (id: string) => {
    if (!confirm("Naozaj vymazať tento kód?")) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("trainer_discounts")
        .delete()
        .eq("id", id);
      if (error) throw error;
      loadProfile();
    } catch (err: any) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  type TrainerReviewItem = {
    id: string;
    client_name: string;
    rating: number;
    comment: string;
    photo_url: string | null;
    created_at: string;
  };

  function TrainerReviewsTab() {
    const [reviews, setReviews] = useState<TrainerReviewItem[]>([]);
    const [loadingReviews, setLoadingReviews] = useState(true);
    const [reviewsError, setReviewsError] = useState<string | null>(null);

    useEffect(() => {
      let cancelled = false;

      async function load() {
        setLoadingReviews(true);
        setReviewsError(null);
        try {
          const sessionRes = await supabase.auth.getSession();
          const accessToken = sessionRes.data.session?.access_token;
          if (!accessToken) {
            throw new Error("Pre zobrazenie recenzií sa musíte prihlásiť.");
          }

          const res = await listTrainerReviewsForDashboardAction({ access_token: accessToken });
          if (res.status !== "success") {
            throw new Error(res.message);
          }

          if (!cancelled) setReviews(res.reviews as TrainerReviewItem[]);
        } catch (err: unknown) {
          if (!cancelled) setReviewsError(err instanceof Error ? err.message : "Nepodarilo sa načítať recenzie.");
        } finally {
          if (!cancelled) setLoadingReviews(false);
        }
      }

      void load();
      return () => {
        cancelled = true;
      };
    }, []);

    if (loadingReviews) return <div className="text-zinc-500 animate-pulse">Načítavam recenzie...</div>;
    if (reviewsError) return <div className="text-red-400">Chyba: {reviewsError}</div>;

    if (reviews.length === 0) {
      return <div className="text-zinc-500 italic">Zatiaľ nemáte žiadne recenzie.</div>;
    }

    return (
      <div className="space-y-4">
        {reviews.map((r) => (
          <div key={r.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-white font-bold">{r.client_name}</div>
                <div className="text-zinc-500 text-xs">
                  {new Date(r.created_at).toLocaleDateString("sk-SK")}
                </div>
              </div>
              <div className="flex text-yellow-400">
                {[...Array(5)].map((_, i) => (
                  <svg
                    key={i}
                    viewBox="0 0 20 20"
                    className={`w-4 h-4 ${r.rating > i ? "fill-current" : "fill-transparent"} stroke-current`}
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
            </div>

            <div className="mt-3 text-zinc-200 text-sm whitespace-pre-wrap">{r.comment}</div>

            {r.photo_url && (
              <div className="mt-4">
                <img src={r.photo_url} alt="" className="w-full rounded-2xl border border-white/10" />
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  const renderTabContent = () => {
    if (loading) return <div className="flex items-center justify-center h-full text-zinc-500">Načítavam...</div>;

    switch (activeTab) {
      case "profil":
        return (
          <div className="flex flex-col gap-6 w-full max-w-[760px] ml-auto">
            <h2 className="text-4xl font-display uppercase tracking-wider mb-2 text-emerald-400">Môj profil</h2>

            <div className="flex items-center justify-between gap-3 border border-emerald-500/30 rounded-2xl bg-zinc-900/30 backdrop-blur-sm px-4 py-3">
              <div className="min-w-0">
                <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Link vášho profilu</div>
                <div className="text-white font-bold truncate">{profileUrl}</div>
              </div>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(profileUrl)}
                className="shrink-0 px-4 py-2 rounded-full bg-emerald-500 text-black text-[10px] font-bold uppercase tracking-widest hover:bg-emerald-400 transition-colors"
              >
                Kopírovať
              </button>
            </div>

            <div className="bg-zinc-900/30 border border-emerald-500/30 rounded-[30px] p-6 md:p-8 backdrop-blur-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2 md:col-span-2">
                  <span className="text-zinc-400 text-[10px] uppercase tracking-widest font-bold ml-2">Meno a priezvisko</span>
                  <input
                    type="text"
                    placeholder="Vaše meno a priezvisko"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full bg-zinc-950/50 border border-emerald-500/40 rounded-xl px-5 py-4 text-white outline-none focus:ring-1 focus:ring-emerald-500 transition-all placeholder:text-zinc-700"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <span className="text-zinc-400 text-[10px] uppercase tracking-widest font-bold ml-2">Telefónne číslo</span>
                  <input
                    type="tel"
                    placeholder="Telefónne číslo"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="w-full bg-zinc-950/50 border border-emerald-500/40 rounded-xl px-5 py-4 text-white outline-none focus:ring-1 focus:ring-emerald-500 transition-all placeholder:text-zinc-700"
                  />
                </div>

                <div className="space-y-2">
                  <span className="text-zinc-400 text-[10px] uppercase tracking-widest font-bold ml-2">Mesto</span>
                  <input
                    type="text"
                    placeholder="Mesto (napr. Trnava)"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full bg-zinc-950/50 border border-emerald-500/40 rounded-xl px-5 py-4 text-white outline-none focus:ring-1 focus:ring-emerald-500 transition-all placeholder:text-zinc-700"
                  />
                </div>

                <div className="space-y-2">
                  <span className="text-zinc-400 text-[10px] uppercase tracking-widest font-bold ml-2">Názov fitka</span>
                  <input
                    type="text"
                    placeholder="Názov fitka (napr. Royal Fitness)"
                    value={gymName}
                    onChange={(e) => setGymName(e.target.value)}
                    className="w-full bg-zinc-950/50 border border-emerald-500/40 rounded-xl px-5 py-4 text-white outline-none focus:ring-1 focus:ring-emerald-500 transition-all placeholder:text-zinc-700"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <span className="text-zinc-400 text-[10px] uppercase tracking-widest font-bold ml-2">Používateľské meno (URL)</span>
                  <input
                    type="text"
                    placeholder="Používateľské meno (URL slug)"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-zinc-950/50 border border-emerald-500/40 rounded-xl px-5 py-4 text-white outline-none focus:ring-1 focus:ring-emerald-500 transition-all placeholder:text-zinc-700"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <div className="flex items-center justify-between gap-4 px-2">
                    <span className="text-zinc-400 text-[10px] uppercase tracking-widest font-bold">Bio</span>
                    <span className="text-[10px] text-zinc-600 font-bold">{bio.length}/100</span>
                  </div>
                  <textarea
                    placeholder="Bio"
                    value={bio}
                    onChange={(e) => setBio(e.target.value.slice(0, 100))}
                    maxLength={100}
                    className="w-full bg-zinc-950/50 border border-emerald-500/40 rounded-2xl px-5 py-4 text-white outline-none min-h-[110px] resize-none focus:ring-1 focus:ring-emerald-500 transition-all placeholder:text-zinc-700"
                  />
                </div>
              </div>

              <div className="mt-8 space-y-3">
                <span className="text-zinc-400 text-[10px] uppercase tracking-widest font-bold ml-2">Profilové fotky</span>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full aspect-[16/9] border border-emerald-500/50 border-dashed rounded-[30px] flex flex-col items-center justify-center cursor-pointer hover:bg-emerald-500/5 transition-colors overflow-hidden relative"
                >
                  <div className="text-emerald-500 text-5xl font-light mb-2">+</div>
                  <div className="text-zinc-500 text-[10px] uppercase tracking-widest font-bold">Nahrať profilové fotky</div>
                </div>
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />

                <div className="flex flex-wrap justify-center gap-3 pt-2">
                  {images.map((img, idx) => (
                    <div key={idx} className="relative w-16 h-16 md:w-20 md:h-20 rounded-2xl border border-emerald-500/30 overflow-hidden shrink-0 bg-zinc-950/40">
                      {img ? (
                        <>
                          <Image src={img} alt={`Profile ${idx}`} fill className="object-cover" />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeImage(idx);
                            }}
                            className="absolute top-2 right-2 bg-black/70 text-white rounded-full w-6 h-6 flex items-center justify-center text-[10px] hover:bg-black transition-colors z-20"
                            aria-label="Odstrániť fotku"
                          >
                            ✕
                          </button>
                        </>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-700 text-xs font-bold">—</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-10 flex justify-end">
                <button
                  onClick={handleSaveProfile}
                  disabled={saving}
                  className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-3 px-10 rounded-full text-sm uppercase tracking-widest transition-all disabled:opacity-50 shadow-lg shadow-emerald-500/20"
                >
                  {saving ? "Ukladám..." : "Uložiť"}
                </button>
              </div>
            </div>
          </div>
        );

      case "sluzby":
        return (
          <div className="flex flex-col gap-4 w-full max-w-[400px] ml-auto">
            <div className="flex items-center justify-between p-4 border border-emerald-500/30 rounded-xl bg-zinc-900/30 backdrop-blur-sm">
              <span className="text-white font-medium">Rezervovať osobný tréning</span>
              <button
                type="button"
                role="switch"
                aria-checked={servicesVisibility.personal_training}
                onClick={() => toggleService("personal_training")}
                disabled={saving}
                className={`relative w-12 h-6 rounded-full transition-colors ${servicesVisibility.personal_training ? "bg-emerald-500" : "bg-zinc-700"} disabled:opacity-60 disabled:cursor-not-allowed`}
              >
                <span
                  className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${servicesVisibility.personal_training ? "translate-x-6" : "translate-x-0"}`}
                />
              </button>
            </div>
            <div className="flex items-center justify-between p-4 border border-emerald-500/30 rounded-xl bg-zinc-900/30 backdrop-blur-sm">
              <span className="text-white font-medium">Rezervovať online konzultáciu</span>
              <button
                type="button"
                role="switch"
                aria-checked={servicesVisibility.online_consultation}
                onClick={() => toggleService("online_consultation")}
                disabled={saving}
                className={`relative w-12 h-6 rounded-full transition-colors ${servicesVisibility.online_consultation ? "bg-emerald-500" : "bg-zinc-700"} disabled:opacity-60 disabled:cursor-not-allowed`}
              >
                <span
                  className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${servicesVisibility.online_consultation ? "translate-x-6" : "translate-x-0"}`}
                />
              </button>
            </div>
            <div className="flex items-center justify-between p-4 border border-emerald-500/30 rounded-xl bg-zinc-900/30 backdrop-blur-sm">
              <span className="text-white font-medium">Objednať jedálniček</span>
              <button
                type="button"
                role="switch"
                aria-checked={servicesVisibility.meal_plan}
                onClick={() => toggleService("meal_plan")}
                disabled={saving}
                className={`relative w-12 h-6 rounded-full transition-colors ${servicesVisibility.meal_plan ? "bg-emerald-500" : "bg-zinc-700"} disabled:opacity-60 disabled:cursor-not-allowed`}
              >
                <span
                  className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${servicesVisibility.meal_plan ? "translate-x-6" : "translate-x-0"}`}
                />
              </button>
            </div>
            <div className="flex items-center justify-between p-4 border border-emerald-500/30 rounded-xl bg-zinc-900/30 backdrop-blur-sm">
              <span className="text-white font-medium">Mesačná premena</span>
              <button
                type="button"
                role="switch"
                aria-checked={servicesVisibility.transformation}
                onClick={() => toggleService("transformation")}
                disabled={saving}
                className={`relative w-12 h-6 rounded-full transition-colors ${servicesVisibility.transformation ? "bg-emerald-500" : "bg-zinc-700"} disabled:opacity-60 disabled:cursor-not-allowed`}
              >
                <span
                  className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${servicesVisibility.transformation ? "translate-x-6" : "translate-x-0"}`}
                />
              </button>
            </div>
            <div className="flex items-center justify-between p-4 border border-emerald-500/30 rounded-xl bg-zinc-900/30 backdrop-blur-sm">
              <span className="text-white font-medium">Moje odporúčané značky</span>
              <button
                type="button"
                role="switch"
                aria-checked={servicesVisibility.brands}
                onClick={() => toggleService("brands")}
                disabled={saving}
                className={`relative w-12 h-6 rounded-full transition-colors ${servicesVisibility.brands ? "bg-emerald-500" : "bg-zinc-700"} disabled:opacity-60 disabled:cursor-not-allowed`}
              >
                <span
                  className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${servicesVisibility.brands ? "translate-x-6" : "translate-x-0"}`}
                />
              </button>
            </div>

            <div className="flex justify-end mt-6">
              <button className="bg-emerald-500 text-black font-display text-xl px-12 py-2 rounded-full uppercase tracking-widest shadow-lg shadow-emerald-500/20">Uložiť</button>
            </div>
          </div>
        );

      case "kalendar":
        return (
          <div className="flex flex-col gap-6 w-full max-w-[760px] ml-auto">
            <h2 className="text-4xl font-display uppercase tracking-wider mb-4 text-white">Kalendár osobných tréningov</h2>
            
            <div className="flex gap-4 mb-6 border-b border-zinc-900 pb-4">
              <button
                onClick={() => setActiveCalendarTab("moj_kalendar")}
                className={`px-6 py-2 rounded-full font-bold uppercase tracking-widest text-xs transition-all ${
                  activeCalendarTab === "moj_kalendar" 
                    ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20" 
                    : "text-zinc-500 hover:text-white"
                }`}
              >
                Môj kalendár
              </button>
              <button
                onClick={() => setActiveCalendarTab("nastavenia_kalendara")}
                className={`px-6 py-2 rounded-full font-bold uppercase tracking-widest text-xs transition-all ${
                  activeCalendarTab === "nastavenia_kalendara" 
                    ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20" 
                    : "text-zinc-500 hover:text-white"
                }`}
              >
                Nastavenia kalendára
              </button>
            </div>

            {activeCalendarTab === "moj_kalendar" ? (
              <TrainerCalendar trainerId={trainerId} serviceType="personal" slotDurationMinutes={60} />
            ) : (
              <CalendarSettings trainerId={trainerId} serviceType="personal" slotDurationMinutes={60} />
            )}
          </div>
        );

      case "online-konzultacie":
        return (
          <div className="flex flex-col gap-6 w-full max-w-[760px] ml-auto">
            <h2 className="text-4xl font-display uppercase tracking-wider mb-4">Online konzultácie</h2>
            
            <div className="flex gap-4 mb-6 border-b border-zinc-900 pb-4">
              <button
                onClick={() => setActiveCalendarTab("moj_kalendar")}
                className={`px-6 py-2 rounded-full font-bold uppercase tracking-widest text-xs transition-all ${
                  activeCalendarTab === "moj_kalendar" 
                    ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20" 
                    : "text-zinc-500 hover:text-white"
                }`}
              >
                Môj kalendár
              </button>
              <button
                onClick={() => setActiveCalendarTab("nastavenia_kalendara")}
                className={`px-6 py-2 rounded-full font-bold uppercase tracking-widest text-xs transition-all ${
                  activeCalendarTab === "nastavenia_kalendara" 
                    ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20" 
                    : "text-zinc-500 hover:text-white"
                }`}
              >
                Nastavenia kalendára
              </button>
            </div>

            {activeCalendarTab === "moj_kalendar" ? (
              <TrainerCalendar trainerId={trainerId} serviceType="online" slotDurationMinutes={30} />
            ) : (
              <CalendarSettings trainerId={trainerId} serviceType="online" slotDurationMinutes={30} />
            )}
          </div>
        );

      case "rezervacie":
        return (
          <div className="flex flex-col gap-6 w-full max-w-[1100px] ml-auto">
            <h2 className="text-4xl font-display uppercase tracking-wider mb-4">Moje rezervácie</h2>
            <TrainerBookings trainerId={trainerId} />
          </div>
        );

      case "recenzie":
        return (
          <div className="flex flex-col gap-6 w-full max-w-[760px] ml-auto">
            <h2 className="text-4xl font-display uppercase tracking-wider mb-4">Recenzie</h2>
            <TrainerReviewsTab />
          </div>
        );

      case "vysledky":
        return (
          <div className="flex flex-col gap-6 w-full max-w-[760px] ml-auto">
            <h2 className="text-4xl font-display uppercase tracking-wider mb-4">Výsledky klientov</h2>
            <TrainerClientResults trainerId={trainerId} />
          </div>
        );

      case "znacky":
        return (
          <div className="flex flex-col gap-6 w-full max-w-[760px] ml-auto">
            <h2 className="text-4xl font-display uppercase tracking-wider mb-4">Moje značky</h2>
            
            <div className="flex gap-4 mb-8">
              <button 
                onClick={() => setActiveBrandSubTab("zoznam")}
                className={`px-6 py-2 rounded-full font-bold uppercase tracking-widest text-xs transition-all ${
                  activeBrandSubTab === "zoznam" 
                    ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20" 
                    : "bg-zinc-900/50 text-zinc-500 hover:text-white border border-white/5"
                }`}
              >
                Moje značky
              </button>
              <button 
                onClick={() => setActiveBrandSubTab("pridat")}
                className={`px-6 py-2 rounded-full font-bold uppercase tracking-widest text-xs transition-all ${
                  activeBrandSubTab === "pridat" 
                    ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20" 
                    : "bg-zinc-900/50 text-zinc-500 hover:text-white border border-white/5"
                }`}
              >
                + Pridať značku
              </button>
            </div>

            {activeBrandSubTab === "pridat" ? (
              <div className="bg-zinc-900/30 border border-emerald-500/30 rounded-[30px] p-8 backdrop-blur-sm max-w-[500px]">
                <div className="space-y-6">
                  <div className="space-y-3">
                    <span className="text-zinc-400 text-[10px] uppercase tracking-widest font-bold ml-2">Logo značky</span>
                    <div 
                      onClick={() => brandLogoInputRef.current?.click()}
                      className="w-full aspect-[2/1] border border-emerald-500/50 border-dashed rounded-2xl flex items-center justify-center cursor-pointer hover:bg-emerald-500/5 transition-colors overflow-hidden relative group"
                    >
                      {newBrandLogo ? (
                        <>
                          <Image src={newBrandLogo} alt="Logo" fill className="object-contain p-4" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold uppercase tracking-widest">
                            Zmeniť logo
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                          <span className="text-emerald-500 text-4xl font-light">+</span>
                          <span className="text-zinc-500 text-[10px] uppercase tracking-widest font-bold">Nahrať logo</span>
                        </div>
                      )}
                    </div>
                    <input type="file" ref={brandLogoInputRef} className="hidden" accept="image/*" onChange={handleLogoUpload} />
                  </div>

                  <div className="space-y-3">
                    <span className="text-zinc-400 text-[10px] uppercase tracking-widest font-bold ml-2">Váš promo kód</span>
                    <input 
                      type="text" 
                      placeholder="Napr. FITBASE10"
                      value={newBrandCode} 
                      onChange={(e) => setNewBrandCode(e.target.value)}
                      className="w-full bg-zinc-950/50 border border-emerald-500/50 rounded-xl px-6 py-4 text-white text-lg font-bold outline-none focus:ring-1 focus:ring-emerald-500 transition-all uppercase placeholder:text-zinc-700" 
                    />
                  </div>

                  <div className="space-y-3">
                    <span className="text-zinc-400 text-[10px] uppercase tracking-widest font-bold ml-2">URL stránky proma</span>
                    <input 
                      type="text" 
                      placeholder="https://www.znacka.sk/akcia"
                      value={newBrandUrl} 
                      onChange={(e) => setNewBrandUrl(e.target.value)}
                      className="w-full bg-zinc-950/50 border border-emerald-500/50 rounded-xl px-6 py-4 text-white text-lg font-bold outline-none focus:ring-1 focus:ring-emerald-500 transition-all placeholder:text-zinc-700" 
                    />
                  </div>

                  <div className="pt-4 flex justify-end">
                    <button 
                      onClick={handleSaveBrand}
                      disabled={saving}
                      className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-3 px-10 rounded-full text-sm uppercase tracking-widest transition-all disabled:opacity-50 shadow-lg shadow-emerald-500/20"
                    >
                      {saving ? "Ukladám..." : "Uložiť značku"}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {brands.length === 0 ? (
                  <div className="col-span-full bg-zinc-900/20 border border-zinc-800/50 rounded-[30px] py-16 flex flex-col items-center gap-4">
                    <div className="text-zinc-600 italic">Zatiaľ nemáte pridané žiadne značky.</div>
                    <button 
                      onClick={() => setActiveBrandSubTab("pridat")}
                      className="text-emerald-500 text-[10px] uppercase tracking-widest font-bold hover:text-emerald-400 transition-colors"
                    >
                      Pridať prvú značku
                    </button>
                  </div>
                ) : (
                  brands.map((brand) => (
                    <div key={brand.id} className="bg-zinc-900/30 border border-emerald-500/30 rounded-[25px] p-5 backdrop-blur-sm group hover:border-emerald-500/50 transition-colors flex flex-col gap-4">
                      <div className="relative aspect-[2/1] bg-zinc-950/40 rounded-xl overflow-hidden border border-zinc-800 flex items-center justify-center">
                        <Image src={brand.logo} alt="Logo" fill className="object-contain p-4" />
                      </div>
                      
                      <div className="flex items-center justify-between px-1">
                        <div className="space-y-1">
                          <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold block">Promo kód</span>
                          <span className="text-white font-bold text-lg tracking-wide uppercase">{brand.code}</span>
                        </div>
                        <button 
                          onClick={() => handleDeleteBrand(brand.id)}
                          className="px-4 py-2 rounded-full border border-red-500/30 text-red-500 hover:bg-red-500/10 transition-colors text-[10px] uppercase font-bold tracking-widest"
                        >
                          Vymazať
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        );

      case "transformation":
        return (
          <div className="flex flex-col gap-6 w-full max-w-[760px] ml-auto">
            <h2 className="text-4xl font-display uppercase tracking-wider mb-2">Mesačná premena</h2>
            <div className="bg-zinc-900/30 border border-emerald-500/30 rounded-[30px] p-8 backdrop-blur-sm space-y-8">
              <div>
                <h3 className="text-xl font-bold text-white mb-2">Vypíšte, čo klient získa kúpou mesačnej premeny</h3>
                <p className="text-zinc-400 text-sm">Tieto informácie uvidí klient na vašom profile pred kúpou.</p>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold ml-2">Čo získate kúpou mesačného predplatného?</label>
                  <input
                    type="text"
                    placeholder="Napr. Kompletná transformácia tela za 30 dní"
                    value={transformation.headline}
                    onChange={(e) => setTransformation({ ...transformation, headline: e.target.value })}
                    className="w-full bg-zinc-950/50 border border-emerald-500/40 rounded-xl px-5 py-4 text-white outline-none focus:ring-1 focus:ring-emerald-500 transition-all placeholder:text-zinc-700"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold ml-2">Nepovinná krátka motivačná veta</label>
                  <input
                    type="text"
                    placeholder="Napr. Zmeňte svoj životný štýl ešte dnes"
                    value={transformation.subheadline}
                    onChange={(e) => setTransformation({ ...transformation, subheadline: e.target.value })}
                    className="w-full bg-zinc-950/50 border border-emerald-500/40 rounded-xl px-5 py-4 text-white outline-none focus:ring-1 focus:ring-emerald-500 transition-all placeholder:text-zinc-700"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold ml-2">Počet osobných tréningov</label>
                    <input
                      type="number"
                      value={transformation.personal_sessions_count}
                      onChange={(e) => setTransformation({ ...transformation, personal_sessions_count: parseInt(e.target.value) || 0 })}
                      className="w-full bg-zinc-950/50 border border-emerald-500/40 rounded-xl px-5 py-4 text-white outline-none focus:ring-1 focus:ring-emerald-500 transition-all"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold ml-2">Počet online volaní</label>
                    <input
                      type="number"
                      value={transformation.online_calls_count}
                      onChange={(e) => setTransformation({ ...transformation, online_calls_count: parseInt(e.target.value) || 0 })}
                      className="w-full bg-zinc-950/50 border border-emerald-500/40 rounded-xl px-5 py-4 text-white outline-none focus:ring-1 focus:ring-emerald-500 transition-all"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 px-2">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={transformation.includes_meal_plan}
                    onClick={() => setTransformation({ ...transformation, includes_meal_plan: !transformation.includes_meal_plan })}
                    className={`relative w-12 h-6 rounded-full transition-colors ${transformation.includes_meal_plan ? "bg-emerald-500" : "bg-zinc-700"}`}
                  >
                    <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${transformation.includes_meal_plan ? "translate-x-6" : "translate-x-0"}`} />
                  </button>
                  <span className="text-white font-medium">Jedálniček na mieru</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                  <div className="space-y-2">
                    <label className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold ml-2">Cena na mesiac (v EUR)</label>
                    <input
                      type="number"
                      placeholder="Cena v EUR"
                      value={transformation.price_month_cents / 100}
                      onChange={(e) => setTransformation({ ...transformation, price_month_cents: Math.round(parseFloat(e.target.value) * 100) || 0 })}
                      className="w-full bg-zinc-950/50 border border-emerald-500/40 rounded-xl px-5 py-4 text-white outline-none focus:ring-1 focus:ring-emerald-500 transition-all font-bold text-lg"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold ml-2">Koľko by vás to vyšlo normálne (v EUR)</label>
                    <input
                      type="number"
                      placeholder="Bežná cena v EUR"
                      value={transformation.regular_price_cents / 100}
                      onChange={(e) => setTransformation({ ...transformation, regular_price_cents: Math.round(parseFloat(e.target.value) * 100) || 0 })}
                      className="w-full bg-zinc-950/50 border border-emerald-500/40 rounded-xl px-5 py-4 text-white outline-none focus:ring-1 focus:ring-emerald-500 transition-all"
                    />
                  </div>
                </div>

                <div className="pt-8 flex justify-end">
                   <button
                     onClick={handleSaveTransformation}
                     disabled={saving}
                     className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-3 px-10 rounded-full text-sm uppercase tracking-widest transition-all disabled:opacity-50 shadow-lg shadow-emerald-500/20"
                   >
                     {saving ? "Ukladám..." : "Uložiť premenu"}
                   </button>
                 </div>
               </div>
             </div>

             <div className="mt-12 bg-zinc-900/30 border border-emerald-500/30 rounded-[30px] p-8 backdrop-blur-sm">
               <div className="text-white font-bold text-lg mb-6 uppercase tracking-wider">Zľavové kódy pre premenu</div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <div className="bg-black/20 border border-white/10 rounded-2xl p-6 space-y-4">
                   <div className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Nový kód</div>
                   <div className="space-y-3">
                     <input
                       placeholder="KÓD (napr. PREMENA10)"
                       value={newDiscount.code}
                       onChange={(e) => setNewDiscount({ ...newDiscount, code: e.target.value.toUpperCase(), service_type: "transformation" })}
                       className="w-full p-4 bg-zinc-800 border border-zinc-700 rounded-xl text-white outline-none focus:ring-1 focus:ring-emerald-500"
                     />
                     <div className="flex gap-2">
                       <select
                         value={newDiscount.type}
                         onChange={(e) => setNewDiscount({ ...newDiscount, type: e.target.value as "percent" | "fixed" })}
                         className="flex-1 p-4 bg-zinc-800 border border-zinc-700 rounded-xl text-white outline-none"
                       >
                         <option value="percent">Percentá (%)</option>
                         <option value="fixed">Fixná suma (EUR)</option>
                       </select>
                       <input
                         placeholder="Hodnota"
                         type="number"
                         value={newDiscount.value}
                         onChange={(e) => setNewDiscount({ ...newDiscount, value: e.target.value })}
                         className="w-24 p-4 bg-zinc-800 border border-zinc-700 rounded-xl text-white outline-none focus:ring-1 focus:ring-emerald-500"
                       />
                     </div>
                     <input
                       placeholder="Max. počet použití (voliteľné)"
                       type="number"
                       value={newDiscount.max_uses}
                       onChange={(e) => setNewDiscount({ ...newDiscount, max_uses: e.target.value })}
                       className="w-full p-4 bg-zinc-800 border border-zinc-700 rounded-xl text-white outline-none focus:ring-1 focus:ring-emerald-500"
                     />
                     <button
                       onClick={handleAddDiscount}
                       disabled={saving || !newDiscount.code || !newDiscount.value}
                       className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-4 rounded-xl text-xs uppercase tracking-widest transition-all disabled:opacity-50"
                     >
                       Pridať kód
                     </button>
                   </div>
                 </div>

                 <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                   {discounts.filter(d => d.service_type === "transformation").length === 0 ? (
                     <div className="text-zinc-500 italic text-sm text-center py-10">Zatiaľ žiadne kódy pre premenu.</div>
                   ) : (
                     discounts.filter(d => d.service_type === "transformation").map((d) => (
                       <div key={d.id} className="bg-zinc-800/50 border border-white/5 rounded-xl p-5 flex items-center justify-between">
                         <div>
                           <div className="flex items-center gap-2">
                             <span className="font-bold text-emerald-400">{d.code}</span>
                           </div>
                           <div className="text-xs text-zinc-400 mt-1">
                             {d.value}{d.type === "percent" ? "%" : " EUR"} • Použité: {d.used_count}/{d.max_uses || "∞"}
                           </div>
                         </div>
                         <div className="flex items-center gap-3">
                           <button
                             onClick={() => toggleDiscountActive(d.id, d.is_active)}
                             className={`w-10 h-5 rounded-full relative transition-colors ${d.is_active ? "bg-emerald-500" : "bg-zinc-600"}`}
                           >
                             <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${d.is_active ? "left-6" : "left-1"}`} />
                           </button>
                           <button onClick={() => deleteDiscount(d.id)} className="text-zinc-500 hover:text-red-400 p-2">
                             <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                               <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                             </svg>
                           </button>
                         </div>
                       </div>
                     ))
                   )}
                 </div>
               </div>
             </div>
           </div>
         );

      case "ai-jedalnicek":
        return (
          <div className="flex flex-col gap-6 w-full max-w-[1100px] ml-auto">
            <h2 className="text-4xl font-display uppercase tracking-wider mb-2">AI jedálniček</h2>
            <p className="text-zinc-400 text-sm mb-4">
              Urobte klientovi jedálniček pomocou AI, aby ste si ušetrili čas. Vygenerujte jedálniček, ktorý môžete upravovať a následne poslať klientovi.
            </p>
            <TrainerMealPlanAI trainerId={trainerId} />
          </div>
        );

      case "nastavenia":
        return (
          <div className="flex flex-col gap-6 w-full max-w-[760px] ml-auto">
            <div className="flex justify-center">
              <div className="max-w-full overflow-x-auto overscroll-x-contain">
                <div className="inline-flex rounded-full bg-zinc-950/60 border border-zinc-800 p-1 whitespace-nowrap">
                  {settingsTabs.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveSettingsTab(tab.id)}
                      className={`shrink-0 px-6 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-colors ${
                        activeSettingsTab === tab.id ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20" : "text-zinc-300 hover:text-white"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {activeSettingsTab === "payment_account" && (
              <div className="bg-zinc-900/30 border border-emerald-500/30 rounded-[30px] p-6 md:p-8 backdrop-blur-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-white font-bold text-lg">Stripe Connect</div>
                    <div className="mt-1 text-zinc-400 text-sm">
                      Dokončite onboarding, aby ste mohli prijímať platby a dostávať výplaty.
                    </div>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                    <div className="text-zinc-300 text-sm">Stripe účet</div>
                    <span
                      className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                        stripeAccountId ? "bg-emerald-500/20 text-emerald-400" : "bg-zinc-700/50 text-zinc-300"
                      }`}
                    >
                      {stripeAccountId ? "Vytvorený" : "Nevytvorený"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                    <div className="text-zinc-300 text-sm">Onboarding</div>
                    <span
                      className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                        stripeOnboardingCompleted ? "bg-emerald-500/20 text-emerald-400" : "bg-zinc-700/50 text-zinc-300"
                      }`}
                    >
                      {stripeOnboardingCompleted ? "Dokončený" : "Nedokončený"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                    <div className="text-zinc-300 text-sm">Prijímanie platieb</div>
                    <span
                      className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                        stripeChargesEnabled ? "bg-emerald-500/20 text-emerald-400" : "bg-zinc-700/50 text-zinc-300"
                      }`}
                    >
                      {stripeChargesEnabled ? "Povolené" : "Nepovolené"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                    <div className="text-zinc-300 text-sm">Výplaty</div>
                    <span
                      className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                        stripePayoutsEnabled ? "bg-emerald-500/20 text-emerald-400" : "bg-zinc-700/50 text-zinc-300"
                      }`}
                    >
                      {stripePayoutsEnabled ? "Povolené" : "Nepovolené"}
                    </span>
                  </div>
                </div>

                <div className="mt-4 text-[11px] text-zinc-500 leading-relaxed">
                  Onboarding je overenie a nastavenie vášho Stripe účtu. Bez dokončenia onboardingu Stripe nezapne prijímanie platieb ani výplaty.
                </div>

                {stripeError && (
                  <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-200 text-sm">
                    {stripeError}
                  </div>
                )}

                <div className="mt-6 flex justify-end">
                  {!stripeAccountId ? (
                    <button
                      type="button"
                      onClick={handleStripeConnect}
                      disabled={stripeBusy !== null}
                      className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-3 px-8 rounded-full text-xs uppercase tracking-widest transition-all disabled:opacity-50 shadow-lg shadow-emerald-500/20"
                    >
                      {stripeBusy === "connect" ? "Prebieha..." : "Prepojiť Stripe"}
                    </button>
                  ) : !stripeOnboardingCompleted ? (
                    <button
                      type="button"
                      onClick={handleStripeOnboarding}
                      disabled={stripeBusy !== null}
                      className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-3 px-8 rounded-full text-xs uppercase tracking-widest transition-all disabled:opacity-50 shadow-lg shadow-emerald-500/20"
                    >
                      {stripeBusy === "onboarding" ? "Prebieha..." : "Dokončiť onboarding"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleStripeDashboard}
                      disabled={stripeBusy !== null}
                      className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-3 px-8 rounded-full text-xs uppercase tracking-widest transition-all disabled:opacity-50 shadow-lg shadow-emerald-500/20"
                    >
                      {stripeBusy === "dashboard" ? "Prebieha..." : "Otvoriť Stripe dashboard"}
                    </button>
                  )}
                </div>
              </div>
            )}
            {activeSettingsTab === "pricing" && (
              <div className="bg-zinc-900/30 border border-emerald-500/30 rounded-[30px] p-6 md:p-8 backdrop-blur-sm space-y-6">
                <div>
                  <div className="text-white font-bold text-lg">Cenník</div>
                  <div className="mt-1 text-zinc-400 text-sm">Nastavte ceny v EUR. Uložené hodnoty sa použijú pri platbe.</div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest">Osobný tréning (EUR)</label>
                    <input
                      value={pricePersonalEuro}
                      onChange={(e) => setPricePersonalEuro(e.target.value)}
                      inputMode="decimal"
                      className="w-full p-3 bg-zinc-800 border border-zinc-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-white placeholder:text-zinc-600"
                      placeholder="50.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest">Online konzultácia (EUR)</label>
                    <input
                      value={priceOnlineEuro}
                      onChange={(e) => setPriceOnlineEuro(e.target.value)}
                      inputMode="decimal"
                      className="w-full p-3 bg-zinc-800 border border-zinc-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-white placeholder:text-zinc-600"
                      placeholder="30.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest">Jedálniček na mieru (EUR)</label>
                    <input
                      value={priceMealPlanEuro}
                      onChange={(e) => setPriceMealPlanEuro(e.target.value)}
                      inputMode="decimal"
                      className="w-full p-3 bg-zinc-800 border border-zinc-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-white placeholder:text-zinc-600"
                      placeholder="40.00"
                    />
                    <div className="text-[10px] text-zinc-500 italic mt-1 ml-1">
                      provízia platforme je 10% z každej úspešne prijatej tranzakcie
                    </div>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleSavePricing}
                    disabled={saving}
                    className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-3 px-8 rounded-full text-xs uppercase tracking-widest transition-all disabled:opacity-50 shadow-lg shadow-emerald-500/20"
                  >
                    {saving ? "Ukladám..." : "Uložiť cenník"}
                  </button>
                </div>

                <div className="pt-6 border-t border-white/10">
                  <div className="text-white font-bold text-lg mb-4">Zľavové kódy</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-black/20 border border-white/10 rounded-2xl p-5 space-y-4">
                      <div className="text-sm font-bold text-zinc-400 uppercase tracking-widest">Nový kód</div>
                      <div className="space-y-3">
                        <input
                          placeholder="KÓD (napr. LETO20)"
                          value={newDiscount.code}
                          onChange={(e) => setNewDiscount({ ...newDiscount, code: e.target.value.toUpperCase() })}
                          className="w-full p-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                        <div className="flex gap-2">
                          <select
                            value={newDiscount.type}
                            onChange={(e) => setNewDiscount({ ...newDiscount, type: e.target.value as "percent" | "fixed" })}
                            className="flex-1 p-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white outline-none"
                          >
                            <option value="percent">Percentá (%)</option>
                            <option value="fixed">Fixná suma (EUR)</option>
                          </select>
                          <input
                            placeholder="Hodnota"
                            type="number"
                            value={newDiscount.value}
                            onChange={(e) => setNewDiscount({ ...newDiscount, value: e.target.value })}
                            className="w-24 p-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>
                        <select
                          value={newDiscount.service_type}
                          onChange={(e) => setNewDiscount({ ...newDiscount, service_type: e.target.value as "personal" | "online" | "meal_plan" | "transformation" })}
                          className="w-full p-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white outline-none"
                        >
                          <option value="personal">Osobný tréning</option>
                          <option value="online">Online konzultácia</option>
                          <option value="meal_plan">Jedálniček na mieru</option>
                          <option value="transformation">Mesačná premena</option>
                        </select>
                        <input
                          placeholder="Max. počet použití (voliteľné)"
                          type="number"
                          value={newDiscount.max_uses}
                          onChange={(e) => setNewDiscount({ ...newDiscount, max_uses: e.target.value })}
                          className="w-full p-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                        <button
                          onClick={handleAddDiscount}
                          disabled={saving || !newDiscount.code || !newDiscount.value}
                          className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-3 rounded-xl text-xs uppercase tracking-widest transition-all disabled:opacity-50"
                        >
                          Pridať kód
                        </button>
                      </div>
                    </div>

                    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                      {discounts.length === 0 ? (
                        <div className="text-zinc-500 italic text-sm text-center py-10">Zatiaľ žiadne kódy.</div>
                      ) : (
                        discounts.map((d) => (
                          <div key={d.id} className="bg-zinc-800/50 border border-white/5 rounded-xl p-4 flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-emerald-400">{d.code}</span>
                                <span className="text-[10px] bg-zinc-700 px-2 py-0.5 rounded uppercase text-zinc-300">
                                  {d.service_type === "personal" ? "Osobný" : d.service_type === "online" ? "Online" : "Jedálniček"}
                                </span>
                              </div>
                              <div className="text-xs text-zinc-400 mt-1">
                                {d.value}{d.type === "percent" ? "%" : " EUR"} • Použité: {d.used_count}/{d.max_uses || "∞"}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => toggleDiscountActive(d.id, d.is_active)}
                                className={`w-10 h-5 rounded-full relative transition-colors ${d.is_active ? "bg-emerald-500" : "bg-zinc-600"}`}
                              >
                                <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${d.is_active ? "left-6" : "left-1"}`} />
                              </button>
                              <button onClick={() => deleteDiscount(d.id)} className="text-zinc-500 hover:text-red-400 p-1">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeSettingsTab === "support" && (
              <div className="bg-zinc-900/30 border border-emerald-500/30 rounded-[30px] p-8 md:p-10 backdrop-blur-sm">
                <div className="max-w-[600px] space-y-8">
                  <div className="space-y-4">
                    <h3 className="text-2xl font-bold text-white uppercase tracking-wider">Podpora</h3>
                    <p className="text-zinc-300 leading-relaxed text-lg">
                      Veľmi si vážim že ste začali používať našu platformu. Chceme Vám byť čo najviac nápomocný, aby ste predišli akým koľvek problémom... Pre viac informácií alebo ak sa vyskytne nejaký problém sa kludne na mňa obráťte.
                    </p>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-white/5">
                    <div className="text-sm font-bold text-emerald-400 uppercase tracking-widest">Moje kontaktné údaje:</div>
                    <div className="space-y-3">
                      <div className="flex items-center gap-4 text-zinc-300">
                        <span className="w-24 text-zinc-500 text-xs font-bold uppercase tracking-widest">Telefón:</span>
                        <a href="tel:+421948263939" className="hover:text-emerald-400 transition-colors">+421 948 263 939</a>
                      </div>
                      <div className="flex items-center gap-4 text-zinc-300">
                        <span className="w-24 text-zinc-500 text-xs font-bold uppercase tracking-widest">Instagram:</span>
                        <a href="https://instagram.com/_patris.21" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-400 transition-colors">_patris.21</a>
                      </div>
                      <div className="flex items-center gap-4 text-zinc-300">
                        <span className="w-24 text-zinc-500 text-xs font-bold uppercase tracking-widest">Mail:</span>
                        <a href="mailto:info@fitbase.sk" className="hover:text-emerald-400 transition-colors">info@fitbase.sk</a>
                      </div>
                    </div>
                  </div>

                  <div className="pt-6">
                    <a
                      href="https://fitbase.sk/podpora"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center bg-zinc-950 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500 hover:text-black font-bold py-4 px-10 rounded-full text-sm uppercase tracking-widest transition-all shadow-lg shadow-emerald-500/10 group"
                    >
                      <span>užitočné návody a rady</span>
                      <svg
                        className="ml-2 w-4 h-4 transition-transform group-hover:translate-x-1"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>
        );

      default:
        return <div className="flex items-center justify-center h-full text-zinc-500 italic">Obsah sa pripravuje...</div>;
    }
  };

  const tabs: { id: TabId; label: string }[] = [
    { id: "profil", label: "Môj profil" },
    { id: "rezervacie", label: "Všetky rezervácie" },
    { id: "sluzby", label: "Služby" },
    { id: "kalendar", label: "Kalendár osobných tréningov" },
    { id: "online-konzultacie", label: "Online konzultácie" },
    { id: "recenzie", label: "Recenzie" },
    { id: "vysledky", label: "Výsledky klientov" },
    { id: "znacky", label: "Moje značky" },
    ...(servicesVisibility.transformation ? [{ id: "transformation" as TabId, label: "Mesačná premena" }] : []),
    { id: "ai-jedalnicek", label: "AI jedálniček" },
    { id: "nastavenia", label: "Nadstavenia" },
  ];

  return (
    <div className="min-h-screen bg-black text-white flex flex-col md:flex-row">
      <header className="md:hidden px-4 py-4 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-3">
          <Image src="/Fitbase logo.png" alt="Fitbase" width={130} height={30} priority className="h-auto w-[120px]" />
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right max-w-[45vw]">
            <div className="text-sm font-bold truncate">{fullName || "Tréner"}</div>
          </div>
          <button
            type="button"
            onClick={() => setIsMobileNavOpen(true)}
            className="h-10 w-10 inline-flex items-center justify-center rounded-full border border-white/10 bg-zinc-950/40 hover:bg-zinc-900/60 transition-colors"
            aria-label="Menu"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </header>

      {isMobileNavOpen && (
        <div className="md:hidden fixed inset-0 z-[200]">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setIsMobileNavOpen(false)}
          />
          <div className="absolute top-0 left-0 h-full w-[82vw] max-w-[320px] bg-zinc-950 border-r border-white/10 px-6 pt-4 pb-6 flex flex-col min-h-0 overflow-hidden">
            <div className="flex items-center justify-between mb-6">
              <Image src="/Fitbase logo.png" alt="Fitbase" width={140} height={32} priority className="h-auto w-[120px]" />
              <button
                type="button"
                onClick={() => setIsMobileNavOpen(false)}
                className="h-10 w-10 inline-flex items-center justify-center rounded-full border border-white/10 bg-zinc-950/40 hover:bg-zinc-900/60 transition-colors"
                aria-label="Zatvoriť"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mb-4">
              <div className="text-xs text-zinc-500 uppercase tracking-widest font-bold">Prihlásený tréner</div>
              <div className="text-lg font-bold text-white truncate">{fullName || "Tréner"}</div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain -mx-2 px-2">
              <nav className="flex flex-col gap-2 pb-6">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id);
                      setIsMobileNavOpen(false);
                    }}
                    className={`text-left px-4 py-3 rounded-2xl font-display text-xl tracking-wide transition-colors ${
                      activeTab === tab.id ? "bg-emerald-500 text-black" : "text-white hover:bg-white/5"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
                <div className="pt-4 mt-4 border-t border-white/10">
                  <button
                    type="button"
                    onClick={async () => {
                      setIsMobileNavOpen(false);
                      await handleLogout();
                    }}
                    className="w-full text-left px-4 py-3 rounded-2xl font-display text-xl tracking-wide transition-colors text-red-400 hover:bg-red-500/10 hover:text-red-300"
                  >
                    Odhlásiť sa
                  </button>
                </div>
              </nav>
            </div>
          </div>
        </div>
      )}

      <aside className="hidden md:flex w-[280px] p-10 flex-col gap-16 shrink-0 h-screen overflow-y-auto">
        <Image src="/Fitbase logo.png" alt="Fitbase" width={150} height={35} priority className="h-auto w-[150px]" />
        <div>
          <nav className="flex flex-col gap-4">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`text-left text-2xl font-display tracking-wide transition-colors ${activeTab === tab.id ? "text-emerald-500" : "text-white hover:text-emerald-500/70"}`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
          <div className="pt-6 mt-6 border-t border-white/10">
            <button
              type="button"
              onClick={handleLogout}
              className="text-left text-2xl font-display tracking-wide transition-colors text-red-400 hover:text-red-300"
            >
              Odhlásiť sa
            </button>
          </div>
        </div>
      </aside>
      <main className="flex-1 p-6 md:p-10 flex flex-col">
        <div className="md:mt-[4px]">{renderTabContent()}</div>
      </main>
      <style jsx global>{`@import url('https://fonts.googleapis.com/css2?family=League+Gothic&display=swap');`}</style>
    </div>
  );
}
