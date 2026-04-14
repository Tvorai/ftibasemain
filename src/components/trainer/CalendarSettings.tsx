"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { loadAvailabilityAction, saveAvailabilityAction } from "@/lib/availability/saveAvailability";

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
  type TimeSlot = { hour: number; minute: number };
  type DayAvailability = { isDayActive: boolean; activeSlots: TimeSlot[] };
  type AvailabilityState = Record<number, DayAvailability>;
  type AvailabilitySlotRow = { day_of_week: number | string | null; start_time: string | null; end_time: string | null };
  type ExpandedRowDebug = {
    raw: AvailabilitySlotRow;
    normalizedDayOfWeek: number | null;
    normalizedStart: string | null;
    normalizedEnd: string | null;
    generatedActiveSlots: string[];
  };

  const debug = process.env.NODE_ENV !== "production";

  const createEmptyAvailability = useCallback((): AvailabilityState => {
    const initial: AvailabilityState = {};
    DAYS.forEach((day) => {
      initial[day.id] = { isDayActive: false, activeSlots: [] };
    });
    return initial;
  }, []);

  const parseDbTime = useCallback((value: string): { hour: number; minute: number } | null => {
    const match = value.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (!match) return null;
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
    return { hour, minute };
  }, []);

  const toTimeLabel = useCallback((hour: number, minute: number) => {
    return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
  }, []);

  const normalizeDayOfWeek = useCallback((value: number | string | null): number | null => {
    if (typeof value === "number") {
      if (!Number.isInteger(value)) return null;
      if (value < 1 || value > 7) return null;
      return value;
    }
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) return null;
      const parsed = Number.parseInt(trimmed, 10);
      if (!Number.isFinite(parsed)) return null;
      if (parsed < 1 || parsed > 7) return null;
      return parsed;
    }
    return null;
  }, []);

  const timeLabels = useMemo(() => {
    const slotsPerHour = Math.max(1, Math.floor(60 / slotDurationMinutes));
    return HOURS.flatMap((hour) =>
      Array.from({ length: slotsPerHour }, (_, slotIdx) => {
        const minute = slotIdx * slotDurationMinutes;
        return toTimeLabel(hour, minute);
      })
    );
  }, [slotDurationMinutes, toTimeLabel]);

  const toAvailabilitySlotRow = useCallback((value: unknown): AvailabilitySlotRow | null => {
    if (!value || typeof value !== "object") return null;
    const record = value as Record<string, unknown>;
    const dayRaw = record.day_of_week;
    const startRaw = record.start_time;
    const endRaw = record.end_time;

    const day_of_week = typeof dayRaw === "number" || typeof dayRaw === "string" ? dayRaw : null;
    const start_time = typeof startRaw === "string" ? startRaw : null;
    const end_time = typeof endRaw === "string" ? endRaw : null;
    return { day_of_week, start_time, end_time };
  }, []);

  const buildAvailabilityFromRows = useCallback(
    (rows: AvailabilitySlotRow[]): { availability: AvailabilityState; expanded: ExpandedRowDebug[] } => {
      const currentAvailability = createEmptyAvailability();
      const expanded: ExpandedRowDebug[] = [];

      rows.forEach((slot) => {
        if (!slot.start_time || !slot.end_time) return;

        const dayId = normalizeDayOfWeek(slot.day_of_week);
        if (!dayId || !currentAvailability[dayId]) return;

        const start = parseDbTime(slot.start_time);
        const end = parseDbTime(slot.end_time);
        if (!start || !end) {
          expanded.push({
            raw: slot,
            normalizedDayOfWeek: dayId,
            normalizedStart: start ? toTimeLabel(start.hour, start.minute) : null,
            normalizedEnd: end ? toTimeLabel(end.hour, end.minute) : null,
            generatedActiveSlots: [],
          });
          return;
        }

        currentAvailability[dayId].isDayActive = true;

        let currentH = start.hour;
        let currentM = start.minute;
        const generatedLabels: string[] = [];

        while (currentH < end.hour || (currentH === end.hour && currentM < end.minute)) {
          if (HOURS.includes(currentH)) {
            currentAvailability[dayId].activeSlots.push({ hour: currentH, minute: currentM });
            generatedLabels.push(toTimeLabel(currentH, currentM));
          }

          currentM += slotDurationMinutes;
          if (currentM >= 60) {
            currentH += Math.floor(currentM / 60);
            currentM = currentM % 60;
          }
        }

        expanded.push({
          raw: slot,
          normalizedDayOfWeek: dayId,
          normalizedStart: toTimeLabel(start.hour, start.minute),
          normalizedEnd: toTimeLabel(end.hour, end.minute),
          generatedActiveSlots: generatedLabels,
        });
      });

      DAYS.forEach((day) => {
        const dayState = currentAvailability[day.id];
        if (!dayState) return;
        const seen = new Set<string>();
        const deduped = dayState.activeSlots
          .slice()
          .sort((a, b) => (a.hour !== b.hour ? a.hour - b.hour : a.minute - b.minute))
          .filter((slot) => {
            const key = `${slot.hour}:${slot.minute}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
        currentAvailability[day.id] = { ...dayState, activeSlots: deduped };
      });

      return { availability: currentAvailability, expanded };
    },
    [createEmptyAvailability, normalizeDayOfWeek, parseDbTime, slotDurationMinutes, toTimeLabel]
  );

  // Inicializujeme stav s prázdnymi dňami, aby sme predišli undefined chybám pri prvom renderi
  const [availability, setAvailability] = useState<AvailabilityState>(() => createEmptyAvailability());
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Výpočet rolling 7-dňového okna zosúladeného s rezervačným formulárom
  const weekDates = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    
    const windowDays = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now);
      d.setDate(now.getDate() + i);
      return d;
    });

    const getWeekdayNumber = (date: Date): number => {
      const js = date.getDay();
      return js === 0 ? 7 : js;
    };

    const daysByWeekday = new Map<number, Date>();
    windowDays.forEach(d => {
      daysByWeekday.set(getWeekdayNumber(d), d);
    });

    return DAYS.map((day) => {
      const date = daysByWeekday.get(day.id);
      return {
        day: date?.getDate() || 0,
        month: (date?.getMonth() || 0) + 1
      };
    });
  }, []);

  const loadAvailability = useCallback(
    async (source: "effect" | "afterSave") => {
      if (!trainerId) return { rowCount: 0 };
      setLoading(true);
      try {
        const res = await loadAvailabilityAction(trainerId, serviceType);
        if (!res.success) {
          throw new Error(res.error);
        }

        const rawRows = res.data;
        const rows = rawRows.map(toAvailabilitySlotRow).filter((row): row is AvailabilitySlotRow => row !== null);
        const { availability: nextAvailability, expanded } = buildAvailabilityFromRows(rows);

        if (debug) {
          console.log("[CalendarSettings] loadAvailability", {
            source,
            trainerId,
            serviceType,
            slotDurationMinutes,
            timeLabels,
            rawRows,
            normalizedRows: rows,
            expandedRows: expanded,
            transformedAvailability: nextAvailability,
            sampleTimeCompare: { ui: "05:00", db: "05:00:00", normalizedDb: parseDbTime("05:00:00") },
          });
        }

        setAvailability(nextAvailability);
        return { rowCount: rows.length };
      } catch (err) {
        console.error("[CalendarSettings] Chyba pri načítaní dostupnosti:", err);
        return { rowCount: 0 };
      } finally {
        setLoading(false);
      }
    },
    [buildAvailabilityFromRows, debug, parseDbTime, serviceType, slotDurationMinutes, timeLabels, toAvailabilitySlotRow, trainerId]
  );

  useEffect(() => {
    void loadAvailability("effect");
  }, [loadAvailability]);

  useEffect(() => {
    if (!debug) return;
    console.log("[CalendarSettings] state before render", {
      trainerId,
      serviceType,
      slotDurationMinutes,
      timeLabels,
      availability,
    });
  }, [availability, debug, serviceType, slotDurationMinutes, timeLabels, trainerId]);

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
      const before = availability;
      const res = await saveAvailabilityAction(trainerId, availability, serviceType, slotDurationMinutes);
      if (res.success) {
        alert("Nastavenia kalendára boli uložené.");
        const refetch = async () => loadAvailability("afterSave");
        const { rowCount } = await refetch();
        const hasSelection =
          Object.values(before).some((d) => d.isDayActive && d.activeSlots.length > 0);
        if (hasSelection && rowCount === 0) {
          await new Promise<void>((resolve) => setTimeout(resolve, 250));
          await refetch();
        }
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
          <div className="flex items-center justify-center font-bold text-[10px] text-zinc-600 uppercase tracking-widest border-b border-white/5 pb-2">ČAS</div>
          {DAYS.map((day, idx) => (
            <div key={day.id} className="flex flex-col items-center gap-2 border-b border-white/5 pb-2">
              <span className="text-[10px] text-zinc-500 font-mono">
                {weekDates[idx].day}. {weekDates[idx].month}.
              </span>
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
