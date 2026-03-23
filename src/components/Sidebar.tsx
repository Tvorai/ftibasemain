"use client";

import Link from "next/link";
import { useI18n } from "@/providers/i18n";

export function UserSidebar() {
  const { messages } = useI18n();
  return (
    <nav className="flex md:flex-col gap-2 text-sm">
      <Link href="/ucet" className="hover:text-brand">
        {messages.common.menu.userDashboard}
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
    </nav>
  );
}

export function TrainerSidebar() {
  const { messages } = useI18n();
  return (
    <nav className="flex md:flex-col gap-2 text-sm">
      <Link href="/ucet-trenera" className="hover:text-brand">
        {messages.common.menu.trainerDashboard}
      </Link>
      <Link href="/nadstavenia" className="hover:text-brand">
        {messages.common.menu.settings}
      </Link>
    </nav>
  );
}
