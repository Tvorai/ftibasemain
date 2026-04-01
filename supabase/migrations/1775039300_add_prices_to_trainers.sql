ALTER TABLE trainers
  ADD COLUMN IF NOT EXISTS price_personal_cents INTEGER;

ALTER TABLE trainers
  ADD COLUMN IF NOT EXISTS price_online_cents INTEGER;

