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

  useEffect(() => {
    async function loadBookings() {
      if (!trainerId) return;
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("bookings")
          .select("*")
          .eq("trainer_id", trainerId)
          .eq("service_type", serviceType)
          .in("booking_status", ["confirmed", "pending"]);

        if (error) throw error;
        setBookings(data || []);
      } catch (err) {
        console.error("Chyba pri načítaní bookingov:", err);
      } finally {
        setLoading(false);
      }
    }
    loadBookings();
  }, [trainerId, serviceType]);

  const getBookingForSlot = (dayId: number, hour: number, minute: number = 0) => {
    return bookings.find(b => {
      const date = new Date(b.starts_at);
      let jsDay = date.getDay(); // 0-6 (Sun-Sat)
      
      // Mapovanie JS dňa na ID (1-7)
      const currentDayId = jsDay === 0 ? 7 : jsDay;
      
      const startH = date.getHours();
      const startM = date.getMinutes();
      return currentDayId === dayId && startH === hour && startM === minute;
    });
  };

  if (loading) return <div className="text-zinc-500 animate-pulse">Načítavam kalendár...</div>;

  const slotsPerHour = 60 / slotDurationMinutes;

  return (
    <div className="overflow-x-auto pb-4">
      <div className="min-w-[600px] grid grid-cols-[80px_repeat(7,1fr)] gap-2">
        {/* Header */}
        <div className="flex items-center justify-center font-bold text-[10px] text-zinc-500 uppercase tracking-widest">Čas</div>
        {DAYS.map(day => (
          <div key={day.id} className="flex flex-col items-center py-2">
            <span className="font-bold text-zinc-200">{day.label}</span>
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
                  {DAYS.map(day => {
                    const booking = getBookingForSlot(day.id, hour, minute);
                    
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
