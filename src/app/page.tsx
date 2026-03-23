"use client";

import Link from "next/link";
import { Container } from "@/components/Container";
import { useI18n } from "@/providers/i18n";

export default function HomePage() {
  const { messages } = useI18n();
  return (
    <Container className="py-8 space-y-4">
      <h1 className="text-2xl font-semibold">{messages.common.brand}</h1>
      <p className="text-gray-600">Vyberte stránku:</p>
      <div className="flex flex-col gap-2">
        <Link href="/ucet" className="text-brand hover:underline">
          {messages.common.menu.userDashboard}
        </Link>
        <Link href="/ucet-trenera" className="text-brand hover:underline">
          {messages.common.menu.trainerDashboard}
        </Link>
        <Link href="/historia-rezervacii" className="text-brand hover:underline">
          {messages.common.menu.bookings}
        </Link>
        <Link href="/historia-platieb" className="text-brand hover:underline">
          {messages.common.menu.payments}
        </Link>
        <Link href="/nadstavenia" className="text-brand hover:underline">
          {messages.common.menu.settings}
        </Link>
        <Link href="/john-doe" className="text-brand hover:underline">
          /[trainerSlug] príklad
        </Link>
      </div>
    </Container>
  );
}
