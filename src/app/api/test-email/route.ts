import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email/emailService";

export async function GET() {
  // Tento endpoint slúži na rýchle overenie Resend integrácie po deployi
  const testEmail = "info@fitbase.sk"; 
  
  console.log(`[Test Email API] Iniciujem test cez Resend SDK na: ${testEmail}`);
  
  try {
    const result = await sendEmail({
      from: "onboarding@resend.dev",
      to: testEmail,
      subject: "Fitbase test",
      html: "<p>Test OK - Resend SDK funguje!</p>"
    });

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: `Email bol úspešne odoslaný na ${testEmail} cez Resend SDK`,
        data: result.data
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.error,
        data: result.data
      }, { status: 500 });
    }
  } catch (err: any) {
    console.error("[Test Email API] Exception:", err);
    return NextResponse.json({
      success: false,
      error: err.message || "Neočakávaná chyba v test endpoint route"
    }, { status: 500 });
  }
}
