ALTER TABLE public.maintenance_plans
  ADD COLUMN IF NOT EXISTS execution_mode text NOT NULL DEFAULT 'internal',
  ADD COLUMN IF NOT EXISTS default_provider text;
ALTER TABLE public.maintenance_plans
  ADD CONSTRAINT maintenance_plans_execution_mode_check CHECK (execution_mode IN ('internal','external'));
ALTER TABLE public.maintenance_plans ALTER COLUMN checklist_template_id DROP NOT NULL;
ALTER TABLE public.maintenance_items ALTER COLUMN checklist_template_version_id DROP NOT NULL;