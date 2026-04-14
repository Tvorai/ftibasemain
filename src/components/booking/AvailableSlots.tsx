
'use client';

import React, { useState, useEffect } from 'react';
import SlotCard from './SlotCard';
import { AvailableSlot } from '@/lib/booking/getAvailableSlots';

interface AvailableSlotsProps {
  trainerId: string;
  onSlotSelect?: (slot: AvailableSlot) => void;
  selectedSlot?: AvailableSlot | null;
  serviceType?: "personal" | "online";
  slotDuration?: number;
}

const AvailableSlots: React.FC<AvailableSlotsProps> = ({ 
  trainerId, 
  onSlotSelect,
  selectedSlot: externalSelectedSlot,
  serviceType = "personal",
  slotDuration = 60
}) => {
  const maxSlots = 250;
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [internalSelectedSlot, setInternalSelectedSlot] = useState<AvailableSlot | null>(null);
  const [selectedDayKey, setSelectedDayKey] = useState<string>('');

  const selectedSlot = externalSelectedSlot !== undefined ? externalSelectedSlot : internalSelectedSlot;

  // Debug logy pre zosúladenie s adminom
  useEffect(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const windowDays = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      d.setDate(now.getDate() + i);
      return d;
    });
    const getWeekdayNumber = (date: Date): number => {
      const js = date.getDay(); // 0=Sun..6=Sat
      return js === 0 ? 7 : js; // 1=Mon..7=Sun
    };
    const daysByWeekday = windowDays.reduce((acc, d) => {
      acc.set(getWeekdayNumber(d), d);
      return acc;
    }, new Map<number, Date>());
    const daysArr = Array.from({ length: 7 }, (_, i) => daysByWeekday.get(i + 1)).filter(
      (d): d is Date => Boolean(d)
    );

    console.log("[BOOKING FORM] today =", today.toLocaleDateString('sk-SK'));
    console.log("[BOOKING FORM] computed dates =", daysArr.map(d => `${d.getDate()}.${d.getMonth() + 1}.`).join(', '));
  }, []);

  const formatDayKey = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getDayLabel = (date: Date): string => {
    const raw = date.toLocaleDateString('sk-SK', { weekday: 'long' });
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  };

  const formatDayMonth = (date: Date): string => {
    return `${date.getDate()}.${date.getMonth() + 1}.`;
  };

  const isAvailableSlot = (value: unknown): value is AvailableSlot => {
    if (typeof value !== 'object' || value === null) return false;
    const v = value as Record<string, unknown>;
    return (
      typeof v.trainer_id === 'string' &&
      typeof v.starts_at === 'string' &&
      typeof v.ends_at === 'string' &&
      typeof v.source_availability_slot_id === 'string'
    );
  };

  useEffect(() => {
    const fetchSlots = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/public-trainer/slots?trainerId=${trainerId}&serviceType=${serviceType}&slotDuration=${slotDuration}&maxSlots=${maxSlots}`
        );
        if (res.ok) {
          const payload: unknown = await res.json();
          const parsed = Array.isArray(payload) ? payload.filter(isAvailableSlot) : [];
          setSlots(parsed);
        } else {
          const errorData = await res.json();
          setError(errorData.message || 'Nepodarilo sa načítať voľné termíny.');
        }
      } catch (err) {
        setError('Chyba pri komunikácii so serverom.');
      } finally {
        setLoading(false);
      }
    };

    if (trainerId) {
      fetchSlots();
    }
  }, [trainerId, serviceType, slotDuration]);

  useEffect(() => {
    if (slots.length === 0) return;
    const now = new Date();
    const todayKey = formatDayKey(now);
    const keysWithSlots = new Set(slots.map((s) => formatDayKey(new Date(s.starts_at))));
    if (keysWithSlots.has(todayKey)) {
      setSelectedDayKey(todayKey);
      return;
    }

    const firstKey = Array.from(keysWithSlots).sort()[0];
    setSelectedDayKey(firstKey || todayKey);
  }, [slots]);

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

  const now = new Date();
  const rangeStart = now;
  const rangeEnd = new Date(now);
  rangeEnd.setDate(now.getDate() + 6);

  const windowDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    d.setDate(now.getDate() + i);
    return d;
  });

  const getWeekdayNumber = (date: Date): number => {
    const js = date.getDay(); // 0=Sun..6=Sat
    return js === 0 ? 7 : js; // 1=Mon..7=Sun
  };

  const daysByWeekday = windowDays.reduce((acc, d) => {
    acc.set(getWeekdayNumber(d), d);
    return acc;
  }, new Map<number, Date>());

  const days = Array.from({ length: 7 }, (_, i) => daysByWeekday.get(i + 1)).filter(
    (d): d is Date => Boolean(d)
  );

  const slotsByDayKey = slots.reduce((acc, slot) => {
    const key = formatDayKey(new Date(slot.starts_at));
    const list = acc.get(key) || [];
    list.push(slot);
    acc.set(key, list);
    return acc;
  }, new Map<string, AvailableSlot[]>());

  const activeDayKey = selectedDayKey || formatDayKey(now);
  const activeSlots = (slotsByDayKey.get(activeDayKey) || []).slice().sort((a, b) => {
    return new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime();
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-2">
        <p className="text-sm text-zinc-300 font-semibold">Vyberte si deň a čas</p>
        <p className="text-xs text-zinc-500 font-bold tracking-widest uppercase">
          {formatDayMonth(rangeStart)} - {formatDayMonth(rangeEnd)}
        </p>
      </div>

      <div className="flex gap-5 overflow-x-auto pb-2 -mx-2 px-2">
        {days.map((day) => {
          const key = formatDayKey(day);
          const isActive = key === activeDayKey;
          const hasSlots = (slotsByDayKey.get(key)?.length || 0) > 0;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setSelectedDayKey(key)}
              className={`whitespace-nowrap font-bold transition-colors ${
                isActive ? 'text-emerald-400' : 'text-zinc-300 hover:text-white'
              } ${!hasSlots ? 'opacity-40' : ''}`}
            >
              {getDayLabel(day)}
            </button>
          );
        })}
      </div>

      <div className="max-h-[52vh] overflow-y-auto pr-2">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {activeSlots.map((slot) => (
            <SlotCard
              key={slot.source_availability_slot_id + slot.starts_at}
              slot={slot}
              isSelected={selectedSlot?.starts_at === slot.starts_at}
              onSelect={handleSlotSelect}
            />
          ))}
        </div>
        {activeSlots.length === 0 && (
          <div className="text-center py-6 text-zinc-500">
            Pre tento deň nie sú dostupné žiadne termíny.
          </div>
        )}
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
