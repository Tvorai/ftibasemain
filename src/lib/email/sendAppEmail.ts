import { sendEmail } from "./emailService";

export type AppEmailOptions = {
  to: string;
  subject: string;
  html: string;
};

/**
 * Centrálnu pomocná funkcia na odosielanie emailov v rámci aplikácie.
 * Zabezpečuje jednotný logovací formát a error handling.
 */
export async function sendAppEmail({ to, subject, html }: AppEmailOptions) {
  const sender = "Fitbase <noreply@fitbase.sk>";
  
  console.log(`[APP EMAIL] Sending to: ${to}`);
  console.log(`[APP EMAIL] Subject: ${subject}`);

  try {
    const result = await sendEmail({
      to,
      subject,
      html,
      from: sender
    });

    if (result.success) {
      console.log(`[APP EMAIL] SUCCESS: Email sent to ${to}`);
    } else {
      console.error(`[APP EMAIL] FAILED: ${result.error}`, result.data);
    }

    return result;
  } catch (error: unknown) {
    console.error(`[APP EMAIL] EXCEPTION:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error during sendAppEmail"
    };
  }
}
