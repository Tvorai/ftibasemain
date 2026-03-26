"use client";

import Link from "next/link";
import { Container } from "@/components/Container";
import { useI18n } from "@/providers/i18n";

export default function HomePage() {
  const { messages } = useI18n();
  return (
    <Container className="py-8 space-y-4 text-white">
      <h1 className="text-3xl font-display uppercase tracking-wider">{messages.common.brand}</h1>
      <p className="text-zinc-400">Vyberte stránku:</p>
      <div className="flex flex-col gap-2">
        <Link href="/ucet" className="text-emerald-400 hover:text-emerald-300">
          {messages.common.menu.userDashboard}
        </Link>
        <Link href="/ucet-trenera" className="text-emerald-400 hover:text-emerald-300">
          {messages.common.menu.trainerDashboard}
        </Link>
        <Link href="/historia-rezervacii" className="text-emerald-400 hover:text-emerald-300">
          {messages.common.menu.bookings}
        </Link>
        <Link href="/historia-platieb" className="text-emerald-400 hover:text-emerald-300">
          {messages.common.menu.payments}
        </Link>
        <Link href="/nadstavenia" className="text-emerald-400 hover:text-emerald-300">
          {messages.common.menu.settings}
        </Link>
        <Link href="/john-doe" className="text-emerald-400 hover:text-emerald-300">
          /[trainerSlug] príklad
        </Link>
      </div>
    </Container>
  );
}
