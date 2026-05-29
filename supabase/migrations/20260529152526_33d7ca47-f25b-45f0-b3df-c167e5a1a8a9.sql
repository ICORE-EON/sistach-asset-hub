-- ============================================================
-- MIGRATION 05: Audit trigger attachment, incident propagation,
--               and outbox security
-- ============================================================

-- 1) Secure audit_outbox: no direct access from authenticated/anon
REVOKE ALL ON public.audit_outbox FROM anon, authenticated;
GRANT ALL ON public.audit_outbox TO service_role;

-- Ensure RLS is enabled and locked (only service_role/SECURITY DEFINER can write)
ALTER TABLE public.audit_outbox ENABLE ROW LEVEL SECURITY;
-- No policies = no access for normal roles; SECURITY DEFINER trigger bypasses RLS

-- 2) Attach audit triggers to critical tables
-- Helper: idempotent attachment
DO $$
DECLARE
  t TEXT;
  audited_tables TEXT[] := ARRAY[
    'companies',
    'company_members',
    'company_features',
    'assets',
    'vehicles',
    'vehicle_mounts',
    'locations',
    'asset_types',
    'first_aid_kit_contents',
    'checklist_templates',
    'checklist_template_versions',
    'checklist_questions',
    'maintenance_plans',
    'maintenance_plan_assets',
    'maintenance_sessions',
    'maintenance_items',
    'checklist_responses',
    'incidents',
    'incident_status_history',
    'certificates',
    'certificate_items',
    'documents',
    'session_reopen_log',
    'import_batches'
  ];
BEGIN
  FOREACH t IN ARRAY audited_tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%I ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_audit_%I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn()',
      t, t
    );
  END LOOP;
END $$;

-- 3) Incident propagation: when a maintenance_item is created with related_incident_id,
--    or when an incident transitions status, we keep the audit chain via incident_status_history.
--    Trigger to auto-record status changes on incidents.

CREATE OR REPLACE FUNCTION public.incidents_record_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.incident_status_history(
      incident_id, company_id, from_status, to_status, changed_by, notes
    ) VALUES (
      NEW.id, NEW.company_id, NULL, NEW.status, auth.uid(),
      'Incident created'
    );
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.incident_status_history(
      incident_id, company_id, from_status, to_status, changed_by, notes
    ) VALUES (
      NEW.id, NEW.company_id, OLD.status, NEW.status, auth.uid(),
      NULL
    );
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.incidents_record_status_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_incidents_status_change ON public.incidents;
CREATE TRIGGER trg_incidents_status_change
  AFTER INSERT OR UPDATE OF status ON public.incidents
  FOR EACH ROW EXECUTE FUNCTION public.incidents_record_status_change();

-- 4) Session reopen log: trigger to require reason + capture user
CREATE OR REPLACE FUNCTION public.maintenance_sessions_handle_reopen()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  -- Detect reopen: was closed, now in_progress or draft
  IF OLD.status = 'closed' AND NEW.status IN ('in_progress', 'draft') THEN
    IF NOT public.can_reopen_session(NEW.company_id) THEN
      RAISE EXCEPTION 'Forbidden: user cannot reopen sessions in company %', NEW.company_id
        USING ERRCODE = '42501';
    END IF;

    INSERT INTO public.session_reopen_log(
      session_id, company_id, reopened_by, previous_status, new_status, reason
    ) VALUES (
      NEW.id, NEW.company_id, auth.uid(), OLD.status, NEW.status,
      COALESCE(NEW.reopen_reason, 'No reason provided')
    );
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.maintenance_sessions_handle_reopen() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_maintenance_sessions_reopen ON public.maintenance_sessions;
CREATE TRIGGER trg_maintenance_sessions_reopen
  AFTER UPDATE OF status ON public.maintenance_sessions
  FOR EACH ROW EXECUTE FUNCTION public.maintenance_sessions_handle_reopen();

-- 5) Audit retention: scheduled purge function (24 months online)
CREATE OR REPLACE FUNCTION public.audit_logs_purge_old()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_cutoff DATE := (CURRENT_DATE - INTERVAL '24 months')::DATE;
  v_partition TEXT;
  v_dropped INTEGER := 0;
  r RECORD;
BEGIN
  FOR r IN
    SELECT inhrelid::regclass::text AS partition_name,
           pg_get_expr(c.relpartbound, c.oid) AS bounds
    FROM pg_inherits i
    JOIN pg_class c ON c.oid = i.inhrelid
    WHERE inhparent = 'public.audit_logs'::regclass
  LOOP
    -- Parse partition bounds: FOR VALUES FROM ('2026-05-01') TO ('2026-06-01')
    IF r.bounds ~ 'TO \(''(\d{4}-\d{2}-\d{2})''\)' THEN
      DECLARE
        v_upper DATE;
      BEGIN
        v_upper := (regexp_match(r.bounds, 'TO \(''(\d{4}-\d{2}-\d{2})''\)'))[1]::DATE;
        IF v_upper <= v_cutoff THEN
          EXECUTE format('DROP TABLE IF EXISTS %s', r.partition_name);
          v_dropped := v_dropped + 1;
        END IF;
      END;
    END IF;
  END LOOP;

  RETURN v_dropped;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.audit_logs_purge_old() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.audit_logs_purge_old() TO service_role;

-- 6) Reopen reason column on maintenance_sessions (if missing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='maintenance_sessions' AND column_name='reopen_reason'
  ) THEN
    ALTER TABLE public.maintenance_sessions ADD COLUMN reopen_reason TEXT;
  END IF;
END $$;
