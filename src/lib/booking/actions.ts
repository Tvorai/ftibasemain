"use server";

import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { 
  sendEmail, 
  getClientConfirmationEmailHtml, 
  getAdminNotificationEmailHtml 
} from "@/lib/email/emailService";
import { BookingStatus, PaymentStatus } from "@/lib/types";

// Schema pre validáciu booking formulára
const bookingSchema = z.object({
  slot_id: z.string().uuid(),
  admin_id: z.string().uuid(),
  starts_at: z.string().datetime(),
  ends_at: z.string().datetime(),
  client_name: z.string().min(2, "Meno musí mať aspoň 2 znaky"),
  client_email: z.string().email("Neplatný email"),
  client_phone: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
  trainer_name: z.string().optional(), // Iba pre účely emailu
  trainer_email: z.string().email().optional(), // Iba pre účely emailu
});

export type BookingFormState = 
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

/**
 * Server Action pre vytvorenie rezervácie.
 */
export async function createBookingAction(formData: z.infer<typeof bookingSchema>): Promise<BookingFormState> {
  // 1. Validácia vstupov cez Zod
  const validatedFields = bookingSchema.safeParse(formData);
  if (!validatedFields.success) {
    return { status: "error", message: "Neplatné údaje vo formulári." };
  }

  const { 
    slot_id, admin_id, starts_at, ends_at, 
    client_name, client_email, client_phone, note,
    trainer_name, trainer_email
  } = validatedFields.data;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return { status: "error", message: "Chyba konfigurácie servera." };
  }

  // Používame service_role pre bezpečné overenie a zápis (bypass RLS pre kontrolu dostupnosti)
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    // 2. Kontrola, či slot už nie je obsadený (Race condition protection na serveri)
    // Hľadáme aktívne rezervácie (nie zrušené), ktoré sa prekrývajú s vybraným časom.
    const activeStatuses: BookingStatus[] = ["pending", "pending_payment", "confirmed"];
    const { data: existingBookings, error: checkError } = await supabase
      .from("bookings")
      .select("id")
      .eq("admin_id", admin_id)
      .in("status", activeStatuses)
      .eq("starts_at", starts_at)
      .maybeSingle();

    if (checkError) throw checkError;
    if (existingBookings) {
      return { status: "error", message: "Tento termín už nie je dostupný. Prosím, vyberte si iný." };
    }

    // 3. Vytvorenie záznamu v 'bookings' tabuľke
    const { data: newBooking, error: insertError } = await supabase
      .from("bookings")
      .insert({
        slot_id,
        admin_id,
        starts_at,
        ends_at,
        client_name,
        client_email,
        client_phone,
        note,
        status: "pending" as BookingStatus, // Predvolený status
        payment_status: "unpaid" as PaymentStatus,
      })
      .select()
      .single();

    if (insertError) {
      // Špecifická kontrola na unikátny index (v prípade race condition, ktorú SELECT nezachytil)
      if (insertError.code === "23505") {
        return { status: "error", message: "Tento termín bol práve rezervovaný niekým iným." };
      }
      throw insertError;
    }

    // 4. Odoslanie emailov (Asynchrónne, neblokujeme odpoveď)
    const dateFormatted = new Date(starts_at).toLocaleString("sk-SK", {
      weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit"
    });

    // Email klientovi
    sendEmail({
      to: client_email,
      subject: `Potvrdenie rezervácie - Fitbase`,
      html: getClientConfirmationEmailHtml(client_name, dateFormatted, trainer_name || "Tréner")
    }).catch(err => console.error("Chyba pri odosielaní emailu klientovi:", err));

    // Email adminovi (ak máme email)
    if (trainer_email) {
      sendEmail({
        to: trainer_email,
        subject: `Nová rezervácia - ${client_name}`,
        html: getAdminNotificationEmailHtml(client_name, client_email, client_phone || null, dateFormatted, note || null)
      }).catch(err => console.error("Chyba pri odosielaní emailu adminovi:", err));
    }

    return { status: "success", message: "Rezervácia bola úspešne vytvorená. Čoskoro vás budeme kontaktovať." };

  } catch (error: any) {
    console.error("Chyba pri vytváraní rezervácie:", error);
    return { status: "error", message: "Nastala neočakávaná chyba pri spracovaní rezervácie." };
  }
}
