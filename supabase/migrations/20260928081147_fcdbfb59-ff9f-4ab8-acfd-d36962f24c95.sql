SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

DO $pre$
DECLARE v bigint; v_msg text := '';
BEGIN
  SELECT (SELECT count(*) FROM public.assets WHERE company_id IS NULL)
       + (SELECT count(*) FROM public.locations WHERE company_id IS NULL)
       + (SELECT count(*) FROM public.maintenance_plans WHERE company_id IS NULL)
       + (SELECT count(*) FROM public.maintenance_sessions WHERE company_id IS NULL)
       + (SELECT count(*) FROM public.checklist_templates WHERE company_id IS NULL)
       + (SELECT count(*) FROM public.incidents WHERE company_id IS NULL)
       + (SELECT count(*) FROM public.certificates WHERE company_id IS NULL)
       + (SELECT count(*) FROM public.certificate_templates WHERE company_id IS NULL)
       + (SELECT count(*) FROM public.vehicles WHERE company_id IS NULL) INTO v;
  IF v > 0 THEN v_msg := v_msg || format('P2 padres sin company_id=%s; ', v); END IF;

  SELECT count(*) INTO v FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relname LIKE 'mnt\_%';
  IF v > 0 THEN v_msg := v_msg || format('P3 objetos mnt_ existentes=%s; ', v); END IF;
  SELECT count(*) INTO v FROM pg_constraint
   WHERE connamespace = 'public'::regnamespace
     AND (conname LIKE '%\_company\_id\_id\_key' OR conname LIKE '%\_org\_fk');
  IF v > 0 THEN v_msg := v_msg || format('P3 restricciones existentes=%s; ', v); END IF;

  SELECT count(*) INTO v FROM information_schema.columns
   WHERE table_schema = 'public' AND column_name = 'company_id'
     AND table_name IN ('checklist_template_versions','checklist_questions','checklist_responses',
       'maintenance_items','maintenance_plan_assets','maintenance_plan_type_templates','certificate_items',
       'incident_status_history','session_reopen_log','first_aid_kit_contents','vehicle_mounts');
  IF v > 0 THEN v_msg := v_msg || format('P4 hijas con company_id=%s; ', v); END IF;

  SELECT (SELECT count(*) FROM public.assets a JOIN public.asset_types t ON t.id = a.asset_type_id
           WHERE t.company_id IS NOT NULL AND t.company_id <> a.company_id)
       + (SELECT count(*) FROM public.maintenance_plans p JOIN public.asset_families f ON f.id = p.asset_family_id
           WHERE f.company_id IS NOT NULL AND f.company_id <> p.company_id)
       + (SELECT count(*) FROM public.checklist_templates c JOIN public.asset_families f ON f.id = c.asset_family_id
           WHERE f.company_id IS NOT NULL AND f.company_id <> c.company_id)
       + (SELECT count(*) FROM public.certificate_templates c JOIN public.asset_families f ON f.id = c.asset_family_id
           WHERE f.company_id IS NOT NULL AND f.company_id <> c.company_id)
       + (SELECT count(*) FROM public.asset_types t JOIN public.asset_families f ON f.id = t.family_id
           WHERE f.company_id IS NOT NULL AND f.company_id IS DISTINCT FROM t.company_id)
       + (SELECT count(*) FROM public.maintenance_plan_type_templates x
            JOIN public.maintenance_plans p ON p.id = x.plan_id
            JOIN public.asset_types t ON t.id = x.asset_type_id
           WHERE t.company_id IS NOT NULL AND t.company_id <> p.company_id) INTO v;
  IF v > 0 THEN v_msg := v_msg || format('G3 referencias cruzadas=%s; ', v); END IF;

  IF v_msg <> '' THEN RAISE EXCEPTION 'M1 preflight falló: %', v_msg; END IF;
END
$pre$;

ALTER TABLE public.assets                ADD CONSTRAINT assets_company_id_id_key                UNIQUE (company_id, id);
ALTER TABLE public.locations             ADD CONSTRAINT locations_company_id_id_key             UNIQUE (company_id, id);
ALTER TABLE public.maintenance_plans     ADD CONSTRAINT maintenance_plans_company_id_id_key     UNIQUE (company_id, id);
ALTER TABLE public.maintenance_sessions  ADD CONSTRAINT maintenance_sessions_company_id_id_key  UNIQUE (company_id, id);
ALTER TABLE public.checklist_templates   ADD CONSTRAINT checklist_templates_company_id_id_key   UNIQUE (company_id, id);
ALTER TABLE public.incidents             ADD CONSTRAINT incidents_company_id_id_key             UNIQUE (company_id, id);
ALTER TABLE public.certificates          ADD CONSTRAINT certificates_company_id_id_key          UNIQUE (company_id, id);
ALTER TABLE public.certificate_templates ADD CONSTRAINT certificate_templates_company_id_id_key UNIQUE (company_id, id);
ALTER TABLE public.vehicles              ADD CONSTRAINT vehicles_company_id_asset_id_key        UNIQUE (company_id, asset_id);

ALTER TABLE public.checklist_template_versions     ADD COLUMN company_id uuid NULL REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.checklist_questions             ADD COLUMN company_id uuid NULL REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.checklist_responses             ADD COLUMN company_id uuid NULL REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.maintenance_items               ADD COLUMN company_id uuid NULL REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.maintenance_plan_assets         ADD COLUMN company_id uuid NULL REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.maintenance_plan_type_templates ADD COLUMN company_id uuid NULL REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.certificate_items               ADD COLUMN company_id uuid NULL REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.incident_status_history         ADD COLUMN company_id uuid NULL REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.session_reopen_log              ADD COLUMN company_id uuid NULL REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.first_aid_kit_contents          ADD COLUMN company_id uuid NULL REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.vehicle_mounts                  ADD COLUMN company_id uuid NULL REFERENCES public.companies(id) ON DELETE CASCADE;

CREATE INDEX checklist_template_versions_company_id_idx     ON public.checklist_template_versions (company_id);
CREATE INDEX checklist_questions_company_id_idx             ON public.checklist_questions (company_id);
CREATE INDEX checklist_responses_company_id_idx             ON public.checklist_responses (company_id);
CREATE INDEX maintenance_items_company_id_idx               ON public.maintenance_items (company_id);
CREATE INDEX maintenance_plan_assets_company_id_idx         ON public.maintenance_plan_assets (company_id);
CREATE INDEX maintenance_plan_type_templates_company_id_idx ON public.maintenance_plan_type_templates (company_id);
CREATE INDEX certificate_items_company_id_idx               ON public.certificate_items (company_id);
CREATE INDEX incident_status_history_company_id_idx         ON public.incident_status_history (company_id);
CREATE INDEX session_reopen_log_company_id_idx              ON public.session_reopen_log (company_id);
CREATE INDEX first_aid_kit_contents_company_id_idx          ON public.first_aid_kit_contents (company_id);
CREATE INDEX vehicle_mounts_company_id_idx                  ON public.vehicle_mounts (company_id);

ALTER TABLE public.checklist_template_versions ADD CONSTRAINT checklist_template_versions_company_id_id_key UNIQUE (company_id, id);
ALTER TABLE public.checklist_questions         ADD CONSTRAINT checklist_questions_company_id_id_key         UNIQUE (company_id, id);
ALTER TABLE public.maintenance_items           ADD CONSTRAINT maintenance_items_company_id_id_key           UNIQUE (company_id, id);
ALTER TABLE public.checklist_responses         ADD CONSTRAINT checklist_responses_company_id_id_key         UNIQUE (company_id, id);

ALTER TABLE public.maintenance_items ADD CONSTRAINT maintenance_items_session_org_fk
  FOREIGN KEY (company_id, session_id) REFERENCES public.maintenance_sessions (company_id, id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.maintenance_items ADD CONSTRAINT maintenance_items_asset_org_fk
  FOREIGN KEY (company_id, asset_id) REFERENCES public.assets (company_id, id) NOT VALID;
ALTER TABLE public.checklist_responses ADD CONSTRAINT checklist_responses_item_org_fk
  FOREIGN KEY (company_id, maintenance_item_id) REFERENCES public.maintenance_items (company_id, id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.checklist_template_versions ADD CONSTRAINT checklist_template_versions_template_org_fk
  FOREIGN KEY (company_id, template_id) REFERENCES public.checklist_templates (company_id, id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.checklist_questions ADD CONSTRAINT checklist_questions_version_org_fk
  FOREIGN KEY (company_id, template_version_id) REFERENCES public.checklist_template_versions (company_id, id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.maintenance_plan_assets ADD CONSTRAINT maintenance_plan_assets_plan_org_fk
  FOREIGN KEY (company_id, plan_id) REFERENCES public.maintenance_plans (company_id, id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.maintenance_plan_assets ADD CONSTRAINT maintenance_plan_assets_asset_org_fk
  FOREIGN KEY (company_id, asset_id) REFERENCES public.assets (company_id, id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.maintenance_plan_type_templates ADD CONSTRAINT maintenance_plan_type_templates_plan_org_fk
  FOREIGN KEY (company_id, plan_id) REFERENCES public.maintenance_plans (company_id, id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.maintenance_plan_type_templates ADD CONSTRAINT maintenance_plan_type_templates_template_org_fk
  FOREIGN KEY (company_id, checklist_template_id) REFERENCES public.checklist_templates (company_id, id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.maintenance_sessions ADD CONSTRAINT maintenance_sessions_plan_org_fk
  FOREIGN KEY (company_id, plan_id) REFERENCES public.maintenance_plans (company_id, id) ON DELETE SET NULL (plan_id) NOT VALID;
ALTER TABLE public.maintenance_sessions ADD CONSTRAINT maintenance_sessions_location_org_fk
  FOREIGN KEY (company_id, location_id) REFERENCES public.locations (company_id, id) ON DELETE SET NULL (location_id) NOT VALID;
ALTER TABLE public.incidents ADD CONSTRAINT incidents_asset_org_fk
  FOREIGN KEY (company_id, asset_id) REFERENCES public.assets (company_id, id) ON DELETE SET NULL (asset_id) NOT VALID;
ALTER TABLE public.incidents ADD CONSTRAINT incidents_location_org_fk
  FOREIGN KEY (company_id, location_id) REFERENCES public.locations (company_id, id) ON DELETE SET NULL (location_id) NOT VALID;
ALTER TABLE public.incident_status_history ADD CONSTRAINT incident_status_history_incident_org_fk
  FOREIGN KEY (company_id, incident_id) REFERENCES public.incidents (company_id, id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.certificate_items ADD CONSTRAINT certificate_items_certificate_org_fk
  FOREIGN KEY (company_id, certificate_id) REFERENCES public.certificates (company_id, id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.certificate_items ADD CONSTRAINT certificate_items_asset_org_fk
  FOREIGN KEY (company_id, asset_id) REFERENCES public.assets (company_id, id) ON DELETE SET NULL (asset_id) NOT VALID;
ALTER TABLE public.certificate_items ADD CONSTRAINT certificate_items_session_org_fk
  FOREIGN KEY (company_id, maintenance_session_id) REFERENCES public.maintenance_sessions (company_id, id) ON DELETE SET NULL (maintenance_session_id) NOT VALID;
ALTER TABLE public.session_reopen_log ADD CONSTRAINT session_reopen_log_session_org_fk
  FOREIGN KEY (company_id, session_id) REFERENCES public.maintenance_sessions (company_id, id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.first_aid_kit_contents ADD CONSTRAINT first_aid_kit_contents_kit_org_fk
  FOREIGN KEY (company_id, kit_asset_id) REFERENCES public.assets (company_id, id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.vehicle_mounts ADD CONSTRAINT vehicle_mounts_vehicle_org_fk
  FOREIGN KEY (company_id, vehicle_asset_id) REFERENCES public.vehicles (company_id, asset_id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.vehicle_mounts ADD CONSTRAINT vehicle_mounts_mounted_org_fk
  FOREIGN KEY (company_id, mounted_asset_id) REFERENCES public.assets (company_id, id) NOT VALID;
ALTER TABLE public.assets ADD CONSTRAINT assets_location_org_fk
  FOREIGN KEY (company_id, location_id) REFERENCES public.locations (company_id, id) ON DELETE SET NULL (location_id) NOT VALID;
ALTER TABLE public.maintenance_plans ADD CONSTRAINT maintenance_plans_certificate_template_org_fk
  FOREIGN KEY (company_id, certificate_template_id) REFERENCES public.certificate_templates (company_id, id) ON DELETE SET NULL (certificate_template_id) NOT VALID;
ALTER TABLE public.maintenance_plans ADD CONSTRAINT maintenance_plans_checklist_template_org_fk
  FOREIGN KEY (company_id, checklist_template_id) REFERENCES public.checklist_templates (company_id, id) NOT VALID;

CREATE OR REPLACE FUNCTION public.mnt_check_type_visible()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_company uuid; v_found boolean;
BEGIN
  IF NEW.org_id IS NULL THEN
    RAISE EXCEPTION 'org_id obligatorio' USING ERRCODE = '23502';
  END IF;
  SELECT true, t.company_id INTO v_found, v_company FROM public.asset_types t WHERE t.id = NEW.asset_type_id;
  IF v_found IS NULL OR (v_company IS NOT NULL AND v_company <> NEW.org_id) THEN
    RAISE EXCEPTION 'Tipo de activo no disponible para la organización' USING ERRCODE = '23503';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.mnt_org_asset_types_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_company uuid; v_found boolean;
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW.org_id IS DISTINCT FROM OLD.org_id OR NEW.asset_type_id IS DISTINCT FROM OLD.asset_type_id) THEN
    RAISE EXCEPTION 'org_id y asset_type_id son inmutables' USING ERRCODE = '42501';
  END IF;
  SELECT true, t.company_id INTO v_found, v_company FROM public.asset_types t WHERE t.id = NEW.asset_type_id;
  IF v_found IS NULL OR v_company IS NOT NULL THEN
    RAISE EXCEPTION 'Solo se habilitan tipos globales' USING ERRCODE = '23503';
  END IF;
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.mnt_check_type_visible() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mnt_org_asset_types_guard() FROM PUBLIC, anon;

CREATE TABLE public.mnt_checklist_template_types (
  org_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  template_id uuid NOT NULL,
  asset_type_id uuid NOT NULL REFERENCES public.asset_types(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (template_id, asset_type_id),
  CONSTRAINT mnt_checklist_template_types_template_org_fk
    FOREIGN KEY (org_id, template_id) REFERENCES public.checklist_templates (company_id, id) ON DELETE CASCADE
);
CREATE INDEX mnt_checklist_template_types_org_idx ON public.mnt_checklist_template_types (org_id);
CREATE INDEX mnt_checklist_template_types_type_idx ON public.mnt_checklist_template_types (asset_type_id);

CREATE TABLE public.mnt_checklist_template_sites (
  org_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  template_id uuid NOT NULL,
  location_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (template_id, location_id),
  CONSTRAINT mnt_checklist_template_sites_template_org_fk
    FOREIGN KEY (org_id, template_id) REFERENCES public.checklist_templates (company_id, id) ON DELETE CASCADE,
  CONSTRAINT mnt_checklist_template_sites_location_org_fk
    FOREIGN KEY (org_id, location_id) REFERENCES public.locations (company_id, id) ON DELETE CASCADE
);
CREATE INDEX mnt_checklist_template_sites_org_idx ON public.mnt_checklist_template_sites (org_id);
CREATE INDEX mnt_checklist_template_sites_location_idx ON public.mnt_checklist_template_sites (org_id, location_id);

CREATE TABLE public.mnt_plan_sites (
  org_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL,
  location_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (plan_id, location_id),
  CONSTRAINT mnt_plan_sites_plan_org_fk
    FOREIGN KEY (org_id, plan_id) REFERENCES public.maintenance_plans (company_id, id) ON DELETE CASCADE,
  CONSTRAINT mnt_plan_sites_location_org_fk
    FOREIGN KEY (org_id, location_id) REFERENCES public.locations (company_id, id) ON DELETE CASCADE
);
CREATE INDEX mnt_plan_sites_org_idx ON public.mnt_plan_sites (org_id);
CREATE INDEX mnt_plan_sites_location_idx ON public.mnt_plan_sites (org_id, location_id);

CREATE TABLE public.mnt_org_asset_types (
  org_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  asset_type_id uuid NOT NULL REFERENCES public.asset_types(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, asset_type_id)
);
CREATE INDEX mnt_org_asset_types_type_idx ON public.mnt_org_asset_types (asset_type_id);

CREATE TABLE public.mnt_outbox (
  event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  aggregate_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  last_error text
);
CREATE INDEX mnt_outbox_pending_idx ON public.mnt_outbox (occurred_at) WHERE processed_at IS NULL;

CREATE TABLE public.mnt_migration_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  step text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL,
  preflight jsonb,
  postflight jsonb,
  rows_affected jsonb,
  error text
);

REVOKE ALL ON public.mnt_checklist_template_types, public.mnt_checklist_template_sites, public.mnt_plan_sites,
  public.mnt_org_asset_types, public.mnt_outbox, public.mnt_migration_runs FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.mnt_checklist_template_types TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.mnt_checklist_template_sites TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.mnt_plan_sites TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.mnt_org_asset_types TO authenticated;
GRANT ALL ON public.mnt_checklist_template_types, public.mnt_checklist_template_sites, public.mnt_plan_sites,
  public.mnt_org_asset_types, public.mnt_outbox, public.mnt_migration_runs TO service_role;

ALTER TABLE public.mnt_checklist_template_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mnt_checklist_template_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mnt_plan_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mnt_org_asset_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mnt_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mnt_migration_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY mnt_ctt_select ON public.mnt_checklist_template_types FOR SELECT TO authenticated USING (public.can_view(org_id));
CREATE POLICY mnt_ctt_insert ON public.mnt_checklist_template_types FOR INSERT TO authenticated WITH CHECK (public.can_manage_assets(org_id));
CREATE POLICY mnt_ctt_delete ON public.mnt_checklist_template_types FOR DELETE TO authenticated USING (public.can_manage_assets(org_id));

CREATE POLICY mnt_cts_select ON public.mnt_checklist_template_sites FOR SELECT TO authenticated USING (public.can_view(org_id));
CREATE POLICY mnt_cts_insert ON public.mnt_checklist_template_sites FOR INSERT TO authenticated WITH CHECK (public.can_manage_assets(org_id));
CREATE POLICY mnt_cts_delete ON public.mnt_checklist_template_sites FOR DELETE TO authenticated USING (public.can_manage_assets(org_id));

CREATE POLICY mnt_ps_select ON public.mnt_plan_sites FOR SELECT TO authenticated USING (public.can_view(org_id));
CREATE POLICY mnt_ps_insert ON public.mnt_plan_sites FOR INSERT TO authenticated WITH CHECK (public.can_manage_assets(org_id));
CREATE POLICY mnt_ps_delete ON public.mnt_plan_sites FOR DELETE TO authenticated USING (public.can_manage_assets(org_id));

CREATE POLICY mnt_oat_select ON public.mnt_org_asset_types FOR SELECT TO authenticated USING (public.can_view(org_id));
CREATE POLICY mnt_oat_insert ON public.mnt_org_asset_types FOR INSERT TO authenticated WITH CHECK (public.can_manage_company(org_id));
CREATE POLICY mnt_oat_update ON public.mnt_org_asset_types FOR UPDATE TO authenticated
  USING (public.can_manage_company(org_id)) WITH CHECK (public.can_manage_company(org_id));

CREATE TRIGGER mnt_ctt_check_type BEFORE INSERT OR UPDATE ON public.mnt_checklist_template_types
  FOR EACH ROW EXECUTE FUNCTION public.mnt_check_type_visible();
CREATE TRIGGER mnt_oat_guard BEFORE INSERT OR UPDATE ON public.mnt_org_asset_types
  FOR EACH ROW EXECUTE FUNCTION public.mnt_org_asset_types_guard();
CREATE TRIGGER set_updated_at_mnt_org_asset_types BEFORE UPDATE ON public.mnt_org_asset_types
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.mnt_migration_runs (step, finished_at, status, preflight)
VALUES ('M1', now(), 'done', jsonb_build_object(
  'P2_parents_null_company', 0, 'P3_existing_objects', 0, 'P4_children_with_company', 0, 'G3_cross_refs', 0,
  'G1_families_global', (SELECT count(*) FROM public.asset_families WHERE company_id IS NULL),
  'G1_types_global', (SELECT count(*) FROM public.asset_types WHERE company_id IS NULL)));