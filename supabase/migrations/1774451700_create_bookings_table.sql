-- create_bookings_table.sql

-- Zabezpečí dostupnosť gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Definovanie vlastných typov ENUM pre statusy rezervácie a platby
CREATE TYPE booking_status_enum AS ENUM ('pending', 'pending_payment', 'confirmed', 'cancelled');
CREATE TYPE payment_status_enum AS ENUM ('unpaid', 'paid', 'failed', 'refunded');

-- Vytvorenie tabuľky 'bookings'
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), -- Používame gen_random_uuid() pre bezpečné UUID
  slot_id UUID NOT NULL, -- UUID slotu, ku ktorému sa rezervácia vzťahuje
  admin_id UUID NOT NULL, -- UUID trénera/admina, ktorý rezerváciu spravuje
  client_name TEXT NOT NULL,
  client_email TEXT NOT NULL,
  client_phone TEXT, -- Voliteľné pole
  note TEXT, -- Voliteľná poznámka
  starts_at TIMESTAMP WITH TIME ZONE NOT NULL, -- Začiatok rezervácie
  ends_at TIMESTAMP WITH TIME ZONE NOT NULL, -- Koniec rezervácie
  status booking_status_enum NOT NULL DEFAULT 'pending', -- Predvolený status
  payment_status payment_status_enum NOT NULL DEFAULT 'unpaid', -- Predvolený status platby
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), -- Automatické nastavenie pri vytvorení
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() -- Automatické nastavenie pri vytvorení a aktualizácii
);

-- Vytvorenie indexov pre optimalizáciu vyhľadávania
CREATE INDEX idx_bookings_slot_id ON bookings (slot_id);
CREATE INDEX idx_bookings_admin_id ON bookings (admin_id);
CREATE INDEX idx_bookings_client_email ON bookings (client_email);
CREATE INDEX idx_bookings_status ON bookings (status);
CREATE INDEX idx_bookings_payment_status ON bookings (payment_status);

-- Funkcia na automatickú aktualizáciu stĺpca 'updated_at'
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger, ktorý volá funkciu update_updated_at_column() pred každou aktualizáciou riadku v tabuľke 'bookings'
CREATE TRIGGER update_bookings_updated_at
BEFORE UPDATE ON bookings
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- TODO: Overiť existenciu tabuľky 'slots' a 'profiles'.
-- Ak existujú, je vhodné pridať FOREIGN KEY constraints:
-- ALTER TABLE bookings ADD CONSTRAINT fk_slot
--   FOREIGN KEY (slot_id) REFERENCES slots(id) ON DELETE CASCADE;
-- ALTER TABLE bookings ADD CONSTRAINT fk_admin
--   FOREIGN KEY (admin_id) REFERENCES profiles(id) ON DELETE CASCADE;
-- TODO: Zvážiť pridanie UNIQUE CONSTRAINT na 'slot_id' v tabuľke 'bookings', ak sa jeden slot môže rezervovať len raz.