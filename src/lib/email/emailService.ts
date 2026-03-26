// emailService.ts

type EmailParams = {
  to: string;
  subject: string;
  html: string;
};

/**
 * Jednoduchá vrstva pre odosielanie emailov.
 * Aktuálne loguje do konzoly, pripravené na integráciu s Resend, SendGrid, atď.
 */
export async function sendEmail({ to, subject, html }: EmailParams) {
  console.log(`[Email Service] Odosielam email na: ${to}`);
  console.log(`[Email Service] Predmet: ${subject}`);
  // Tu by prišla integrácia napr. s Resend:
  // const { data, error } = await resend.emails.send({ from: 'Fitbase <noreply@fitbase.sk>', to, subject, html });
  
  // Pre účely testovania vracíme success
  return { success: true };
}

/**
 * Šablóna pre potvrdzovací email pre klienta.
 */
export function getClientConfirmationEmailHtml(clientName: string, dateStr: string, trainerName: string) {
  return `
    <h1>Potvrdenie rezervácie</h1>
    <p>Ahoj ${clientName},</p>
    <p>Tvoja rezervácia na termín <strong>${dateStr}</strong> u trénera <strong>${trainerName}</strong> bola úspešne prijatá.</p>
    <p>Tešíme sa na teba!</p>
    <p>Tím Fitbase</p>
  `;
}

/**
 * Šablóna pre notifikačný email pre admina (trénera).
 */
export function getAdminNotificationEmailHtml(clientName: string, clientEmail: string, clientPhone: string | null, dateStr: string, note: string | null) {
  return `
    <h1>Nová rezervácia</h1>
    <p>Máte novú rezerváciu od klienta <strong>${clientName}</strong>.</p>
    <p><strong>Termín:</strong> ${dateStr}</p>
    <p><strong>Email:</strong> ${clientEmail}</p>
    <p><strong>Telefón:</strong> ${clientPhone || 'neuvedené'}</p>
    <p><strong>Poznámka:</strong> ${note || 'žiadna'}</p>
    <p>Rezerváciu nájdete vo svojom dashboarde.</p>
  `;
}
