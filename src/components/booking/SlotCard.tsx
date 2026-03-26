
import React from 'react';
import { AvailableSlot } from '@/lib/booking/getAvailableSlots';

interface SlotCardProps {
  slot: AvailableSlot;
  isSelected: boolean;
  onSelect: (slot: AvailableSlot) => void;
}

const SlotCard: React.FC<SlotCardProps> = ({
  slot,
  isSelected,
  onSelect,
}) => {
  const startTime = new Date(slot.starts_at).toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' });
  const endTime = new Date(slot.ends_at).toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' });

  return (
    <button
      type="button"
      onClick={() => onSelect(slot)}
      className={`p-4 border rounded-[15px] shadow-sm text-center transition-all duration-200
        ${isSelected 
          ? 'bg-emerald-500 text-black border-emerald-400 scale-105 font-bold' 
          : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:border-emerald-500/50 hover:bg-zinc-700'}
      `}
    >
      <p className="text-lg leading-none">{startTime} - {endTime}</p>
      <p className={`text-[10px] mt-1 uppercase tracking-widest ${isSelected ? 'text-black/70' : 'text-zinc-500'}`}>
        {new Date(slot.starts_at).toLocaleDateString('sk-SK', { weekday: 'short', month: 'short', day: 'numeric' })}
      </p>
    </button>
  );
};

export default SlotCard;
