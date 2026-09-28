-- =============================================================================
-- Maintenance module (mnt) · clean installer v1 for ICORE
-- Installs from scratch; does not depend on any table of the standalone app.
-- Idempotent: re-running leaves the same schema (IF NOT EXISTS / OR REPLACE /
-- DROP ... IF EXISTS + CREATE for policies and triggers).
-- Host integration points (must exist BEFORE running; see INTEGRATION.md):
--   roles anon, authenticated, service_role · auth.uid()
--   public.host_has_perm(uuid,text) · public.host_person_ref()
--   public.host_person_snapshot(uuid) · public.host_site_in_org(uuid,uuid)
--   public.host_document_version_sha(uuid,uuid)
-- Organisations are registered by the host with public.mnt_register_org(uuid).
-- =============================================================================
\set ON_ERROR_STOP on
BEGIN;

-- ---------------------------------------------------------------- preflight --
DO $preflight$
DECLARE
  missing text[] := '{}';
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN missing := missing || ('role ' || r); END IF;
  END LOOP;
  FOREACH r IN ARRAY ARRAY['auth.uid()','public.host_has_perm(uuid,text)','public.host_person_ref()',
                           'public.host_person_snapshot(uuid)','public.host_site_in_org(uuid,uuid)',
                           'public.host_document_version_sha(uuid,uuid)'] LOOP
    IF to_regprocedure(r) IS NULL THEN missing := missing || ('function ' || r); END IF;
  END LOOP;
  IF array_length(missing, 1) > 0 THEN
    RAISE EXCEPTION 'MNT preflight failed, missing host prerequisites: %', array_to_string(missing, ', ')
      USING ERRCODE = 'P0001';
  END IF;
  -- host_has_perm must be SECURITY DEFINER with a fixed search_path
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid = 'public.host_has_perm(uuid,text)'::regprocedure
                 AND prosecdef AND EXISTS (SELECT 1 FROM unnest(proconfig) c WHERE c LIKE 'search_path=%')) THEN
    RAISE EXCEPTION 'MNT preflight failed: host_has_perm must be SECURITY DEFINER with fixed search_path';
  END IF;
  -- fail-closed: without a session it must answer false (never null/true/error)
  IF public.host_has_perm(gen_random_uuid(), 'mnt.view') IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'MNT preflight failed: host_has_perm is not fail-closed';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.host_has_perm(uuid,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'MNT preflight failed: authenticated cannot execute host_has_perm';
  END IF;
END
$preflight$;

-- ------------------------------------------------------------------ tables --
CREATE TABLE IF NOT EXISTS public.mnt_installation (
  version int PRIMARY KEY, installed_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.mnt_catalog_versions (
  catalog text PRIMARY KEY, version int NOT NULL, applied_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.mnt_orgs (
  org_id uuid PRIMARY KEY, registered_at timestamptz NOT NULL DEFAULT now());

CREATE TABLE IF NOT EXISTS public.mnt_asset_families (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.mnt_orgs(org_id),
  code text NOT NULL CHECK (code ~ '^[a-z0-9_]{2,40}$'),
  name_i18n jsonb NOT NULL CHECK (jsonb_typeof(name_i18n) = 'object'),
  color text, sort_order int NOT NULL DEFAULT 100,
  requires_certificate boolean NOT NULL DEFAULT false,
  is_system boolean NOT NULL DEFAULT false, active boolean NOT NULL DEFAULT true,
  catalog_version int,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mnt_asset_families_scope CHECK ((is_system AND org_id IS NULL) OR (NOT is_system AND org_id IS NOT NULL)));
CREATE UNIQUE INDEX IF NOT EXISTS mnt_asset_families_global_code ON public.mnt_asset_families(code) WHERE org_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS mnt_asset_families_org_code ON public.mnt_asset_families(org_id, code) WHERE org_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.mnt_asset_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.mnt_orgs(org_id),
  family_id uuid NOT NULL REFERENCES public.mnt_asset_families(id),
  code text NOT NULL CHECK (code ~ '^[a-z0-9_]{2,40}$'),
  name_i18n jsonb NOT NULL CHECK (jsonb_typeof(name_i18n) = 'object'),
  is_system boolean NOT NULL DEFAULT false, active boolean NOT NULL DEFAULT true,
  catalog_version int, metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mnt_asset_types_scope CHECK ((is_system AND org_id IS NULL) OR (NOT is_system AND org_id IS NOT NULL)));
CREATE UNIQUE INDEX IF NOT EXISTS mnt_asset_types_global_code ON public.mnt_asset_types(code) WHERE org_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS mnt_asset_types_org_code ON public.mnt_asset_types(org_id, code) WHERE org_id IS NOT NULL;

-- Explicit per-organisation activation (D5: never automatic).
CREATE TABLE IF NOT EXISTS public.mnt_org_asset_types (
  org_id uuid NOT NULL REFERENCES public.mnt_orgs(org_id),
  asset_type_id uuid NOT NULL REFERENCES public.mnt_asset_types(id),
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, asset_type_id));

CREATE TABLE IF NOT EXISTS public.mnt_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.mnt_orgs(org_id),
  asset_type_id uuid NOT NULL REFERENCES public.mnt_asset_types(id),
  site_ref uuid,
  code text NOT NULL, name text, serial_number text, manufacturer text, model text,
  install_date date, warranty_until date,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','maintenance','retired')),
  qr_token text NOT NULL DEFAULT replace(gen_random_uuid()::text, '-', '') UNIQUE,
  notes text, metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz,
  UNIQUE (org_id, id), UNIQUE (org_id, code));
CREATE INDEX IF NOT EXISTS mnt_assets_type_idx ON public.mnt_assets(org_id, asset_type_id);
CREATE INDEX IF NOT EXISTS mnt_assets_site_idx ON public.mnt_assets(org_id, site_ref);

CREATE TABLE IF NOT EXISTS public.mnt_kit_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL, asset_id uuid NOT NULL,
  product_code text, product_name text NOT NULL, quantity int NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  unit text, batch_code text, expires_on date, notes text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, id),
  FOREIGN KEY (org_id, asset_id) REFERENCES public.mnt_assets(org_id, id) ON DELETE CASCADE);
CREATE INDEX IF NOT EXISTS mnt_kit_items_asset_idx ON public.mnt_kit_items(org_id, asset_id);

CREATE TABLE IF NOT EXISTS public.mnt_checklist_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.mnt_orgs(org_id),
  code text NOT NULL, name text NOT NULL, description text,
  asset_family_id uuid REFERENCES public.mnt_asset_families(id),
  include_sublocations boolean NOT NULL DEFAULT false, active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz,
  UNIQUE (org_id, id), UNIQUE (org_id, code));
CREATE TABLE IF NOT EXISTS public.mnt_checklist_template_types (
  org_id uuid NOT NULL, template_id uuid NOT NULL,
  asset_type_id uuid NOT NULL REFERENCES public.mnt_asset_types(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (template_id, asset_type_id),
  FOREIGN KEY (org_id, template_id) REFERENCES public.mnt_checklist_templates(org_id, id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS public.mnt_checklist_template_sites (
  org_id uuid NOT NULL, template_id uuid NOT NULL, site_ref uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (template_id, site_ref),
  FOREIGN KEY (org_id, template_id) REFERENCES public.mnt_checklist_templates(org_id, id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS public.mnt_checklist_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL, template_id uuid NOT NULL,
  version int NOT NULL CHECK (version > 0),
  is_published boolean NOT NULL DEFAULT false, published_at timestamptz,
  published_by_ref uuid, published_by_snapshot jsonb, notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, id), UNIQUE (template_id, version),
  FOREIGN KEY (org_id, template_id) REFERENCES public.mnt_checklist_templates(org_id, id));
CREATE TABLE IF NOT EXISTS public.mnt_checklist_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL, version_id uuid NOT NULL,
  position int NOT NULL, prompt text NOT NULL, help_text text,
  response_type text NOT NULL CHECK (response_type IN ('ok_ko_na','boolean','text','number','select')),
  options jsonb, required boolean NOT NULL DEFAULT true, creates_incident boolean NOT NULL DEFAULT false,
  UNIQUE (org_id, id), UNIQUE (version_id, position),
  FOREIGN KEY (org_id, version_id) REFERENCES public.mnt_checklist_versions(org_id, id));

CREATE TABLE IF NOT EXISTS public.mnt_certificate_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.mnt_orgs(org_id),
  code text NOT NULL, name text NOT NULL,
  asset_family_id uuid REFERENCES public.mnt_asset_families(id),
  is_default boolean NOT NULL DEFAULT false, language text NOT NULL DEFAULT 'es',
  title text NOT NULL, intro_text text NOT NULL DEFAULT '', regulation_text text NOT NULL DEFAULT '',
  footer_text text NOT NULL DEFAULT '', columns jsonb NOT NULL DEFAULT '[]',
  show_logo boolean NOT NULL DEFAULT true, show_signature boolean NOT NULL DEFAULT true,
  show_company_stamp boolean NOT NULL DEFAULT false,
  paper_size text NOT NULL DEFAULT 'A4' CHECK (paper_size IN ('A4','Letter')),
  logo_document_ref uuid, notes text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz,
  UNIQUE (org_id, id), UNIQUE (org_id, code));

CREATE TABLE IF NOT EXISTS public.mnt_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.mnt_orgs(org_id),
  code text NOT NULL, name text NOT NULL,
  asset_family_id uuid NOT NULL REFERENCES public.mnt_asset_families(id),
  frequency text NOT NULL CHECK (frequency IN ('monthly','quarterly','semiannual','annual','custom')),
  interval_months int CHECK (interval_months IS NULL OR interval_months > 0),
  scope_mode text NOT NULL DEFAULT 'manual' CHECK (scope_mode IN ('scoped','manual')),
  include_sublocations boolean NOT NULL DEFAULT false,
  certificate_template_id uuid,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','archived')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz,
  UNIQUE (org_id, id), UNIQUE (org_id, code),
  FOREIGN KEY (org_id, certificate_template_id) REFERENCES public.mnt_certificate_templates(org_id, id));
CREATE TABLE IF NOT EXISTS public.mnt_plan_sites (
  org_id uuid NOT NULL, plan_id uuid NOT NULL, site_ref uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (plan_id, site_ref),
  FOREIGN KEY (org_id, plan_id) REFERENCES public.mnt_plans(org_id, id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS public.mnt_plan_assets (
  org_id uuid NOT NULL, plan_id uuid NOT NULL, asset_id uuid NOT NULL,
  start_on date NOT NULL DEFAULT current_date, end_on date,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (plan_id, asset_id),
  FOREIGN KEY (org_id, plan_id) REFERENCES public.mnt_plans(org_id, id) ON DELETE CASCADE,
  FOREIGN KEY (org_id, asset_id) REFERENCES public.mnt_assets(org_id, id));
CREATE TABLE IF NOT EXISTS public.mnt_plan_type_templates (
  org_id uuid NOT NULL, plan_id uuid NOT NULL,
  asset_type_id uuid NOT NULL REFERENCES public.mnt_asset_types(id),
  checklist_template_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (plan_id, asset_type_id),
  FOREIGN KEY (org_id, plan_id) REFERENCES public.mnt_plans(org_id, id) ON DELETE CASCADE,
  FOREIGN KEY (org_id, checklist_template_id) REFERENCES public.mnt_checklist_templates(org_id, id));

CREATE TABLE IF NOT EXISTS public.mnt_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.mnt_orgs(org_id),
  code text NOT NULL, request_id uuid NOT NULL,
  plan_id uuid NOT NULL, site_ref uuid, scheduled_for date,
  technician_ref uuid, technician_snapshot jsonb,
  is_external boolean NOT NULL DEFAULT false, external_provider text,
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('draft','in_progress','closed','reopened','cancelled')),
  outcome text CHECK (outcome IN ('ok','with_incidents','partial','not_performed')),
  started_at timestamptz NOT NULL DEFAULT now(), closed_at timestamptz,
  closed_by_ref uuid, closed_by_snapshot jsonb, reopen_reason text, notes text,
  metadata jsonb NOT NULL DEFAULT '{}', created_by_ref uuid,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, id), UNIQUE (org_id, code), UNIQUE (org_id, request_id),
  FOREIGN KEY (org_id, plan_id) REFERENCES public.mnt_plans(org_id, id));
CREATE INDEX IF NOT EXISTS mnt_sessions_status_idx ON public.mnt_sessions(org_id, status);

CREATE TABLE IF NOT EXISTS public.mnt_session_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL, session_id uuid NOT NULL, asset_id uuid NOT NULL, checklist_version_id uuid NOT NULL,
  result text NOT NULL DEFAULT 'pending' CHECK (result IN ('pending','ok','failed','not_applicable','skipped')),
  observations text, completed_at timestamptz, completed_by_ref uuid, completed_by_snapshot jsonb,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, id), UNIQUE (session_id, asset_id),
  FOREIGN KEY (org_id, session_id) REFERENCES public.mnt_sessions(org_id, id),
  FOREIGN KEY (org_id, asset_id) REFERENCES public.mnt_assets(org_id, id),
  FOREIGN KEY (org_id, checklist_version_id) REFERENCES public.mnt_checklist_versions(org_id, id));
CREATE INDEX IF NOT EXISTS mnt_session_items_asset_idx ON public.mnt_session_items(org_id, asset_id);

CREATE TABLE IF NOT EXISTS public.mnt_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL, item_id uuid NOT NULL, question_id uuid NOT NULL,
  answer jsonb, is_fail boolean NOT NULL DEFAULT false, observations text,
  answered_by_ref uuid, answered_by_snapshot jsonb, answered_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, id), UNIQUE (item_id, question_id),
  FOREIGN KEY (org_id, item_id) REFERENCES public.mnt_session_items(org_id, id),
  FOREIGN KEY (org_id, question_id) REFERENCES public.mnt_checklist_questions(org_id, id));

CREATE TABLE IF NOT EXISTS public.mnt_session_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL, session_id uuid NOT NULL,
  event text NOT NULL CHECK (event IN ('closed','reopened','cancelled')),
  actor_ref uuid, actor_snapshot jsonb NOT NULL, reason text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (org_id, session_id) REFERENCES public.mnt_sessions(org_id, id));
CREATE INDEX IF NOT EXISTS mnt_session_history_idx ON public.mnt_session_history(org_id, session_id);

CREATE TABLE IF NOT EXISTS public.mnt_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.mnt_orgs(org_id),
  code text NOT NULL, asset_id uuid, site_ref uuid,
  source text NOT NULL CHECK (source IN ('manual','checklist')),
  source_response_id uuid,
  title text NOT NULL, description text,
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','closed','cancelled')),
  reporter_ref uuid, reporter_snapshot jsonb, assigned_to_ref uuid, due_date date,
  resolved_at timestamptz, closed_at timestamptz, resolution_notes text, metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, id), UNIQUE (org_id, code),
  CONSTRAINT mnt_incidents_one_per_response UNIQUE (org_id, source_response_id),
  CONSTRAINT mnt_incidents_source_ref CHECK ((source = 'checklist') = (source_response_id IS NOT NULL)),
  FOREIGN KEY (org_id, asset_id) REFERENCES public.mnt_assets(org_id, id),
  FOREIGN KEY (org_id, source_response_id) REFERENCES public.mnt_responses(org_id, id));
CREATE INDEX IF NOT EXISTS mnt_incidents_status_idx ON public.mnt_incidents(org_id, status);
CREATE INDEX IF NOT EXISTS mnt_incidents_asset_idx ON public.mnt_incidents(org_id, asset_id);

CREATE TABLE IF NOT EXISTS public.mnt_incident_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL, incident_id uuid NOT NULL,
  from_status text, to_status text NOT NULL, actor_ref uuid, actor_snapshot jsonb NOT NULL, note text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (org_id, incident_id) REFERENCES public.mnt_incidents(org_id, id));
CREATE INDEX IF NOT EXISTS mnt_incident_history_idx ON public.mnt_incident_history(org_id, incident_id);

CREATE TABLE IF NOT EXISTS public.mnt_certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.mnt_orgs(org_id),
  code text NOT NULL, session_id uuid,
  title text NOT NULL, issued_on date NOT NULL DEFAULT current_date, valid_until date,
  issuer_ref uuid, issuer_snapshot jsonb NOT NULL,
  is_external boolean NOT NULL DEFAULT false, external_provider text, external_number text,
  status text NOT NULL DEFAULT 'issued' CHECK (status IN ('issued','revoked')),
  snapshot jsonb NOT NULL DEFAULT '{}',
  document_version_ref uuid, pdf_sha256 text CHECK (pdf_sha256 IS NULL OR pdf_sha256 ~ '^[0-9a-f]{64}$'),
  revoked_at timestamptz, revoked_by_ref uuid, notes text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, id), UNIQUE (org_id, code),
  CONSTRAINT mnt_certificates_one_per_session UNIQUE (org_id, session_id),
  CONSTRAINT mnt_certificates_pdf_pair CHECK ((document_version_ref IS NULL) = (pdf_sha256 IS NULL)),
  FOREIGN KEY (org_id, session_id) REFERENCES public.mnt_sessions(org_id, id));
CREATE INDEX IF NOT EXISTS mnt_certificates_status_idx ON public.mnt_certificates(org_id, status);

CREATE TABLE IF NOT EXISTS public.mnt_certificate_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL, certificate_id uuid NOT NULL, asset_id uuid NOT NULL, session_item_id uuid,
  result text NOT NULL CHECK (result IN ('ok','conditional','failed','na')), notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (certificate_id, asset_id),
  FOREIGN KEY (org_id, certificate_id) REFERENCES public.mnt_certificates(org_id, id),
  FOREIGN KEY (org_id, asset_id) REFERENCES public.mnt_assets(org_id, id),
  FOREIGN KEY (org_id, session_item_id) REFERENCES public.mnt_session_items(org_id, id));
CREATE INDEX IF NOT EXISTS mnt_certificate_items_asset_idx ON public.mnt_certificate_items(org_id, asset_id);

CREATE TABLE IF NOT EXISTS public.mnt_counters (
  org_id uuid NOT NULL REFERENCES public.mnt_orgs(org_id), scope text NOT NULL, year int NOT NULL,
  value bigint NOT NULL DEFAULT 0, PRIMARY KEY (org_id, scope, year));

-- Transactional outbox: written in the same transaction as the change; consumed by the host (service_role).
CREATE TABLE IF NOT EXISTS public.mnt_outbox (
  event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.mnt_orgs(org_id),
  event_type text NOT NULL, aggregate_type text NOT NULL, aggregate_id uuid NOT NULL,
  actor_ref uuid, payload jsonb NOT NULL DEFAULT '{}',
  occurred_at timestamptz NOT NULL DEFAULT now(), processed_at timestamptz,
  attempts int NOT NULL DEFAULT 0, last_error text);
CREATE INDEX IF NOT EXISTS mnt_outbox_pending_idx ON public.mnt_outbox(occurred_at) WHERE processed_at IS NULL;

-- ------------------------------------------------------- helper functions --
CREATE OR REPLACE FUNCTION public.mnt_can(p_org uuid, p_perm text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT p_org IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.mnt_orgs o WHERE o.org_id = p_org)
     AND coalesce(public.host_has_perm(p_org, p_perm), false)
$$;

CREATE OR REPLACE FUNCTION public.mnt_assert_perm(p_org uuid, p_perm text) RETURNS void
LANGUAGE plpgsql STABLE SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT public.mnt_can(p_org, p_perm) THEN
    RAISE EXCEPTION 'mnt: permiso % denegado', p_perm USING ERRCODE = '42501';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.mnt_is_client() RETURNS boolean
LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
  SELECT current_user IN ('authenticated','anon')
$$;

CREATE OR REPLACE FUNCTION public.mnt_actor_snapshot() RETURNS jsonb
LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
  SELECT coalesce(public.host_person_snapshot(public.host_person_ref()), '{}'::jsonb)
$$;

CREATE OR REPLACE FUNCTION public.mnt_next_code(p_org uuid, p_scope text, p_prefix text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v bigint; y int := extract(year FROM now())::int;
BEGIN
  INSERT INTO public.mnt_counters(org_id, scope, year, value) VALUES (p_org, p_scope, y, 1)
  ON CONFLICT (org_id, scope, year) DO UPDATE SET value = public.mnt_counters.value + 1
  RETURNING value INTO v;
  RETURN p_prefix || '-' || y || '-' || lpad(v::text, 4, '0');
END $$;

CREATE OR REPLACE FUNCTION public.mnt_emit(p_org uuid, p_type text, p_agg text, p_id uuid, p_payload jsonb) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  INSERT INTO public.mnt_outbox(org_id, event_type, aggregate_type, aggregate_id, actor_ref, payload)
  VALUES (p_org, p_type, p_agg, p_id, public.host_person_ref(), coalesce(p_payload, '{}'::jsonb))
$$;

CREATE OR REPLACE FUNCTION public.mnt_type_usable(p_org uuid, p_type uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM public.mnt_asset_types t WHERE t.id = p_type AND t.active AND (
           t.org_id = p_org OR (t.org_id IS NULL AND EXISTS (
             SELECT 1 FROM public.mnt_org_asset_types a WHERE a.org_id = p_org AND a.asset_type_id = t.id AND a.enabled))))
$$;

-- ------------------------------------------------------ trigger functions --
CREATE OR REPLACE FUNCTION public.mnt_tg_touch() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;

CREATE OR REPLACE FUNCTION public.mnt_tg_code() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' THEN
    NEW.code := public.mnt_next_code(NEW.org_id, TG_ARGV[0], TG_ARGV[1]);
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.mnt_tg_append_only() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN RAISE EXCEPTION 'mnt: % es un historial inmutable', TG_TABLE_NAME USING ERRCODE = '55000'; END $$;

-- Referenced catalogue rows must be global or belong to the same organisation.
CREATE OR REPLACE FUNCTION public.mnt_tg_catalog_scope() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE fam uuid; typ uuid; o uuid;
BEGIN
  IF TG_TABLE_NAME = 'mnt_asset_types' THEN fam := NEW.family_id;
  ELSIF TG_TABLE_NAME IN ('mnt_checklist_templates','mnt_certificate_templates','mnt_plans') THEN fam := NEW.asset_family_id;
  END IF;
  IF fam IS NOT NULL THEN
    SELECT org_id INTO o FROM public.mnt_asset_families WHERE id = fam;
    IF o IS NOT NULL AND o IS DISTINCT FROM NEW.org_id THEN
      RAISE EXCEPTION 'mnt: familia de otra organización' USING ERRCODE = '23503';
    END IF;
  END IF;
  IF TG_TABLE_NAME = 'mnt_org_asset_types' THEN
    SELECT org_id INTO o FROM public.mnt_asset_types WHERE id = NEW.asset_type_id;
    IF o IS NOT NULL AND o IS DISTINCT FROM NEW.org_id THEN
      RAISE EXCEPTION 'mnt: tipo de otra organización' USING ERRCODE = '23503';
    END IF;
  ELSIF TG_TABLE_NAME IN ('mnt_assets','mnt_checklist_template_types','mnt_plan_type_templates') THEN
    typ := NEW.asset_type_id;
    IF NOT public.mnt_type_usable(NEW.org_id, typ) THEN
      RAISE EXCEPTION 'mnt: tipo de activo no habilitado para la organización' USING ERRCODE = '23503';
    END IF;
  END IF;
  RETURN NEW;
END $$;

-- Site references are validated by the host (ICORE centres).
CREATE OR REPLACE FUNCTION public.mnt_tg_site_scope() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.site_ref IS NOT NULL AND NOT coalesce(public.host_site_in_org(NEW.org_id, NEW.site_ref), false) THEN
    RAISE EXCEPTION 'mnt: el centro no pertenece a la organización' USING ERRCODE = '23503';
  END IF;
  RETURN NEW;
END $$;

-- Sessions: clients cannot close/reopen or rewrite a closed session directly (only via RPC).
CREATE OR REPLACE FUNCTION public.mnt_tg_session_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT public.mnt_is_client() THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    RAISE EXCEPTION 'mnt: las sesiones se crean con mnt_create_session' USING ERRCODE = '42501';
  END IF;
  IF OLD.status IN ('closed','cancelled') THEN
    RAISE EXCEPTION 'mnt: sesión cerrada, no editable' USING ERRCODE = '55000';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status OR NEW.closed_at IS DISTINCT FROM OLD.closed_at
     OR NEW.closed_by_ref IS DISTINCT FROM OLD.closed_by_ref OR NEW.closed_by_snapshot IS DISTINCT FROM OLD.closed_by_snapshot
     OR NEW.outcome IS DISTINCT FROM OLD.outcome OR NEW.code IS DISTINCT FROM OLD.code
     OR NEW.org_id IS DISTINCT FROM OLD.org_id OR NEW.plan_id IS DISTINCT FROM OLD.plan_id
     OR NEW.request_id IS DISTINCT FROM OLD.request_id OR NEW.reopen_reason IS DISTINCT FROM OLD.reopen_reason THEN
    RAISE EXCEPTION 'mnt: campos de estado solo modificables por RPC' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;

-- Items/responses: frozen when the session is closed; responses must match the item's checklist version.
CREATE OR REPLACE FUNCTION public.mnt_tg_item_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE st text; sess uuid; ver uuid; qver uuid;
BEGIN
  IF TG_TABLE_NAME = 'mnt_session_items' THEN
    sess := CASE WHEN TG_OP = 'DELETE' THEN OLD.session_id ELSE NEW.session_id END;
  ELSE
    SELECT session_id, checklist_version_id INTO sess, ver FROM public.mnt_session_items
     WHERE id = CASE WHEN TG_OP = 'DELETE' THEN OLD.item_id ELSE NEW.item_id END;
    IF TG_OP <> 'DELETE' THEN
      SELECT version_id INTO qver FROM public.mnt_checklist_questions WHERE id = NEW.question_id;
      IF qver IS DISTINCT FROM ver THEN
        RAISE EXCEPTION 'mnt: la pregunta no pertenece a la versión del checklist del equipo' USING ERRCODE = '23514';
      END IF;
    END IF;
  END IF;
  IF public.mnt_is_client() THEN
    SELECT status INTO st FROM public.mnt_sessions WHERE id = sess;
    IF st IS NULL OR st IN ('closed','cancelled') THEN
      RAISE EXCEPTION 'mnt: sesión cerrada, datos inmutables' USING ERRCODE = '55000';
    END IF;
    IF TG_TABLE_NAME = 'mnt_session_items' AND TG_OP = 'UPDATE' AND (NEW.session_id <> OLD.session_id
       OR NEW.asset_id <> OLD.asset_id OR NEW.checklist_version_id <> OLD.checklist_version_id OR NEW.org_id <> OLD.org_id) THEN
      RAISE EXCEPTION 'mnt: vínculos del equipo inmutables' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;

-- Published checklist versions and their questions are immutable.
CREATE OR REPLACE FUNCTION public.mnt_tg_checklist_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE pub boolean;
BEGIN
  IF TG_TABLE_NAME = 'mnt_checklist_versions' THEN
    IF TG_OP = 'DELETE' AND OLD.is_published THEN
      RAISE EXCEPTION 'mnt: versión publicada inmutable' USING ERRCODE = '55000';
    END IF;
    IF TG_OP = 'UPDATE' AND OLD.is_published THEN
      RAISE EXCEPTION 'mnt: versión publicada inmutable' USING ERRCODE = '55000';
    END IF;
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;
  SELECT is_published INTO pub FROM public.mnt_checklist_versions
   WHERE id = CASE WHEN TG_OP = 'DELETE' THEN OLD.version_id ELSE NEW.version_id END;
  IF pub OR (TG_OP = 'UPDATE' AND (SELECT is_published FROM public.mnt_checklist_versions WHERE id = OLD.version_id)) THEN
    RAISE EXCEPTION 'mnt: preguntas de una versión publicada inmutables' USING ERRCODE = '55000';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;

-- Incidents: clients may only edit descriptive fields; status changes go through RPC with history.
CREATE OR REPLACE FUNCTION public.mnt_tg_incident_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT public.mnt_is_client() THEN RETURN NEW; END IF;
  IF NEW.status IS DISTINCT FROM OLD.status OR NEW.resolved_at IS DISTINCT FROM OLD.resolved_at
     OR NEW.closed_at IS DISTINCT FROM OLD.closed_at OR NEW.source IS DISTINCT FROM OLD.source
     OR NEW.source_response_id IS DISTINCT FROM OLD.source_response_id OR NEW.code IS DISTINCT FROM OLD.code
     OR NEW.org_id IS DISTINCT FROM OLD.org_id OR NEW.asset_id IS DISTINCT FROM OLD.asset_id
     OR NEW.reporter_ref IS DISTINCT FROM OLD.reporter_ref OR NEW.reporter_snapshot IS DISTINCT FROM OLD.reporter_snapshot THEN
    RAISE EXCEPTION 'mnt: campos de estado de incidencia solo modificables por RPC' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;

-- Certificates: emission data is frozen for everyone; PDF reference set once; only issued -> revoked.
CREATE OR REPLACE FUNCTION public.mnt_tg_certificate_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'mnt: los certificados no se borran (se revocan)' USING ERRCODE = '55000';
  END IF;
  IF NEW.org_id IS DISTINCT FROM OLD.org_id OR NEW.code IS DISTINCT FROM OLD.code
     OR NEW.session_id IS DISTINCT FROM OLD.session_id OR NEW.issued_on IS DISTINCT FROM OLD.issued_on
     OR NEW.valid_until IS DISTINCT FROM OLD.valid_until OR NEW.title IS DISTINCT FROM OLD.title
     OR NEW.issuer_ref IS DISTINCT FROM OLD.issuer_ref OR NEW.issuer_snapshot IS DISTINCT FROM OLD.issuer_snapshot
     OR NEW.snapshot IS DISTINCT FROM OLD.snapshot OR NEW.is_external IS DISTINCT FROM OLD.is_external
     OR NEW.external_provider IS DISTINCT FROM OLD.external_provider OR NEW.external_number IS DISTINCT FROM OLD.external_number THEN
    RAISE EXCEPTION 'mnt: datos de emisión del certificado inmutables' USING ERRCODE = '55000';
  END IF;
  IF OLD.document_version_ref IS NOT NULL AND (NEW.document_version_ref IS DISTINCT FROM OLD.document_version_ref
     OR NEW.pdf_sha256 IS DISTINCT FROM OLD.pdf_sha256) THEN
    RAISE EXCEPTION 'mnt: el PDF emitido no se sustituye' USING ERRCODE = '55000';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status AND NOT (OLD.status = 'issued' AND NEW.status = 'revoked') THEN
    RAISE EXCEPTION 'mnt: transición de certificado no permitida' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.mnt_tg_certificate_item_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN RAISE EXCEPTION 'mnt: ítems de certificado inmutables' USING ERRCODE = '55000'; END $$;

-- ----------------------------------------------------------------- triggers --
DO $triggers$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['mnt_asset_families','mnt_asset_types','mnt_org_asset_types','mnt_assets','mnt_kit_items',
    'mnt_checklist_templates','mnt_certificate_templates','mnt_plans','mnt_sessions','mnt_session_items',
    'mnt_incidents','mnt_certificates'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS mnt_touch ON public.%I', t);
    EXECUTE format('CREATE TRIGGER mnt_touch BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.mnt_tg_touch()', t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['mnt_asset_types','mnt_org_asset_types','mnt_assets','mnt_checklist_templates',
    'mnt_checklist_template_types','mnt_certificate_templates','mnt_plans','mnt_plan_type_templates'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS mnt_catalog_scope ON public.%I', t);
    EXECUTE format('CREATE TRIGGER mnt_catalog_scope BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.mnt_tg_catalog_scope()', t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['mnt_assets','mnt_checklist_template_sites','mnt_plan_sites','mnt_sessions','mnt_incidents'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS mnt_site_scope ON public.%I', t);
    EXECUTE format('CREATE TRIGGER mnt_site_scope BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.mnt_tg_site_scope()', t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['mnt_session_history','mnt_incident_history'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS mnt_append_only ON public.%I', t);
    EXECUTE format('CREATE TRIGGER mnt_append_only BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.mnt_tg_append_only()', t);
  END LOOP;
END
$triggers$;

DROP TRIGGER IF EXISTS mnt_code ON public.mnt_assets;
CREATE TRIGGER mnt_code BEFORE INSERT ON public.mnt_assets FOR EACH ROW EXECUTE FUNCTION public.mnt_tg_code('asset', 'AST');
DROP TRIGGER IF EXISTS mnt_code ON public.mnt_sessions;
CREATE TRIGGER mnt_code BEFORE INSERT ON public.mnt_sessions FOR EACH ROW EXECUTE FUNCTION public.mnt_tg_code('session', 'MTS');
DROP TRIGGER IF EXISTS mnt_code ON public.mnt_incidents;
CREATE TRIGGER mnt_code BEFORE INSERT ON public.mnt_incidents FOR EACH ROW EXECUTE FUNCTION public.mnt_tg_code('incident', 'INC');
DROP TRIGGER IF EXISTS mnt_code ON public.mnt_certificates;
CREATE TRIGGER mnt_code BEFORE INSERT ON public.mnt_certificates FOR EACH ROW EXECUTE FUNCTION public.mnt_tg_code('certificate', 'CERT');
DROP TRIGGER IF EXISTS mnt_guard ON public.mnt_sessions;
CREATE TRIGGER mnt_guard BEFORE INSERT OR UPDATE ON public.mnt_sessions FOR EACH ROW EXECUTE FUNCTION public.mnt_tg_session_guard();
DROP TRIGGER IF EXISTS mnt_guard ON public.mnt_session_items;
CREATE TRIGGER mnt_guard BEFORE INSERT OR UPDATE OR DELETE ON public.mnt_session_items FOR EACH ROW EXECUTE FUNCTION public.mnt_tg_item_guard();
DROP TRIGGER IF EXISTS mnt_guard ON public.mnt_responses;
CREATE TRIGGER mnt_guard BEFORE INSERT OR UPDATE OR DELETE ON public.mnt_responses FOR EACH ROW EXECUTE FUNCTION public.mnt_tg_item_guard();
DROP TRIGGER IF EXISTS mnt_guard ON public.mnt_checklist_versions;
CREATE TRIGGER mnt_guard BEFORE UPDATE OR DELETE ON public.mnt_checklist_versions FOR EACH ROW EXECUTE FUNCTION public.mnt_tg_checklist_guard();
DROP TRIGGER IF EXISTS mnt_guard ON public.mnt_checklist_questions;
CREATE TRIGGER mnt_guard BEFORE INSERT OR UPDATE OR DELETE ON public.mnt_checklist_questions FOR EACH ROW EXECUTE FUNCTION public.mnt_tg_checklist_guard();
DROP TRIGGER IF EXISTS mnt_guard ON public.mnt_incidents;
CREATE TRIGGER mnt_guard BEFORE UPDATE ON public.mnt_incidents FOR EACH ROW EXECUTE FUNCTION public.mnt_tg_incident_guard();
DROP TRIGGER IF EXISTS mnt_guard ON public.mnt_certificates;
CREATE TRIGGER mnt_guard BEFORE UPDATE OR DELETE ON public.mnt_certificates FOR EACH ROW EXECUTE FUNCTION public.mnt_tg_certificate_guard();
DROP TRIGGER IF EXISTS mnt_guard ON public.mnt_certificate_items;
CREATE TRIGGER mnt_guard BEFORE UPDATE OR DELETE ON public.mnt_certificate_items FOR EACH ROW EXECUTE FUNCTION public.mnt_tg_certificate_item_guard();

-- --------------------------------------------------------------------- RPC --
-- Host provisioning: register an organisation (service_role / installer only).
CREATE OR REPLACE FUNCTION public.mnt_register_org(p_org uuid) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  INSERT INTO public.mnt_orgs(org_id) VALUES (p_org) ON CONFLICT DO NOTHING
$$;

-- Publish a checklist version (freezes it).
CREATE OR REPLACE FUNCTION public.mnt_publish_checklist_version(p_org uuid, p_version uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM public.mnt_assert_perm(p_org, 'mnt.admin');
  UPDATE public.mnt_checklist_versions SET is_published = true, published_at = now(),
         published_by_ref = public.host_person_ref(), published_by_snapshot = public.mnt_actor_snapshot()
   WHERE org_id = p_org AND id = p_version AND NOT is_published;
  IF NOT FOUND THEN RAISE EXCEPTION 'mnt: versión no encontrada o ya publicada' USING ERRCODE = 'P0002'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.mnt_checklist_questions WHERE version_id = p_version) THEN
    RAISE EXCEPTION 'mnt: una versión sin preguntas no se publica' USING ERRCODE = '23514';
  END IF;
  PERFORM public.mnt_emit(p_org, 'checklist.version_published', 'checklist_version', p_version, '{}');
END $$;

-- Create a session idempotently (same request_id -> same session).
CREATE OR REPLACE FUNCTION public.mnt_create_session(
  p_org uuid, p_request_id uuid, p_plan uuid, p_site uuid DEFAULT NULL,
  p_scheduled_for date DEFAULT NULL, p_asset_ids uuid[] DEFAULT NULL) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE sid uuid; me uuid := public.host_person_ref(); missing int;
BEGIN
  PERFORM public.mnt_assert_perm(p_org, 'mnt.run');
  SELECT id INTO sid FROM public.mnt_sessions WHERE org_id = p_org AND request_id = p_request_id;
  IF sid IS NOT NULL THEN RETURN sid; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.mnt_plans WHERE org_id = p_org AND id = p_plan AND deleted_at IS NULL AND status = 'active') THEN
    RAISE EXCEPTION 'mnt: plan no encontrado' USING ERRCODE = 'P0002';
  END IF;
  INSERT INTO public.mnt_sessions(org_id, request_id, plan_id, site_ref, scheduled_for, technician_ref, technician_snapshot, created_by_ref)
  VALUES (p_org, p_request_id, p_plan, p_site, p_scheduled_for, me, public.mnt_actor_snapshot(), me)
  ON CONFLICT (org_id, request_id) DO NOTHING
  RETURNING id INTO sid;
  IF sid IS NULL THEN
    SELECT id INTO sid FROM public.mnt_sessions WHERE org_id = p_org AND request_id = p_request_id;
    RETURN sid;
  END IF;
  INSERT INTO public.mnt_session_items(org_id, session_id, asset_id, checklist_version_id)
  SELECT p_org, sid, a.id, v.id
    FROM public.mnt_plan_assets pa
    JOIN public.mnt_assets a ON a.org_id = pa.org_id AND a.id = pa.asset_id AND a.deleted_at IS NULL
    JOIN public.mnt_plan_type_templates ptt ON ptt.plan_id = pa.plan_id AND ptt.asset_type_id = a.asset_type_id
    JOIN LATERAL (SELECT cv.id FROM public.mnt_checklist_versions cv
                   WHERE cv.template_id = ptt.checklist_template_id AND cv.is_published
                   ORDER BY cv.version DESC LIMIT 1) v ON true
   WHERE pa.org_id = p_org AND pa.plan_id = p_plan AND (pa.end_on IS NULL OR pa.end_on >= current_date)
     AND (p_asset_ids IS NULL OR a.id = ANY (p_asset_ids));
  GET DIAGNOSTICS missing = ROW_COUNT;
  IF missing = 0 THEN
    RAISE EXCEPTION 'mnt: el plan no tiene equipos con checklist publicado' USING ERRCODE = '23514';
  END IF;
  PERFORM public.mnt_emit(p_org, 'session.created', 'session', sid, jsonb_build_object('plan_id', p_plan));
  RETURN sid;
END $$;

-- Close a session atomically: status + history + incidents per failed response + certificate + outbox.
CREATE OR REPLACE FUNCTION public.mnt_close_session(p_org uuid, p_session uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  s public.mnt_sessions%ROWTYPE;
  me uuid := public.host_person_ref();
  snap jsonb := public.mnt_actor_snapshot();
  v_outcome text; n_inc int := 0; cert uuid; needs_cert boolean; tpl jsonb;
BEGIN
  PERFORM public.mnt_assert_perm(p_org, 'mnt.close');
  SELECT * INTO s FROM public.mnt_sessions WHERE org_id = p_org AND id = p_session FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'mnt: sesión no encontrada' USING ERRCODE = 'P0002'; END IF;
  IF s.status NOT IN ('in_progress','reopened') THEN
    RAISE EXCEPTION 'mnt: la sesión no se puede cerrar desde %', s.status USING ERRCODE = '55000';
  END IF;
  IF EXISTS (SELECT 1 FROM public.mnt_session_items WHERE session_id = p_session AND result = 'pending') THEN
    RAISE EXCEPTION 'mnt: hay equipos pendientes' USING ERRCODE = '23514';
  END IF;
  v_outcome := CASE WHEN EXISTS (SELECT 1 FROM public.mnt_session_items WHERE session_id = p_session AND result = 'failed')
                    THEN 'with_incidents' ELSE 'ok' END;
  UPDATE public.mnt_sessions SET status = 'closed', closed_at = now(), closed_by_ref = me,
         closed_by_snapshot = snap, outcome = v_outcome
   WHERE id = p_session;
  INSERT INTO public.mnt_session_history(org_id, session_id, event, actor_ref, actor_snapshot)
  VALUES (p_org, p_session, 'closed', me, snap);

  WITH failed AS (
    SELECT r.id AS response_id, i.asset_id, q.prompt
      FROM public.mnt_responses r
      JOIN public.mnt_session_items i ON i.id = r.item_id
      JOIN public.mnt_checklist_questions q ON q.id = r.question_id
     WHERE i.session_id = p_session AND r.is_fail AND q.creates_incident
       AND NOT EXISTS (SELECT 1 FROM public.mnt_incidents x WHERE x.org_id = p_org AND x.source_response_id = r.id)),
  ins AS (
    INSERT INTO public.mnt_incidents(org_id, asset_id, site_ref, source, source_response_id, title, severity, status, reporter_ref, reporter_snapshot)
    SELECT p_org, f.asset_id, s.site_ref, 'checklist', f.response_id, left('Fallo: ' || f.prompt, 200), 'medium', 'open', me, snap
      FROM failed f
    ON CONFLICT ON CONSTRAINT mnt_incidents_one_per_response DO NOTHING
    RETURNING id),
  hist AS (
    INSERT INTO public.mnt_incident_history(org_id, incident_id, from_status, to_status, actor_ref, actor_snapshot, note)
    SELECT p_org, id, NULL, 'open', me, snap, 'Creada al cerrar ' || s.code FROM ins RETURNING incident_id),
  evt AS (
    INSERT INTO public.mnt_outbox(org_id, event_type, aggregate_type, aggregate_id, actor_ref, payload)
    SELECT p_org, 'incident.opened', 'incident', incident_id, me, jsonb_build_object('session_id', p_session) FROM hist
    RETURNING 1)
  SELECT count(*) INTO n_inc FROM evt;

  SELECT f.requires_certificate INTO needs_cert
    FROM public.mnt_plans p JOIN public.mnt_asset_families f ON f.id = p.asset_family_id WHERE p.id = s.plan_id;
  IF needs_cert THEN
    SELECT to_jsonb(ct) - 'org_id' - 'created_at' - 'updated_at' - 'deleted_at' INTO tpl
      FROM public.mnt_plans p JOIN public.mnt_certificate_templates ct ON ct.org_id = p.org_id AND ct.id = p.certificate_template_id
     WHERE p.id = s.plan_id;
    INSERT INTO public.mnt_certificates(org_id, session_id, title, issuer_ref, issuer_snapshot, snapshot)
    SELECT p_org, p_session, coalesce(tpl->>'title', 'Certificado de mantenimiento'), me, snap,
           jsonb_build_object('plan', jsonb_build_object('id', p.id, 'code', p.code, 'name', p.name),
                              'session', jsonb_build_object('code', s.code, 'closed_at', now(), 'site_ref', s.site_ref),
                              'template', tpl, 'closed_by', snap,
                              'items', (SELECT coalesce(jsonb_agg(jsonb_build_object('asset_id', a.id, 'code', a.code, 'name', a.name,
                                         'result', i.result) ORDER BY a.code), '[]'::jsonb)
                                          FROM public.mnt_session_items i JOIN public.mnt_assets a ON a.id = i.asset_id
                                         WHERE i.session_id = p_session))
      FROM public.mnt_plans p WHERE p.id = s.plan_id
    ON CONFLICT ON CONSTRAINT mnt_certificates_one_per_session DO NOTHING
    RETURNING id INTO cert;
    IF cert IS NOT NULL THEN
      INSERT INTO public.mnt_certificate_items(org_id, certificate_id, asset_id, session_item_id, result)
      SELECT p_org, cert, i.asset_id, i.id,
             CASE i.result WHEN 'ok' THEN 'ok' WHEN 'failed' THEN 'failed' ELSE 'na' END
        FROM public.mnt_session_items i WHERE i.session_id = p_session;
      PERFORM public.mnt_emit(p_org, 'certificate.issued', 'certificate', cert, jsonb_build_object('session_id', p_session));
    END IF;
  END IF;

  PERFORM public.mnt_emit(p_org, 'session.closed', 'session', p_session,
    jsonb_build_object('outcome', v_outcome, 'incidents', n_inc, 'certificate_id', cert));
  RETURN jsonb_build_object('session_id', p_session, 'outcome', v_outcome, 'incidents_created', n_inc, 'certificate_id', cert);
END $$;

CREATE OR REPLACE FUNCTION public.mnt_reopen_session(p_org uuid, p_session uuid, p_reason text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE st text; me uuid := public.host_person_ref(); snap jsonb := public.mnt_actor_snapshot();
BEGIN
  PERFORM public.mnt_assert_perm(p_org, 'mnt.reopen');
  IF coalesce(trim(p_reason), '') = '' THEN RAISE EXCEPTION 'mnt: motivo obligatorio' USING ERRCODE = '23514'; END IF;
  SELECT status INTO st FROM public.mnt_sessions WHERE org_id = p_org AND id = p_session FOR UPDATE;
  IF st IS NULL THEN RAISE EXCEPTION 'mnt: sesión no encontrada' USING ERRCODE = 'P0002'; END IF;
  IF st <> 'closed' THEN RAISE EXCEPTION 'mnt: solo se reabren sesiones cerradas' USING ERRCODE = '55000'; END IF;
  UPDATE public.mnt_sessions SET status = 'reopened', reopen_reason = p_reason WHERE id = p_session;
  INSERT INTO public.mnt_session_history(org_id, session_id, event, actor_ref, actor_snapshot, reason)
  VALUES (p_org, p_session, 'reopened', me, snap, p_reason);
  PERFORM public.mnt_emit(p_org, 'session.reopened', 'session', p_session, jsonb_build_object('reason', p_reason));
END $$;

CREATE OR REPLACE FUNCTION public.mnt_open_incident(
  p_org uuid, p_title text, p_description text DEFAULT NULL, p_severity text DEFAULT 'medium',
  p_asset uuid DEFAULT NULL, p_site uuid DEFAULT NULL) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE iid uuid; me uuid := public.host_person_ref(); snap jsonb := public.mnt_actor_snapshot();
BEGIN
  PERFORM public.mnt_assert_perm(p_org, 'mnt.run');
  IF coalesce(trim(p_title), '') = '' THEN RAISE EXCEPTION 'mnt: título obligatorio' USING ERRCODE = '23514'; END IF;
  INSERT INTO public.mnt_incidents(org_id, asset_id, site_ref, source, title, description, severity, reporter_ref, reporter_snapshot)
  VALUES (p_org, p_asset, p_site, 'manual', trim(p_title), p_description, p_severity, me, snap) RETURNING id INTO iid;
  INSERT INTO public.mnt_incident_history(org_id, incident_id, from_status, to_status, actor_ref, actor_snapshot)
  VALUES (p_org, iid, NULL, 'open', me, snap);
  PERFORM public.mnt_emit(p_org, 'incident.opened', 'incident', iid, '{}');
  RETURN iid;
END $$;

-- Transition table mirrors domain/incident-rules.ts.
CREATE OR REPLACE FUNCTION public.mnt_change_incident_status(
  p_org uuid, p_incident uuid, p_from text, p_to text, p_note text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE cur text; me uuid := public.host_person_ref(); snap jsonb := public.mnt_actor_snapshot();
BEGIN
  PERFORM public.mnt_assert_perm(p_org, 'mnt.run');
  SELECT status INTO cur FROM public.mnt_incidents WHERE org_id = p_org AND id = p_incident FOR UPDATE;
  IF cur IS NULL THEN RAISE EXCEPTION 'mnt: incidencia no encontrada' USING ERRCODE = 'P0002'; END IF;
  IF cur IS DISTINCT FROM p_from THEN
    RAISE EXCEPTION 'mnt: la incidencia cambió de estado (%), recarga', cur USING ERRCODE = '40001';
  END IF;
  IF NOT ((cur, p_to) IN (('open','in_progress'),('open','resolved'),('in_progress','open'),('in_progress','resolved'),
                           ('resolved','closed'),('resolved','in_progress'),('closed','in_progress'))) THEN
    RAISE EXCEPTION 'mnt: transición no permitida % -> %', cur, p_to USING ERRCODE = '55000';
  END IF;
  UPDATE public.mnt_incidents SET status = p_to,
         resolved_at = CASE WHEN p_to = 'resolved' THEN now() WHEN p_to IN ('open','in_progress') THEN NULL ELSE resolved_at END,
         closed_at = CASE WHEN p_to = 'closed' THEN now() WHEN p_to IN ('open','in_progress') THEN NULL ELSE closed_at END,
         resolution_notes = CASE WHEN p_to = 'resolved' THEN coalesce(p_note, resolution_notes) ELSE resolution_notes END
   WHERE id = p_incident;
  INSERT INTO public.mnt_incident_history(org_id, incident_id, from_status, to_status, actor_ref, actor_snapshot, note)
  VALUES (p_org, p_incident, cur, p_to, me, snap, p_note);
  PERFORM public.mnt_emit(p_org, 'incident.status_changed', 'incident', p_incident, jsonb_build_object('from', cur, 'to', p_to));
END $$;

-- Attach the server-generated PDF: the host document system must hold that version with that hash.
CREATE OR REPLACE FUNCTION public.mnt_attach_certificate_pdf(p_org uuid, p_cert uuid, p_doc_ref uuid, p_sha256 text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM public.mnt_assert_perm(p_org, 'mnt.certify');
  IF public.host_document_version_sha(p_org, p_doc_ref) IS DISTINCT FROM p_sha256 THEN
    RAISE EXCEPTION 'mnt: el documento no existe en la organización o su hash no coincide' USING ERRCODE = '23514';
  END IF;
  UPDATE public.mnt_certificates SET document_version_ref = p_doc_ref, pdf_sha256 = p_sha256
   WHERE org_id = p_org AND id = p_cert AND status = 'issued' AND document_version_ref IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'mnt: certificado no encontrado, revocado o con PDF ya emitido' USING ERRCODE = '55000'; END IF;
  PERFORM public.mnt_emit(p_org, 'certificate.pdf_attached', 'certificate', p_cert, jsonb_build_object('sha256', p_sha256));
END $$;

CREATE OR REPLACE FUNCTION public.mnt_revoke_certificate(p_org uuid, p_cert uuid, p_reason text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM public.mnt_assert_perm(p_org, 'mnt.certify');
  UPDATE public.mnt_certificates SET status = 'revoked', revoked_at = now(), revoked_by_ref = public.host_person_ref(),
         notes = coalesce(p_reason, notes)
   WHERE org_id = p_org AND id = p_cert AND status = 'issued';
  IF NOT FOUND THEN RAISE EXCEPTION 'mnt: certificado no encontrado o ya revocado' USING ERRCODE = '55000'; END IF;
  PERFORM public.mnt_emit(p_org, 'certificate.revoked', 'certificate', p_cert, jsonb_build_object('reason', p_reason));
END $$;

CREATE OR REPLACE FUNCTION public.mnt_register_external_certificate(
  p_org uuid, p_title text, p_issued_on date, p_valid_until date, p_provider text, p_number text,
  p_asset uuid, p_doc_ref uuid, p_sha256 text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE cid uuid; me uuid := public.host_person_ref();
BEGIN
  PERFORM public.mnt_assert_perm(p_org, 'mnt.certify');
  IF coalesce(trim(p_provider), '') = '' THEN RAISE EXCEPTION 'mnt: proveedor obligatorio' USING ERRCODE = '23514'; END IF;
  IF public.host_document_version_sha(p_org, p_doc_ref) IS DISTINCT FROM p_sha256 THEN
    RAISE EXCEPTION 'mnt: el documento no existe en la organización o su hash no coincide' USING ERRCODE = '23514';
  END IF;
  INSERT INTO public.mnt_certificates(org_id, title, issued_on, valid_until, issuer_ref, issuer_snapshot,
         is_external, external_provider, external_number, document_version_ref, pdf_sha256)
  VALUES (p_org, p_title, p_issued_on, p_valid_until, me, public.mnt_actor_snapshot(), true, p_provider, p_number, p_doc_ref, p_sha256)
  RETURNING id INTO cid;
  IF p_asset IS NOT NULL THEN
    INSERT INTO public.mnt_certificate_items(org_id, certificate_id, asset_id, result) VALUES (p_org, cid, p_asset, 'ok');
  END IF;
  PERFORM public.mnt_emit(p_org, 'certificate.issued', 'certificate', cid, jsonb_build_object('external', true));
  RETURN cid;
END $$;

-- ---------------------------------------------------------- grants + RLS --
DO $security$
DECLARE
  t text; p text; f regprocedure;
  all_tables text[] := ARRAY['mnt_installation','mnt_catalog_versions','mnt_orgs','mnt_asset_families','mnt_asset_types',
    'mnt_org_asset_types','mnt_assets','mnt_kit_items','mnt_checklist_templates','mnt_checklist_template_types',
    'mnt_checklist_template_sites','mnt_checklist_versions','mnt_checklist_questions','mnt_certificate_templates',
    'mnt_plans','mnt_plan_sites','mnt_plan_assets','mnt_plan_type_templates','mnt_sessions','mnt_session_items',
    'mnt_responses','mnt_session_history','mnt_incidents','mnt_incident_history','mnt_certificates',
    'mnt_certificate_items','mnt_counters','mnt_outbox'];
  -- table => permission required to write (clients); reads always need mnt.view
  writable jsonb := '{
    "mnt_org_asset_types":"mnt.admin", "mnt_assets":"mnt.manage_assets", "mnt_kit_items":"mnt.manage_assets",
    "mnt_checklist_templates":"mnt.admin", "mnt_checklist_template_types":"mnt.admin",
    "mnt_checklist_template_sites":"mnt.admin", "mnt_checklist_versions":"mnt.admin",
    "mnt_checklist_questions":"mnt.admin", "mnt_certificate_templates":"mnt.admin", "mnt_plans":"mnt.admin",
    "mnt_plan_sites":"mnt.admin", "mnt_plan_assets":"mnt.admin", "mnt_plan_type_templates":"mnt.admin",
    "mnt_session_items":"mnt.run", "mnt_responses":"mnt.run"}';
  update_only jsonb := '{"mnt_sessions":"mnt.run", "mnt_incidents":"mnt.run"}';
  read_only text[] := ARRAY['mnt_session_history','mnt_incident_history','mnt_certificates','mnt_certificate_items'];
BEGIN
  FOREACH t IN ARRAY all_tables LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated', t);
    EXECUTE format('GRANT SELECT ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', p, t);
    END LOOP;
    -- the installer/owner and service_role act as host infrastructure
    EXECUTE format('CREATE POLICY mnt_service ON public.%I TO service_role USING (true) WITH CHECK (true)', t);
  END LOOP;
  EXECUTE 'GRANT UPDATE (processed_at, attempts, last_error) ON public.mnt_outbox TO service_role';
  EXECUTE 'GRANT INSERT ON public.mnt_orgs TO service_role';

  -- catalogue (global rows readable by any authenticated user; only org rows writable)
  FOREACH t IN ARRAY ARRAY['mnt_asset_families','mnt_asset_types'] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('CREATE POLICY mnt_read ON public.%I FOR SELECT TO authenticated USING (org_id IS NULL OR public.mnt_can(org_id, ''mnt.view''))', t);
    EXECUTE format('CREATE POLICY mnt_ins ON public.%I FOR INSERT TO authenticated WITH CHECK (org_id IS NOT NULL AND NOT is_system AND public.mnt_can(org_id, ''mnt.admin''))', t);
    EXECUTE format('CREATE POLICY mnt_upd ON public.%I FOR UPDATE TO authenticated USING (org_id IS NOT NULL AND public.mnt_can(org_id, ''mnt.admin'')) WITH CHECK (org_id IS NOT NULL AND NOT is_system AND public.mnt_can(org_id, ''mnt.admin''))', t);
    EXECUTE format('CREATE POLICY mnt_del ON public.%I FOR DELETE TO authenticated USING (org_id IS NOT NULL AND public.mnt_can(org_id, ''mnt.admin''))', t);
  END LOOP;
  EXECUTE 'GRANT SELECT ON public.mnt_installation, public.mnt_catalog_versions TO authenticated';
  EXECUTE 'CREATE POLICY mnt_read ON public.mnt_installation FOR SELECT TO authenticated USING (true)';
  EXECUTE 'CREATE POLICY mnt_read ON public.mnt_catalog_versions FOR SELECT TO authenticated USING (true)';

  FOR t, p IN SELECT key, value FROM jsonb_each_text(writable) LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('CREATE POLICY mnt_read ON public.%I FOR SELECT TO authenticated USING (public.mnt_can(org_id, ''mnt.view''))', t);
    EXECUTE format('CREATE POLICY mnt_ins ON public.%I FOR INSERT TO authenticated WITH CHECK (public.mnt_can(org_id, %L))', t, p);
    EXECUTE format('CREATE POLICY mnt_upd ON public.%I FOR UPDATE TO authenticated USING (public.mnt_can(org_id, %L)) WITH CHECK (public.mnt_can(org_id, %L))', t, p, p);
    EXECUTE format('CREATE POLICY mnt_del ON public.%I FOR DELETE TO authenticated USING (public.mnt_can(org_id, %L))', t, p);
  END LOOP;
  FOR t, p IN SELECT key, value FROM jsonb_each_text(update_only) LOOP
    EXECUTE format('GRANT SELECT, UPDATE ON public.%I TO authenticated', t);
    EXECUTE format('CREATE POLICY mnt_read ON public.%I FOR SELECT TO authenticated USING (public.mnt_can(org_id, ''mnt.view''))', t);
    EXECUTE format('CREATE POLICY mnt_upd ON public.%I FOR UPDATE TO authenticated USING (public.mnt_can(org_id, %L)) WITH CHECK (public.mnt_can(org_id, %L))', t, p, p);
  END LOOP;
  FOREACH t IN ARRAY read_only LOOP
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
    EXECUTE format('CREATE POLICY mnt_read ON public.%I FOR SELECT TO authenticated USING (public.mnt_can(org_id, ''mnt.view''))', t);
  END LOOP;

  -- functions: nothing executable by PUBLIC/anon; RPCs + mnt_can for authenticated
  FOR f IN SELECT oid::regprocedure FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname LIKE 'mnt\_%' LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
  END LOOP;
  FOREACH p IN ARRAY ARRAY['mnt_can(uuid,text)','mnt_is_client()','mnt_create_session(uuid,uuid,uuid,uuid,date,uuid[])',
    'mnt_close_session(uuid,uuid)','mnt_reopen_session(uuid,uuid,text)','mnt_open_incident(uuid,text,text,text,uuid,uuid)',
    'mnt_change_incident_status(uuid,uuid,text,text,text)','mnt_attach_certificate_pdf(uuid,uuid,uuid,text)',
    'mnt_revoke_certificate(uuid,uuid,text)','mnt_publish_checklist_version(uuid,uuid)',
    'mnt_register_external_certificate(uuid,text,date,date,text,text,uuid,uuid,text)'] LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', p);
  END LOOP;
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.mnt_register_org(uuid) TO service_role';
END
$security$;

INSERT INTO public.mnt_installation(version) VALUES (1) ON CONFLICT DO NOTHING;
COMMIT;
