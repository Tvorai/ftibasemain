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
  const finalFrom = from || process.env.RESEND_FROM || "onboarding@resend.dev";

  console.log("[Email Service] --- Resend SDK Call ---");
  console.log(`[Email Service] API Key present: ${!!resendApiKey}`);
  console.log(`[Email Service] Sending: From=${finalFrom}, To=${to}, Subject=${subject}`);

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
        body { font-family: sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
        .container { max-width: 600px; margin: 20px auto; padding: 20px; border: 1px solid #eee; border-radius: 10px; background-color: #ffffff; }
        .header { border-bottom: 2px solid #10b981; padding-bottom: 10px; margin-bottom: 20px; text-align: center; }
        .header h1 { color: #10b981; margin: 0; font-size: 28px; font-weight: bold; }
        .details { background: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #e5e7eb; }
        .details p { margin: 8px 0; color: #374151; }
        .footer { margin-top: 30px; font-size: 12px; color: #6b7280; text-align: center; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Fitbase</h1>
        </div>
        <h2 style="color: #111827; margin-top: 0;">${title}</h2>
        <p>Ahoj ${clientName},</p>
        <p>${content}</p>
        
        <div class="details">
          <p><strong>Služba:</strong> ${serviceName}</p>
          <p><strong>Tréner:</strong> ${trainerName}</p>
          <p><strong>Cena:</strong> ${price}</p>
        </div>

        <p>V prípade otázok nás neváhajte kontaktovať odpoveďou na tento email.</p>
        
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} Fitbase. Všetky práva vyhradené.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}
