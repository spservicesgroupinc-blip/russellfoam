-- Add expenses column to company_settings for tracking per-job expense defaults
ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS expenses jsonb;
