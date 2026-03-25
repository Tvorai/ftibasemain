import { createClient } from "@supabase/supabase-js";
import { Slot, Booking } from "@/lib/types";

// Definícia typu pre dostupný slot s konkrétnymi dátumami a časmi
export type AvailableSlot = Slot & {
  start_time: string; // Plný ISO string dátumu a času
  end_time: string;   // Plný ISO string dátumu a času
};


// Pomocná funkcia pre získanie najbližšieho výskytu dňa v týždni s časom
function getNextOccurrence(dayOfWeek: number, timeString: string, currentRefDate: Date): Date {
  const now = new Date(currentRefDate);
  const todayDay = now.getDay(); // 0 pre nedeľu, 1 pre pondelok, atď.

  // Prevod Supabase dayOfWeek (1=Pon, ..., 7=Ned) na JS getDay (0=Ned, ..., 6=Sob)
  const jsDayOfWeek = dayOfWeek === 7 ? 0 : dayOfWeek; 

  let daysUntilNext = jsDayOfWeek - todayDay;
  if (daysUntilNext < 0) {
    daysUntilNext += 7; 
  }

  const nextDate = new Date(now);
  nextDate.setDate(now.getDate() + daysUntilNext);
  
  // Nastavenie časovej zložky
  const [hours, minutes, seconds] = timeString.split(':').map(Number);
  nextDate.setHours(hours, minutes, seconds || 0, 0);

  return nextDate;
}

// Pomocná funkcia pre kontrolu prekrývania časov
function doTimesOverlap(
  slotStart: Date,
  slotEnd: Date,
  bookingStart: Date,
  bookingEnd: Date
): boolean {
  return slotStart < bookingEnd && bookingStart < slotEnd;
}

export async function getAvailableSlots(trainerId: string): Promise<AvailableSlot[] | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Supabase URL or Service Role Key is not configured.");
    return null;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1. Získanie všetkých aktívnych availability_slots pre trénera
  const { data: availabilitySlots, error: availabilityError } = await supabase
    .from("availability_slots")
    .select("id,trainer_id,day_of_week,start_time,end_time,is_active,created_at,updated_at")
    .eq("trainer_id", trainerId)
    .eq("is_active", true)
    .order("day_of_week", { ascending: true })
    .order("start_time", { ascending: true });

  if (availabilityError) {
    console.error("Error fetching availability slots:", availabilityError);
    return null;
  }

  if (!availabilitySlots || availabilitySlots.length === 0) {
    return []; // Žiadna dostupnosť definovaná
  }

  // 2. Získanie všetkých relevantných rezervácií pre trénera
  // Zvažujeme 'confirmed' a 'pending_payment' rezervácie ako obsadené
  const { data: bookings, error: bookingsError } = await supabase
    .from("bookings")
    .select("starts_at,ends_at")
    .eq("trainer_id", trainerId)
    .in("booking_status", ["confirmed", "pending_payment"])
    .gte("ends_at", new Date().toISOString()); // Iba budúce alebo prebiehajúce rezervácie

  if (bookingsError) {
    console.error("Error fetching bookings:", bookingsError);
    return null;
  }

  const occupiedTimeRanges = (bookings || []).map(b => ({
    start: new Date(b.starts_at),
    end: new Date(b.ends_at),
  }));

  const availableFutureSlots: AvailableSlot[] = [];
  const now = new Date();
  const lookAheadDays = 14; // Pozeráme sa dopredu na 14 dní

  for (let i = 0; i < lookAheadDays; i++) { // Iterujeme pre každý deň v rozsahu
    const currentRefDate = new Date(now);
    currentRefDate.setDate(now.getDate() + i);
    const currentDayOfWeek = currentRefDate.getDay(); // 0-6, Sunday is 0

    for (const slot of availabilitySlots as Slot[]) {
      // Prevod Supabase dayOfWeek (1=Pon, ..., 7=Ned) na JS getDay (0=Ned, ..., 6=Sob)
      const supabaseDayOfWeek = slot.day_of_week === 7 ? 0 : slot.day_of_week; 

      if (currentDayOfWeek === supabaseDayOfWeek) {
        const slotStartDateTime = getNextOccurrence(slot.day_of_week, slot.start_time, currentRefDate); // Použijeme pôvodný slot.day_of_week pre getNextOccurrence
        const slotEndDateTime = getNextOccurrence(slot.day_of_week, slot.end_time, currentRefDate);

        // Zabezpečenie, že generovaný slot nie je v minulosti
        if (slotEndDateTime <= now) {
            continue; // Preskočiť minulé sloty
        }

        let isOccupied = false;
        for (const occupied of occupiedTimeRanges) {
          if (doTimesOverlap(slotStartDateTime, slotEndDateTime, occupied.start, occupied.end)) {
            isOccupied = true;
            break;
          }
        }

        if (!isOccupied) {
          availableFutureSlots.push({
            ...slot,
            // Prepíšeme start_time a end_time na ISO stringy konkrétnych výskytov
            // Toto je kľúčové pre frontend, aby vedel presný dátum a čas
            start_time: slotStartDateTime.toISOString(),
            end_time: slotEndDateTime.toISOString(),
          });
        }
      }
    }
  }

  // Zoradenie podľa skutočného času začiatku
  availableFutureSlots.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

  return availableFutureSlots;
}