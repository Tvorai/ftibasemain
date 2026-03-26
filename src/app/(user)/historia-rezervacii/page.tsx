"use client";

import Link from "next/link";
import { useI18n } from "@/providers/i18n";

export default function BookingHistoryPage() {
  const { messages } = useI18n();
  return (
    <div className="min-h-screen bg-black text-white p-6 space-y-4">
      <Link href="/ucet" className="inline-flex text-sm text-emerald-400 hover:text-emerald-300">
        ← Späť na účet
      </Link>
      <h1 className="text-3xl font-display uppercase tracking-wider">{messages.pages.bookings.title}</h1>
      <div className="rounded-2xl border border-emerald-500/60 p-5 text-white/80">
        Zoznam rezervácií (mock)
      </div>
    </div>
  );
}
