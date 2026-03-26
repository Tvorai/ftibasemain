"use client";

import React, { useEffect, useState } from "react";
import { Booking } from "@/lib/types";
import { createClient } from "@supabase/supabase-js";
import { supabaseUrl, supabaseAnonKey } from "@/lib/config";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface TrainerBookingsProps {
  trainerId: string;
}

export default function TrainerBookings({ trainerId }: TrainerBookingsProps) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchBookings() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("bookings")
          .select("*")
          .eq("trainer_id", trainerId)
          .order("starts_at", { ascending: true });

        if (error) throw error;
        setBookings(data || []);
      } catch (err: any) {
        setError("Nepodarilo sa načítať rezervácie.");
      } finally {
        setLoading(false);
      }
    }

    if (trainerId) {
      fetchBookings();
    }
  }, [trainerId]);

  if (loading) return <div className="text-zinc-500 animate-pulse">Načítavam rezervácie...</div>;
  if (error) return <div className="text-red-400">Chyba: {error}</div>;

  return (
    <div className="space-y-4">
      {bookings.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/50">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-800/80 text-zinc-400 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-6 py-4">Meno klienta</th>
                <th className="px-6 py-4">Termín</th>
                <th className="px-6 py-4">Kontakt</th>
                <th className="px-6 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {bookings.map((booking) => (
                <tr key={booking.id} className="hover:bg-zinc-800/30 transition-colors">
                  <td className="px-6 py-4 font-medium text-white">
                    {booking.client_name || "Bez mena"}
                  </td>
                  <td className="px-6 py-4 text-zinc-300">
                    <div className="font-bold">
                      {new Date(booking.starts_at).toLocaleDateString("sk-SK")}
                    </div>
                    <div className="text-[10px] text-zinc-500">
                      {new Date(booking.starts_at).toLocaleTimeString("sk-SK", { hour: "2-digit", minute: "2-digit" })} - {new Date(booking.ends_at).toLocaleTimeString("sk-SK", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-zinc-400">
                    <div>{booking.client_email}</div>
                    {booking.client_phone && <div className="text-xs opacity-60">{booking.client_phone}</div>}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                      booking.booking_status === "confirmed" ? "bg-emerald-500/20 text-emerald-500" :
                      booking.booking_status === "pending" ? "bg-yellow-500/20 text-yellow-500" :
                      "bg-zinc-700/50 text-zinc-400"
                    }`}>
                      {booking.booking_status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-zinc-500 italic">Zatiaľ nemáte žiadne rezervácie.</p>
      )}
    </div>
  );
}
