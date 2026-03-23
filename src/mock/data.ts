import type { Booking, Payment, Trainer } from "@/lib/types";

export const trainers: Trainer[] = [
  { id: "t1", slug: "john-doe", name: "John Doe", specialties: ["silový tréning", "kondícia"], location: "Bratislava" },
  { id: "t2", slug: "jana-nova", name: "Jana Nová", specialties: ["yoga", "mobilita"], location: "Praha" }
];

export const bookings: Booking[] = [
  { id: "b1", trainerId: "t1", userId: "u1", date: "2026-03-25T10:00:00Z", status: "planned" },
  { id: "b2", trainerId: "t2", userId: "u1", date: "2026-03-18T14:00:00Z", status: "completed" }
];

export const payments: Payment[] = [
  { id: "p1", userId: "u1", amountCents: 2500, currency: "EUR", createdAt: "2026-03-18T14:30:00Z", status: "paid" },
  { id: "p2", userId: "u1", amountCents: 5000, currency: "CZK", createdAt: "2026-03-01T12:00:00Z", status: "paid" }
];
