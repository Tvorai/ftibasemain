"use server";

import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { 
  sendEmail, 
  getClientConfirmationEmailHtml, 
  getAdminNotificationEmailHtml 
} from "@/lib/email/emailService";
import { BookingStatus } from "@/lib/types";

// Schema pre validáciu booking formulára
const bookingSchema = z.object({
  trainer_id: z.string().uuid(),
  service_id: z.string().uuid().optional(),
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

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Unknown error";
}

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
    trainer_id, service_id, starts_at, ends_at, 
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
    // POZNÁMKA: "pending_payment" vynechaný, kým nebude pridaný do DB enumu
    const activeStatuses: BookingStatus[] = ["pending", "confirmed"];
    const { data: overlaps, error: checkError } = await supabase
      .from("bookings")
      .select("id")
      .eq("trainer_id", trainer_id)
      .in("booking_status", activeStatuses)
      .lt("starts_at", ends_at)
      .gt("ends_at", starts_at)
      .limit(1);

    if (checkError) throw checkError;
    if (Array.isArray(overlaps) && overlaps.length > 0) {
      return { status: "error", message: "Tento termín už nie je dostupný. Prosím, vyberte si iný." };
    }

    // 3. Vytvorenie záznamu v 'bookings' tabuľke
    const insertPayload: {
      trainer_id: string;
      service_id?: string;
      starts_at: string;
      ends_at: string;
      client_name: string;
      client_email: string;
      client_phone: string | null | undefined;
      client_note: string | null | undefined;
      booking_status: BookingStatus;
    } = {
      trainer_id,
      starts_at,
      ends_at,
      client_name,
      client_email,
      client_phone,
      client_note: note,
      booking_status: "pending" as BookingStatus,
    };
    if (service_id) insertPayload.service_id = service_id;

    let insertResult = await supabase.from("bookings").insert(insertPayload).select("id").maybeSingle();

    if (insertResult.error) {
      const message = insertResult.error.message || "";
      if (message.toLowerCase().includes("client_note") || message.toLowerCase().includes("column")) {
        const fallbackPayload: {
          trainer_id: string;
          service_id?: string;
          starts_at: string;
          ends_at: string;
          client_name: string;
          client_email: string;
          client_phone: string | null | undefined;
          note: string | null | undefined;
          booking_status: BookingStatus;
        } = {
          trainer_id,
          starts_at,
          ends_at,
          client_name,
          client_email,
          client_phone,
          note,
          booking_status: "pending" as BookingStatus,
        };
        if (service_id) fallbackPayload.service_id = service_id;
        insertResult = await supabase.from("bookings").insert(fallbackPayload).select("id").maybeSingle();
      }
    }

    if (insertResult.error) {
      // Špecifická kontrola na unikátny index (v prípade race condition, ktorú SELECT nezachytil)
      if (insertResult.error.code === "23505") {
        return { status: "error", message: "Tento termín bol práve rezervovaný niekým iným." };
      }
      console.error("Chyba pri inserte bookingu:", insertResult.error);
      return { status: "error", message: insertResult.error.message || "Nepodarilo sa vytvoriť rezerváciu." };
    }

    // 4. Odoslanie emailov (Asynchrónne, neblokujeme odpoveď)
    const dateFormatted = new Date(starts_at).toLocaleString("sk-SK", {
      timeZone: "Europe/Bratislava",
      weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit"
    });

    // Email klientovi
    sendEmail({
      to: client_email,
      subject: `Potvrdenie rezervácie - Fitbase`,
      html: getClientConfirmationEmailHtml(
        client_name,
        dateFormatted,
        trainer_name || "Tréner",
        trainer_email || null,
        undefined
      )
    }).catch((err: unknown) => console.error("Chyba pri odosielaní emailu klientovi:", getErrorMessage(err)));

    // Email adminovi (ak máme email)
    if (trainer_email) {
      sendEmail({
        to: trainer_email,
        subject: `Nová rezervácia - ${client_name}`,
        html: getAdminNotificationEmailHtml(client_name, client_email, client_phone || null, dateFormatted, note || null, undefined)
      }).catch((err: unknown) => console.error("Chyba pri odosielaní emailu adminovi:", getErrorMessage(err)));
    }

    return { status: "success", message: "Rezervácia bola úspešne vytvorená. Čoskoro vás budeme kontaktovať." };

  } catch (error: unknown) {
    console.error("Chyba pri vytváraní rezervácie:", error);
    return { status: "error", message: getErrorMessage(error) || "Nastala neočakávaná chyba pri spracovaní rezervácie." };
  }
}
