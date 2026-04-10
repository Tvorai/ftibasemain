// src/lib/email/emailService.ts

type EmailParams = {
  to: string;
  subject: string;
  html: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Hlavná funkcia na odosielanie emailov cez Resend API.
 * Používa fetch pre maximálnu kompatibilitu a minimálnu veľkosť bundle-u.
 */
export async function sendEmail({ to, subject, html }: EmailParams): Promise<{ success: boolean }> {
  const resendApiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM || "Fitbase <onboarding@resend.dev>";

  if (!resendApiKey) {
    console.warn("[Email Service] RESEND_API_KEY chýba, email preskakujem.");
    return { success: false };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to,
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const payload: unknown = await res.json().catch(() => null);
      const details = isRecord(payload) && typeof payload.message === "string" ? payload.message : `HTTP ${res.status}`;
      console.warn(`[Email Service] Resend zlyhal: ${details}`);
      return { success: false };
    }

    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.warn(`[Email Service] Resend request zlyhal: ${message}`);
    return { success: false };
  }
}

/**
 * HTML šablóna pre emaily.
 */
export function getEmailTemplateHtml({
  title,
  clientName,
  serviceName,
  trainerName,
  price,
  content
}: {
  title: string;
  clientName: string;
  serviceName: string;
  trainerName: string;
  price: string;
  content: string;
}) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px; }
        .header { border-bottom: 2px solid #10b981; padding-bottom: 10px; margin-bottom: 20px; }
        .header h1 { color: #10b981; margin: 0; font-size: 24px; }
        .details { background: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0; }
        .details p { margin: 5px 0; }
        .footer { margin-top: 30px; font-size: 12px; color: #666; text-align: center; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Fitbase</h1>
        </div>
        <h2>${title}</h2>
        <p>Ahoj ${clientName},</p>
        <p>${content}</p>
        
        <div class="details">
          <p><strong>Služba:</strong> ${serviceName}</p>
          <p><strong>Tréner:</strong> ${trainerName}</p>
          <p><strong>Cena:</strong> ${price}</p>
        </div>

        <p>V prípade otázok nás neváhajte kontaktovať.</p>
        
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} Fitbase. Všetky práva vyhradené.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}