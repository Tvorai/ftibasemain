-- SQL migrácia pre tabuľku client_results a storage bucket

-- 1. Vytvorenie tabuľky client_results
CREATE TABLE IF NOT EXISTS client_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id UUID NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
  before_image_url TEXT NOT NULL,
  after_image_url TEXT NOT NULL,
  client_name TEXT,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexy pre rýchlejšie vyhľadávanie
CREATE INDEX IF NOT EXISTS idx_client_results_trainer_id ON client_results(trainer_id);

-- Trigger pre updated_at (používame existujúcu funkciu update_updated_at_column, ak existuje)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
        CREATE TRIGGER update_client_results_updated_at
        BEFORE UPDATE ON client_results
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- RLS pre client_results
ALTER TABLE client_results ENABLE ROW LEVEL SECURITY;

-- Politika: Tréneri môžu vidieť len svoje výsledky
CREATE POLICY "Trainers can view their own client results" ON client_results
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM trainers t
      WHERE t.id = client_results.trainer_id
      AND t.profile_id = auth.uid()
    )
  );

-- Politika: Tréneri môžu pridávať svoje výsledky
CREATE POLICY "Trainers can insert their own client results" ON client_results
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM trainers t
      WHERE t.id = client_results.trainer_id
      AND t.profile_id = auth.uid()
    )
  );

-- Politika: Tréneri môžu mazať svoje výsledky
CREATE POLICY "Trainers can delete their own client results" ON client_results
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM trainers t
      WHERE t.id = client_results.trainer_id
      AND t.profile_id = auth.uid()
    )
  );

-- 2. Informácia o Storage Buckete (Supabase Storage sa zvyčajne spravuje cez UI alebo API, ale tu sú RLS politiky pre bucket 'client-results')
-- Poznámka: Predpokladáme, že bucket 'client-results' bude vytvorený manuálne v Supabase UI.
-- Tieto politiky by sa aplikovali na storage.objects

/*
-- Príklad RLS pre storage.objects (spúšťať v Supabase SQL Editore)
CREATE POLICY "Public Access to Client Results" ON storage.objects
  FOR SELECT USING (bucket_id = 'client-results');

CREATE POLICY "Trainers can upload client results" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'client-results' AND
    (auth.role() = 'authenticated')
  );

CREATE POLICY "Trainers can delete their client results" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'client-results' AND
    (auth.role() = 'authenticated')
  );
*/
