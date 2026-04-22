"use client";

import { usePathname } from "next/navigation";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ImpersonationBanner } from "@/components/admin/ImpersonationBanner";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const reservedRoutes = new Set([
    "/",
    "/ucet",
    "/ucet-trenera",
    "/nadstavenia",
    "/historia-rezervacii",
    "/historia-platieb",
    "/prihlasenie",
    "/registracia",
    "/roadmap",
    "/prihlasenie-trenera",
    "/prihlásenie-trénera",
    "/prihl%C3%A1senie-tr%C3%A9nera",
    "/registracia-trenera",
    "/registrácia-trénera",
    "/registr%C3%A1cia-tr%C3%A9nera",
  ]);

  const isSingleSegmentPath =
    pathname !== "/" && pathname.split("/").filter(Boolean).length === 1;

  const isPublicTrainerProfile = isSingleSegmentPath && !reservedRoutes.has(pathname);

  const hideChrome =
    pathname === "/" ||
    pathname === "/roadmap" ||
    pathname === "/prihlasenie" ||
    pathname === "/registracia" ||
    pathname === "/registrácia-trénera" ||
    pathname === "/registracia-trenera" ||
    pathname === "/registr%C3%A1cia-tr%C3%A9nera" ||
    pathname === "/prihlásenie-trénera" ||
    pathname === "/prihlasenie-trenera" ||
    pathname === "/prihl%C3%A1senie-tr%C3%A9nera" ||
    pathname === "/ucet" ||
    pathname === "/ucet-trenera" ||
    pathname === "/nadstavenia" ||
    pathname === "/historia-rezervacii" ||
    pathname === "/historia-platieb" ||
    isPublicTrainerProfile;

  if (hideChrome) {
    return (
      <>
        <ImpersonationBanner />
        <main>{children}</main>
      </>
    );
  }

  return (
    <>
      <ImpersonationBanner />
      <Header />
      <main className="min-h-[60vh]">{children}</main>
      <Footer />
    </>
  );
}
