"use client";

import { useI18n } from "@/providers/i18n";

export default function PaymentsHistoryPage() {
  const { messages } = useI18n();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{messages.pages.payments.title}</h1>
      <div className="rounded-lg border p-4">Zoznam platieb (mock)</div>
    </div>
  );
}
