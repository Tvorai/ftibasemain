import React from "react";
import { Container } from "./Container";

export function DashboardShell({ sidebar, children }: { sidebar: React.ReactNode; children: React.ReactNode }) {
  return (
    <Container className="py-6">
      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6">
        <aside className="md:block">{sidebar}</aside>
        <section>{children}</section>
      </div>
    </Container>
  );
}
