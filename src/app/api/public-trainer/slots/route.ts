import { NextResponse } from "next/server";
import { getAvailableSlots } from "@/lib/booking/getAvailableSlots";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const trainerId = searchParams.get("trainerId");

  if (!trainerId) {
    return NextResponse.json({ ok: false, message: "Chýba trainerId." }, { status: 400 });
  }

  try {
    const slots = await getAvailableSlots(trainerId);
    if (!slots) {
      return NextResponse.json({ ok: false, message: "Nepodarilo sa načítať sloty." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, slots });
  } catch (error: any) {
    console.error("API error fetching slots:", error);
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }
}
