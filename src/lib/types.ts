export type Trainer = {
  id: string;
  slug: string;
  name: string;
  specialties: string[];
  location: string;
};

// Doplnený typ Slot
export type Slot = {
  id: string;
  start_time: string; // ISO string pre začiatok slotu (napr. "2024-03-25T09:00:00Z")
  end_time: string;   // ISO string pre koniec slotu (napr. "2024-03-25T10:00:00Z")
  is_available: boolean; // Indikátor dostupnosti slotu
  trainer_id: string; // ID trénera, ktorému slot patrí
  // Ďalšie relevantné polia, ak existujú v DB tabuľke 'slots'
};

// Nové typy pre statusy rezervácie a platby (upravené podľa existujúcej DB schémy bookings)
export type BookingStatus = "pending" | "pending_payment" | "confirmed" | "cancelled";

export type Booking = {
  id: string;
  trainer_id: string; // ID trénera
  client_profile_id: string; // ID profilu klienta
  service_id: string; // ID služby
  booking_status: BookingStatus; // Status rezervácie
  starts_at: string; // ISO string začiatku rezervácie
  ends_at: string; // ISO string konca rezervácie
  client_note: string | null; // Poznámka od klienta
  trainer_note: string | null; // Poznámka od trénera
  cancelled_by: string | null; // ID toho, kto rezerváciu zrušil
  cancelled_reason: string | null; // Dôvod zrušenia
  created_at: string; // ISO string dátumu vytvorenia
  updated_at: string; // ISO string dátumu poslednej aktualizácie
};

export type Payment = {
  id: string;
  userId: string;
  amountCents: number;
  currency: "EUR" | "CZK";
  createdAt: string; // ISO
  status: "paid" | "refunded" | "failed"; // Pridaný status platby
};