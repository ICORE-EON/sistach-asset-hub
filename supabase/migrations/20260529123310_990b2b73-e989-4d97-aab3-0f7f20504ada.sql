
-- Fix: filtrar solo TABLAS (relkind='r'), no índices
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT n.nspname AS s, c.relname AS t
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname LIKE 'audit_logs_2%'
      AND n.nspname = 'public'
      AND c.relkind = 'r'
  LOOP
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', r.s, r.t);
    EXECUTE format('DROP POLICY IF EXISTS audit_logs_select ON %I.%I', r.s, r.t);
    EXECUTE format(
      'CREATE POLICY audit_logs_select ON %I.%I FOR SELECT TO authenticated USING (public.user_has_membership(company_id) AND public.user_role_in(company_id) IN (''administrator'',''system_manager'',''auditor''))',
      r.s, r.t
    );
  END LOOP;
END $$;

-- REVOKE público en funciones SECURITY DEFINER, GRANT solo a authenticated
REVOKE EXECUTE ON FUNCTION public.current_company_id()                   FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.user_has_membership(UUID)              FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.user_role_in(UUID)                     FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role_in(UUID, public.app_role)     FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_manage_company(UUID)               FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_manage_assets(UUID)                FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_run_maintenance(UUID)              FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_close_session(UUID)                FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_reopen_session(UUID)               FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_view(UUID)                         FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.user_company_ids()                     FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.next_code(UUID, TEXT, TEXT)            FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.current_company_id()                    TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_membership(UUID)               TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_role_in(UUID)                      TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role_in(UUID, public.app_role)      TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_company(UUID)                TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_assets(UUID)                 TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_run_maintenance(UUID)               TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_close_session(UUID)                 TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_reopen_session(UUID)                TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view(UUID)                          TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_company_ids()                      TO authenticated;
GRANT EXECUTE ON FUNCTION public.next_code(UUID, TEXT, TEXT)             TO authenticated;

-- Trigger functions: solo internas
REVOKE EXECUTE ON FUNCTION public.audit_trigger_fn() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user()  FROM PUBLIC, anon, authenticated;

-- search_path fijo en set_updated_at (faltaba)
ALTER FUNCTION public.set_updated_at() SET search_path = public;

-- Mover extensiones fuera de public
CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO authenticated, anon, service_role;
ALTER EXTENSION pgcrypto SET SCHEMA extensions;
ALTER EXTENSION pg_trgm  SET SCHEMA extensions;

-- search_path completo en todas las funciones (public + extensions)
ALTER FUNCTION public.current_company_id()                SET search_path = public, extensions;
ALTER FUNCTION public.user_has_membership(UUID)           SET search_path = public, extensions;
ALTER FUNCTION public.user_role_in(UUID)                  SET search_path = public, extensions;
ALTER FUNCTION public.has_role_in(UUID, public.app_role)  SET search_path = public, extensions;
ALTER FUNCTION public.can_manage_company(UUID)            SET search_path = public, extensions;
ALTER FUNCTION public.can_manage_assets(UUID)             SET search_path = public, extensions;
ALTER FUNCTION public.can_run_maintenance(UUID)           SET search_path = public, extensions;
ALTER FUNCTION public.can_close_session(UUID)             SET search_path = public, extensions;
ALTER FUNCTION public.can_reopen_session(UUID)            SET search_path = public, extensions;
ALTER FUNCTION public.can_view(UUID)                      SET search_path = public, extensions;
ALTER FUNCTION public.user_company_ids()                  SET search_path = public, extensions;
ALTER FUNCTION public.next_code(UUID, TEXT, TEXT)         SET search_path = public, extensions;
ALTER FUNCTION public.audit_trigger_fn()                  SET search_path = public, extensions;
ALTER FUNCTION public.handle_new_user()                   SET search_path = public, extensions;
ALTER FUNCTION public.set_updated_at()                    SET search_path = public, extensions;

ALTER ROLE authenticated SET search_path = public, extensions;
ALTER ROLE anon          SET search_path = public, extensions;
ALTER ROLE service_role  SET search_path = public, extensions;
