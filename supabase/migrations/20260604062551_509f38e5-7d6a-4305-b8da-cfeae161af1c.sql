
-- 1. Table
CREATE TABLE public.certificate_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  language text NOT NULL DEFAULT 'es',
  title text NOT NULL,
  intro_text text NOT NULL DEFAULT '',
  regulation_text text NOT NULL DEFAULT '',
  footer_text text NOT NULL DEFAULT '',
  columns jsonb NOT NULL DEFAULT '[]'::jsonb,
  show_logo boolean NOT NULL DEFAULT true,
  show_signature boolean NOT NULL DEFAULT true,
  show_company_stamp boolean NOT NULL DEFAULT false,
  paper_size text NOT NULL DEFAULT 'A4',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE UNIQUE INDEX certificate_templates_company_code_key
  ON public.certificate_templates(company_id, code)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX certificate_templates_one_default_per_company
  ON public.certificate_templates(company_id)
  WHERE is_default = true AND deleted_at IS NULL;

-- 2. Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.certificate_templates TO authenticated;
GRANT ALL ON public.certificate_templates TO service_role;

-- 3. RLS
ALTER TABLE public.certificate_templates ENABLE ROW LEVEL SECURITY;

-- 4. Policies
CREATE POLICY certificate_templates_select ON public.certificate_templates
  FOR SELECT TO authenticated
  USING (user_has_membership(company_id) AND deleted_at IS NULL);

CREATE POLICY certificate_templates_insert ON public.certificate_templates
  FOR INSERT TO authenticated
  WITH CHECK (can_manage_assets(company_id));

CREATE POLICY certificate_templates_update ON public.certificate_templates
  FOR UPDATE TO authenticated
  USING (can_manage_assets(company_id))
  WITH CHECK (can_manage_assets(company_id));

CREATE POLICY certificate_templates_delete ON public.certificate_templates
  FOR DELETE TO authenticated
  USING (can_manage_company(company_id));

-- updated_at trigger
CREATE TRIGGER certificate_templates_set_updated_at
  BEFORE UPDATE ON public.certificate_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. Link from maintenance_plans
ALTER TABLE public.maintenance_plans
  ADD COLUMN certificate_template_id uuid REFERENCES public.certificate_templates(id) ON DELETE SET NULL;
