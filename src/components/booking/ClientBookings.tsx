"use client";

import React, { useEffect, useState } from "react";
import { Booking } from "@/lib/types";
import { createClient } from "@supabase/supabase-js";
import { supabaseUrl, supabaseAnonKey } from "@/lib/config";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface ClientBookingsProps {
  userId: string;
}

export default function ClientBookings({ userId }: ClientBookingsProps) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchBookings() {
      setLoading(true);
      try {
        // Find bookings by client_profile_id or client_email (if we had it, but here profile_id is better)
        const { data, error } = await supabase
          .from("bookings")
          .select("*, trainers(profiles(full_name, email))")
          .eq("client_profile_id", userId)
          .order("starts_at", { ascending: false });

        if (error) throw error;
        setBookings(data || []);
      } catch (err: any) {
        setError("Nepodarilo sa načítať vaše služby.");
      } finally {
        setLoading(false);
      }
    }

    if (userId) {
      fetchBookings();
    }
  }, [userId]);

  if (loading) return <div className="text-zinc-500 animate-pulse">Načítavam služby...</div>;
  if (error) return <div className="text-red-400 text-sm">Chyba: {error}</div>;

  return (
    <div className="space-y-4">
      {bookings.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {bookings.map((booking) => (
            <div key={booking.id} className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/40 backdrop-blur-sm group hover:border-emerald-500/30 transition-all">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-1">Tréner</p>
                  <p className="text-lg font-bold text-white group-hover:text-emerald-400 transition-colors">
                    {(booking as any).trainers?.profiles?.full_name || "Neznámy tréner"}
                  </p>
                </div>
                <span className={`px-2 py-1 rounded-full text-[9px] font-bold uppercase ${
                  booking.booking_status === "confirmed" ? "bg-emerald-500/20 text-emerald-500" : "bg-zinc-800 text-zinc-500"
                }`}>
                  {booking.booking_status}
                </span>
              </div>
              
              <div className="space-y-3 pt-4 border-t border-zinc-800/50">
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-emerald-500">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-bold text-zinc-200">{new Date(booking.starts_at).toLocaleDateString("sk-SK")}</p>
                    <p className="text-xs text-zinc-500">
                      {new Date(booking.starts_at).toLocaleTimeString("sk-SK", { hour: "2-digit", minute: "2-digit" })} - {new Date(booking.ends_at).toLocaleTimeString("sk-SK", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-sm">
                  <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-emerald-500">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <p className="text-zinc-400">{(booking as any).trainers?.profiles?.email || "Bez kontaktu"}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-zinc-500 italic text-center py-10">Zatiaľ ste si nezarezervovali žiadne služby.</p>
      )}
    </div>
  );
}
