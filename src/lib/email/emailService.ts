import { Resend } from "resend";

type EmailParams = {
  to: string;
  subject: string;
  html: string;
  from?: string;
};

/**
 * Hlavná funkcia na odosielanie emailov cez oficiálne Resend SDK.
 * Custom fetch wrapper bol odstránený.
 */
export async function sendEmail({ to, subject, html, from }: EmailParams): Promise<{ success: boolean; error?: string; data?: any }> {
  const resendApiKey = process.env.RESEND_API_KEY;
  const finalFrom = from || process.env.RESEND_FROM || "Fitbase <noreply@fitbase.sk>";

  console.log("[Email Service] --- Resend SDK Call ---");
  console.log(`[Email Service] From: ${finalFrom}`);
  console.log(`[Email Service] To: ${to}`);
  console.log(`[Email Service] Subject: ${subject}`);
  console.log(`[Email Service] API Key present: ${!!resendApiKey}`);

  if (!resendApiKey) {
    const errorMsg = "RESEND_API_KEY is not defined in environment variables.";
    console.error(`[Email Service] ${errorMsg}`);
    return { success: false, error: errorMsg };
  }

  const resend = new Resend(resendApiKey);

  try {
    const { data, error } = await resend.emails.send({
      from: finalFrom,
      to,
      subject,
      html,
    });

    if (error) {
      console.error("[Email Service] SDK returned error:", JSON.stringify(error, null, 2));
      return { 
        success: false, 
        error: error.message,
        data: error 
      };
    }

    console.log("[Email Service] Success:", JSON.stringify(data, null, 2));
    return { success: true, data };

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown SDK error";
    console.error(`[Email Service] SDK Exception: ${message}`);
    return { success: false, error: message };
  } finally {
    console.log("[Email Service] --- End of SDK Call ---");
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
  content,
  ctaButtonText,
  ctaButtonUrl,
  contactSectionHtml
}: {
  title: string;
  clientName: string;
  serviceName: string;
  trainerName: string;
  price: string;
  content: string;
  ctaButtonText?: string;
  ctaButtonUrl?: string;
  contactSectionHtml?: string;
}) {
  const currentYear = new Date().getFullYear();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://fitbase.sk";
  const logoUrl = `${siteUrl}/fitbase-logo.png`;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
        .container { max-width: 600px; margin: 20px auto; padding: 20px; border: 1px solid #eee; border-radius: 10px; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); }
        .header { border-bottom: 2px solid #10b981; padding-bottom: 20px; margin-bottom: 20px; text-align: center; }
        .header img { max-width: 120px; height: auto; margin-bottom: 10px; }
        .header h1 { color: #10b981; margin: 0; font-size: 24px; font-weight: bold; }
        .details { background: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #e5e7eb; }
        .details p { margin: 8px 0; color: #374151; }
        .price-text { font-size: 1.2em; font-weight: bold; color: #10b981; }
        .cta-container { text-align: center; margin: 30px 0; }
        .cta-button { background-color: #16a34a; color: #ffffff !important; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; }
        .contact-box { background: #f0fdf4; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #dcfce7; }
        .contact-box h3 { margin-top: 0; color: #166534; font-size: 16px; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #6b7280; text-align: center; }
        .footer a { color: #10b981; text-decoration: none; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <img src="${logoUrl}" alt="Fitbase Logo">
          <h1>Fitbase</h1>
        </div>
        
        <h2 style="color: #111827; margin-top: 0;">${title}</h2>
        <p>Ahoj <strong>${clientName}</strong>,</p>
        <p>${content}</p>
        
        <div class="details">
          <p><strong>Služba:</strong> ${serviceName}</p>
          <p><strong>Tréner:</strong> ${trainerName}</p>
          <p><strong>Cena:</strong> <span class="price-text">${price}</span></p>
        </div>

        ${contactSectionHtml ? `<div class="contact-box">${contactSectionHtml}</div>` : ""}

        ${ctaButtonText && ctaButtonUrl ? `
          <div class="cta-container">
            <a href="${ctaButtonUrl}" class="cta-button">${ctaButtonText}</a>
          </div>
        ` : ""}

        <div class="footer">
          <p>Toto je automaticky generovaný email, prosím neodpovedajte naň.</p>
          <p>V prípade otázok nás kontaktujte: 👉 <a href="mailto:info@fitbase.sk">info@fitbase.sk</a></p>
          <p style="margin-top: 20px;">&copy; ${currentYear} Fitbase. Všetky práva vyhradené.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}
