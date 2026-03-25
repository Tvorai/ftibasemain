
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
      className={`p-4 border rounded-lg shadow-sm text-center transition-colors duration-200
        ${isSelected ? 'bg-blue-500 text-white border-blue-600' : 'bg-white text-gray-800 border-gray-300 hover:bg-gray-50'}
      `}
    >
      <p className="font-medium">{startTime} - {endTime}</p>
      <p className="text-sm opacity-80">{new Date(slot.starts_at).toLocaleDateString('sk-SK', { weekday: 'short', month: 'short', day: 'numeric' })}</p>
    </button>
  );
};

export default SlotCard;
