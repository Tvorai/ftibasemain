import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email/emailService";

export async function GET() {
  const testEmail = "tvojemail@gmail.com"; // Používateľ si tu doplní svoj email
  
  console.log(`[Test Email API] Iniciujem testovací email cez Resend SDK na: ${testEmail}`);
  
  try {
    // Presne podľa požiadavky používateľa
    const result = await sendEmail({
      from: "onboarding@resend.dev",
      to: testEmail,
      subject: "TEST",
      html: "<h1>Test OK</h1>"
    });

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: `Email bol úspešne odoslaný na ${testEmail} (cez onboarding@resend.dev)`,
        details: result.details
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.error,
        details: result.details
      }, { status: 500 });
    }
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err.message || "Neočakávaná chyba pri teste"
    }, { status: 500 });
  }
}
