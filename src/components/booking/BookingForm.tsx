"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { AvailableSlot } from "@/lib/booking/getAvailableSlots";
import { createClient } from "@supabase/supabase-js";
import { featureFlags, supabaseAnonKey, supabaseUrl } from "@/lib/config";
import BookingAuthModal from "@/components/booking/BookingAuthModal";

// Validácia formulára pomocou Zod (musi sa zhodovat s tym v server action)
const bookingFormSchema = z.object({
  client_name: z.string().optional().or(z.literal("")),
  client_email: z.string().email("Neplatný email").optional().or(z.literal("")),
  client_phone: z.string().optional().or(z.literal("")),
  note: z.string().optional().or(z.literal("")),
});

type BookingFormValues = z.infer<typeof bookingFormSchema>;

interface BookingFormProps {
  selectedSlot: AvailableSlot;
  trainerName: string;
  trainerEmail?: string;
  initialValues?: Partial<BookingFormValues>;
  onSuccess?: () => void;
  onCancel?: () => void;
  serviceType?: "personal" | "online" | "transformation";
}

type PendingBookingPayload = {
  slot: AvailableSlot;
  form: BookingFormValues;
  trainerName: string;
  trainerEmail?: string;
  createdAt: number;
  serviceType: "personal" | "online" | "transformation";
};

const PENDING_KEY = "fitbase_pending_booking";

type BookingFormState =
  | { status: "idle" }
  | { status: "error"; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parsePendingBooking(raw: string): PendingBookingPayload | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return null;
    const slot = parsed.slot;
    const form = parsed.form;
    const trainerName = parsed.trainerName;
    const createdAt = parsed.createdAt;
    const serviceType = parsed.serviceType as "personal" | "online" | "transformation";

    if (!isRecord(slot)) return null;
    if (typeof slot.trainer_id !== "string" || typeof slot.starts_at !== "string" || typeof slot.ends_at !== "string" || typeof slot.source_availability_slot_id !== "string") {
      return null;
    }
    if (!isRecord(form)) return null;
    if (typeof form.client_name !== "string" || typeof form.client_email !== "string") return null;

    return {
      slot: slot as AvailableSlot,
      form: {
        client_name: form.client_name as string,
        client_email: form.client_email as string,
        client_phone: typeof form.client_phone === "string" ? (form.client_phone as string) : "",
        note: typeof form.note === "string" ? (form.note as string) : "",
      },
      trainerName: typeof trainerName === "string" ? trainerName : "Tréner",
      trainerEmail: typeof parsed.trainerEmail === "string" ? parsed.trainerEmail : undefined,
      createdAt: typeof createdAt === "number" ? createdAt : Date.now(),
      serviceType: serviceType || "personal",
    };
  } catch {
    return null;
  }
}

export default function BookingForm({
  selectedSlot,
  trainerName,
  trainerEmail,
  initialValues,
  onSuccess,
  onCancel,
  serviceType = "personal",
}: BookingFormProps) {
  const [formState, setFormState] = useState<BookingFormState>({ status: "idle" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);

  const supabase = useMemo(() => {
    return featureFlags.supabaseEnabled ? createClient(supabaseUrl, supabaseAnonKey) : null;
  }, []);

  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [accountName, setAccountName] = useState<string | null>(null);
  const [accountPhone, setAccountPhone] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);

  // State pre zľavový kód
  const [discountCode, setDiscountCode] = useState("");
  const [discountInfo, setDiscountInfo] = useState<{
    isValid: boolean;
    discountAmountCents: number;
    finalPriceCents: number;
    originalPriceCents: number;
    message?: string;
  } | null>(null);
  const [isValidatingDiscount, setIsValidatingDiscount] = useState(false);

  // Načítanie pôvodnej ceny pri mounte
  useEffect(() => {
    const fetchOriginalPrice = async () => {
      if (!supabase) return;
      try {
        const session = (await supabase.auth.getSession()).data.session;
        const res = await fetch("/api/stripe/create-checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            trainer_id: selectedSlot.trainer_id,
            service_type: serviceType || "personal",
            validate_only: true,
            access_token: session?.access_token
          }),
        });
        const data = await res.json();
        if (res.ok) {
          setDiscountInfo({
            isValid: false,
            discountAmountCents: 0,
            finalPriceCents: data.original_price_cents,
            originalPriceCents: data.original_price_cents,
          });
        }
      } catch (err) {
        console.error("Error fetching original price:", err);
      }
    };
    fetchOriginalPrice();
  }, [selectedSlot.trainer_id, serviceType, supabase]);

  const validateDiscount = async () => {
    if (!discountCode.trim() || !supabase) return;
    setIsValidatingDiscount(true);
    setDiscountInfo(null);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const res = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trainer_id: selectedSlot.trainer_id,
          service_type: serviceType || "personal",
          discount_code: discountCode.trim(),
          validate_only: true, // Povieme backendu že chceme len validáciu
          access_token: session?.access_token
        }),
      });
      const data = await res.json();
      if (res.ok && data.is_valid) {
        setDiscountInfo({
          isValid: true,
          discountAmountCents: data.discount_amount_cents,
          finalPriceCents: data.final_price_cents,
          originalPriceCents: data.original_price_cents,
          message: data.message
        });
      } else {
        setDiscountInfo({
          isValid: false,
          discountAmountCents: 0,
          finalPriceCents: data.original_price_cents || 0,
          originalPriceCents: data.original_price_cents || 0,
          message: data.message || "Neplatný kód"
        });
      }
    } catch {
      setDiscountInfo({
        isValid: false,
        discountAmountCents: 0,
        finalPriceCents: 0,
        originalPriceCents: 0,
        message: "Chyba pri overovaní kódu"
      });
    } finally {
      setIsValidatingDiscount(false);
    }
  };

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(async ({ data }) => {
      const user = data.session?.user;
      if (!user) {
        setAccountEmail(null);
        setAccountName(null);
        setAccountPhone(null);
        return;
      }
      setAccountEmail(typeof user.email === "string" ? user.email : null);
      try {
        const res = await supabase
          .from("profiles")
          .select("full_name, phone_number")
          .eq("id", user.id)
          .maybeSingle<{ full_name: string | null; phone_number: string | null }>();
        const full = res.data?.full_name;
        const phone = res.data?.phone_number;
        setAccountName(full && full.trim() ? full : null);
        setAccountPhone(phone && phone.trim() ? phone : null);
      } catch {
        setAccountName(null);
        setAccountPhone(null);
      }
    });
  }, [supabase]);

  const defaultValues = useMemo(() => {
    return {
      client_name: initialValues?.client_name || "",
      client_email: initialValues?.client_email || "",
      client_phone: initialValues?.client_phone || "",
      note: initialValues?.note || "",
    };
  }, [initialValues?.client_email, initialValues?.client_name, initialValues?.client_phone, initialValues?.note]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<BookingFormValues>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues,
  });

  useEffect(() => {
    reset(defaultValues);
  }, [defaultValues, reset]);

  const startCheckout = useCallback(async (payload: PendingBookingPayload, accessToken: string, validatedCode?: string) => {
    setIsSubmitting(true);
    setFormState({ status: "idle" });

    try {
      const res = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trainer_id: payload.slot.trainer_id,
          starts_at: payload.slot.starts_at,
          ends_at: payload.slot.ends_at,
          service_type: payload.serviceType,
          client_name: payload.form.client_name,
          client_email: payload.form.client_email,
          client_phone: payload.form.client_phone || null,
          note: payload.form.note || null,
          access_token: accessToken,
          discount_code: validatedCode || undefined
        }),
      });

      const responsePayload: unknown = await res.json().catch(() => null);
      const url = isRecord(responsePayload) && typeof responsePayload.url === "string" ? responsePayload.url : null;
      if (!res.ok || !url) {
        const message =
          isRecord(responsePayload) && typeof responsePayload.message === "string"
            ? responsePayload.message
            : "Nepodarilo sa spustiť platbu.";
        setFormState({ status: "error", message });
        return;
      }

      sessionStorage.removeItem(PENDING_KEY);
      if (onSuccess) onSuccess();
      window.location.href = url;
    } catch {
      setFormState({ status: "error", message: "Nastala neočakávaná chyba pri komunikácii so serverom." });
    } finally {
      setIsSubmitting(false);
    }
  }, [onSuccess]);

  useEffect(() => {
    if (!supabase) return;
    const raw = sessionStorage.getItem(PENDING_KEY);
    if (!raw) return;

    const pending = parsePendingBooking(raw);
    if (!pending) {
      sessionStorage.removeItem(PENDING_KEY);
      return;
    }

    if (pending.slot.trainer_id !== selectedSlot.trainer_id || pending.slot.starts_at !== selectedSlot.starts_at) {
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      const session = data.session;
      if (!session?.access_token) return;
      
      const rawWithDiscount = JSON.parse(raw);
      const validatedCode = rawWithDiscount.discount_code;
      
      void startCheckout(pending, session.access_token, validatedCode);
    });
  }, [selectedSlot.starts_at, selectedSlot.trainer_id, startCheckout, supabase]);

  const onSubmit = async (values: BookingFormValues) => {
    if (!supabase) {
      setFormState({ status: "error", message: "Auth nie je dostupný." });
      return;
    }

    try {
      const sessionResult = await supabase.auth.getSession();
      const session = sessionResult.data.session;

      const isAuthed = !!accountEmail;
      const resolvedName = (isAuthed && !editMode) ? (accountName || "Klient") : (values.client_name || accountName || "Klient");
      const resolvedEmail = (isAuthed && !editMode) ? accountEmail : (values.client_email || accountEmail || "");
      const resolvedPhone = (isAuthed && !editMode) ? (accountPhone || "") : (values.client_phone || accountPhone || "");

      // Ak nie sme v editMode a nie sme prihlásení, musíme skontrolovať či máme aspoň meno a email
      if (!isAuthed && (!resolvedName || !resolvedEmail)) {
        setFormState({ status: "error", message: "Prosím vyplňte meno a email." });
        return;
      }

      const pending: PendingBookingPayload = {
        slot: selectedSlot,
        form: {
          client_name: resolvedName,
          client_email: resolvedEmail,
          client_phone: resolvedPhone,
          note: values.note || "",
        },
        trainerName,
        trainerEmail,
        createdAt: Date.now(),
        serviceType,
      };

      const finalCode = (discountInfo?.isValid && discountCode.trim()) ? discountCode.trim() : undefined;

      if (!session?.access_token) {
        sessionStorage.setItem(PENDING_KEY, JSON.stringify({ ...pending, discount_code: finalCode }));
        setAuthOpen(true);
        return;
      }

      await startCheckout(pending, session.access_token, finalCode);
    } catch {
      setFormState({ status: "error", message: "Nastala neočakávaná chyba pri komunikácii so serverom." });
    }
  };

  const slotDateStr = serviceType === "transformation" 
    ? "Program na 30 dní"
    : new Date(selectedSlot.starts_at).toLocaleString("sk-SK", {
        weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit"
      });

  return (
    <div className="p-0 bg-transparent rounded-xl max-w-md mx-auto">
      <BookingAuthModal
        isOpen={authOpen}
        onClose={() => setAuthOpen(false)}
        initialEmail={defaultValues.client_email}
        onAuthed={async () => {
          if (!supabase) return;
          const raw = sessionStorage.getItem(PENDING_KEY);
          if (!raw) return;
          const pending = parsePendingBooking(raw);
          if (!pending) return;
          const session = (await supabase.auth.getSession()).data.session;
          if (!session?.access_token) return;
          
          const rawWithDiscount = JSON.parse(raw);
          const validatedCode = rawWithDiscount.discount_code;
          
          setAuthOpen(false);
          await startCheckout(pending, session.access_token, validatedCode);
        }}
      />
      <div className="mb-6 p-4 bg-zinc-800/50 border border-zinc-700 rounded-lg">
        <p className="text-xs text-zinc-400 font-medium uppercase tracking-wider">Vybraný termín:</p>
        <p className="text-emerald-400 font-bold text-lg">{slotDateStr}</p>
        <p className="text-[10px] text-zinc-500 mt-1 uppercase">Tréner: {trainerName}</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {accountEmail ? (
          <>
            {!editMode ? (
              <div className="flex items-center justify-between rounded-xl border border-zinc-700 bg-zinc-900/40 p-3">
                <div className="text-xs text-zinc-400">
                  <span className="font-bold uppercase tracking-wider">Ste prihlásený pod účtom: </span>
                  <span className="text-white">{accountEmail}</span>
                </div>
                <button
                  type="button"
                  className="px-3 py-1 rounded-lg border border-white/10 text-zinc-300 hover:bg-white/5 text-[10px] uppercase font-bold tracking-widest"
                  onClick={() => {
                    setEditMode(true);
                    setTimeout(() => {
                      if (accountName) reset({ ...defaultValues, client_name: accountName, client_email: accountEmail || "", client_phone: accountPhone || "" });
                      else reset({ ...defaultValues, client_email: accountEmail || "", client_phone: accountPhone || "" });
                    }, 0);
                  }}
                >
                  Upraviť
                </button>
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-bold text-zinc-400 mb-1 uppercase tracking-tight">Meno a priezvisko *</label>
                  <input
                  {...register("client_name")}
                  className={`w-full p-3 bg-zinc-800 border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-white placeholder:text-zinc-600 scroll-sm-120 ${errors.client_name ? 'border-red-500 bg-red-500/10' : 'border-zinc-700'}`}
                  placeholder="Ján Novák"
                />
                  {errors.client_name && <p className="text-red-400 text-[10px] mt-1 font-bold uppercase tracking-tighter">{errors.client_name.message}</p>}
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-400 mb-1 uppercase tracking-tight">Email *</label>
                  <input
                  {...register("client_email")}
                  className={`w-full p-3 bg-zinc-800 border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-white placeholder:text-zinc-600 scroll-sm-120 ${errors.client_email ? 'border-red-500 bg-red-500/10' : 'border-zinc-700'}`}
                  placeholder="jan@novak.sk"
                  type="email"
                />
                  {errors.client_email && <p className="text-red-400 text-[10px] mt-1 font-bold uppercase tracking-tighter">{errors.client_email.message}</p>}
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-400 mb-1 uppercase tracking-tight">Telefónne číslo</label>
                  <input
                  {...register("client_phone")}
                  className="w-full p-3 bg-zinc-800 border border-zinc-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-white placeholder:text-zinc-600 scroll-sm-120"
                  placeholder="+421 900 000 000"
                />
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    className="px-3 py-1 rounded-lg border border-white/10 text-zinc-300 hover:bg-white/5 text-[10px] uppercase font-bold tracking-widest"
                    onClick={() => {
                      setEditMode(false);
                      reset(defaultValues);
                    }}
                  >
                    Zavrieť
                  </button>
                </div>
              </>
            )}
          </>
        ) : (
          <>
            <div>
              <label className="block text-xs font-bold text-zinc-400 mb-1 uppercase tracking-tight">Meno a priezvisko *</label>
              <input
                {...register("client_name")}
                className={`w-full p-3 bg-zinc-800 border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-white placeholder:text-zinc-600 scroll-sm-120 ${errors.client_name ? 'border-red-500 bg-red-500/10' : 'border-zinc-700'}`}
                placeholder="Ján Novák"
              />
              {errors.client_name && <p className="text-red-400 text-[10px] mt-1 font-bold uppercase tracking-tighter">{errors.client_name.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-400 mb-1 uppercase tracking-tight">Email *</label>
              <input
                {...register("client_email")}
                className={`w-full p-3 bg-zinc-800 border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-white placeholder:text-zinc-600 scroll-sm-120 ${errors.client_email ? 'border-red-500 bg-red-500/10' : 'border-zinc-700'}`}
                placeholder="jan@novak.sk"
                type="email"
              />
              {errors.client_email && <p className="text-red-400 text-[10px] mt-1 font-bold uppercase tracking-tighter">{errors.client_email.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-400 mb-1 uppercase tracking-tight">Telefónne číslo</label>
              <input
                {...register("client_phone")}
                className="w-full p-3 bg-zinc-800 border border-zinc-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-white placeholder:text-zinc-600 scroll-sm-120"
                placeholder="+421 900 000 000"
              />
            </div>
          </>
        )}

        <div>
          <label className="block text-xs font-bold text-zinc-400 mb-1 uppercase tracking-tight">Poznámka</label>
          <textarea
            {...register("note")}
            className="w-full p-3 bg-zinc-800 border border-zinc-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-white placeholder:text-zinc-600 min-h-[80px]"
            placeholder="Mám špecifické požiadavky..."
          />
        </div>

        <div className="pt-2 border-t border-white/5">
          <label className="block text-xs font-bold text-zinc-400 mb-1 uppercase tracking-tight">Zľavový kód</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={discountCode}
              onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
              className="flex-1 p-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white outline-none focus:ring-2 focus:ring-emerald-500 transition-all uppercase placeholder:text-zinc-600"
              placeholder="ZADAJ KÓD"
            />
            <button
              type="button"
              onClick={validateDiscount}
              disabled={isValidatingDiscount || !discountCode.trim()}
              className="px-4 py-3 bg-zinc-700 text-white rounded-xl font-bold hover:bg-zinc-600 disabled:opacity-50 transition-colors uppercase text-xs"
            >
              {isValidatingDiscount ? "..." : "Použiť"}
            </button>
          </div>
          {discountInfo && (
            <div className={`mt-2 p-3 rounded-lg text-xs font-bold ${discountInfo.isValid ? 'bg-emerald-500/10 text-emerald-400' : (discountInfo.message ? 'bg-red-500/10 text-red-400' : 'bg-white/5 text-zinc-400')}`}>
              {discountInfo.isValid ? (
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span>Pôvodná cena:</span>
                    <span className="line-through">{(discountInfo.originalPriceCents / 100).toFixed(2)} €</span>
                  </div>
                  <div className="flex justify-between text-emerald-400">
                    <span>Zľava:</span>
                    <span>-{(discountInfo.discountAmountCents / 100).toFixed(2)} €</span>
                  </div>
                  <div className="flex justify-between text-lg border-t border-emerald-500/20 pt-1 mt-1">
                    <span>Finálna cena:</span>
                    <span>{(discountInfo.finalPriceCents / 100).toFixed(2)} €</span>
                  </div>
                </div>
              ) : (
                discountInfo.message || (
                  <div className="flex justify-between items-center">
                    <span>Cena za službu:</span>
                    <span className="text-white text-lg font-bold">{(discountInfo.originalPriceCents / 100).toFixed(2)} €</span>
                  </div>
                )
              )}
            </div>
          )}
        </div>

        {formState.status === "error" && (
          <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400 text-xs font-bold">
            {formState.message}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-3 px-4 border border-zinc-700 text-zinc-400 rounded-xl hover:bg-zinc-800 transition-colors font-bold uppercase text-xs"
              disabled={isSubmitting}
            >
              Späť
            </button>
          )}
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-[2] py-3 px-4 bg-emerald-500 text-black rounded-xl font-bold hover:bg-emerald-400 disabled:bg-emerald-900/50 disabled:text-zinc-500 disabled:cursor-not-allowed transition-colors uppercase tracking-widest"
          >
            {isSubmitting ? "Presmerovávam..." : "Rezervovať"}
          </button>
        </div>
        
        <p className="text-[9px] text-zinc-500 text-center mt-2 italic leading-tight">
          Pokračovaním v rezervácii súhlasíte so spracovaním osobných údajov pre účely rezervácie.
        </p>
      </form>
    </div>
  );
}
