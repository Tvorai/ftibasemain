"use client";

import { usePathname } from "next/navigation";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideChrome =
    pathname === "/registrácia-trénera" ||
    pathname === "/registracia-trenera" ||
    pathname === "/registr%C3%A1cia-tr%C3%A9nera";

  if (hideChrome) {
    return <main>{children}</main>;
  }

  return (
    <>
      <Header />
      <main className="min-h-[60vh]">{children}</main>
      <Footer />
    </>
  );
}
