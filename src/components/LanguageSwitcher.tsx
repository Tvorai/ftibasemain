"use client";
import { useI18n } from "@/providers/i18n";
import { Button } from "./Button";

export function LanguageSwitcher() {
  const { locale, setLocale, messages } = useI18n();
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-600">{messages.common.language}</span>
      <div className="flex gap-1">
        <Button
          size="sm"
          variant={locale === "sk" ? "primary" : "secondary"}
          onClick={() => setLocale("sk")}
        >
          SK
        </Button>
        <Button
          size="sm"
          variant={locale === "cs" ? "primary" : "secondary"}
          onClick={() => setLocale("cs")}
        >
          CS
        </Button>
      </div>
    </div>
  );
}
