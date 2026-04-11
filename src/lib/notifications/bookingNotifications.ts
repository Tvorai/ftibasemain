import { SupabaseClient } from "@supabase/supabase-js";
import { sendAppEmail } from "@/lib/email/sendAppEmail";
import { getEmailTemplateHtml } from "@/lib/email/emailService";

export type ServiceType = "personal" | "online" | "meal_plan" | "transformation";

export type TrainerContact = {
  email: string | null;
  name: string;
};

/**
 * Centrálnu helper funkcia na dočítanie kontaktu trénera.
 */
export async function resolveTrainerContact(
  supabase: SupabaseClient,
  trainerId: string
): Promise<TrainerContact> {
  try {
    // Odstránime neexistujúci full_name z query a dočítame z profiles
    const { data: trainerData, error: trainerError } = await supabase
      .from("trainers")
      .select("email, profile_id")
      .eq("id", trainerId)
      .maybeSingle();

    if (trainerError) {
      console.error(`[NOTIF] Error fetching trainer ${trainerId}:`, trainerError);
    }

    const trainerEmailFromTrainer = trainerData?.email;
    let trainerEmailFromProfile: string | null = null;
    let trainerNameFromProfile: string | null = null;

    if (trainerData?.profile_id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("email, full_name")
        .eq("id", trainerData.profile_id)
        .maybeSingle();
      
      trainerEmailFromProfile = profile?.email || null;
      trainerNameFromProfile = profile?.full_name || null;
    }

    return {
      email: trainerEmailFromTrainer || trainerEmailFromProfile || null,
      name: trainerNameFromProfile || "Váš tréner"
    };
  } catch (err) {
    console.error(`[NOTIF] Exception in resolveTrainerContact:`, err);
    return { email: null, name: "Váš tréner" };
  }
}

/**
 * Notifikácia po vytvorení rezervácie (pred platbou).
 */
export async function notifyBookingCreated(params: {
  supabase: SupabaseClient;
  trainerId: string;
  clientName: string;
  clientEmail: string;
  serviceType: ServiceType;
  startsAt: string;
  priceStr: string;
  fallbackTrainerName?: string;
  fallbackTrainerEmail?: string;
}) {
  const { supabase, trainerId, clientName, clientEmail, serviceType, startsAt, priceStr, fallbackTrainerName, fallbackTrainerEmail } = params;
  
  const trainer = await resolveTrainerContact(supabase, trainerId);
  const finalTrainerName = trainer.name || fallbackTrainerName || "Váš tréner";
  const finalTrainerEmail = trainer.email || fallbackTrainerEmail;
  
  const serviceLabel = getServiceLabel(serviceType);
  const dateFormatted = formatDate(startsAt);

  // 1. Email klientovi
  const clientHtml = getEmailTemplateHtml({
    title: `Nová požiadavka - ${serviceLabel}`,
    clientName,
    serviceName: serviceLabel,
    trainerName: finalTrainerName,
    price: priceStr,
    content: `Vaša požiadavka na <strong>${serviceLabel}</strong> na termín <strong>${dateFormatted}</strong> bola prijatá. Pre potvrdenie je potrebné dokončiť platbu.`
  });

  await sendAppEmail({
    to: clientEmail,
    subject: `Nová rezervácia - Fitbase`,
    html: clientHtml
  });

  // 2. Email trénerovi
  if (finalTrainerEmail) {
    const trainerHtml = getEmailTemplateHtml({
      title: "🔥 NOVÁ REZERVÁCIA",
      clientName: "tréner",
      serviceName: serviceLabel,
      trainerName: finalTrainerName,
      price: priceStr,
      content: `Máte novú rezerváciu od klienta <strong>${clientName}</strong> na <strong>${serviceLabel}</strong> (termín: ${dateFormatted}). Čaká sa na platbu.`
    });

    await sendAppEmail({
      to: finalTrainerEmail,
      subject: `🔥 NOVÁ REZERVÁCIA – Skontroluj Fitbase`,
      html: trainerHtml
    });
  } else {
    console.warn(`[NOTIF] Missing trainer email for booking notification (trainerId: ${trainerId})`);
  }
}

/**
 * Notifikácia po úspešnej platbe.
 */
export async function notifyPaymentConfirmed(params: {
  supabase: SupabaseClient;
  trainerId: string;
  clientName: string;
  clientEmail: string;
  serviceType: ServiceType;
  priceStr: string;
  startsAt?: string;
}) {
  const { supabase, trainerId, clientName, clientEmail, serviceType, priceStr, startsAt } = params;
  
  const trainer = await resolveTrainerContact(supabase, trainerId);
  const finalTrainerName = trainer.name;
  const finalTrainerEmail = trainer.email;
  
  const serviceLabel = getServiceLabel(serviceType);
  const dateInfo = startsAt ? ` na termín <strong>${formatDate(startsAt)}</strong>` : "";

  // 1. Email klientovi
  const clientHtml = getEmailTemplateHtml({
    title: `Potvrdenie platby - ${serviceLabel}`,
    clientName,
    serviceName: serviceLabel,
    trainerName: finalTrainerName,
    price: priceStr,
    content: `Vaša platba za <strong>${serviceLabel}</strong>${dateInfo} bola úspešne prijatá. Tešíme sa na spoluprácu!`
  });

  await sendAppEmail({
    to: clientEmail,
    subject: `Potvrdenie platby – Fitbase`,
    html: clientHtml
  });

  // 2. Email trénerovi
  if (finalTrainerEmail) {
    const trainerHtml = getEmailTemplateHtml({
      title: "💸 NOVÁ PLATBA",
      clientName: "tréner",
      serviceName: serviceLabel,
      trainerName: finalTrainerName,
      price: priceStr,
      content: `Klient <strong>${clientName}</strong> práve úspešne zaplatil za <strong>${serviceLabel}</strong>${dateInfo}.`
    });

    await sendAppEmail({
      to: finalTrainerEmail,
      subject: `💸 NOVÁ PLATBA – Skontroluj Fitbase`,
      html: trainerHtml
    });
  }
}

// Helpery
function getServiceLabel(type: ServiceType): string {
  switch (type) {
    case "personal": return "Osobný tréning";
    case "online": return "Online konzultácia";
    case "meal_plan": return "Jedálniček na mieru";
    case "transformation": return "Mesačná premena";
    default: return "Služba";
  }
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("sk-SK", {
      timeZone: "Europe/Bratislava",
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
