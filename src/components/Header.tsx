"use client";

import Link from "next/link";
import { Container } from "./Container";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { useI18n } from "@/providers/i18n";

export function Header() {
  const { messages } = useI18n();
  return (
    <header className="border-b bg-white">
      <Container className="flex h-14 items-center justify-between">
        <Link href="/" className="font-bold text-brand">
          {messages.common.brand}
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          <Link href="/ucet" className="hover:text-brand">
            {messages.common.menu.userDashboard}
          </Link>
          <Link href="/ucet-trenera" className="hover:text-brand">
            {messages.common.menu.trainerDashboard}
          </Link>
          <Link href="/historia-rezervacii" className="hover:text-brand">
            {messages.common.menu.bookings}
          </Link>
          <Link href="/historia-platieb" className="hover:text-brand">
            {messages.common.menu.payments}
          </Link>
          <Link href="/nadstavenia" className="hover:text-brand">
            {messages.common.menu.settings}
          </Link>
          <LanguageSwitcher />
        </nav>
      </Container>
    </header>
  );
}
