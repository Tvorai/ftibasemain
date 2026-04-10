import { NextResponse } from "next/server";
import { sendEmail, getEmailTemplateHtml } from "@/lib/email/emailService";

export async function GET() {
  const testEmail = "info@fitbase.sk";
  
  console.log(`[Test Email API] Iniciujem testovací email na: ${testEmail}`);
  
  const html = getEmailTemplateHtml({
    title: "Testovací email - Fitbase",
    clientName: "Testovací používateľ",
    serviceName: "Testovacia služba",
    trainerName: "Systém Fitbase",
    price: "0.00 €",
    content: "Tento email bol odoslaný automaticky ako test integrácie služby Resend. Ak ho vidíte, prepojenie funguje správne."
  });

  try {
    const result = await sendEmail({
      to: testEmail,
      subject: "Test Fitbase - Resend Integration",
      html
    });

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: `Email bol úspešne odoslaný na ${testEmail}`,
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
