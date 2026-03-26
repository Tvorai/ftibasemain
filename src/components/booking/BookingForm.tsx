"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { AvailableSlot } from "@/lib/booking/getAvailableSlots";
import { createBookingAction, BookingFormState } from "@/lib/booking/actions";
import { createClient } from "@supabase/supabase-js";
import { featureFlags, supabaseAnonKey, supabaseUrl } from "@/lib/config";
import BookingAuthModal from "@/components/booking/BookingAuthModal";

// Validácia formulára pomocou Zod (musi sa zhodovat s tym v server action)
const bookingFormSchema = z.object({
  client_name: z.string().min(2, "Meno musí mať aspoň 2 znaky"),
  client_email: z.string().email("Neplatný email"),
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
}

type PendingBookingPayload = {
  slot: AvailableSlot;
  form: BookingFormValues;
  trainerName: string;
  trainerEmail?: string;
  createdAt: number;
};

const PENDING_KEY = "fitbase_pending_booking";

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
}: BookingFormProps) {
  const [formState, setFormState] = useState<BookingFormState>({ status: "idle" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);

  const supabase = useMemo(() => {
    return featureFlags.supabaseEnabled ? createClient(supabaseUrl, supabaseAnonKey) : null;
  }, []);

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

  const finalizeBooking = async (payload: PendingBookingPayload, accessToken: string) => {
    setIsSubmitting(true);
    setFormState({ status: "idle" });

    try {
      const result = await createBookingAction({
        trainer_id: payload.slot.trainer_id,
        starts_at: payload.slot.starts_at,
        ends_at: payload.slot.ends_at,
        client_name: payload.form.client_name,
        client_email: payload.form.client_email,
        client_phone: payload.form.client_phone || null,
        note: payload.form.note || null,
        trainer_name: payload.trainerName,
        trainer_email: payload.trainerEmail,
        access_token: accessToken,
      });

      setFormState(result);
      if (result.status === "success") {
        sessionStorage.removeItem(PENDING_KEY);
        if (onSuccess) setTimeout(() => onSuccess(), 3000);
      }
    } catch {
      setFormState({ status: "error", message: "Nastala neočakávaná chyba pri komunikácii so serverom." });
    } finally {
      setIsSubmitting(false);
    }
  };

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
      void finalizeBooking(pending, session.access_token);
    });
  }, [selectedSlot.starts_at, selectedSlot.trainer_id, supabase]);

  const onSubmit = async (values: BookingFormValues) => {
    if (!supabase) {
      setFormState({ status: "error", message: "Auth nie je dostupný." });
      return;
    }

    try {
      const sessionResult = await supabase.auth.getSession();
      const session = sessionResult.data.session;

      const pending: PendingBookingPayload = {
        slot: selectedSlot,
        form: values,
        trainerName,
        trainerEmail,
        createdAt: Date.now(),
      };

      if (!session?.access_token) {
        sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending));
        setAuthOpen(true);
        return;
      }

      await finalizeBooking(pending, session.access_token);
    } catch {
      setFormState({ status: "error", message: "Nastala neočakávaná chyba pri komunikácii so serverom." });
    }
  };

  if (formState.status === "success") {
    return (
      <div className="p-6 bg-emerald-900/20 border border-emerald-500/50 rounded-xl text-center">
        <div className="mb-4 text-emerald-500">
          <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
          </svg>
        </div>
        <h3 className="text-xl font-bold text-emerald-400 mb-2">Rezervácia bola úspešná!</h3>
        <p className="text-zinc-300">{formState.message}</p>
        <p className="mt-4 text-xs text-emerald-500/70">Potvrdzovací email bol odoslaný na vašu adresu.</p>
      </div>
    );
  }

  const slotDateStr = new Date(selectedSlot.starts_at).toLocaleString("sk-SK", {
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
          setAuthOpen(false);
          await finalizeBooking(pending, session.access_token);
        }}
      />
      <div className="mb-6 p-4 bg-zinc-800/50 border border-zinc-700 rounded-lg">
        <p className="text-xs text-zinc-400 font-medium uppercase tracking-wider">Vybraný termín:</p>
        <p className="text-emerald-400 font-bold text-lg">{slotDateStr}</p>
        <p className="text-[10px] text-zinc-500 mt-1 uppercase">Tréner: {trainerName}</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-zinc-400 mb-1 uppercase tracking-tight">Meno a priezvisko *</label>
          <input
            {...register("client_name")}
            className={`w-full p-3 bg-zinc-800 border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-white placeholder:text-zinc-600 ${errors.client_name ? 'border-red-500 bg-red-500/10' : 'border-zinc-700'}`}
            placeholder="Janko Hraško"
          />
          {errors.client_name && <p className="text-red-400 text-[10px] mt-1 font-bold uppercase tracking-tighter">{errors.client_name.message}</p>}
        </div>

        <div>
          <label className="block text-xs font-bold text-zinc-400 mb-1 uppercase tracking-tight">Email *</label>
          <input
            {...register("client_email")}
            className={`w-full p-3 bg-zinc-800 border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-white placeholder:text-zinc-600 ${errors.client_email ? 'border-red-500 bg-red-500/10' : 'border-zinc-700'}`}
            placeholder="janko@priklad.sk"
            type="email"
          />
          {errors.client_email && <p className="text-red-400 text-[10px] mt-1 font-bold uppercase tracking-tighter">{errors.client_email.message}</p>}
        </div>

        <div>
          <label className="block text-xs font-bold text-zinc-400 mb-1 uppercase tracking-tight">Telefónne číslo</label>
          <input
            {...register("client_phone")}
            className="w-full p-3 bg-zinc-800 border border-zinc-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-white placeholder:text-zinc-600"
            placeholder="+421 900 000 000"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-zinc-400 mb-1 uppercase tracking-tight">Poznámka</label>
          <textarea
            {...register("note")}
            className="w-full p-3 bg-zinc-800 border border-zinc-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-white placeholder:text-zinc-600 min-h-[80px]"
            placeholder="Mám špecifické požiadavky..."
          />
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
            {isSubmitting ? "Spracovávam..." : "Rezervovať"}
          </button>
        </div>
        
        <p className="text-[9px] text-zinc-500 text-center mt-2 italic leading-tight">
          Pokračovaním v rezervácii súhlasíte so spracovaním osobných údajov pre účely rezervácie.
        </p>
      </form>
    </div>
  );
}
