
'use client';

import React, { useState, useEffect } from 'react';
import SlotCard from './SlotCard';
import { getAvailableSlots, AvailableSlot } from '@/lib/booking/getAvailableSlots';

interface AvailableSlotsProps {
  trainerId: string;
  onSlotSelect?: (slot: AvailableSlot) => void;
  selectedSlot?: AvailableSlot | null;
}

const AvailableSlots: React.FC<AvailableSlotsProps> = ({ 
  trainerId, 
  onSlotSelect,
  selectedSlot: externalSelectedSlot 
}) => {
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [internalSelectedSlot, setInternalSelectedSlot] = useState<AvailableSlot | null>(null);

  const selectedSlot = externalSelectedSlot !== undefined ? externalSelectedSlot : internalSelectedSlot;

  useEffect(() => {
    const fetchSlots = async () => {
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
        setError('Nepodarilo sa načítať voľné termíny.');
      } finally {
        setLoading(false);
      }
    };

    if (trainerId) {
      fetchSlots();
    }
  }, [trainerId]);

  const handleSlotSelect = (slot: AvailableSlot) => {
    if (onSlotSelect) {
      onSlotSelect(slot);
    } else {
      setInternalSelectedSlot(slot);
    }
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
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {slots.map((slot) => (
          <SlotCard
            key={slot.source_availability_slot_id + slot.starts_at} // Kombinácia pre unikátny kľúč
            slot={slot}
            isSelected={selectedSlot?.starts_at === slot.starts_at}
            onSelect={handleSlotSelect}
          />
        ))}
      </div>
      
      {selectedSlot && (
        <div className="mt-2 text-center animate-in fade-in slide-in-from-bottom-2 duration-300">
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-2 font-bold">Vybraný termín:</p>
          <div className="inline-block px-6 py-2 bg-emerald-500/10 border border-emerald-500/50 rounded-full text-emerald-400 font-bold">
            {new Date(selectedSlot.starts_at).toLocaleString('sk-SK', { 
              weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' 
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default AvailableSlots;
