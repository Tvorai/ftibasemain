import "@/app/globals.css";
import type { Metadata } from "next";
import { I18nProvider } from "@/providers/i18n";
import { AppShell } from "@/components/AppShell";

export const metadata: Metadata = {
  title: "Fitbase",
  description: "Platforma pre trénerov a klientov - mobile-first, i18n-ready",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000")
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sk">
      <body>
        <I18nProvider>
          <AppShell>{children}</AppShell>
        </I18nProvider>
      </body>
    </html>
  );
}
