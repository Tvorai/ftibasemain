"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { AvailableSlot } from "@/lib/booking/getAvailableSlots";
import { createBookingAction, BookingFormState } from "@/lib/booking/actions";

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
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function BookingForm({
  selectedSlot,
  trainerName,
  trainerEmail,
  onSuccess,
  onCancel,
}: BookingFormProps) {
  const [formState, setFormState] = useState<BookingFormState>({ status: "idle" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<BookingFormValues>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: {
      client_name: "",
      client_email: "",
      client_phone: "",
      note: "",
    },
  });

  const onSubmit = async (values: BookingFormValues) => {
    setIsSubmitting(true);
    setFormState({ status: "idle" });

    try {
      const result = await createBookingAction({
        slot_id: selectedSlot.source_availability_slot_id,
        admin_id: selectedSlot.trainer_id,
        starts_at: selectedSlot.starts_at,
        ends_at: selectedSlot.ends_at,
        client_name: values.client_name,
        client_email: values.client_email,
        client_phone: values.client_phone || null,
        note: values.note || null,
        trainer_name: trainerName,
        trainer_email: trainerEmail,
      });

      setFormState(result);
      if (result.status === "success" && onSuccess) {
        // Po úspechu môžeme zavrieť formulár alebo zobraziť success stav
        // Ak chceme zobraziť success správu, necháme ju tam a voláme onSuccess s oneskorením
        setTimeout(() => onSuccess(), 3000);
      }
    } catch (err) {
      setFormState({ status: "error", message: "Nastala neočakávaná chyba pri komunikácii so serverom." });
    } finally {
      setIsSubmitting(false);
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
