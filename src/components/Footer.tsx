"use client";

import { Container } from "./Container";
import { useI18n } from "@/providers/i18n";

export function Footer() {
  const { messages } = useI18n();
  return (
    <footer className="border-t border-zinc-800 bg-black text-white">
      <Container className="py-6 text-center text-sm text-zinc-400">
        © {new Date().getFullYear()} {messages.common.brand}
      </Container>
    </footer>
  );
}
