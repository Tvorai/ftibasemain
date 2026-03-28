"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { supabaseUrl, supabaseAnonKey } from "@/lib/config";
import { saveAvailabilityAction } from "@/lib/availability/saveAvailability";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface CalendarSettingsProps {
  trainerId: string;
  serviceType?: "personal" | "online";
  slotDurationMinutes?: number;
}

const DAYS = [
  { id: 1, label: "PO" },
  { id: 2, label: "UT" },
  { id: 3, label: "ST" },
  { id: 4, label: "ŠT" },
  { id: 5, label: "PI" },
  { id: 6, label: "SO" },
  { id: 7, label: "NE" },
];

const HOURS = Array.from({ length: 17 }, (_, i) => i + 5); // 05:00 - 21:00

export default function CalendarSettings({ 
  trainerId, 
  serviceType = "personal",
  slotDurationMinutes = 60
}: CalendarSettingsProps) {
  // Inicializujeme stav s prázdnymi dňami, aby sme predišli undefined chybám pri prvom renderi
  const [availability, setAvailability] = useState<Record<number, { isDayActive: boolean; activeSlots: { hour: number; minute: number }[] }>>(() => {
    const initial: Record<number, { isDayActive: boolean; activeSlots: { hour: number; minute: number }[] }> = {};
    DAYS.forEach(day => {
      initial[day.id] = { isDayActive: false, activeSlots: [] };
    });
    return initial;
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadAvailability() {
      if (!trainerId) return;
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("availability_slots")
          .select("day_of_week, start_time, end_time")
          .eq("trainer_id", trainerId)
          .eq("service_type", serviceType)
          .eq("is_active", true);

        if (error) throw error;

        // Reset na čistý stav pred naplnením dátami z DB
        const currentAvailability: Record<number, { isDayActive: boolean; activeSlots: { hour: number; minute: number }[] }> = {};
        DAYS.forEach(day => {
          currentAvailability[day.id] = { isDayActive: false, activeSlots: [] };
        });

        data?.forEach(slot => {
          const dayId = slot.day_of_week;
          if (!dayId) return;

          const [startH, startM] = slot.start_time.split(":").map(Number);
          const [endH, endM] = slot.end_time.split(":").map(Number);
          
          currentAvailability[dayId].isDayActive = true;
          
          let currentH = startH;
          let currentM = startM;
          
          while (currentH < endH || (currentH === endH && currentM < endM)) {
            if (HOURS.includes(currentH)) {
              currentAvailability[dayId].activeSlots.push({ hour: currentH, minute: currentM });
            }
            
            currentM += slotDurationMinutes;
            if (currentM >= 60) {
              currentH += Math.floor(currentM / 60);
              currentM = currentM % 60;
            }
          }
        });

        setAvailability(currentAvailability);
      } catch (err) {
        console.error("Chyba pri načítaní dostupnosti:", err);
      } finally {
        setLoading(false);
      }
    }
    loadAvailability();
  }, [trainerId, serviceType, slotDurationMinutes]);

  const toggleDay = (dayId: number) => {
    setAvailability(prev => {
      const currentDay = prev[dayId] || { isDayActive: false, activeSlots: [] };
      const allSlots: { hour: number; minute: number }[] = [];
      
      if (!currentDay.isDayActive) {
        const slotsPerHour = 60 / slotDurationMinutes;
        HOURS.forEach(hour => {
          for (let i = 0; i < slotsPerHour; i++) {
            allSlots.push({ hour, minute: i * slotDurationMinutes });
          }
        });
      }

      return {
        ...prev,
        [dayId]: {
          isDayActive: !currentDay.isDayActive,
          activeSlots: allSlots
        }
      };
    });
  };

  const toggleSlot = (dayId: number, hour: number, minute: number) => {
    setAvailability(prev => {
      const currentDay = prev[dayId] || { isDayActive: false, activeSlots: [] };
      if (!currentDay.isDayActive) return prev;

      const currentSlots = currentDay.activeSlots;
      const exists = currentSlots.some(s => s.hour === hour && s.minute === minute);
      
      const newSlots = exists
        ? currentSlots.filter(s => !(s.hour === hour && s.minute === minute))
        : [...currentSlots, { hour, minute }].sort((a, b) => a.hour !== b.hour ? a.hour - b.hour : a.minute - b.minute);
      
      return {
        ...prev,
        [dayId]: { ...currentDay, activeSlots: newSlots }
      };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Potrebujeme upraviť saveAvailabilityAction alebo vytvoriť novú, ktorá podporuje serviceType a minúty
      // Pre tento moment skúsime poslať dáta tak, ako sú, ale s upravenou štruktúrou
      const res = await saveAvailabilityAction(trainerId, availability as any, serviceType, slotDurationMinutes);
      if (res.success) {
        alert("Nastavenia kalendára boli uložené.");
      } else {
        alert("Chyba: " + res.error);
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-zinc-500 animate-pulse">Načítavam nastavenia...</div>;

  const slotsPerHour = 60 / slotDurationMinutes;

  return (
    <div className="space-y-8">
      <div className="overflow-x-auto pb-4">
        <div className="min-w-[600px] grid grid-cols-[80px_repeat(7,1fr)] gap-2">
          {/* Header (Dni + Toggles) */}
          <div className="flex items-center justify-center font-bold text-[10px] text-zinc-500 uppercase tracking-widest">Čas</div>
          {DAYS.map(day => (
            <div key={day.id} className="flex flex-col items-center gap-2">
              <span className="font-bold text-zinc-200">{day.label}</span>
              <button
                onClick={() => toggleDay(day.id)}
                className={`w-10 h-5 rounded-full relative transition-colors ${availability[day.id].isDayActive ? "bg-emerald-500" : "bg-zinc-800"}`}
              >
                <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform ${availability[day.id].isDayActive ? "translate-x-5" : ""}`} />
              </button>
            </div>
          ))}

          {/* Grid hodín */}
          {HOURS.map(hour => (
            <React.Fragment key={hour}>
              {Array.from({ length: slotsPerHour }).map((_, slotIdx) => {
                const minute = slotIdx * slotDurationMinutes;
                return (
                  <React.Fragment key={`${hour}-${minute}`}>
                    <div className="flex items-center justify-center text-xs text-zinc-500 font-mono py-1">
                      {hour.toString().padStart(2, '0')}:{minute.toString().padStart(2, '0')}
                    </div>
                    {DAYS.map(day => {
                      const isActive = availability[day.id].isDayActive && availability[day.id].activeSlots.some(s => s.hour === hour && s.minute === minute);
                      const isDayDisabled = !availability[day.id].isDayActive;
                      
                      return (
                        <button
                          key={`${day.id}-${hour}-${minute}`}
                          onClick={() => toggleSlot(day.id, hour, minute)}
                          disabled={isDayDisabled}
                          className={`h-10 rounded-lg border border-white/5 transition-all ${
                            isDayDisabled ? "bg-zinc-900/20 cursor-not-allowed opacity-30" :
                            isActive ? "bg-emerald-500 hover:bg-emerald-400" : "bg-zinc-800 hover:bg-zinc-700"
                          }`}
                        />
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t border-zinc-900">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-emerald-500 hover:bg-emerald-400 text-black font-display text-xl px-12 py-3 rounded-full tracking-wider transition-colors uppercase disabled:opacity-50"
        >
          {saving ? "Ukladám..." : "ULOŽIŤ NASTAVENIA"}
        </button>
      </div>
    </div>
  );
}
