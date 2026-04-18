"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { supabaseUrl, supabaseAnonKey } from "@/lib/config";
import { Booking } from "@/lib/types";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface TrainerCalendarProps {
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

export default function TrainerCalendar({ 
  trainerId, 
  serviceType = "personal",
  slotDurationMinutes = 60
}: TrainerCalendarProps) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  // Výpočet rolling 7-dňového okna zosúladeného s rezervačným formulárom
  const weekDates = React.useMemo(() => {
    const now = new Date();
    // Vytvoriť čistý dátum (dnes o polnoci) v lokálnom čase
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    console.log("[ADMIN CALENDAR] today =", today.toLocaleDateString('sk-SK'));
    
    // Vytvoriť pole 7 po sebe nasledujúcich dní od dnes
    const windowDays = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      return d;
    });

    const getWeekdayNumber = (date: Date): number => {
      const js = date.getDay(); // 0=Sun..6=Sat
      return js === 0 ? 7 : js; // 1=Mon..7=Sun
    };

    // Namapovať dni na ich weekday ID (1-7)
    const daysByWeekday = new Map<number, Date>();
    windowDays.forEach(d => {
      daysByWeekday.set(getWeekdayNumber(d), d);
    });

    const result = DAYS.map((day) => {
      const date = daysByWeekday.get(day.id);
      return {
        day: date?.getDate() || 0,
        month: (date?.getMonth() || 0) + 1,
        fullDate: date || new Date()
      };
    });

    console.log("[ADMIN CALENDAR] computed dates =", result.map(d => `${d.day}.${d.month}.`).join(', '));
    return result;
  }, []);

  useEffect(() => {
    async function loadBookings() {
      if (!trainerId) return;
      console.log("[FETCH LOOP CHECK] TrainerCalendar useEffect [trainerId, serviceType]");
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("bookings")
          .select("id, starts_at, client_name, booking_status")
          .eq("trainer_id", trainerId)
          .eq("service_type", serviceType)
          .in("booking_status", ["confirmed", "pending_payment"]);

        console.log("[FETCH AUDIT] TrainerCalendar = loadBookings");
        console.log("[FETCH AUDIT] table = bookings");
        console.log("[FETCH AUDIT] old select = *");
        console.log("[FETCH AUDIT] new select = id, starts_at, client_name, booking_status");

        if (error) throw error;
        setBookings((data as any) || []);
      } catch (err) {
        console.error("Chyba pri načítaní bookingov:", err);
      } finally {
        setLoading(false);
      }
    }
    loadBookings();
  }, [trainerId, serviceType]);

  const getBookingForSlot = (dayIdx: number, hour: number, minute: number = 0) => {
    const targetDate = weekDates[dayIdx].fullDate;
    if (!targetDate) return null;

    return bookings.find(b => {
      const date = new Date(b.starts_at);
      
      // Porovnanie konkrétneho dátumu (rok, mesiac, deň)
      const sameDate = 
        date.getFullYear() === targetDate.getFullYear() &&
        date.getMonth() === targetDate.getMonth() &&
        date.getDate() === targetDate.getDate();

      if (!sameDate) return false;
      
      const startH = date.getHours();
      const startM = date.getMinutes();
      return startH === hour && startM === minute;
    });
  };

  if (loading) return <div className="text-zinc-500 animate-pulse">Načítavam kalendár...</div>;

  const slotsPerHour = 60 / slotDurationMinutes;

  return (
    <div className="overflow-x-auto pb-4">
      <div className="min-w-[600px] grid grid-cols-[80px_repeat(7,1fr)] gap-2">
        {/* Header */}
        <div className="flex flex-col items-center justify-center font-bold text-[10px] text-zinc-600 uppercase tracking-widest border-b border-white/5 pb-2">
          <span>ČAS</span>
        </div>
        {DAYS.map((day, idx) => (
          <div key={day.id} className="flex flex-col items-center border-b border-white/5 pb-2">
            <span className="text-[10px] text-zinc-500 font-mono mb-0.5">
              {weekDates[idx].day}. {weekDates[idx].month}.
            </span>
            <span className="font-bold text-zinc-200 text-sm tracking-wider">{day.label}</span>
          </div>
        ))}

        {/* Grid */}
        {HOURS.map(hour => (
          <React.Fragment key={hour}>
            {Array.from({ length: slotsPerHour }).map((_, slotIdx) => {
              const minute = slotIdx * slotDurationMinutes;
              return (
                <React.Fragment key={`${hour}-${minute}`}>
                  <div className="flex items-center justify-center text-xs text-zinc-500 font-mono py-1">
                    {hour.toString().padStart(2, '0')}:{minute.toString().padStart(2, '0')}
                  </div>
                  {DAYS.map((day, dayIdx) => {
                    const booking = getBookingForSlot(dayIdx, hour, minute);
                    
                    return (
                      <div
                        key={`${day.id}-${hour}-${minute}`}
                        className={`h-12 rounded-lg border border-white/5 flex flex-col items-center justify-center p-1 text-[10px] transition-all ${
                          booking ? "bg-emerald-500/20 border-emerald-500/30" : "bg-zinc-900/40"
                        }`}
                      >
                        {booking && (
                          <div className="text-center w-full">
                            <p className="font-bold text-emerald-400 leading-tight truncate w-full px-1">
                              {booking.client_name || "Rezervované"}
                            </p>
                            <p className="text-[8px] text-zinc-500 uppercase tracking-tighter">
                              {booking.booking_status}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
