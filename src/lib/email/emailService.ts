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
 * Hlavná funkcia na odosielanie emailov cez Resend API s rozšíreným debugovaním.
 */
export async function sendEmail({ to, subject, html }: EmailParams): Promise<{ success: boolean; error?: string; details?: any }> {
  const resendApiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM || "Fitbase <info@fitbase.sk>";

  console.log("[Email Service] --- Debug Start ---");
  console.log(`[Email Service] To: ${to}`);
  console.log(`[Email Service] From: ${from}`);
  console.log(`[Email Service] Subject: ${subject}`);
  console.log(`[Email Service] HTML Length: ${html.length} chars`);
  console.log(`[Email Service] API Key exists: ${!!resendApiKey}`);

  if (!resendApiKey) {
    const errorMsg = "RESEND_API_KEY is undefined";
    console.error(`[Email Service] CRITICAL ERROR: ${errorMsg}`);
    return { success: false, error: errorMsg };
  }

  try {
    const payload = {
      from,
      to,
      subject,
      html,
    };

    console.log("[Email Service] Sending request to Resend API...");
    
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    console.log(`[Email Service] Resend HTTP Status: ${res.status} ${res.statusText}`);

    const responseData: unknown = await res.json().catch(() => null);
    
    if (!res.ok) {
      console.error("[Email Service] Resend API Error Response:", JSON.stringify(responseData, null, 2));
      const details = isRecord(responseData) && typeof responseData.message === "string" 
        ? responseData.message 
        : `HTTP ${res.status}`;
      
      return { 
        success: false, 
        error: `Resend API Error: ${details}`,
        details: responseData 
      };
    }

    console.log("[Email Service] Email sent successfully!", JSON.stringify(responseData, null, 2));
    return { success: true, details: responseData };

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[Email Service] Request failed: ${message}`);
    return { success: false, error: message };
  } finally {
    console.log("[Email Service] --- Debug End ---");
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
        .button-placeholder { display: inline-block; padding: 12px 24px; background-color: #10b981; color: white; text-decoration: none; border-radius: 9999px; font-weight: bold; margin-top: 10px; }
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