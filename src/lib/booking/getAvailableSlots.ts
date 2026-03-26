
import { createClient } from "@supabase/supabase-js";
// Force Vercel redeploy again
// Force Vercel redeploy again
import { Booking, BookingStatus, Slot } from "@/lib/types";

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

/**
 * Hlavná server-side funkcia na výpočet konkrétnych voľných termínov trénera.
 * @param trainerId ID trénera, pre ktorého sa hľadajú termíny.
 * @param lookaheadDays Počet dní dopredu, na ktoré sa majú generovať termíny (defaultne 14).
 * @param slotDurationMinutes Dĺžka jedného termínu v minútach (defaultne 60).
 * @returns Pole dostupných termínov alebo null v prípade chyby.
 */
export async function getAvailableSlots(
  trainerId: string,
  lookaheadDays: number = 14,
  slotDurationMinutes: number = 60
): Promise<AvailableSlot[] | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Chyba: Supabase URL alebo Service Role Key nie je nakonfigurovaný.");
    return null;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const now = new Date();
  const lookaheadDate = new Date(now);
  lookaheadDate.setDate(now.getDate() + lookaheadDays);

  // 1. Načítanie aktívnych pravidiel dostupnosti pre trénera
  const { data: rawAvailabilityRules, error: rulesError } = await supabase
    .from("availability_slots")
    .select("*")
    .eq("trainer_id", trainerId)
    .eq("is_active", true);

  if (rulesError) {
    console.error("Chyba pri načítaní pravidiel dostupnosti:", rulesError);
    return null;
  }
  const availabilityRules = (rawAvailabilityRules || []) as Slot[];

  // 2. Načítanie existujúcich aktívnych rezervácií v danom časovom rozsahu
  const activeBookingStatuses: BookingStatus[] = ["confirmed", "pending", "pending_payment"];
  const { data: bookings, error: bookingsError } = await supabase
    .from("bookings")
    .select("starts_at, ends_at")
    .eq("trainer_id", trainerId)
    .in("booking_status", activeBookingStatuses)
    .gte("starts_at", now.toISOString())
    .lte("starts_at", lookaheadDate.toISOString());

  if (bookingsError) {
    console.error("Chyba pri načítaní rezervácií:", bookingsError);
    return null;
  }

  const typedBookings = (bookings || []) as { starts_at: string; ends_at: string }[];
  const occupiedRanges = typedBookings.map(b => ({
    start: new Date(b.starts_at),
    end: new Date(b.ends_at),
  }));

  // --- Generovanie a filtrovanie termínov ---

  const finalAvailableSlots: AvailableSlot[] = [];
  const slotDurationMs = slotDurationMinutes * 60 * 1000;

  // 3. Iterácia cez dni v požadovanom rozsahu
  for (let i = 0; i < lookaheadDays; i++) {
    const day = new Date(now);
    day.setDate(now.getDate() + i);
    day.setHours(0, 0, 0, 0); // Normalizácia na začiatok dňa

    const jsDayOfWeek = day.getDay(); // 0 = Nedeľa, 1 = Pondelok, ..., 6 = Sobota
    const supabaseDayOfWeek = jsDayOfWeek === 0 ? 7 : jsDayOfWeek; // Konverzia na Supabase formát (1-7)

    const rulesForThisDay = availabilityRules.filter(rule => rule.day_of_week === supabaseDayOfWeek);

    // 4. Pre každé pravidlo generujeme 60-minútové termíny
    for (const rule of rulesForThisDay) {
      const [startHours, startMinutes] = rule.start_time.split(':').map(Number);
      const [endHours, endMinutes] = rule.end_time.split(':').map(Number);

      const ruleStartDateTime = new Date(day);
      ruleStartDateTime.setHours(startHours, startMinutes, 0, 0);

      const ruleEndDateTime = new Date(day);
      ruleEndDateTime.setHours(endHours, endMinutes, 0, 0);

      let currentSlotStart = new Date(ruleStartDateTime);

      while (currentSlotStart.getTime() + slotDurationMs <= ruleEndDateTime.getTime()) {
        const currentSlotEnd = new Date(currentSlotStart.getTime() + slotDurationMs);

        // 5. Filtrovanie - ignoruj minulé a obsadené termíny
        if (currentSlotStart < now) {
          currentSlotStart = currentSlotEnd; // Posun na ďalší slot
          continue;
        }

        const isOccupied = occupiedRanges.some(occupied =>
          doRangesOverlap(currentSlotStart, currentSlotEnd, occupied.start, occupied.end)
        );

        if (!isOccupied) {
          finalAvailableSlots.push({
            trainer_id: trainerId,
            starts_at: currentSlotStart.toISOString(),
            ends_at: currentSlotEnd.toISOString(),
            source_availability_slot_id: rule.id,
          });
        }

        currentSlotStart = currentSlotEnd; // Posun na ďalší slot
      }
    }
  }

  // Zoradenie finálnych termínov
  finalAvailableSlots.sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());

  return finalAvailableSlots;
}
