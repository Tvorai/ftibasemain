"use client";

import { useI18n } from "@/providers/i18n";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export default function SettingsPage() {
  const { messages } = useI18n();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{messages.pages.settings.title}</h1>
      <div className="rounded-lg border p-4 space-y-2">
        <div className="text-sm text-gray-600">{messages.pages.settings.languageLabel}</div>
        <LanguageSwitcher />
      </div>
    </div>
  );
}
