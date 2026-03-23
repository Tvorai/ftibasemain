"use client";

import { useI18n } from "@/providers/i18n";

export default function BookingHistoryPage() {
  const { messages } = useI18n();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{messages.pages.bookings.title}</h1>
      <div className="rounded-lg border p-4">Zoznam rezervácií (mock)</div>
    </div>
  );
}
