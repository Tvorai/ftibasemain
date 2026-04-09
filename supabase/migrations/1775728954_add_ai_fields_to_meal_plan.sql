-- Migration to add AI generation fields to meal_plan_requests
-- Safe, idempotent script

ALTER TABLE meal_plan_requests
ADD COLUMN IF NOT EXISTS ai_generation_status TEXT DEFAULT 'idle' CHECK (ai_generation_status IN ('idle', 'generating', 'ready', 'failed')),
ADD COLUMN IF NOT EXISTS ai_prompt_input JSONB,
ADD COLUMN IF NOT EXISTS ai_generated_plan JSONB,
ADD COLUMN IF NOT EXISTS trainer_edited_plan TEXT,
ADD COLUMN IF NOT EXISTS ai_last_error TEXT,
ADD COLUMN IF NOT EXISTS ai_generated_at TIMESTAMPTZ;

-- Add index for status if needed, though probably not necessary for this scale
CREATE INDEX IF NOT EXISTS idx_meal_plan_requests_ai_status ON meal_plan_requests(ai_generation_status);
