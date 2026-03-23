export type Trainer = {
  id: string;
  slug: string;
  name: string;
  specialties: string[];
  location: string;
};

export type Booking = {
  id: string;
  trainerId: string;
  userId: string;
  date: string; // ISO
  status: "planned" | "completed" | "canceled";
};

export type Payment = {
  id: string;
  userId: string;
  amountCents: number;
  currency: "EUR" | "CZK";
  createdAt: string; // ISO
  status: "paid" | "refunded" | "failed";
};
