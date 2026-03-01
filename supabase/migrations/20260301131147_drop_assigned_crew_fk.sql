-- Drop the FK from estimates.assigned_crew_id → profiles(id).
-- Local crews live in company_settings.crews JSONB only and have no
-- corresponding row in profiles, so the FK caused every estimate upsert
-- with an assigned crew to fail with a FK constraint violation.
ALTER TABLE public.estimates
  DROP CONSTRAINT IF EXISTS estimates_assigned_crew_id_fkey;
