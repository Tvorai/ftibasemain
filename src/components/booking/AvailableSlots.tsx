
'use client';

import React, { useState, useEffect } from 'react';
import SlotCard from './SlotCard';
import { getAvailableSlots, AvailableSlot } from '@/lib/booking/getAvailableSlots';

interface AvailableSlotsProps {
  trainerId: string;
}

const AvailableSlots: React.FC<AvailableSlotsProps> = ({ trainerId }) => {
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);

  useEffect(() => {
    const fetchSlots = async () => {
      setLoading(true);
      setError(null);
      try {
        // Assuming getAvailableSlots can take trainerId as an argument if it's not globally available
        const fetchedSlots = await getAvailableSlots(trainerId);
        if (fetchedSlots) {
          setSlots(fetchedSlots);
        } else {
          setSlots([]);
        }
      } catch (err) {
        console.error("Failed to fetch available slots:", err);
        setError("Nepodarilo sa načítať dostupné sloty. Skúste to prosím neskôr.");
      } finally {
        setLoading(false);
      }
    };

    fetchSlots();
  }, [trainerId]);

  const handleSlotSelect = (slot: AvailableSlot) => {
    setSelectedSlot(slot);
    // In a real scenario, you might want to pass this selected slot up to a parent component
    // or trigger some other action, but for now, we just update the local state.
  };

  if (loading) {
    return <div className="text-center py-8">Načítavam dostupné sloty...</div>;
  }

  if (error) {
    return <div className="text-center py-8 text-red-500">Chyba: {error}</div>;
  }

  if (slots.length === 0) {
    return <div className="text-center py-8">Pre tohto trénera nie sú dostupné žiadne sloty.</div>;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Dostupné časy</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {slots.map((slot) => (
          <SlotCard
            key={slot.id + new Date(slot.start_time).toISOString()} // Use slot ID and actual start time for unique key
            slot={slot}
            isSelected={selectedSlot?.id === slot.id && selectedSlot?.start_time === slot.start_time}
            onSelect={handleSlotSelect}
          />
        ))}
      </div>
      {selectedSlot && (
        <div className="mt-4 p-4 bg-green-100 border border-green-300 rounded-lg">
          Vybraný slot: {new Date(selectedSlot.start_time).toLocaleString('sk-SK', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })} - {new Date(selectedSlot.end_time).toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' })}
        </div>
      )}
    </div>
  );
};

export default AvailableSlots;
