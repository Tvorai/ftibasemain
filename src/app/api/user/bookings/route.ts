import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type BookingRow = {
  id: string;
  trainer_id: string;
  starts_at: string;
  ends_at: string;
  booking_status: string;
  service_type: string | null;
};

type ClientBookingItem = {
  id: string;
  trainerId: string;
  startsAt: string;
  endsAt: string;
  status: string;
  serviceType: string | null;
  trainerName: string;
  trainerEmail: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toBookingRow(value: unknown): BookingRow | null {
  if (!isRecord(value)) return null;
  const id = value.id;
  const trainerId = value.trainer_id;
  const startsAt = value.starts_at;
  const endsAt = value.ends_at;
  const status = value.booking_status;
  const serviceType = value.service_type;
  if (
    typeof id !== "string" ||
    typeof trainerId !== "string" ||
    typeof startsAt !== "string" ||
    typeof endsAt !== "string" ||
    typeof status !== "string" ||
    !(typeof serviceType === "string" || serviceType === null)
  ) {
    return null;
  }
  return { id, trainer_id: trainerId, starts_at: startsAt, ends_at: endsAt, booking_status: status, service_type: serviceType };
}

type TrainerContact = { name: string; email: string | null };

function toTrainerContact(value: unknown): { trainerId: string; contact: TrainerContact } | null {
  if (!isRecord(value)) return null;
  const trainerId = value.id;
  if (typeof trainerId !== "string") return null;

  const profiles = value.profiles;
  const fullName = isRecord(profiles) && typeof profiles.full_name === "string" ? profiles.full_name : null;
  const email = isRecord(profiles) && typeof profiles.email === "string" ? profiles.email : null;

  return {
    trainerId,
    contact: { name: fullName && fullName.trim() ? fullName : "Neznámy tréner", email },
  };
}

function getBearerToken(request: Request): string | null {
  const auth = request.headers.get("authorization");
  if (!auth) return null;
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || null;
}

export async function GET(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("[api/user/bookings] Missing env vars", {
      hasUrl: Boolean(supabaseUrl),
      hasServiceRole: Boolean(serviceRoleKey),
    });
    return NextResponse.json({ message: "Server config missing." }, { status: 500 });
  }

  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const userResult = await supabase.auth.getUser(token);
  const user = userResult.data.user;

  console.log("[api/user/bookings] auth user id:", user?.id || null);

  if (!user) {
    console.error("[api/user/bookings] auth failed:", userResult.error?.message || "no user");
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const bookingsRes = await supabase
    .from("bookings")
    .select("id, trainer_id, starts_at, ends_at, booking_status, service_type")
    .eq("client_profile_id", user.id)
    .order("starts_at", { ascending: false });

  if (bookingsRes.error) {
    console.error("[api/user/bookings] bookings query error:", bookingsRes.error);
    return NextResponse.json({ message: bookingsRes.error.message }, { status: 500 });
  }

  const bookingsPayload: unknown = bookingsRes.data;
  const rows = Array.isArray(bookingsPayload) ? bookingsPayload.map(toBookingRow).filter((x): x is BookingRow => x !== null) : [];

  console.log("[api/user/bookings] bookings count:", rows.length);

  const trainerIds = Array.from(new Set(rows.map((r) => r.trainer_id))).filter((id) => id);
  const contactsByTrainerId = new Map<string, TrainerContact>();

  if (trainerIds.length > 0) {
    const trainerRes = await supabase.from("trainers").select("id, profiles(full_name,email)").in("id", trainerIds);
    if (trainerRes.error) {
      console.error("[api/user/bookings] trainers query error:", trainerRes.error);
    } else {
      const trainerPayload: unknown = trainerRes.data;
      if (Array.isArray(trainerPayload)) {
        for (const item of trainerPayload) {
          const parsed = toTrainerContact(item);
          if (parsed) contactsByTrainerId.set(parsed.trainerId, parsed.contact);
        }
      }
    }
  }

  const result: ClientBookingItem[] = rows.map((r) => {
    const contact = contactsByTrainerId.get(r.trainer_id);
    return {
      id: r.id,
      trainerId: r.trainer_id,
      startsAt: r.starts_at,
      endsAt: r.ends_at,
      status: r.booking_status,
      serviceType: r.service_type,
      trainerName: contact?.name || "Neznámy tréner",
      trainerEmail: contact?.email || null,
    };
  });

  return NextResponse.json(result);
}

