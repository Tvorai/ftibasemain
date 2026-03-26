"use client";

import React, { useEffect, useState } from "react";
import { AvailableSlot } from "@/lib/booking/getAvailableSlots";
import SlotCard from "./SlotCard";

interface TrainerCalendarProps {
  trainerId: string;
}

export default function TrainerCalendar({ trainerId }: TrainerCalendarProps) {
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSlots() {
      setLoading(true);
      try {
        const res = await fetch(`/api/public-trainer/slots?trainerId=${trainerId}`);
        const data = await res.json();
        if (data.ok) {
          setSlots(data.slots);
        } else {
          setError(data.message);
        }
      } catch (err) {
        setError("Nepodarilo sa načítať voľné termíny.");
      } finally {
        setLoading(false);
      }
    }

    if (trainerId) {
      fetchSlots();
    }
  }, [trainerId]);

  if (loading) return <div className="text-zinc-500 animate-pulse">Načítavam kalendár...</div>;
  if (error) return <div className="text-red-400">Chyba: {error}</div>;

  // Group slots by date
  const groupedSlots = slots.reduce((acc, slot) => {
    const date = new Date(slot.starts_at).toLocaleDateString("sk-SK", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    if (!acc[date]) acc[date] = [];
    acc[date].push(slot);
    return acc;
  }, {} as Record<string, AvailableSlot[]>);

  return (
    <div className="space-y-8">
      {Object.entries(groupedSlots).map(([date, daySlots]) => (
        <div key={date} className="space-y-3">
          <h3 className="text-lg font-bold text-emerald-400 sticky top-0 bg-black/80 backdrop-blur-sm py-2 z-10 uppercase tracking-wider">
            {date}
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {daySlots.map((slot) => (
              <SlotCard
                key={slot.starts_at}
                slot={slot}
                isSelected={false}
                onSelect={() => {}} // Read-only view for trainer
              />
            ))}
          </div>
        </div>
      ))}
      {slots.length === 0 && (
        <p className="text-zinc-500 italic">Nemáte nastavené žiadne voľné termíny.</p>
      )}
    </div>
  );
}
