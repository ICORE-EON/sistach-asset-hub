ALTER TABLE public.maintenance_plans
  ADD COLUMN IF NOT EXISTS scope_mode text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS scope_location_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS scope_include_sublocations boolean NOT NULL DEFAULT true;

ALTER TABLE public.maintenance_plans
  DROP CONSTRAINT IF EXISTS maintenance_plans_scope_mode_chk;

ALTER TABLE public.maintenance_plans
  ADD CONSTRAINT maintenance_plans_scope_mode_chk CHECK (scope_mode IN ('manual','scoped'));