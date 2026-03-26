-- 1774451800_booking_policies.sql

-- Povolenie RLS na tabuľke bookings
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- Politika: Každý môže vytvoriť rezerváciu (INSERT)
-- V produkcii by tu mohla byť dodatočná kontrola, napr. cez CAPTCHA alebo overenie emailu
CREATE POLICY "Enable insert for everyone" ON bookings
  FOR INSERT
  WITH CHECK (true);

-- Politika: Tréner (admin) môže vidieť iba svoje rezervácie
-- Predpokladáme, že auth.uid() trénera sa zhoduje s admin_id
CREATE POLICY "Trainers can view their own bookings" ON bookings
  FOR SELECT
  USING (auth.uid() = admin_id);

-- Politika: Tréner (admin) môže upravovať iba svoje rezervácie
CREATE POLICY "Trainers can update their own bookings" ON bookings
  FOR UPDATE
  USING (auth.uid() = admin_id)
  WITH CHECK (auth.uid() = admin_id);

-- Ochrana proti dvojitej rezervácii (Race Condition protection na úrovni DB)
-- Vytvoríme unikátny index, ktorý zabezpečí, že jeden tréner nemôže mať dve aktívne rezervácie v rovnakom čase.
-- Poznámka: Tento index predpokladá, že sloty sú fixné. Ak by sa časy mohli prekrývať, bol by potrebný komplexnejší TRIGGER.
CREATE UNIQUE INDEX idx_unique_active_booking_slot 
ON bookings (admin_id, starts_at) 
WHERE (status != 'cancelled');

-- TODO: Ak chcete povoliť klientom vidieť ich vlastné rezervácie (napr. po prihlásení), 
-- bolo by potrebné pridať client_id a príslušnú politiku.
