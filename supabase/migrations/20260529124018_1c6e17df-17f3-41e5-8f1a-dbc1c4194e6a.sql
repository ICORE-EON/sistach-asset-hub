
-- ============================================================
-- MIGRATION 03: Checklists, Maintenance Plans, Sessions, Incidents
-- ============================================================

-- ---------- CHECKLIST TEMPLATES (master) ----------
CREATE TABLE public.checklist_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  asset_type_id UUID NOT NULL REFERENCES public.asset_types(id) ON DELETE RESTRICT,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  current_version INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX checklist_templates_company_code_uk
  ON public.checklist_templates(company_id, code) WHERE deleted_at IS NULL;
CREATE INDEX checklist_templates_company_idx ON public.checklist_templates(company_id);
CREATE INDEX checklist_templates_type_idx ON public.checklist_templates(asset_type_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.checklist_templates TO authenticated;
GRANT ALL ON public.checklist_templates TO service_role;
ALTER TABLE public.checklist_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY checklist_templates_select ON public.checklist_templates FOR SELECT TO authenticated
  USING (public.user_has_membership(company_id) AND deleted_at IS NULL);
CREATE POLICY checklist_templates_insert ON public.checklist_templates FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_assets(company_id));
CREATE POLICY checklist_templates_update ON public.checklist_templates FOR UPDATE TO authenticated
  USING (public.can_manage_assets(company_id))
  WITH CHECK (public.can_manage_assets(company_id));
CREATE POLICY checklist_templates_delete ON public.checklist_templates FOR DELETE TO authenticated
  USING (public.can_manage_company(company_id));

CREATE TRIGGER checklist_templates_updated_at BEFORE UPDATE ON public.checklist_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- CHECKLIST TEMPLATE VERSIONS (immutable once published) ----------
CREATE TABLE public.checklist_template_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.checklist_templates(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  published_at TIMESTAMPTZ,
  published_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_published BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (template_id, version)
);
CREATE INDEX checklist_tv_template_idx ON public.checklist_template_versions(template_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.checklist_template_versions TO authenticated;
GRANT ALL ON public.checklist_template_versions TO service_role;
ALTER TABLE public.checklist_template_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY ctv_select ON public.checklist_template_versions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.checklist_templates t
    WHERE t.id = checklist_template_versions.template_id
      AND public.user_has_membership(t.company_id)));
CREATE POLICY ctv_insert ON public.checklist_template_versions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.checklist_templates t
    WHERE t.id = checklist_template_versions.template_id
      AND public.can_manage_assets(t.company_id)));
-- Solo se puede actualizar mientras no esté publicada
CREATE POLICY ctv_update ON public.checklist_template_versions FOR UPDATE TO authenticated
  USING (
    is_published = false AND
    EXISTS (SELECT 1 FROM public.checklist_templates t
      WHERE t.id = checklist_template_versions.template_id
        AND public.can_manage_assets(t.company_id))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.checklist_templates t
      WHERE t.id = checklist_template_versions.template_id
        AND public.can_manage_assets(t.company_id))
  );
CREATE POLICY ctv_delete ON public.checklist_template_versions FOR DELETE TO authenticated
  USING (
    is_published = false AND
    EXISTS (SELECT 1 FROM public.checklist_templates t
      WHERE t.id = checklist_template_versions.template_id
        AND public.can_manage_company(t.company_id))
  );

-- ---------- CHECKLIST QUESTIONS ----------
CREATE TABLE public.checklist_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  template_version_id UUID NOT NULL REFERENCES public.checklist_template_versions(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  prompt TEXT NOT NULL,
  help_text TEXT,
  response_type TEXT NOT NULL CHECK (response_type IN (
    'boolean','single_choice','multi_choice','number','text','date','photo'
  )),
  options JSONB,
  required BOOLEAN NOT NULL DEFAULT true,
  fails_on JSONB,
  creates_incident BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (template_version_id, id)
);
CREATE INDEX checklist_q_version_idx ON public.checklist_questions(template_version_id, position);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.checklist_questions TO authenticated;
GRANT ALL ON public.checklist_questions TO service_role;
ALTER TABLE public.checklist_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY cq_select ON public.checklist_questions FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.checklist_template_versions v
    JOIN public.checklist_templates t ON t.id = v.template_id
    WHERE v.id = checklist_questions.template_version_id
      AND public.user_has_membership(t.company_id)
  ));
CREATE POLICY cq_modify ON public.checklist_questions FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.checklist_template_versions v
    JOIN public.checklist_templates t ON t.id = v.template_id
    WHERE v.id = checklist_questions.template_version_id
      AND v.is_published = false
      AND public.can_manage_assets(t.company_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.checklist_template_versions v
    JOIN public.checklist_templates t ON t.id = v.template_id
    WHERE v.id = checklist_questions.template_version_id
      AND v.is_published = false
      AND public.can_manage_assets(t.company_id)
  ));

-- ---------- MAINTENANCE PLANS ----------
CREATE TABLE public.maintenance_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  asset_type_id UUID REFERENCES public.asset_types(id) ON DELETE RESTRICT,
  checklist_template_id UUID NOT NULL REFERENCES public.checklist_templates(id) ON DELETE RESTRICT,
  frequency TEXT NOT NULL CHECK (frequency IN (
    'monthly','quarterly','semiannual','annual','biennial','custom'
  )),
  interval_months INTEGER,
  active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT mp_custom_interval_chk CHECK (
    frequency <> 'custom' OR (interval_months IS NOT NULL AND interval_months > 0)
  )
);
CREATE UNIQUE INDEX maintenance_plans_company_code_uk
  ON public.maintenance_plans(company_id, code) WHERE deleted_at IS NULL;
CREATE INDEX maintenance_plans_company_idx ON public.maintenance_plans(company_id);
CREATE INDEX maintenance_plans_type_idx ON public.maintenance_plans(asset_type_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.maintenance_plans TO authenticated;
GRANT ALL ON public.maintenance_plans TO service_role;
ALTER TABLE public.maintenance_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY mp_select ON public.maintenance_plans FOR SELECT TO authenticated
  USING (public.user_has_membership(company_id) AND deleted_at IS NULL);
CREATE POLICY mp_modify ON public.maintenance_plans FOR ALL TO authenticated
  USING (public.can_manage_assets(company_id))
  WITH CHECK (public.can_manage_assets(company_id));

CREATE TRIGGER maintenance_plans_updated_at BEFORE UPDATE ON public.maintenance_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- MAINTENANCE PLAN ASSETS (which assets follow which plan) ----------
CREATE TABLE public.maintenance_plan_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.maintenance_plans(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  start_on DATE NOT NULL DEFAULT CURRENT_DATE,
  end_on DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (plan_id, asset_id)
);
CREATE INDEX mpa_plan_idx ON public.maintenance_plan_assets(plan_id);
CREATE INDEX mpa_asset_idx ON public.maintenance_plan_assets(asset_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.maintenance_plan_assets TO authenticated;
GRANT ALL ON public.maintenance_plan_assets TO service_role;
ALTER TABLE public.maintenance_plan_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY mpa_select ON public.maintenance_plan_assets FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.maintenance_plans p
    WHERE p.id = maintenance_plan_assets.plan_id
      AND public.user_has_membership(p.company_id)));
CREATE POLICY mpa_modify ON public.maintenance_plan_assets FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.maintenance_plans p
    WHERE p.id = maintenance_plan_assets.plan_id
      AND public.can_manage_assets(p.company_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.maintenance_plans p
    WHERE p.id = maintenance_plan_assets.plan_id
      AND public.can_manage_assets(p.company_id)));

-- ---------- MAINTENANCE SESSIONS ----------
CREATE TABLE public.maintenance_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  plan_id UUID REFERENCES public.maintenance_plans(id) ON DELETE SET NULL,
  location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
  technician_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  technician_name TEXT,
  is_external BOOLEAN NOT NULL DEFAULT false,
  external_provider TEXT,
  external_cert_number TEXT,
  scheduled_for DATE,
  started_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft','in_progress','closed','reopened','cancelled'
  )),
  signature_image_url TEXT,
  signer_name TEXT,
  signer_role TEXT,
  signer_ip INET,
  signer_user_agent TEXT,
  pdf_url TEXT,
  pdf_hash_sha256 TEXT,
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX maintenance_sessions_company_code_uk
  ON public.maintenance_sessions(company_id, code);
CREATE INDEX ms_company_idx ON public.maintenance_sessions(company_id);
CREATE INDEX ms_plan_idx ON public.maintenance_sessions(plan_id);
CREATE INDEX ms_status_idx ON public.maintenance_sessions(company_id, status);
CREATE INDEX ms_scheduled_idx ON public.maintenance_sessions(company_id, scheduled_for);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.maintenance_sessions TO authenticated;
GRANT ALL ON public.maintenance_sessions TO service_role;
ALTER TABLE public.maintenance_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY ms_select ON public.maintenance_sessions FOR SELECT TO authenticated
  USING (public.user_has_membership(company_id));
CREATE POLICY ms_insert ON public.maintenance_sessions FOR INSERT TO authenticated
  WITH CHECK (public.can_run_maintenance(company_id));
CREATE POLICY ms_update ON public.maintenance_sessions FOR UPDATE TO authenticated
  USING (public.can_run_maintenance(company_id))
  WITH CHECK (public.can_run_maintenance(company_id));
CREATE POLICY ms_delete ON public.maintenance_sessions FOR DELETE TO authenticated
  USING (public.can_manage_company(company_id));

CREATE TRIGGER maintenance_sessions_updated_at BEFORE UPDATE ON public.maintenance_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- SESSION REOPEN LOG ----------
CREATE TABLE public.session_reopen_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.maintenance_sessions(id) ON DELETE CASCADE,
  reopened_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  reopened_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX srl_session_idx ON public.session_reopen_log(session_id);

GRANT SELECT, INSERT ON public.session_reopen_log TO authenticated;
GRANT ALL ON public.session_reopen_log TO service_role;
ALTER TABLE public.session_reopen_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY srl_select ON public.session_reopen_log FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.maintenance_sessions s
    WHERE s.id = session_reopen_log.session_id
      AND public.user_has_membership(s.company_id)));
CREATE POLICY srl_insert ON public.session_reopen_log FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.maintenance_sessions s
    WHERE s.id = session_reopen_log.session_id
      AND public.can_reopen_session(s.company_id)));

-- ---------- MAINTENANCE ITEMS (one per asset within a session) ----------
CREATE TABLE public.maintenance_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.maintenance_sessions(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE RESTRICT,
  checklist_template_version_id UUID NOT NULL REFERENCES public.checklist_template_versions(id) ON DELETE RESTRICT,
  result TEXT NOT NULL DEFAULT 'pending' CHECK (result IN (
    'pending','ok','with_incident','not_applicable','skipped'
  )),
  observations TEXT,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, asset_id)
);
CREATE INDEX mi_session_idx ON public.maintenance_items(session_id);
CREATE INDEX mi_asset_idx ON public.maintenance_items(asset_id);
CREATE INDEX mi_result_idx ON public.maintenance_items(session_id, result);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.maintenance_items TO authenticated;
GRANT ALL ON public.maintenance_items TO service_role;
ALTER TABLE public.maintenance_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY mi_select ON public.maintenance_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.maintenance_sessions s
    WHERE s.id = maintenance_items.session_id
      AND public.user_has_membership(s.company_id)));
CREATE POLICY mi_modify ON public.maintenance_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.maintenance_sessions s
    WHERE s.id = maintenance_items.session_id
      AND public.can_run_maintenance(s.company_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.maintenance_sessions s
    WHERE s.id = maintenance_items.session_id
      AND public.can_run_maintenance(s.company_id)));

CREATE TRIGGER maintenance_items_updated_at BEFORE UPDATE ON public.maintenance_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- CHECKLIST RESPONSES ----------
CREATE TABLE public.checklist_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  maintenance_item_id UUID NOT NULL REFERENCES public.maintenance_items(id) ON DELETE CASCADE,
  checklist_template_version_id UUID NOT NULL REFERENCES public.checklist_template_versions(id) ON DELETE RESTRICT,
  question_id UUID NOT NULL,
  answer JSONB,
  is_fail BOOLEAN NOT NULL DEFAULT false,
  observations TEXT,
  answered_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  answered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (maintenance_item_id, question_id),
  FOREIGN KEY (checklist_template_version_id, question_id)
    REFERENCES public.checklist_questions(template_version_id, id) ON DELETE RESTRICT
);
CREATE INDEX cr_item_idx ON public.checklist_responses(maintenance_item_id);
CREATE INDEX cr_fail_idx ON public.checklist_responses(maintenance_item_id) WHERE is_fail = true;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.checklist_responses TO authenticated;
GRANT ALL ON public.checklist_responses TO service_role;
ALTER TABLE public.checklist_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY cr_select ON public.checklist_responses FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.maintenance_items i
    JOIN public.maintenance_sessions s ON s.id = i.session_id
    WHERE i.id = checklist_responses.maintenance_item_id
      AND public.user_has_membership(s.company_id)
  ));
CREATE POLICY cr_modify ON public.checklist_responses FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.maintenance_items i
    JOIN public.maintenance_sessions s ON s.id = i.session_id
    WHERE i.id = checklist_responses.maintenance_item_id
      AND public.can_run_maintenance(s.company_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.maintenance_items i
    JOIN public.maintenance_sessions s ON s.id = i.session_id
    WHERE i.id = checklist_responses.maintenance_item_id
      AND public.can_run_maintenance(s.company_id)
  ));

-- ---------- INCIDENTS ----------
CREATE TABLE public.incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  asset_id UUID REFERENCES public.assets(id) ON DELETE SET NULL,
  location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN (
    'manual','maintenance','qr_public','import','api'
  )),
  source_maintenance_item_id UUID REFERENCES public.maintenance_items(id) ON DELETE SET NULL,
  source_response_id UUID REFERENCES public.checklist_responses(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN (
    'open','acknowledged','in_progress','resolved','closed','cancelled'
  )),
  reporter_name TEXT,
  reporter_email TEXT,
  reporter_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  due_date DATE,
  resolved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  resolution_notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX incidents_company_code_uk ON public.incidents(company_id, code);
CREATE INDEX incidents_company_idx ON public.incidents(company_id);
CREATE INDEX incidents_asset_idx ON public.incidents(asset_id);
CREATE INDEX incidents_open_idx ON public.incidents(company_id, status)
  WHERE status NOT IN ('closed','cancelled');
CREATE INDEX incidents_assigned_idx ON public.incidents(assigned_to) WHERE assigned_to IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.incidents TO authenticated;
GRANT ALL ON public.incidents TO service_role;
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY incidents_select ON public.incidents FOR SELECT TO authenticated
  USING (public.user_has_membership(company_id));
CREATE POLICY incidents_insert ON public.incidents FOR INSERT TO authenticated
  WITH CHECK (public.can_run_maintenance(company_id));
CREATE POLICY incidents_update ON public.incidents FOR UPDATE TO authenticated
  USING (public.can_run_maintenance(company_id))
  WITH CHECK (public.can_run_maintenance(company_id));
CREATE POLICY incidents_delete ON public.incidents FOR DELETE TO authenticated
  USING (public.can_manage_company(company_id));

CREATE TRIGGER incidents_updated_at BEFORE UPDATE ON public.incidents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- INCIDENT STATUS HISTORY ----------
CREATE TABLE public.incident_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  note TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ish_incident_idx ON public.incident_status_history(incident_id);

GRANT SELECT, INSERT ON public.incident_status_history TO authenticated;
GRANT ALL ON public.incident_status_history TO service_role;
ALTER TABLE public.incident_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY ish_select ON public.incident_status_history FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.incidents i
    WHERE i.id = incident_status_history.incident_id
      AND public.user_has_membership(i.company_id)));
CREATE POLICY ish_insert ON public.incident_status_history FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.incidents i
    WHERE i.id = incident_status_history.incident_id
      AND public.can_run_maintenance(i.company_id)));

-- ---------- VIEW: open incidents per asset (for inheritance into next revision) ----------
CREATE VIEW public.maintenance_item_open_incidents
WITH (security_invoker = true)
AS
SELECT
  i.id AS incident_id,
  i.company_id,
  i.asset_id,
  i.code,
  i.title,
  i.severity,
  i.status,
  i.created_at
FROM public.incidents i
WHERE i.status NOT IN ('closed','cancelled')
  AND i.asset_id IS NOT NULL;

GRANT SELECT ON public.maintenance_item_open_incidents TO authenticated;

-- ---------- VIEW: next scheduled maintenance per asset+plan ----------
-- Last closed session per (plan, asset) + cadence in months
CREATE VIEW public.asset_next_maintenances
WITH (security_invoker = true)
AS
WITH last_done AS (
  SELECT
    mi.asset_id,
    s.plan_id,
    MAX(COALESCE(s.closed_at, s.started_at, s.created_at)) AS last_done_at
  FROM public.maintenance_items mi
  JOIN public.maintenance_sessions s ON s.id = mi.session_id
  WHERE s.status = 'closed' AND s.plan_id IS NOT NULL
  GROUP BY mi.asset_id, s.plan_id
)
SELECT
  mpa.asset_id,
  mpa.plan_id,
  p.company_id,
  p.frequency,
  CASE p.frequency
    WHEN 'monthly'    THEN 1
    WHEN 'quarterly'  THEN 3
    WHEN 'semiannual' THEN 6
    WHEN 'annual'     THEN 12
    WHEN 'biennial'   THEN 24
    WHEN 'custom'     THEN p.interval_months
  END AS interval_months,
  COALESCE(ld.last_done_at, mpa.start_on::timestamptz) AS last_done_at,
  (COALESCE(ld.last_done_at::date, mpa.start_on)
    + (CASE p.frequency
        WHEN 'monthly'    THEN 1
        WHEN 'quarterly'  THEN 3
        WHEN 'semiannual' THEN 6
        WHEN 'annual'     THEN 12
        WHEN 'biennial'   THEN 24
        WHEN 'custom'     THEN p.interval_months
      END || ' months')::interval
  )::date AS next_due_at
FROM public.maintenance_plan_assets mpa
JOIN public.maintenance_plans p ON p.id = mpa.plan_id
LEFT JOIN last_done ld ON ld.plan_id = mpa.plan_id AND ld.asset_id = mpa.asset_id
WHERE p.active = true AND p.deleted_at IS NULL
  AND (mpa.end_on IS NULL OR mpa.end_on >= CURRENT_DATE);

GRANT SELECT ON public.asset_next_maintenances TO authenticated;
