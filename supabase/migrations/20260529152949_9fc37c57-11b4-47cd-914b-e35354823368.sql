CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.audit_logs_ensure_partitions(p_months_ahead INT DEFAULT 3)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_start DATE;
  v_end DATE;
  v_name TEXT;
  v_created INT := 0;
  i INT;
BEGIN
  FOR i IN 0..p_months_ahead LOOP
    v_start := date_trunc('month', CURRENT_DATE + (i || ' months')::interval)::date;
    v_end   := (v_start + INTERVAL '1 month')::date;
    v_name  := format('audit_logs_%s', to_char(v_start, 'YYYY_MM'));
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = v_name) THEN
      EXECUTE format(
        'CREATE TABLE public.%I PARTITION OF public.audit_logs FOR VALUES FROM (%L) TO (%L)',
        v_name, v_start, v_end
      );
      v_created := v_created + 1;
    END IF;
  END LOOP;
  RETURN v_created;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.audit_logs_ensure_partitions(INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.audit_logs_ensure_partitions(INT) TO service_role;

CREATE OR REPLACE VIEW public.company_kpis
WITH (security_invoker = true) AS
SELECT
  c.id AS company_id,
  c.name AS company_name,
  (SELECT COUNT(*) FROM public.assets a
     WHERE a.company_id = c.id AND a.deleted_at IS NULL AND a.status = 'active') AS assets_active,
  (SELECT COUNT(*) FROM public.assets a
     WHERE a.company_id = c.id AND a.deleted_at IS NULL) AS assets_total,
  (SELECT COUNT(*) FROM public.maintenance_sessions s
     WHERE s.company_id = c.id AND s.status IN ('draft','in_progress')) AS sessions_open,
  (SELECT COUNT(*) FROM public.incidents i
     WHERE i.company_id = c.id AND i.status NOT IN ('closed','cancelled')) AS incidents_open,
  (SELECT COUNT(*) FROM public.vehicles v
     JOIN public.assets a ON a.id = v.asset_id
     WHERE a.company_id = c.id AND a.deleted_at IS NULL) AS vehicles_total
FROM public.companies c;

GRANT SELECT ON public.company_kpis TO authenticated;

SELECT cron.schedule(
  'audit-logs-create-partitions',
  '0 2 1 * *',
  $$SELECT public.audit_logs_ensure_partitions(3);$$
);

SELECT cron.schedule(
  'audit-logs-purge-old',
  '0 3 1 * *',
  $$SELECT public.audit_logs_purge_old();$$
);

SELECT public.audit_logs_ensure_partitions(3);
