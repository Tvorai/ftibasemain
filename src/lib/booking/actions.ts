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
  access_token: z.string().min(1),
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
    trainer_id, service_id, access_token, starts_at, ends_at, 
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
    const userResult = await supabase.auth.getUser(access_token);
    const authUser = userResult.data.user;
    if (!authUser) {
      console.error("createBookingAction: user not authenticated", userResult.error);
      return { status: "error", message: "Pre dokončenie rezervácie sa musíte prihlásiť." };
    }

    const profileResult = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("id", authUser.id)
      .maybeSingle();

    const profileRow = profileResult.data;
    if (!profileRow) {
      const insertProfile = await supabase
        .from("profiles")
        .insert({ id: authUser.id, full_name: client_name })
        .select("id")
        .maybeSingle();
      if (insertProfile.error) {
        console.warn("createBookingAction: profile insert failed", insertProfile.error);
      }
    } else {
      const fullName = typeof (profileRow as Record<string, unknown>).full_name === "string"
        ? ((profileRow as Record<string, unknown>).full_name as string)
        : null;
      if (!fullName || !fullName.trim()) {
        const updateProfile = await supabase
          .from("profiles")
          .update({ full_name: client_name })
          .eq("id", authUser.id);
        if (updateProfile.error) {
          console.warn("createBookingAction: profile update failed", updateProfile.error);
        }
      }
    }

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
      client_profile_id: string;
      starts_at: string;
      ends_at: string;
      client_name: string;
      client_email: string;
      client_phone: string | null | undefined;
      client_note: string | null | undefined;
      booking_status: BookingStatus;
    } = {
      trainer_id,
      client_profile_id: authUser.id,
      starts_at,
      ends_at,
      client_name,
      client_email,
      client_phone,
      client_note: note,
      booking_status: "confirmed" as BookingStatus,
    };
    if (service_id) insertPayload.service_id = service_id;

    let insertResult = await supabase.from("bookings").insert(insertPayload).select("id").maybeSingle();

    if (insertResult.error) {
      const message = insertResult.error.message || "";
      if (message.toLowerCase().includes("client_note") || message.toLowerCase().includes("column")) {
        const fallbackPayload: {
          trainer_id: string;
          service_id?: string;
          client_profile_id: string;
          starts_at: string;
          ends_at: string;
          client_name: string;
          client_email: string;
          client_phone: string | null | undefined;
          note: string | null | undefined;
          booking_status: BookingStatus;
        } = {
          trainer_id,
          client_profile_id: authUser.id,
          starts_at,
          ends_at,
          client_name,
          client_email,
          client_phone,
          note,
          booking_status: "confirmed" as BookingStatus,
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

const followUpEmailSchema = z.object({
  booking_id: z.string().uuid(),
  access_token: z.string().min(1),
});

type FollowUpEmailState =
  | { status: "success"; message: string }
  | { status: "error"; message: string };

const updateBookingStatusSchema = z.object({
  booking_id: z.string().uuid(),
  booking_status: z.enum(["pending", "confirmed", "completed", "cancelled"]),
  access_token: z.string().min(1),
});

type UpdateBookingStatusState =
  | { status: "success"; message: string }
  | { status: "error"; message: string };

export async function updateBookingStatusAction(
  input: z.infer<typeof updateBookingStatusSchema>
): Promise<UpdateBookingStatusState> {
  const parsed = updateBookingStatusSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: "Neplatné údaje." };
  }

  const { booking_id, booking_status, access_token } = parsed.data;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return { status: "error", message: "Chýba konfigurácia servera." };
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const userResult = await supabase.auth.getUser(access_token);
    const authUser = userResult.data.user;
    if (!authUser) {
      return { status: "error", message: "Neautorizované." };
    }

    const trainerRes = await supabase
      .from("trainers")
      .select("id")
      .eq("profile_id", authUser.id)
      .maybeSingle<{ id: string }>();

    if (trainerRes.error) {
      return { status: "error", message: "Nepodarilo sa overiť trénera." };
    }
    if (!trainerRes.data?.id) {
      return { status: "error", message: "Používateľ nie je tréner." };
    }

    const updateRes = await supabase
      .from("bookings")
      .update({ booking_status: booking_status as BookingStatus })
      .eq("id", booking_id)
      .eq("trainer_id", trainerRes.data.id)
      .select("id")
      .maybeSingle<{ id: string }>();

    if (updateRes.error) {
      return { status: "error", message: updateRes.error.message };
    }
    if (!updateRes.data?.id) {
      return { status: "error", message: "Rezerváciu sa nepodarilo aktualizovať." };
    }

    return { status: "success", message: "Status bol aktualizovaný." };
  } catch (error: unknown) {
    console.error("updateBookingStatusAction error:", error);
    return { status: "error", message: getErrorMessage(error) };
  }
}

export async function sendBookingFollowUpEmailAction(
  input: z.infer<typeof followUpEmailSchema>
): Promise<FollowUpEmailState> {
  const parsed = followUpEmailSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: "Neplatné údaje." };
  }

  const { booking_id, access_token } = parsed.data;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return { status: "error", message: "Chýba konfigurácia servera." };
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const userResult = await supabase.auth.getUser(access_token);
    const authUser = userResult.data.user;
    if (!authUser) {
      return { status: "error", message: "Neautorizované." };
    }

    const trainerRes = await supabase
      .from("trainers")
      .select("id")
      .eq("profile_id", authUser.id)
      .maybeSingle<{ id: string }>();

    if (trainerRes.error) {
      return { status: "error", message: "Nepodarilo sa overiť trénera." };
    }
    if (!trainerRes.data?.id) {
      return { status: "error", message: "Používateľ nie je tréner." };
    }

    const bookingRes = await supabase
      .from("bookings")
      .select("id, trainer_id, client_name, client_email, starts_at")
      .eq("id", booking_id)
      .maybeSingle<{
        id: string;
        trainer_id: string;
        client_name: string | null;
        client_email: string | null;
        starts_at: string;
      }>();

    if (bookingRes.error) {
      return { status: "error", message: "Nepodarilo sa načítať rezerváciu." };
    }
    if (!bookingRes.data) {
      return { status: "error", message: "Rezervácia neexistuje." };
    }
    if (bookingRes.data.trainer_id !== trainerRes.data.id) {
      return { status: "error", message: "Nemáte oprávnenie." };
    }

    const to = bookingRes.data.client_email;
    if (!to) {
      return { status: "success", message: "Email klienta nie je dostupný." };
    }

    const clientName = bookingRes.data.client_name && bookingRes.data.client_name.trim() ? bookingRes.data.client_name : "Ahoj";
    const dateFormatted = new Date(bookingRes.data.starts_at).toLocaleString("sk-SK", {
      timeZone: "Europe/Bratislava",
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    });

    const html = `
      <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; line-height: 1.5;">
        <p>${clientName}, ďakujeme za tréning.</p>
        <p>Termín: <strong>${dateFormatted}</strong></p>
        <p>Budeme radi za krátku spätnú väzbu. Stačí odpovedať na tento email.</p>
        <p>Fitbase</p>
      </div>
    `;

    await sendEmail({
      to,
      subject: "Ďakujeme za tréning - Fitbase",
      html,
    });

    return { status: "success", message: "Email bol odoslaný." };
  } catch (error: unknown) {
    console.error("sendBookingFollowUpEmailAction error:", error);
    return { status: "error", message: getErrorMessage(error) };
  }
}

const createTrainerReviewSchema = z.object({
  booking_id: z.string().uuid(),
  trainer_id: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().min(1).max(2000),
  photo_url: z.string().trim().min(1).max(400000).optional().nullable(),
  access_token: z.string().min(1),
});

type CreateTrainerReviewState =
  | { status: "success"; message: string }
  | { status: "error"; message: string };

export async function createTrainerReviewAction(
  input: z.infer<typeof createTrainerReviewSchema>
): Promise<CreateTrainerReviewState> {
  const parsed = createTrainerReviewSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: "Neplatné údaje." };
  }

  const { booking_id, trainer_id, rating, comment, photo_url, access_token } = parsed.data;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return { status: "error", message: "Chýba konfigurácia servera." };
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const userResult = await supabase.auth.getUser(access_token);
    const authUser = userResult.data.user;
    if (!authUser) {
      return { status: "error", message: "Neautorizované." };
    }

    const bookingRes = await supabase
      .from("bookings")
      .select("id, trainer_id, client_profile_id, booking_status")
      .eq("id", booking_id)
      .maybeSingle<{
        id: string;
        trainer_id: string;
        client_profile_id: string | null;
        booking_status: string;
      }>();

    if (bookingRes.error) {
      return { status: "error", message: "Nepodarilo sa načítať rezerváciu." };
    }
    if (!bookingRes.data) {
      return { status: "error", message: "Rezervácia neexistuje." };
    }

    if (bookingRes.data.trainer_id !== trainer_id) {
      return { status: "error", message: "Rezervácia nepatrí tomuto trénerovi." };
    }
    if (bookingRes.data.client_profile_id !== authUser.id) {
      return { status: "error", message: "Nemáte oprávnenie." };
    }
    if (bookingRes.data.booking_status !== "completed") {
      return { status: "error", message: "Recenziu je možné pridať až po dokončení tréningu." };
    }

    const profileRes = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", authUser.id)
      .maybeSingle<{ full_name: string | null }>();

    const clientName =
      (profileRes.data?.full_name && profileRes.data.full_name.trim()) ||
      authUser.email ||
      "Klient";

    const title = "Recenzia";

    let insertRes = await supabase
      .from("reviews")
      .insert({
        trainer_id,
        booking_id,
        client_profile_id: authUser.id,
        rating,
        title,
        body: comment,
        is_public: true,
        photo_url: photo_url || null,
      })
      .select("id")
      .maybeSingle<{ id: string }>();

    if (insertRes.error) {
      const msg = insertRes.error.message || "";
      if (msg.toLowerCase().includes("photo_url") || msg.toLowerCase().includes("column")) {
        insertRes = await supabase
          .from("reviews")
          .insert({
            trainer_id,
            booking_id,
            client_profile_id: authUser.id,
            rating,
            title,
            body: photo_url ? `${comment}\n\n${photo_url}` : comment,
            is_public: true,
          })
          .select("id")
          .maybeSingle<{ id: string }>();
      }
    }

    if (insertRes.error) {
      const code = insertRes.error.code;
      if (code === "23505") {
        return { status: "error", message: "Recenzia pre tento tréning už existuje." };
      }
      return { status: "error", message: insertRes.error.message };
    }

    return { status: "success", message: "Recenzia bola odoslaná." };
  } catch (error: unknown) {
    console.error("createTrainerReviewAction error:", error);
    return { status: "error", message: getErrorMessage(error) };
  }
}

const listPublicTrainerReviewsSchema = z.object({
  trainer_id: z.string().uuid(),
  limit: z.number().int().min(1).max(50).optional(),
});

type TrainerReviewItem = {
  id: string;
  client_name: string;
  rating: number;
  comment: string;
  photo_url: string | null;
  created_at: string;
};

type ListTrainerReviewsState =
  | { status: "success"; reviews: TrainerReviewItem[] }
  | { status: "error"; message: string };

export async function listPublicTrainerReviewsAction(
  input: z.infer<typeof listPublicTrainerReviewsSchema>
): Promise<ListTrainerReviewsState> {
  const parsed = listPublicTrainerReviewsSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: "Neplatné údaje." };
  }

  const { trainer_id, limit } = parsed.data;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return { status: "error", message: "Chýba konfigurácia servera." };
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const res = await supabase
    .from("reviews")
    .select("id, client_profile_id, rating, title, body, is_public, created_at, photo_url")
    .eq("trainer_id", trainer_id)
    .eq("is_public", true)
    .order("created_at", { ascending: false })
    .limit(limit ?? 20);

  if (res.error) {
    return { status: "error", message: res.error.message };
  }

  const payload: unknown = res.data;
  const rows = Array.isArray(payload) ? (payload as unknown[]) : [];
  const reviews: TrainerReviewItem[] = [];

  const clientIds: string[] = [];
  for (const item of rows) {
    if (!item || typeof item !== "object") continue;
    const anyItem = item as Record<string, unknown>;
    const clientId = anyItem.client_profile_id;
    if (typeof clientId === "string") clientIds.push(clientId);
  }

  const uniqueClientIds = Array.from(new Set(clientIds));
  const nameByClientId = new Map<string, string>();
  if (uniqueClientIds.length > 0) {
    const profRes = await supabase.from("profiles").select("id, full_name").in("id", uniqueClientIds);
    if (!profRes.error && Array.isArray(profRes.data)) {
      for (const item of profRes.data as unknown[]) {
        if (!item || typeof item !== "object") continue;
        const anyItem = item as Record<string, unknown>;
        const id = anyItem.id;
        const fullName = anyItem.full_name;
        if (typeof id === "string" && typeof fullName === "string" && fullName.trim()) {
          nameByClientId.set(id, fullName);
        }
      }
    }
  }

  for (const item of rows) {
    if (!item || typeof item !== "object") continue;
    const anyItem = item as Record<string, unknown>;
    const id = anyItem.id;
    const clientId = anyItem.client_profile_id;
    const ratingValue = anyItem.rating;
    const bodyValue = anyItem.body;
    const photoUrl = anyItem.photo_url;
    const createdAt = anyItem.created_at;
    if (typeof id !== "string") continue;
    if (typeof clientId !== "string") continue;
    if (typeof ratingValue !== "number") continue;
    if (typeof bodyValue !== "string") continue;
    if (!(typeof photoUrl === "string" || photoUrl === null || typeof photoUrl === "undefined")) continue;
    if (typeof createdAt !== "string") continue;

    const name = nameByClientId.get(clientId) || "Klient";
    reviews.push({
      id,
      client_name: name,
      rating: ratingValue,
      comment: bodyValue,
      photo_url: typeof photoUrl === "string" ? photoUrl : null,
      created_at: createdAt,
    });
  }

  return { status: "success", reviews };
}

const listTrainerReviewsForDashboardSchema = z.object({
  access_token: z.string().min(1),
  limit: z.number().int().min(1).max(100).optional(),
});

export async function listTrainerReviewsForDashboardAction(
  input: z.infer<typeof listTrainerReviewsForDashboardSchema>
): Promise<ListTrainerReviewsState> {
  const parsed = listTrainerReviewsForDashboardSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: "Neplatné údaje." };
  }

  const { access_token, limit } = parsed.data;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return { status: "error", message: "Chýba konfigurácia servera." };
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const userResult = await supabase.auth.getUser(access_token);
  const authUser = userResult.data.user;
  if (!authUser) {
    return { status: "error", message: "Neautorizované." };
  }

  const trainerRes = await supabase
    .from("trainers")
    .select("id")
    .eq("profile_id", authUser.id)
    .maybeSingle<{ id: string }>();

  if (trainerRes.error || !trainerRes.data?.id) {
    return { status: "error", message: "Používateľ nie je tréner." };
  }

  return listPublicTrainerReviewsAction({ trainer_id: trainerRes.data.id, limit: limit ?? 50 });
}
