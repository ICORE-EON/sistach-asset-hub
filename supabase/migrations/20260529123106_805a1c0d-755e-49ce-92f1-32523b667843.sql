
-- ============================================================================
-- MIGRACIÓN 01 — Identidad, tenant, multi-empresa, cimientos RLS y auditoría
-- ============================================================================
-- Contenido:
--   1. Extensiones
--   2. ENUMs base
--   3. companies, company_features, counters
--   4. profiles (mirror de auth.users)
--   5. company_members (pivote multi-empresa con rol)
--   6. Helpers SECURITY DEFINER (current_company_id, user_has_membership, has_role_in, can_*)
--   7. Función reopen_session() y next_code() (counters atómicos)
--   8. audit_outbox + audit_logs particionada por mes
--   9. Trigger universal de auditoría
--  10. Trigger profile auto-create on auth.users
--  11. updated_at trigger genérico
--  12. RLS sobre tablas base
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. EXTENSIONES
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ---------------------------------------------------------------------------
-- 2. ENUMs
-- ---------------------------------------------------------------------------
CREATE TYPE public.app_role AS ENUM (
  'administrator',
  'system_manager',
  'manager',
  'employee',
  'auditor'
);

CREATE TYPE public.audit_action AS ENUM (
  'INSERT', 'UPDATE', 'DELETE', 'REOPEN', 'SIGN', 'IMPORT'
);

-- ---------------------------------------------------------------------------
-- 3. companies
-- ---------------------------------------------------------------------------
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  cif TEXT NOT NULL UNIQUE,
  address TEXT,
  logo_url TEXT,
  primary_color TEXT,
  locale TEXT NOT NULL DEFAULT 'es' CHECK (locale IN ('es','ca')),
  timezone TEXT NOT NULL DEFAULT 'Europe/Madrid',
  plan TEXT NOT NULL DEFAULT 'mvp',
  seat_limit INT,
  storage_limit_mb INT,
  active_until DATE,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_companies_active ON public.companies(active) WHERE deleted_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.companies TO authenticated;
GRANT ALL ON public.companies TO service_role;

-- company_features (feature flags por empresa)
CREATE TABLE public.company_features (
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, feature_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_features TO authenticated;
GRANT ALL ON public.company_features TO service_role;

-- counters (generación atómica de códigos secuenciales por empresa)
CREATE TABLE public.counters (
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  scope TEXT NOT NULL,
  year INT NOT NULL,
  value BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (company_id, scope, year)
);

GRANT SELECT, INSERT, UPDATE ON public.counters TO authenticated;
GRANT ALL ON public.counters TO service_role;

-- ---------------------------------------------------------------------------
-- 4. profiles (1:1 con auth.users, SIN company_id)
-- ---------------------------------------------------------------------------
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  preferred_locale TEXT NOT NULL DEFAULT 'es' CHECK (preferred_locale IN ('es','ca')),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_profiles_email ON public.profiles(email);

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

-- ---------------------------------------------------------------------------
-- 5. company_members (PIVOTE CLAVE: usuario × empresa × rol)
-- ---------------------------------------------------------------------------
CREATE TABLE public.company_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  left_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, company_id)
);

-- Solo una empresa por defecto por usuario
CREATE UNIQUE INDEX idx_company_members_one_default
  ON public.company_members(user_id)
  WHERE is_default = true;

CREATE INDEX idx_company_members_user_active ON public.company_members(user_id) WHERE active;
CREATE INDEX idx_company_members_company_active ON public.company_members(company_id) WHERE active;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_members TO authenticated;
GRANT ALL ON public.company_members TO service_role;

-- ---------------------------------------------------------------------------
-- 6. HELPERS SECURITY DEFINER (la pieza crítica de RLS)
-- ---------------------------------------------------------------------------

-- Devuelve la company_id activa de la sesión (seteable vía GUC) o la default del user.
CREATE OR REPLACE FUNCTION public.current_company_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_setting TEXT;
  v_company UUID;
BEGIN
  -- 1) Intento leer GUC seteado por la app
  BEGIN
    v_setting := current_setting('app.company_id', true);
  EXCEPTION WHEN OTHERS THEN
    v_setting := NULL;
  END;

  IF v_setting IS NOT NULL AND v_setting <> '' THEN
    BEGIN
      v_company := v_setting::uuid;
      -- Validamos que el user pertenece realmente a esa company
      IF EXISTS (
        SELECT 1 FROM public.company_members
        WHERE user_id = auth.uid()
          AND company_id = v_company
          AND active = true
      ) THEN
        RETURN v_company;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- cast inválido -> fallback
    END;
  END IF;

  -- 2) Fallback: empresa por defecto del usuario
  SELECT company_id INTO v_company
  FROM public.company_members
  WHERE user_id = auth.uid()
    AND active = true
    AND is_default = true
  LIMIT 1;

  RETURN v_company;
END;
$$;

-- ¿El usuario pertenece a esta empresa (activo)?
CREATE OR REPLACE FUNCTION public.user_has_membership(p_company_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_members
    WHERE user_id = auth.uid()
      AND company_id = p_company_id
      AND active = true
  );
$$;

-- Rol del usuario en una empresa concreta
CREATE OR REPLACE FUNCTION public.user_role_in(p_company_id UUID)
RETURNS public.app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.company_members
  WHERE user_id = auth.uid()
    AND company_id = p_company_id
    AND active = true
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.has_role_in(p_company_id UUID, p_role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_members
    WHERE user_id = auth.uid()
      AND company_id = p_company_id
      AND role = p_role
      AND active = true
  );
$$;

-- Atajos por capacidad (los usaremos en políticas y funciones)
CREATE OR REPLACE FUNCTION public.can_manage_company(p_company_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.user_role_in(p_company_id) = 'administrator';
$$;

CREATE OR REPLACE FUNCTION public.can_manage_assets(p_company_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.user_role_in(p_company_id) IN ('administrator','system_manager');
$$;

CREATE OR REPLACE FUNCTION public.can_run_maintenance(p_company_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.user_role_in(p_company_id) IN ('administrator','system_manager','manager','employee');
$$;

CREATE OR REPLACE FUNCTION public.can_close_session(p_company_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.user_role_in(p_company_id) IN ('administrator','system_manager','manager');
$$;

CREATE OR REPLACE FUNCTION public.can_reopen_session(p_company_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.user_role_in(p_company_id) IN ('administrator','system_manager');
$$;

CREATE OR REPLACE FUNCTION public.can_view(p_company_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.user_has_membership(p_company_id);
$$;

-- Lista de empresas accesibles por el user (útil para Storage policies)
CREATE OR REPLACE FUNCTION public.user_company_ids()
RETURNS UUID[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(array_agg(company_id), ARRAY[]::uuid[])
  FROM public.company_members
  WHERE user_id = auth.uid() AND active = true;
$$;

-- ---------------------------------------------------------------------------
-- 7. next_code (generación atómica de códigos por empresa)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.next_code(
  p_company_id UUID,
  p_scope TEXT,
  p_prefix TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year INT := EXTRACT(YEAR FROM now())::INT;
  v_value BIGINT;
BEGIN
  -- Solo miembros de la empresa pueden generar códigos
  IF NOT public.user_has_membership(p_company_id) THEN
    RAISE EXCEPTION 'Forbidden: not a member of company %', p_company_id
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.counters(company_id, scope, year, value)
  VALUES (p_company_id, p_scope, v_year, 1)
  ON CONFLICT (company_id, scope, year)
  DO UPDATE SET value = public.counters.value + 1
  RETURNING value INTO v_value;

  RETURN p_prefix || '-' || v_year::TEXT || '-' || LPAD(v_value::TEXT, 4, '0');
END;
$$;

REVOKE ALL ON FUNCTION public.next_code(UUID, TEXT, TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.next_code(UUID, TEXT, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- 8. Auditoría: outbox + tabla particionada por mes
-- ---------------------------------------------------------------------------

-- Buffer rápido sin índices, el cron lo drena
CREATE TABLE public.audit_outbox (
  id BIGSERIAL PRIMARY KEY,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabla particionada por created_at (mensual)
CREATE TABLE public.audit_logs (
  id BIGSERIAL,
  company_id UUID NOT NULL,
  member_id UUID,
  user_id UUID,
  table_name TEXT NOT NULL,
  record_id UUID,
  action public.audit_action NOT NULL,
  changed_fields JSONB,
  context JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Crear particiones de los meses actuales y siguientes
DO $$
DECLARE
  v_start DATE := date_trunc('month', now())::date;
  v_month INT;
  v_from DATE;
  v_to DATE;
  v_name TEXT;
BEGIN
  FOR v_month IN 0..2 LOOP
    v_from := v_start + (v_month || ' month')::interval;
    v_to   := v_from + INTERVAL '1 month';
    v_name := 'audit_logs_' || to_char(v_from, 'YYYY_MM');
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS public.%I PARTITION OF public.audit_logs FOR VALUES FROM (%L) TO (%L)',
      v_name, v_from, v_to
    );
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON public.%I (company_id, table_name, record_id, created_at DESC)',
      v_name || '_idx', v_name
    );
  END LOOP;
END $$;

GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
GRANT ALL ON public.audit_outbox TO service_role;
GRANT INSERT ON public.audit_outbox TO authenticated;

-- ---------------------------------------------------------------------------
-- 9. Trigger universal de auditoría (escribe a outbox, async drain por cron)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.audit_trigger_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id UUID;
  v_record_id UUID;
  v_changed JSONB;
  v_old JSONB;
  v_new JSONB;
  v_key TEXT;
BEGIN
  -- Resolver company_id desde el registro
  IF TG_OP = 'DELETE' THEN
    v_company_id := COALESCE((to_jsonb(OLD)->>'company_id')::uuid, NULL);
    v_record_id  := COALESCE((to_jsonb(OLD)->>'id')::uuid, NULL);
  ELSE
    v_company_id := COALESCE((to_jsonb(NEW)->>'company_id')::uuid, NULL);
    v_record_id  := COALESCE((to_jsonb(NEW)->>'id')::uuid, NULL);
  END IF;

  -- Diff solo de campos cambiados
  IF TG_OP = 'UPDATE' THEN
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    v_changed := '{}'::jsonb;
    FOR v_key IN SELECT jsonb_object_keys(v_new) LOOP
      IF (v_old->v_key) IS DISTINCT FROM (v_new->v_key) THEN
        v_changed := v_changed || jsonb_build_object(
          v_key,
          jsonb_build_object('old', v_old->v_key, 'new', v_new->v_key)
        );
      END IF;
    END LOOP;
    IF v_changed = '{}'::jsonb THEN
      RETURN NEW; -- nada que auditar
    END IF;
  ELSIF TG_OP = 'INSERT' THEN
    v_changed := jsonb_build_object('new', to_jsonb(NEW));
  ELSIF TG_OP = 'DELETE' THEN
    v_changed := jsonb_build_object('old', to_jsonb(OLD));
  END IF;

  INSERT INTO public.audit_outbox(payload) VALUES (
    jsonb_build_object(
      'company_id', v_company_id,
      'user_id', auth.uid(),
      'table_name', TG_TABLE_NAME,
      'record_id', v_record_id,
      'action', TG_OP,
      'changed_fields', v_changed,
      'context', jsonb_build_object('schema', TG_TABLE_SCHEMA),
      'created_at', now()
    )
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

-- Aplicamos auditoría a las tablas base (las siguientes migraciones la añadirán a las suyas)
CREATE TRIGGER audit_companies
  AFTER INSERT OR UPDATE OR DELETE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

CREATE TRIGGER audit_company_members
  AFTER INSERT OR UPDATE OR DELETE ON public.company_members
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

-- ---------------------------------------------------------------------------
-- 10. Trigger profile auto-create on auth.users
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 11. updated_at trigger genérico (lo reusaremos en todas las tablas)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_updated_at_companies
  BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_profiles
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_company_members
  BEFORE UPDATE ON public.company_members
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 12. RLS en tablas base
-- ---------------------------------------------------------------------------
ALTER TABLE public.companies         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_features  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.counters          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_members   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_outbox      ENABLE ROW LEVEL SECURITY;

-- companies: solo miembros ven su empresa, solo administrator la modifica
CREATE POLICY companies_select ON public.companies
  FOR SELECT TO authenticated
  USING (public.user_has_membership(id) AND deleted_at IS NULL);

CREATE POLICY companies_update ON public.companies
  FOR UPDATE TO authenticated
  USING (public.can_manage_company(id))
  WITH CHECK (public.can_manage_company(id));

-- No INSERT/DELETE por clientes (creación de companies via flujo admin/onboarding controlado)

-- company_features
CREATE POLICY company_features_select ON public.company_features
  FOR SELECT TO authenticated
  USING (public.user_has_membership(company_id));

CREATE POLICY company_features_modify ON public.company_features
  FOR ALL TO authenticated
  USING (public.can_manage_company(company_id))
  WITH CHECK (public.can_manage_company(company_id));

-- counters: lectura solo a miembros, escritura solo vía next_code() (SECURITY DEFINER)
CREATE POLICY counters_select ON public.counters
  FOR SELECT TO authenticated
  USING (public.user_has_membership(company_id));

-- profiles: el propio + perfiles de compañeros (de cualquier empresa compartida)
CREATE POLICY profiles_select ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.company_members cm1
      JOIN public.company_members cm2 ON cm1.company_id = cm2.company_id
      WHERE cm1.user_id = auth.uid()
        AND cm1.active = true
        AND cm2.user_id = public.profiles.id
        AND cm2.active = true
    )
  );

CREATE POLICY profiles_update_self ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- company_members
CREATE POLICY company_members_select_own ON public.company_members
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.user_has_membership(company_id)
  );

CREATE POLICY company_members_insert_admin ON public.company_members
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_company(company_id));

CREATE POLICY company_members_update_admin ON public.company_members
  FOR UPDATE TO authenticated
  USING (public.can_manage_company(company_id))
  WITH CHECK (public.can_manage_company(company_id));

CREATE POLICY company_members_delete_admin ON public.company_members
  FOR DELETE TO authenticated
  USING (public.can_manage_company(company_id));

-- audit_logs: lectura solo a admin/system_manager/auditor de la company
CREATE POLICY audit_logs_select ON public.audit_logs
  FOR SELECT TO authenticated
  USING (
    public.user_has_membership(company_id)
    AND public.user_role_in(company_id) IN ('administrator','system_manager','auditor')
  );

-- audit_outbox: ningún acceso desde clientes (solo service_role drena)
-- (RLS habilitada sin políticas = nadie ve ni escribe excepto service_role/bypass)
