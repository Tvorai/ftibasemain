"use server";

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Server Action na uloženie dostupnosti trénera.
 * @param trainerId ID trénera
 * @param availability Objekty dostupnosti pre každý deň (1-7)
 */
export async function saveAvailabilityAction(
  trainerId: string,
  availability: Record<number, { isDayActive: boolean; activeHours: number[] }>
) {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase konfigurácia chýba.");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    // 1. Zmazať existujúcu dostupnosť pre trénera
    const { error: deleteError } = await supabase
      .from("availability_slots")
      .delete()
      .eq("trainer_id", trainerId);

    if (deleteError) throw deleteError;

    const newSlots: any[] = [];

    // 2. Spracovať každý deň a nájsť súvislé časové úseky
    for (let day = 1; day <= 7; day++) {
      const dayData = availability[day];
      if (!dayData || !dayData.isDayActive || dayData.activeHours.length === 0) continue;

      // Zoradiť hodiny
      const sortedHours = [...dayData.activeHours].sort((a, b) => a - b);
      
      let currentStart = sortedHours[0];
      let currentEnd = sortedHours[0] + 1;

      for (let i = 1; i < sortedHours.length; i++) {
        if (sortedHours[i] === currentEnd) {
          // Súvislý úsek pokračuje
          currentEnd = sortedHours[i] + 1;
        } else {
          // Úsek skončil, uložiť a začať nový
          newSlots.push({
            trainer_id: trainerId,
            day_of_week: day,
            start_time: `${currentStart.toString().padStart(2, '0')}:00:00`,
            end_time: `${currentEnd.toString().padStart(2, '0')}:00:00`,
            is_active: true
          });
          currentStart = sortedHours[i];
          currentEnd = sortedHours[i] + 1;
        }
      }

      // Posledný úsek pre daný deň
      newSlots.push({
        trainer_id: trainerId,
        day_of_week: day,
        start_time: `${currentStart.toString().padStart(2, '0')}:00:00`,
        end_time: `${currentEnd.toString().padStart(2, '0')}:00:00`,
        is_active: true
      });
    }

    // 3. Vložiť nové sloty do DB
    if (newSlots.length > 0) {
      const { error: insertError } = await supabase
        .from("availability_slots")
        .insert(newSlots);

      if (insertError) throw insertError;
    }

    return { success: true };
  } catch (error: any) {
    console.error("Chyba pri ukladaní dostupnosti:", error);
    return { success: false, error: error.message };
  }
}
