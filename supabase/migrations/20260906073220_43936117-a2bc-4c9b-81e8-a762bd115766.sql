CREATE TABLE public.asset_families (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  code text NOT NULL,
  name_i18n jsonb NOT NULL DEFAULT '{}'::jsonb,
  color text,
  sort_order integer NOT NULL DEFAULT 100,
  requires_certificate boolean NOT NULL DEFAULT true,
  is_system boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX asset_families_company_code_uq ON public.asset_families (COALESCE(company_id, '00000000-0000-0000-0000-000000000000'::uuid), code);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.asset_families TO authenticated;
GRANT ALL ON public.asset_families TO service_role;

ALTER TABLE public.asset_families ENABLE ROW LEVEL SECURITY;

CREATE POLICY "asset_families_select" ON public.asset_families
  FOR SELECT TO authenticated
  USING (is_system OR public.user_has_membership(company_id));

CREATE POLICY "asset_families_insert" ON public.asset_families
  FOR INSERT TO authenticated
  WITH CHECK (company_id IS NOT NULL AND NOT is_system AND public.can_manage_assets(company_id));

CREATE POLICY "asset_families_update" ON public.asset_families
  FOR UPDATE TO authenticated
  USING (company_id IS NOT NULL AND NOT is_system AND public.can_manage_assets(company_id))
  WITH CHECK (company_id IS NOT NULL AND NOT is_system AND public.can_manage_assets(company_id));

CREATE POLICY "asset_families_delete" ON public.asset_families
  FOR DELETE TO authenticated
  USING (company_id IS NOT NULL AND NOT is_system AND public.can_manage_assets(company_id));

CREATE TRIGGER asset_families_updated_at BEFORE UPDATE ON public.asset_families
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.asset_families (code, name_i18n, color, sort_order, requires_certificate, is_system) VALUES
  ('pci', '{"es":"Equipos PCI","ca":"Equips PCI","en":"Fire protection"}'::jsonb, '#ef4444', 10, true, true),
  ('health', '{"es":"Botiquines y DEA","ca":"Farmacioles i DEA","en":"First aid and AED"}'::jsonb, '#10b981', 20, true, true),
  ('vehicles', '{"es":"Vehículos","ca":"Vehicles","en":"Vehicles"}'::jsonb, '#3b82f6', 30, false, true),
  ('machinery', '{"es":"Maquinaria","ca":"Maquinària","en":"Machinery"}'::jsonb, '#f59e0b', 40, true, true),
  ('other', '{"es":"Otros","ca":"Altres","en":"Other"}'::jsonb, '#64748b', 90, false, true);

ALTER TABLE public.asset_types ADD COLUMN family_id uuid REFERENCES public.asset_families(id) ON DELETE SET NULL;

UPDATE public.asset_types t SET family_id = f.id
FROM public.asset_families f
WHERE f.is_system AND f.code = CASE
  WHEN t.category IN ('extinguisher','bie','alarm','detector','emergency_light','signage','sprinkler','fire_door') THEN 'pci'
  WHEN t.category IN ('first_aid_kit','defibrillator','aed') THEN 'health'
  WHEN t.category = 'vehicle' THEN 'vehicles'
  WHEN t.category IN ('machinery','elevator') THEN 'machinery'
  ELSE 'other'
END;

CREATE INDEX asset_types_family_idx ON public.asset_types (family_id);

ALTER TABLE public.maintenance_plans ADD COLUMN asset_family_id uuid REFERENCES public.asset_families(id) ON DELETE SET NULL;

ALTER TABLE public.certificate_templates ADD COLUMN asset_family_id uuid REFERENCES public.asset_families(id) ON DELETE SET NULL;

ALTER TABLE public.maintenance_sessions ADD COLUMN outcome text;
ALTER TABLE public.maintenance_sessions ADD CONSTRAINT maintenance_sessions_outcome_chk
  CHECK (outcome IS NULL OR outcome IN ('ok','with_incidents','incomplete','incomplete_with_incidents'));

CREATE TABLE public.maintenance_plan_type_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.maintenance_plans(id) ON DELETE CASCADE,
  asset_type_id uuid NOT NULL REFERENCES public.asset_types(id) ON DELETE CASCADE,
  checklist_template_id uuid NOT NULL REFERENCES public.checklist_templates(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_id, asset_type_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.maintenance_plan_type_templates TO authenticated;
GRANT ALL ON public.maintenance_plan_type_templates TO service_role;

ALTER TABLE public.maintenance_plan_type_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mptt_select" ON public.maintenance_plan_type_templates
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.maintenance_plans p WHERE p.id = plan_id AND public.can_view(p.company_id)));

CREATE POLICY "mptt_write" ON public.maintenance_plan_type_templates
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.maintenance_plans p WHERE p.id = plan_id AND public.can_manage_assets(p.company_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.maintenance_plans p WHERE p.id = plan_id AND public.can_manage_assets(p.company_id)));

CREATE TRIGGER mptt_updated_at BEFORE UPDATE ON public.maintenance_plan_type_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();