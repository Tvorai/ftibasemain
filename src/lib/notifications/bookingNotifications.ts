import { SupabaseClient } from "@supabase/supabase-js";
import { sendAppEmail } from "@/lib/email/sendAppEmail";
import { getEmailTemplateHtml } from "@/lib/email/emailService";

export type ServiceType = "personal" | "online" | "meal_plan" | "transformation";

export type TrainerContact = {
  email: string | null;
  name: string | null; // Zmeníme na nullable aby sme vedeli kedy fallbackovať
  phone: string | null;
  profileId?: string | null;
};

/**
 * Helper funkcia na získanie dát trénera priamo z tabuľky trainers.
 */
async function getTrainerData(supabase: SupabaseClient, trainer_id: string) {
  const { data: trainerData } = await supabase
    .from("trainers")
    .select("email, full_name, profile_id")
    .eq("id", trainer_id)
    .maybeSingle();

  if (!trainerData) {
    console.warn(`[TRAINER DATA] trainer not found: ${trainer_id}`);
    return null;
  }

  console.log(`[TRAINER DATA] trainer_id: ${trainer_id}`);
  console.log(`[TRAINER DATA] resolved trainer email: ${trainerData.email}`);
  console.log(`[TRAINER DATA] resolved trainer full_name: ${trainerData.full_name}`);

  return {
    email: trainerData.email,
    full_name: trainerData.full_name || "Váš tréner",
    profile_id: trainerData.profile_id
  };
}

/**
 * Centrálnu helper funkcia na dočítanie kontaktu trénera.
 */
export async function resolveTrainerContact(
  supabase: SupabaseClient,
  trainerId: string
): Promise<TrainerContact> {
  try {
    const trainer = await getTrainerData(supabase, trainerId);

    if (!trainer) {
      return { email: null, name: null, phone: null, profileId: null };
    }

    // Telefón doťahujeme z profilu ak je potrebný (zatiaľ ostáva ako voliteľný lookup ak je v trainerData null)
    // Ak by bol phone tiež v trainers, môžeme to ešte viac zjednodušiť.
    let phone = null;
    if (trainer.profile_id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("phone_number")
        .eq("id", trainer.profile_id)
        .maybeSingle();
      phone = profile?.phone_number || null;
    }

    return {
      email: trainer.email,
      name: trainer.full_name,
      phone: phone,
      profileId: trainer.profile_id
    };
  } catch (err) {
    console.error(`[NOTIF] Exception in resolveTrainerContact:`, err);
    return { email: null, name: null, phone: null, profileId: null };
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
  clientPhone?: string;
  serviceType: ServiceType;
  startsAt: string;
  priceStr: string;
  fallbackTrainerName?: string;
  fallbackTrainerEmail?: string;
}) {
  const { supabase, trainerId, clientName, clientEmail, clientPhone, serviceType, startsAt, priceStr, fallbackTrainerName, fallbackTrainerEmail } = params;
  
  const trainer = await resolveTrainerContact(supabase, trainerId);
  const finalTrainerName = trainer.name || fallbackTrainerName || "Váš tréner";
  const finalTrainerEmail = trainer.email || fallbackTrainerEmail;
  
  console.log(`[TRAINER DATA] resolved trainer email: ${finalTrainerEmail}`);
  console.log(`[TRAINER DATA] resolved trainer full_name: ${finalTrainerName}`);

  const serviceLabel = getServiceLabel(serviceType);
  const dateFormatted = formatDate(startsAt);

  // 1. Email klientovi
  const clientContactHtml = `
    <h3>Tréner:</h3>
    <p><strong>Meno:</strong> ${finalTrainerName}</p>
    <p><strong>Email:</strong> ${finalTrainerEmail || "neuvedený"}</p>
    ${trainer.phone ? `<p><strong>Telefón:</strong> ${trainer.phone}</p>` : ""}
  `;

  const clientTemplatePayload = {
    title: `✅ Potvrdenie rezervácie – Fitbase`,
    clientName,
    serviceName: serviceLabel,
    trainerName: finalTrainerName,
    price: priceStr,
    content: `Vaša požiadavka na <strong>${serviceLabel}</strong> na termín <strong>${dateFormatted}</strong> bola prijatá. Pre potvrdenie je potrebné dokončiť platbu.`,
    ctaButtonText: "👉 Zobraziť moje tréningy",
    ctaButtonUrl: "https://fitbase.sk/ucet?tab=treningy",
    contactSectionHtml: clientContactHtml
  };
  console.log(`[EMAIL DEBUG] client template payload =`, JSON.stringify(clientTemplatePayload, null, 2));

  const clientHtml = getEmailTemplateHtml(clientTemplatePayload);

  await sendAppEmail({
    to: clientEmail,
    subject: `✅ Potvrdenie rezervácie – Fitbase`,
    html: clientHtml
  });

  // 2. Email trénerovi
  if (finalTrainerEmail) {
    const trainerContactHtml = `
      <h3>Klient:</h3>
      <p><strong>Meno:</strong> ${clientName}</p>
      <p><strong>Email:</strong> ${clientEmail}</p>
      ${clientPhone ? `<p><strong>Telefón:</strong> ${clientPhone}</p>` : ""}
    `;

    const trainerHtml = getEmailTemplateHtml({
      title: "🔥 NOVÁ REZERVÁCIA",
      clientName: "tréner",
      serviceName: serviceLabel,
      trainerName: finalTrainerName,
      price: priceStr,
      content: `Máte novú rezerváciu od klienta <strong>${clientName}</strong> na <strong>${serviceLabel}</strong> (termín: ${dateFormatted}). Čaká sa na platbu.`,
      ctaButtonText: "👉 Zobraziť rezervácie",
      ctaButtonUrl: "https://fitbase.sk/ucet-trenera?tab=rezervacie",
      contactSectionHtml: trainerContactHtml
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
  clientPhone?: string;
  serviceType: ServiceType;
  priceStr: string;
  startsAt?: string;
  fallbackTrainerName?: string;
}) {
  const { supabase, trainerId, clientName, clientEmail, clientPhone, serviceType, priceStr, startsAt, fallbackTrainerName } = params;
  
  const trainer = await resolveTrainerContact(supabase, trainerId);
  const finalTrainerName = trainer.name || fallbackTrainerName || "Váš tréner";
  const finalTrainerEmail = trainer.email;
  
  console.log(`[TRAINER DATA] resolved trainer email: ${finalTrainerEmail}`);
  console.log(`[TRAINER DATA] resolved trainer full_name: ${finalTrainerName}`);

  const serviceLabel = getServiceLabel(serviceType);
  const dateInfo = startsAt ? ` na termín <strong>${formatDate(startsAt)}</strong>` : "";

  // 1. Email klientovi
  const clientContactHtml = `
    <h3>Tréner:</h3>
    <p><strong>Meno:</strong> ${finalTrainerName}</p>
    <p><strong>Email:</strong> ${finalTrainerEmail || "neuvedený"}</p>
    ${trainer.phone ? `<p><strong>Telefón:</strong> ${trainer.phone}</p>` : ""}
  `;

  const clientTemplatePayload = {
    title: `✅ Potvrdenie platby – Fitbase`,
    clientName,
    serviceName: serviceLabel,
    trainerName: finalTrainerName,
    price: priceStr,
    content: `Vaša platba za <strong>${serviceLabel}</strong>${dateInfo} bola úspešne prijatá. Tešíme sa na spoluprácu!`,
    ctaButtonText: "👉 Zobraziť moje tréningy",
    ctaButtonUrl: "https://fitbase.sk/ucet?tab=treningy",
    contactSectionHtml: clientContactHtml
  };
  console.log(`[EMAIL DEBUG] client template payload =`, JSON.stringify(clientTemplatePayload, null, 2));

  const clientHtml = getEmailTemplateHtml(clientTemplatePayload);

  await sendAppEmail({
    to: clientEmail,
    subject: `✅ Potvrdenie platby – Fitbase`,
    html: clientHtml
  });

  // 2. Email trénerovi
  if (finalTrainerEmail) {
    const trainerContactHtml = `
      <h3>Klient:</h3>
      <p><strong>Meno:</strong> ${clientName}</p>
      <p><strong>Email:</strong> ${clientEmail}</p>
      ${clientPhone ? `<p><strong>Telefón:</strong> ${clientPhone}</p>` : ""}
    `;

    const trainerHtml = getEmailTemplateHtml({
      title: "💸 NOVÁ PLATBA",
      clientName: "tréner",
      serviceName: serviceLabel,
      trainerName: finalTrainerName,
      price: priceStr,
      content: `Klient <strong>${clientName}</strong> práve úspešne zaplatil za <strong>${serviceLabel}</strong>${dateInfo}.`,
      ctaButtonText: "👉 Zobraziť rezervácie",
      ctaButtonUrl: "https://fitbase.sk/ucet-trenera?tab=rezervacie",
      contactSectionHtml: trainerContactHtml
    });

    await sendAppEmail({
      to: finalTrainerEmail,
      subject: `💸 NOVÁ PLATBA – Skontroluj Fitbase`,
      html: trainerHtml
    });
  }
}

/**
 * Notifikácia po dokončení tréningu / konzultácie.
 */
export async function notifyBookingCompleted(params: {
  supabase: SupabaseClient;
  trainerId: string;
  bookingId: string;
  clientName: string;
  clientEmail: string;
  serviceType: ServiceType;
  priceCents?: number | null;
  fallbackTrainerName?: string;
}) {
  const { supabase, trainerId, bookingId, clientName, clientEmail, serviceType, priceCents, fallbackTrainerName } = params;
  
  const trainer = await resolveTrainerContact(supabase, trainerId);
  const finalTrainerName = trainer.name || fallbackTrainerName || "Váš tréner";
  
  console.log(`[TRAINER DATA] resolved trainer full_name: ${finalTrainerName}`);

  const serviceLabel = getServiceLabel(serviceType);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://fitbase.sk";

  // Cena
  const priceStr = priceCents ? `${(priceCents / 100).toFixed(2)} €` : "-";

  // Linky pre CTA - upravené podľa požiadavky
  const reviewUrl = `${siteUrl}/ucet?tab=sluzby&reviewBookingId=${bookingId}`;
  
  // Získame slug trénera pre re-booking link
  const { data: trainerData } = await supabase
    .from("trainers")
    .select("slug")
    .eq("id", trainerId)
    .maybeSingle();
  
  const trainerSlug = trainerData?.slug;
  const bookingUrl = trainerSlug 
    ? `${siteUrl}/${trainerSlug}?openBooking=1`
    : `${siteUrl}/t/${trainerId}?openBooking=1`;

  const ctaText1 = serviceType === "online" ? "Rezervovať ďalšiu konzultáciu" : "Rezervovať ďalší tréning";

  const clientTemplatePayload = {
    title: `✅ Tréning bol dokončený – čo ďalej?`,
    clientName,
    serviceName: serviceLabel,
    trainerName: finalTrainerName,
    price: priceStr,
    content: `Váš <strong>${serviceLabel}</strong> s trénerom <strong>${finalTrainerName}</strong> bol úspešne dokončený. Ak chcete pokračovať, môžete si rovno rezervovať ďalší termín alebo zanechať recenziu.`,
    ctaButtonText: ctaText1,
    ctaButtonUrl: bookingUrl,
    contactSectionHtml: `
      <div style="margin-top: 20px; text-align: center;">
        <a href="${reviewUrl}" style="background-color: #10b981; color: #ffffff !important; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">👉 Napísať recenziu</a>
      </div>
    `
  };
  console.log(`[EMAIL DEBUG] client template payload =`, JSON.stringify(clientTemplatePayload, null, 2));

  const clientHtml = getEmailTemplateHtml(clientTemplatePayload);

  console.log(`[EMAIL FLOW] sending to client: ${clientEmail}`);
  const result = await sendAppEmail({
    to: clientEmail,
    subject: `✅ Tréning bol dokončený – čo ďalej?`,
    html: clientHtml
  });
  console.log(`[EMAIL FLOW] result ${result.success ? 'SUCCESS' : 'FAILED'}`);
}

/**
 * Notifikácia po zrušení rezervácie trénerom.
 */
export async function notifyBookingCancelled(params: {
  supabase: SupabaseClient;
  trainerId: string;
  clientName: string;
  clientEmail: string;
  serviceType: ServiceType;
  cancelledReason: string | null;
  priceCents?: number | null;
  fallbackTrainerName?: string;
}) {
  const { supabase, trainerId, clientName, clientEmail, serviceType, cancelledReason, priceCents, fallbackTrainerName } = params;
  
  const trainer = await resolveTrainerContact(supabase, trainerId);
  const finalTrainerName = trainer.name || fallbackTrainerName || "Váš tréner";
  
  console.log(`[TRAINER DATA] resolved trainer full_name: ${finalTrainerName}`);

  const serviceLabel = getServiceLabel(serviceType);

  const reasonText = cancelledReason || "Tréner neuviedol dôvod zrušenia.";
  const priceStr = priceCents ? `${(priceCents / 100).toFixed(2)} €` : "-";

  const clientContactHtml = `
    <h3>Kontakt na trénera:</h3>
    <p><strong>Meno:</strong> ${finalTrainerName}</p>
    <p><strong>Email:</strong> ${trainer.email || "neuvedený"}</p>
    ${trainer.phone ? `<p><strong>Telefón:</strong> ${trainer.phone}</p>` : ""}
    <p style="margin-top: 15px; font-size: 13px; color: #6b7280; font-style: italic;">
      Pre zmenu termínu kontaktujte trénera, ak by ste sa s trénerom nedohodli a chceli by ste vrátiť peniaze kontaktujte našu podporu na: info@fitbase.sk
    </p>
  `;

  const clientTemplatePayload = {
    title: `❌ Rezervácia bola zrušená`,
    clientName,
    serviceName: serviceLabel,
    trainerName: finalTrainerName,
    price: priceStr,
    content: `Vaša rezervácia na <strong>${serviceLabel}</strong> bola zrušená trénerom <strong>${finalTrainerName}</strong>.<br><br><strong>Dôvod zrušenia:</strong><br>${reasonText}`,
    contactSectionHtml: clientContactHtml
  };
  console.log(`[EMAIL DEBUG] client template payload =`, JSON.stringify(clientTemplatePayload, null, 2));

  const clientHtml = getEmailTemplateHtml(clientTemplatePayload);

  console.log(`[CANCEL FLOW] email sent to: ${clientEmail}`);
  await sendAppEmail({
    to: clientEmail,
    subject: `❌ Rezervácia bola zrušená – Fitbase`,
    html: clientHtml
  });
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
