"use client";

import { useI18n } from "@/providers/i18n";

export default function TrainerDashboardPage() {
  const { messages } = useI18n();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{messages.pages.trainerDashboard.title}</h1>
      <p className="text-gray-600">{messages.pages.trainerDashboard.description}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-lg border p-4">Widget: kalendár</div>
        <div className="rounded-lg border p-4">Widget: klienti</div>
      </div>
    </div>
  );
}
