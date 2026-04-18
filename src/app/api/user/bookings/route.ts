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

type MealPlanRow = {
  id: string;
  trainer_id: string;
  created_at: string;
  status: string;
};

type UserServiceItem =
  | {
      kind: "booking";
      id: string;
      trainerId: string;
      startsAt: string;
      endsAt: string;
      status: string;
      serviceType: string | null;
      trainerName: string;
      trainerEmail: string | null;
      trainerPhone: string | null;
    }
  | {
      kind: "meal_plan";
      id: string;
      trainerId: string;
      createdAt: string;
      status: string;
      trainerName: string;
      trainerEmail: string | null;
      trainerPhone: string | null;
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

function toMealPlanRow(value: unknown): MealPlanRow | null {
  if (!isRecord(value)) return null;
  const id = value.id;
  const trainerId = value.trainer_id;
  const createdAt = value.created_at;
  const status = value.status;
  if (typeof id !== "string" || typeof trainerId !== "string" || typeof createdAt !== "string" || typeof status !== "string") {
    return null;
  }
  return { id, trainer_id: trainerId, created_at: createdAt, status };
}

type TrainerContact = { name: string; email: string | null; phone: string | null };

function toTrainerContact(value: unknown): { trainerId: string; contact: TrainerContact } | null {
  if (!isRecord(value)) return null;
  const trainerId = value.id;
  if (typeof trainerId !== "string") return null;

  const profiles = value.profiles;
  const fullName = isRecord(profiles) && typeof profiles.full_name === "string" ? profiles.full_name : null;
  const email = isRecord(profiles) && typeof profiles.email === "string" ? profiles.email : null;
  const phone = isRecord(profiles) && typeof profiles.phone_number === "string" ? profiles.phone_number : null;

  return {
    trainerId,
    contact: { name: fullName && fullName.trim() ? fullName : "Neznámy tréner", email, phone },
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

  const bookingsPromise = supabase
    .from("bookings")
    .select("id, trainer_id, starts_at, ends_at, booking_status, service_type")
    .eq("client_profile_id", user.id)
    .order("starts_at", { ascending: false });

  console.log("[FETCH AUDIT] api/user/bookings = GET");
  console.log("[FETCH AUDIT] table = bookings");
  console.log("[FETCH AUDIT] old select = id, trainer_id, starts_at, ends_at, booking_status, service_type");
  console.log("[FETCH AUDIT] new select = id, trainer_id, starts_at, ends_at, booking_status, service_type");

  const mealPlansPromise = supabase
    .from("meal_plan_requests")
    .select("id, trainer_id, created_at, status")
    .eq("client_profile_id", user.id)
    .order("created_at", { ascending: false });

  console.log("[FETCH AUDIT] table = meal_plan_requests");
  console.log("[FETCH AUDIT] old select = id, trainer_id, created_at, status");
  console.log("[FETCH AUDIT] new select = id, trainer_id, created_at, status");

  const [bookingsRes, mealPlansRes] = await Promise.all([bookingsPromise, mealPlansPromise]);

  if (bookingsRes.error) {
    console.error("[api/user/bookings] bookings query error:", bookingsRes.error);
    return NextResponse.json({ message: bookingsRes.error.message }, { status: 500 });
  }
  if (mealPlansRes.error) {
    console.error("[api/user/bookings] meal plans query error:", mealPlansRes.error);
    return NextResponse.json({ message: mealPlansRes.error.message }, { status: 500 });
  }

  const bookingsPayload: unknown = bookingsRes.data;
  const bookingRows = Array.isArray(bookingsPayload)
    ? bookingsPayload.map(toBookingRow).filter((x): x is BookingRow => x !== null)
    : [];

  const mealPlansPayload: unknown = mealPlansRes.data;
  const mealPlanRows = Array.isArray(mealPlansPayload)
    ? mealPlansPayload.map(toMealPlanRow).filter((x): x is MealPlanRow => x !== null)
    : [];

  console.log("[api/user/bookings] bookings count:", bookingRows.length, "meal plans count:", mealPlanRows.length);

  const trainerIds = Array.from(new Set([...bookingRows, ...mealPlanRows].map((r) => r.trainer_id))).filter((id) => id);
  const contactsByTrainerId = new Map<string, TrainerContact>();

  if (trainerIds.length > 0) {
    const trainerRes = await supabase
      .from("trainers")
      .select("id, profiles(full_name,email,phone_number)")
      .in("id", trainerIds);

    console.log("[FETCH AUDIT] table = trainers (contacts lookup)");
    console.log("[FETCH AUDIT] old select = id, profiles(full_name,email,phone_number)");
    console.log("[FETCH AUDIT] new select = id, profiles(full_name,email,phone_number)");
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

  const result: UserServiceItem[] = [
    ...bookingRows.map((r) => {
      const contact = contactsByTrainerId.get(r.trainer_id);
      return {
        kind: "booking" as const,
        id: r.id,
        trainerId: r.trainer_id,
        startsAt: r.starts_at,
        endsAt: r.ends_at,
        status: r.booking_status,
        serviceType: r.service_type,
        trainerName: contact?.name || "Neznámy tréner",
        trainerEmail: contact?.email || null,
        trainerPhone: contact?.phone || null,
      };
    }),
    ...mealPlanRows.map((r) => {
      const contact = contactsByTrainerId.get(r.trainer_id);
      return {
        kind: "meal_plan" as const,
        id: r.id,
        trainerId: r.trainer_id,
        createdAt: r.created_at,
        status: r.status,
        trainerName: contact?.name || "Neznámy tréner",
        trainerEmail: contact?.email || null,
        trainerPhone: contact?.phone || null,
      };
    }),
  ];

  return NextResponse.json(result);
}

