export type Trainer = {
  id: string;
  slug: string;
  name: string;
  specialties: string[];
  location: string;
};

// Doplnený typ Slot pre availability_slots tabuľku
export type Slot = {
  id: string;
  trainer_id: string;
  day_of_week: number; // smallint v DB, TypeScript number
  start_time: string; // time v DB, tu string (napr. "09:00:00")
  end_time: string;   // time v DB, tu string (napr. "10:00:00")
  is_active: boolean; // Indikátor aktivity slotu
  created_at: string; // ISO string
  updated_at: string; // ISO string
};

// Nové typy pre statusy rezervácie a platby (upravené podľa existujúcej DB schémy bookings)
export type BookingStatus = "pending" | "pending_payment" | "confirmed" | "cancelled";
export type PaymentStatus = "unpaid" | "paid" | "failed" | "refunded";

export type Booking = {
  id: string;
  slot_id: string; // ID slotu (z availability_slots alebo manuálne vytvorený)
  admin_id: string; // ID trénera/admina
  client_name: string;
  client_email: string;
  client_phone: string | null;
  note: string | null;
  starts_at: string; // ISO string
  ends_at: string; // ISO string
  status: BookingStatus;
  payment_status: PaymentStatus;
  created_at: string; // ISO string
  updated_at: string; // ISO string
};

export type Payment = {
  id: string;
  userId: string;
  amountCents: number;
  currency: "EUR" | "CZK";
  createdAt: string; // ISO
  status: "paid" | "refunded" | "failed"; // Pridaný status platby
};