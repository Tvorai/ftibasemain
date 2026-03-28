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
  availability: Record<number, { isDayActive: boolean; activeSlots: { hour: number; minute: number }[] }>,
  serviceType: "personal" | "online" = "personal",
  slotDurationMinutes: number = 60
) {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase konfigurácia chýba.");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    // 1. Zmazať existujúcu dostupnosť pre trénera a daný typ služby
    const { error: deleteError } = await supabase
      .from("availability_slots")
      .delete()
      .eq("trainer_id", trainerId)
      .eq("service_type", serviceType);

    if (deleteError) throw deleteError;

    const newSlots: any[] = [];

    // 2. Spracovať každý deň a nájsť súvislé časové úseky
    for (let day = 1; day <= 7; day++) {
      const dayData = availability[day];
      if (!dayData || !dayData.isDayActive || dayData.activeSlots.length === 0) continue;

      // Zoradiť sloty podľa času
      const sortedSlots = [...dayData.activeSlots].sort((a, b) => 
        a.hour !== b.hour ? a.hour - b.hour : a.minute - b.minute
      );
      
      let currentStart = sortedSlots[0];
      let currentEndMinute = sortedSlots[0].minute + slotDurationMinutes;
      let currentEndHour = sortedSlots[0].hour + Math.floor(currentEndMinute / 60);
      currentEndMinute = currentEndMinute % 60;

      for (let i = 1; i < sortedSlots.length; i++) {
        const slot = sortedSlots[i];
        if (slot.hour === currentEndHour && slot.minute === currentEndMinute) {
          // Súvislý úsek pokračuje
          currentEndMinute += slotDurationMinutes;
          currentEndHour += Math.floor(currentEndMinute / 60);
          currentEndMinute = currentEndMinute % 60;
        } else {
          // Úsek skončil, uložiť a začať nový
          newSlots.push({
            trainer_id: trainerId,
            day_of_week: day,
            start_time: `${currentStart.hour.toString().padStart(2, '0')}:${currentStart.minute.toString().padStart(2, '0')}:00`,
            end_time: `${currentEndHour.toString().padStart(2, '0')}:${currentEndMinute.toString().padStart(2, '0')}:00`,
            is_active: true,
            service_type: serviceType
          });
          currentStart = slot;
          currentEndMinute = slot.minute + slotDurationMinutes;
          currentEndHour = slot.hour + Math.floor(currentEndMinute / 60);
          currentEndMinute = currentEndMinute % 60;
        }
      }

      // Posledný úsek pre daný deň
      newSlots.push({
        trainer_id: trainerId,
        day_of_week: day,
        start_time: `${currentStart.hour.toString().padStart(2, '0')}:${currentStart.minute.toString().padStart(2, '0')}:00`,
        end_time: `${currentEndHour.toString().padStart(2, '0')}:${currentEndMinute.toString().padStart(2, '0')}:00`,
        is_active: true,
        service_type: serviceType
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
