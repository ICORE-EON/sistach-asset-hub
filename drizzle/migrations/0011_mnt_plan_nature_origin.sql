ALTER TABLE public.maintenance_plans
  ADD COLUMN IF NOT EXISTS plan_nature text NOT NULL DEFAULT 'preventive',
  ADD COLUMN IF NOT EXISTS requirement_origin text NOT NULL DEFAULT 'unspecified',
  ADD COLUMN IF NOT EXISTS requirement_reference text;
ALTER TABLE public.maintenance_plans
  ADD CONSTRAINT maintenance_plans_plan_nature_chk CHECK (plan_nature IN ('preventive','predictive','calibration','other')),
  ADD CONSTRAINT maintenance_plans_requirement_origin_chk CHECK (requirement_origin IN ('unspecified','legal','manufacturer','internal','contractual','other')),
  ADD CONSTRAINT maintenance_plans_requirement_reference_len CHECK (requirement_reference IS NULL OR char_length(requirement_reference) <= 500);
CREATE INDEX IF NOT EXISTS maintenance_plans_company_origin_idx ON public.maintenance_plans (company_id, requirement_origin);
COMMENT ON COLUMN public.maintenance_plans.plan_nature IS 'Stable code: preventive|predictive|calibration|other. Corrective work is ad-hoc sessions, never a plan.';
COMMENT ON COLUMN public.maintenance_plans.requirement_origin IS 'Stable code chosen explicitly by the user; unspecified until set. Never inferred.';