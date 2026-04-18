-- Migration to add duration and 30-day pricing for meal plans
-- Safe, idempotent script

-- 1. Add price_meal_plan_30_days_cents to trainers table
ALTER TABLE trainers 
ADD COLUMN IF NOT EXISTS price_meal_plan_30_days_cents INTEGER;

-- 2. Add duration_days to meal_plan_requests
ALTER TABLE meal_plan_requests
ADD COLUMN IF NOT EXISTS duration_days INTEGER DEFAULT 7;
