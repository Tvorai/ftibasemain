import { NextResponse } from "next/server";
import { getAvailableSlots } from "@/lib/booking/getAvailableSlots";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const trainerId = searchParams.get("trainerId");
  const serviceType = (searchParams.get("serviceType") || "personal") as "personal" | "online";
  const rawMaxSlots = searchParams.get("maxSlots");
  const parsedMaxSlots = rawMaxSlots ? parseInt(rawMaxSlots) : 250;
  const maxSlots = Number.isFinite(parsedMaxSlots) ? Math.min(Math.max(parsedMaxSlots, 1), 500) : 250;

  if (!trainerId) {
    return NextResponse.json(
      { message: "Chýba trainerId.", step: "prijatie_parametra", details: "trainerId nebol nájdený v URL query." }, 
      { status: 400 }
    );
  }

  try {
    // Voláme existujúcu funkciu getAvailableSlots, ktorú sme upravili
    const slotDuration = serviceType === "online" ? 30 : 60;
    const slots = await getAvailableSlots(trainerId, 7, slotDuration, maxSlots, serviceType);
    
    if (!slots) {
      return NextResponse.json(
        { message: "Nepodarilo sa načítať sloty.", step: "vypocet_slotov", details: "getAvailableSlots vrátil null." }, 
        { status: 500 }
      );
    }

    // Vrátime priamo pole slotov (nie { ok: true, slots: ... })
    return NextResponse.json(slots);
  } catch (error: unknown) {
    console.error("API error fetching slots:", error);
    
    // Identifikácia kroku na základe správy chyby
    let step = "neznamy_krok";
    const message = error instanceof Error ? error.message : "";
    if (message.includes("SUPABASE_URL")) step = "env_check";
    if (message.includes("SUPABASE_SERVICE_ROLE_KEY")) step = "env_check";
    if (message.includes("availability_slots")) step = "query_availability";
    if (message.includes("bookings")) step = "query_bookings";

    return NextResponse.json(
      { 
        message: message || "Interná chyba servera.", 
        step: step, 
        details: error instanceof Error && error.stack ? error.stack : "Žiadne detaily nie sú k dispozícii." 
      }, 
      { status: 500 }
    );
  }
}
