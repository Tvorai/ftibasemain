
import { createClient } from "@supabase/supabase-js";
// Force Vercel redeploy again
// Force Vercel redeploy again
// Force Vercel redeploy again
import { BookingStatus, Slot } from "@/lib/types";

/**
 * Nový typ pre konkrétny vypočítaný voľný termín.
 */
export type AvailableSlot = {
  trainer_id: string;
  starts_at: string; // Plný ISO string začiatku termínu
  ends_at: string;   // Plný ISO string konca termínu
  source_availability_slot_id: string; // ID pôvodného pravidla dostupnosti
};

// --- Pomocné funkcie ---

/**
 * Pomocná funkcia pre kontrolu prekrývania časových rozsahov.
 */
function doRangesOverlap(startA: Date, endA: Date, startB: Date, endB: Date): boolean {
  return startA < endB && startB < endA;
}

type DateParts = { year: number; month: number; day: number };

function getDatePartsInTimeZone(date: Date, timeZone: string): DateParts {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);

  const yearStr = parts.find((p) => p.type === "year")?.value;
  const monthStr = parts.find((p) => p.type === "month")?.value;
  const dayStr = parts.find((p) => p.type === "day")?.value;

  if (!yearStr || !monthStr || !dayStr) {
    throw new Error("Failed to resolve date parts for timezone");
  }

  return { year: Number(yearStr), month: Number(monthStr), day: Number(dayStr) };
}

function addDaysToDateParts(base: DateParts, offsetDays: number): DateParts {
  const dt = new Date(Date.UTC(base.year, base.month - 1, base.day + offsetDays, 12, 0, 0));
  return {
    year: dt.getUTCFullYear(),
    month: dt.getUTCMonth() + 1,
    day: dt.getUTCDate(),
  };
}

function getTimeZoneOffsetMinutes(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(date);
  const yearStr = parts.find((p) => p.type === "year")?.value;
  const monthStr = parts.find((p) => p.type === "month")?.value;
  const dayStr = parts.find((p) => p.type === "day")?.value;
  const hourStr = parts.find((p) => p.type === "hour")?.value;
  const minuteStr = parts.find((p) => p.type === "minute")?.value;
  const secondStr = parts.find((p) => p.type === "second")?.value;

  if (!yearStr || !monthStr || !dayStr || !hourStr || !minuteStr || !secondStr) {
    throw new Error("Failed to resolve timezone offset");
  }

  const asUtc = Date.UTC(
    Number(yearStr),
    Number(monthStr) - 1,
    Number(dayStr),
    Number(hourStr),
    Number(minuteStr),
    Number(secondStr)
  );

  return (asUtc - date.getTime()) / 60000;
}

function zonedTimeToUtc(parts: DateParts, hour: number, minute: number, timeZone: string): Date {
  const naiveUtc = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, hour, minute, 0));
  const offset1 = getTimeZoneOffsetMinutes(naiveUtc, timeZone);
  const adjusted = new Date(naiveUtc.getTime() - offset1 * 60000);
  const offset2 = getTimeZoneOffsetMinutes(adjusted, timeZone);
  if (offset2 !== offset1) {
    return new Date(naiveUtc.getTime() - offset2 * 60000);
  }
  return adjusted;
}

function parseTimeToHourMinute(value: string): { hour: number; minute: number } {
  const [h, m] = value.split(":");
  const hour = Number(h);
  const minute = Number(m);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    throw new Error(`Invalid time value: ${value}`);
  }
  return { hour, minute };
}

function getDbDayOfWeek(parts: DateParts): number {
  const js = new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay(); // 0..6, 0=Sun
  return js === 0 ? 7 : js; // 1=Mon .. 7=Sun
}

/**
 * Hlavná server-side funkcia na výpočet konkrétnych voľných termínov trénera.
 * @param trainerId ID trénera, pre ktorého sa hľadajú termíny.
 * @param lookaheadDays Počet dní dopredu, na ktoré sa majú generovať termíny (defaultne 14).
 * @param slotDurationMinutes Dĺžka jedného termínu v minútach (defaultne 60).
 * @returns Pole dostupných termínov alebo null v prípade chyby.
 */
export async function getAvailableSlots(
  trainerId: string,
  lookaheadDays: number = 7,
  slotDurationMinutes: number = 60,
  maxSlots: number = 30,
  serviceType: "personal" | "online" = "personal"
): Promise<AvailableSlot[] | null> {
  const effectiveSlotDurationMinutes = serviceType === "online" ? 30 : 60;
  const requestedSlotDurationMinutes = Number.isFinite(slotDurationMinutes) ? slotDurationMinutes : effectiveSlotDurationMinutes;

  console.log(
    `[getAvailableSlots] Start pre trainerId: ${trainerId}, serviceType: ${serviceType}, slotDurationMinutes: ${effectiveSlotDurationMinutes} (requested: ${requestedSlotDurationMinutes})`
  );
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error("SUPABASE_URL missing");
  }
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY missing");
  }

  console.log(`[getAvailableSlots] Inicializácia Supabase klienta...`);
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const now = new Date();
  const timeZone = "Europe/Bratislava";
  const todayInTz = getDatePartsInTimeZone(now, timeZone);
  const endInTz = addDaysToDateParts(todayInTz, lookaheadDays);
  const lookaheadEndUtc = zonedTimeToUtc(endInTz, 23, 59, timeZone);

  console.log(`[getAvailableSlots] Načítanie availability_slots pre trainerId: ${trainerId}, serviceType: ${serviceType}...`);
  // 1. Načítanie aktívnych pravidiel dostupnosti pre trénera a daný typ služby
  const { data: rawAvailabilityRules, error: rulesError } = await supabase
    .from("availability_slots")
    .select("id, trainer_id, day_of_week, start_time, end_time, is_active")
    .eq("trainer_id", trainerId)
    .eq("service_type", serviceType)
    .eq("is_active", true);

  if (rulesError) {
    console.error("[getAvailableSlots] Chyba pri dopyte na availability_slots:", rulesError);
    throw new Error(`DB Error (availability_slots): ${rulesError.message}`);
  }
  
  const availabilityRules = (rawAvailabilityRules || []) as Slot[];
  console.log(`[getAvailableSlots] Počet nájdených pravidiel: ${availabilityRules.length}`);

  console.log(`[getAvailableSlots] Načítanie bookings pre serviceType: ${serviceType}...`);
  // 2. Načítanie existujúcich aktívnych rezervácií v danom časovom rozsahu pre daný typ služby
  const activeBookingStatuses: BookingStatus[] = ["pending", "confirmed"];
  const { data: bookings, error: bookingsError } = await supabase
    .from("bookings")
    .select("starts_at, ends_at")
    .eq("trainer_id", trainerId)
    .eq("service_type", serviceType)
    .in("booking_status", activeBookingStatuses)
    .gte("starts_at", now.toISOString())
    .lte("starts_at", lookaheadEndUtc.toISOString());

  if (bookingsError) {
    console.error("[getAvailableSlots] Chyba pri dopyte na bookings:", bookingsError);
    throw new Error(`DB Error (bookings): ${bookingsError.message}`);
  }

  const typedBookings = (bookings || []) as { starts_at: string; ends_at: string }[];
  console.log(`[getAvailableSlots] Počet nájdených rezervácií: ${typedBookings.length}`);

  const occupiedRanges = typedBookings.map(b => ({
    start: new Date(b.starts_at),
    end: new Date(b.ends_at),
  }));

  // --- Generovanie a filtrovanie termínov ---
  console.log(`[getAvailableSlots] Generovanie termínov...`);
  const finalAvailableSlots: AvailableSlot[] = [];
  const slotDurationMs = effectiveSlotDurationMinutes * 60 * 1000;

  for (let offsetDays = 0; offsetDays <= lookaheadDays; offsetDays++) {
    const dayParts = addDaysToDateParts(todayInTz, offsetDays);
    const dayOfWeek = getDbDayOfWeek(dayParts);

    const rulesForThisDay = availabilityRules.filter((rule) => rule.day_of_week === dayOfWeek);
    if (rulesForThisDay.length === 0) continue;

    for (const rule of rulesForThisDay) {
      const start = parseTimeToHourMinute(rule.start_time);
      const end = parseTimeToHourMinute(rule.end_time);

      const ruleStartUtc = zonedTimeToUtc(dayParts, start.hour, start.minute, timeZone);
      const ruleEndUtc = zonedTimeToUtc(dayParts, end.hour, end.minute, timeZone);

      let currentSlotStartUtc = new Date(ruleStartUtc.getTime());
      while (currentSlotStartUtc.getTime() + slotDurationMs <= ruleEndUtc.getTime()) {
        const currentSlotEndUtc = new Date(currentSlotStartUtc.getTime() + slotDurationMs);

        if (currentSlotStartUtc < now) {
          currentSlotStartUtc = currentSlotEndUtc;
          continue;
        }

        const isOccupied = occupiedRanges.some((occupied) =>
          doRangesOverlap(currentSlotStartUtc, currentSlotEndUtc, occupied.start, occupied.end)
        );

        if (!isOccupied) {
          finalAvailableSlots.push({
            trainer_id: trainerId,
            starts_at: currentSlotStartUtc.toISOString(),
            ends_at: currentSlotEndUtc.toISOString(),
            source_availability_slot_id: rule.id,
          });
        }

        currentSlotStartUtc = currentSlotEndUtc;
      }
    }
  }

  // Zoradenie finálnych termínov
  finalAvailableSlots.sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  const limited = finalAvailableSlots.length > maxSlots ? finalAvailableSlots.slice(0, maxSlots) : finalAvailableSlots;
  console.log(`[getAvailableSlots] Hotovo. Vygenerované: ${finalAvailableSlots.length}, vraciam: ${limited.length}`);

  return limited;
}
