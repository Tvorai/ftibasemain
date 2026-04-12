import "@/app/globals.css";
import type { Metadata } from "next";
import { I18nProvider } from "@/providers/i18n";
import { AppShell } from "@/components/AppShell";
import { siteUrl } from "@/lib/config";
import CookieBanner from "@/components/cookies/CookieBanner";

export const metadata: Metadata = {
  title: "Fitbase",
  description: "Platforma pre trénerov a klientov - mobile-first, i18n-ready",
  metadataBase: new URL(siteUrl),
  icons: {
    icon: "/simplelogo.png",
    apple: "/simplelogo.png",
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sk">
      <body>
        <I18nProvider>
          <AppShell>{children}</AppShell>
          <CookieBanner />
        </I18nProvider>
      </body>
    </html>
  );
}
