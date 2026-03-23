"use client";

import { Container } from "@/components/Container";
import { useI18n } from "@/providers/i18n";

export default function TrainerProfilePage({ params }: { params: { trainerSlug: string } }) {
  const { messages } = useI18n();
  return (
    <Container className="py-6 space-y-4">
      <h1 className="text-2xl font-semibold">{messages.pages.trainerProfile.title}</h1>
      <p className="text-gray-600">{messages.pages.trainerProfile.description}</p>
      <div className="rounded-lg border p-4">
        <div className="text-sm text-gray-500">Slug:</div>
        <div className="font-mono">{params.trainerSlug}</div>
      </div>
    </Container>
  );
}
