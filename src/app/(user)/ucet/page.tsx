"use client";

import { useI18n } from "@/providers/i18n";

export default function UserDashboardPage() {
  const { messages } = useI18n();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{messages.pages.userDashboard.title}</h1>
      <p className="text-gray-600">{messages.pages.userDashboard.description}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-lg border p-4">Widget: prehľad tréningov</div>
        <div className="rounded-lg border p-4">Widget: nadchádzajúce rezervácie</div>
      </div>
    </div>
  );
}
