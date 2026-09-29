CREATE OR REPLACE FUNCTION public.mtr_site_in_org(p_company uuid, p_site uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.locations
                 WHERE id = p_site AND company_id = p_company AND kind = 'site' AND deleted_at IS NULL)
$$;

CREATE OR REPLACE FUNCTION public.mtr_calc_next_due(p_from date, p_unit text, p_value integer) RETURNS date
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE p_unit
    WHEN 'days'   THEN p_from + p_value
    WHEN 'months' THEN (p_from + make_interval(months => p_value))::date
    WHEN 'years'  THEN (p_from + make_interval(years => p_value))::date
    ELSE NULL END
$$;

CREATE TABLE public.mnt_mtr_equipment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  equipment_type text NOT NULL,
  magnitude text,
  intended_use text,
  site_id uuid NOT NULL,
  location_detail text,
  responsible_ref uuid,
  responsible_snapshot jsonb,
  brand text, model text, serial_number text,
  photo_document_ref uuid,
  range_min numeric, range_max numeric, unit text,
  resolution text, declared_accuracy text,
  restrictions text,
  allowed_uses text,
  registered_on date NOT NULL DEFAULT current_date,
  status text NOT NULL DEFAULT 'operational'
    CHECK (status IN ('operational','restricted','unfit','out_of_service','retired')),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (company_id, id),
  UNIQUE (company_id, code),
  CHECK (range_min IS NULL OR range_max IS NULL OR range_min <= range_max),
  CHECK (status <> 'restricted' OR allowed_uses IS NOT NULL),
  FOREIGN KEY (company_id, site_id) REFERENCES public.locations(company_id, id)
);
CREATE INDEX mnt_mtr_equipment_site_idx ON public.mnt_mtr_equipment(company_id, site_id);
CREATE INDEX mnt_mtr_equipment_status_idx ON public.mnt_mtr_equipment(company_id, status);

CREATE TABLE public.mnt_mtr_control_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  equipment_id uuid NOT NULL,
  control_kind text NOT NULL CHECK (control_kind IN ('calibration','verification','check')),
  method text NOT NULL CHECK (method IN ('external','internal')),
  procedure text,
  frequency_unit text NOT NULL CHECK (frequency_unit IN ('days','months','years','before_use')),
  frequency_value integer,
  acceptance_criteria text,
  responsible_ref uuid,
  next_due_on date,
  requires_document boolean NOT NULL DEFAULT false,
  qualifies_as_reference boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, id),
  CHECK ((frequency_unit = 'before_use' AND frequency_value IS NULL)
      OR (frequency_unit <> 'before_use' AND frequency_value > 0)),
  FOREIGN KEY (company_id, equipment_id) REFERENCES public.mnt_mtr_equipment(company_id, id) ON DELETE CASCADE
);
CREATE INDEX mnt_mtr_plans_equipment_idx ON public.mnt_mtr_control_plans(company_id, equipment_id);
CREATE INDEX mnt_mtr_plans_due_idx ON public.mnt_mtr_control_plans(company_id, next_due_on) WHERE active;

CREATE TABLE public.mnt_mtr_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  equipment_id uuid NOT NULL,
  control_plan_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('calibration','verification','check')),
  performed_on date NOT NULL,
  performer_ref uuid,
  performer_snapshot jsonb,
  result text CHECK (result IN ('fit','unfit')),
  next_due_calculated date,
  next_due_override date,
  override_reason text,
  observations text,
  document_ref uuid,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','validated','superseded')),
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  supersedes_id uuid,
  rectification_reason text,
  laboratory text, certificate_number text, accreditation text,
  declared_uncertainty text, adjusted_or_repaired boolean,
  reference_equipment_id uuid,
  validated_by uuid, validated_by_snapshot jsonb, validated_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, id),
  CHECK (next_due_override IS NULL OR override_reason IS NOT NULL),
  CHECK (supersedes_id IS NULL OR rectification_reason IS NOT NULL),
  CHECK (reference_equipment_id IS NULL OR reference_equipment_id <> equipment_id),
  FOREIGN KEY (company_id, equipment_id) REFERENCES public.mnt_mtr_equipment(company_id, id) ON DELETE CASCADE,
  FOREIGN KEY (company_id, control_plan_id) REFERENCES public.mnt_mtr_control_plans(company_id, id),
  FOREIGN KEY (company_id, supersedes_id) REFERENCES public.mnt_mtr_records(company_id, id),
  FOREIGN KEY (company_id, reference_equipment_id) REFERENCES public.mnt_mtr_equipment(company_id, id)
);
CREATE INDEX mnt_mtr_records_equipment_idx ON public.mnt_mtr_records(company_id, equipment_id, performed_on DESC);
CREATE INDEX mnt_mtr_records_plan_idx ON public.mnt_mtr_records(company_id, control_plan_id, performed_on DESC);
CREATE UNIQUE INDEX mnt_mtr_records_one_rectification ON public.mnt_mtr_records(supersedes_id) WHERE supersedes_id IS NOT NULL;

CREATE TABLE public.mnt_mtr_record_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  record_id uuid NOT NULL,
  position integer NOT NULL,
  label text NOT NULL,
  reference_value numeric,
  measured_value numeric,
  deviation numeric GENERATED ALWAYS AS (measured_value - reference_value) STORED,
  tolerance numeric CHECK (tolerance IS NULL OR tolerance >= 0),
  result text CHECK (result IN ('fit','unfit')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (record_id, position),
  FOREIGN KEY (company_id, record_id) REFERENCES public.mnt_mtr_records(company_id, id) ON DELETE CASCADE
);

CREATE TABLE public.mnt_mtr_unfit_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  record_id uuid NOT NULL UNIQUE,
  equipment_id uuid NOT NULL,
  decision text NOT NULL CHECK (decision IN ('retire','repair','restrict','repeat')),
  notes text,
  allowed_uses text,
  decided_by uuid, decided_by_snapshot jsonb,
  decided_at timestamptz NOT NULL DEFAULT now(),
  CHECK (decision <> 'restrict' OR allowed_uses IS NOT NULL),
  FOREIGN KEY (company_id, record_id) REFERENCES public.mnt_mtr_records(company_id, id),
  FOREIGN KEY (company_id, equipment_id) REFERENCES public.mnt_mtr_equipment(company_id, id)
);

CREATE TABLE public.mnt_mtr_impact_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  equipment_id uuid NOT NULL,
  record_id uuid NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','evaluated')),
  responsible_ref uuid,
  reviewed_on date,
  period_reviewed text,
  conclusion text CHECK (conclusion IN ('no_impact','impact')),
  justification text,
  actions_taken_or_planned text,
  external_ref_type text CHECK (external_ref_type IN ('nc','action')),
  external_ref_id text, external_ref_label text, external_ref_url text,
  closed_by uuid, closed_by_snapshot jsonb, closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status = 'pending' OR (conclusion IS NOT NULL AND nullif(btrim(justification),'') IS NOT NULL AND reviewed_on IS NOT NULL)),
  CHECK (conclusion IS DISTINCT FROM 'impact' OR nullif(btrim(actions_taken_or_planned),'') IS NOT NULL),
  CHECK ((external_ref_type IS NULL) = (external_ref_id IS NULL)),
  FOREIGN KEY (company_id, record_id) REFERENCES public.mnt_mtr_records(company_id, id),
  FOREIGN KEY (company_id, equipment_id) REFERENCES public.mnt_mtr_equipment(company_id, id)
);
CREATE INDEX mnt_mtr_impact_pending_idx ON public.mnt_mtr_impact_reviews(company_id, equipment_id) WHERE status = 'pending';

CREATE TABLE public.mnt_mtr_site_moves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  equipment_id uuid NOT NULL,
  from_site_id uuid, to_site_id uuid NOT NULL,
  location_detail text, note text,
  moved_by uuid, moved_by_snapshot jsonb,
  moved_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (company_id, equipment_id) REFERENCES public.mnt_mtr_equipment(company_id, id) ON DELETE CASCADE
);

CREATE TABLE public.mnt_mtr_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  equipment_id uuid NOT NULL,
  from_status text, to_status text NOT NULL,
  cause text NOT NULL,
  record_id uuid,
  note text,
  changed_by uuid, changed_by_snapshot jsonb,
  changed_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (company_id, equipment_id) REFERENCES public.mnt_mtr_equipment(company_id, id) ON DELETE CASCADE
);
CREATE INDEX mnt_mtr_status_history_idx ON public.mnt_mtr_status_history(company_id, equipment_id, changed_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.mnt_mtr_equipment, public.mnt_mtr_control_plans TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mnt_mtr_records, public.mnt_mtr_record_lines TO authenticated;
GRANT SELECT ON public.mnt_mtr_unfit_decisions, public.mnt_mtr_impact_reviews,
  public.mnt_mtr_site_moves, public.mnt_mtr_status_history TO authenticated;
GRANT ALL ON public.mnt_mtr_equipment, public.mnt_mtr_control_plans, public.mnt_mtr_records, public.mnt_mtr_record_lines,
  public.mnt_mtr_unfit_decisions, public.mnt_mtr_impact_reviews, public.mnt_mtr_site_moves, public.mnt_mtr_status_history
  TO service_role;

ALTER TABLE public.mnt_mtr_equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mnt_mtr_control_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mnt_mtr_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mnt_mtr_record_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mnt_mtr_unfit_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mnt_mtr_impact_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mnt_mtr_site_moves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mnt_mtr_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY mtr_equipment_select ON public.mnt_mtr_equipment FOR SELECT TO authenticated USING (public.can_view(company_id));
CREATE POLICY mtr_equipment_insert ON public.mnt_mtr_equipment FOR INSERT TO authenticated WITH CHECK (public.can_manage_assets(company_id));
CREATE POLICY mtr_equipment_update ON public.mnt_mtr_equipment FOR UPDATE TO authenticated
  USING (public.can_manage_assets(company_id)) WITH CHECK (public.can_manage_assets(company_id));

CREATE POLICY mtr_plans_select ON public.mnt_mtr_control_plans FOR SELECT TO authenticated USING (public.can_view(company_id));
CREATE POLICY mtr_plans_insert ON public.mnt_mtr_control_plans FOR INSERT TO authenticated WITH CHECK (public.can_manage_assets(company_id));
CREATE POLICY mtr_plans_update ON public.mnt_mtr_control_plans FOR UPDATE TO authenticated
  USING (public.can_manage_assets(company_id)) WITH CHECK (public.can_manage_assets(company_id));

CREATE POLICY mtr_records_select ON public.mnt_mtr_records FOR SELECT TO authenticated USING (public.can_view(company_id));
CREATE POLICY mtr_records_insert ON public.mnt_mtr_records FOR INSERT TO authenticated WITH CHECK (public.can_run_maintenance(company_id));
CREATE POLICY mtr_records_update ON public.mnt_mtr_records FOR UPDATE TO authenticated
  USING (public.can_run_maintenance(company_id)) WITH CHECK (public.can_run_maintenance(company_id));
CREATE POLICY mtr_records_delete ON public.mnt_mtr_records FOR DELETE TO authenticated
  USING (public.can_run_maintenance(company_id) AND status = 'draft');

CREATE POLICY mtr_lines_select ON public.mnt_mtr_record_lines FOR SELECT TO authenticated USING (public.can_view(company_id));
CREATE POLICY mtr_lines_insert ON public.mnt_mtr_record_lines FOR INSERT TO authenticated WITH CHECK (public.can_run_maintenance(company_id));
CREATE POLICY mtr_lines_update ON public.mnt_mtr_record_lines FOR UPDATE TO authenticated
  USING (public.can_run_maintenance(company_id)) WITH CHECK (public.can_run_maintenance(company_id));
CREATE POLICY mtr_lines_delete ON public.mnt_mtr_record_lines FOR DELETE TO authenticated USING (public.can_run_maintenance(company_id));

CREATE POLICY mtr_decisions_select ON public.mnt_mtr_unfit_decisions FOR SELECT TO authenticated USING (public.can_view(company_id));
CREATE POLICY mtr_impact_select ON public.mnt_mtr_impact_reviews FOR SELECT TO authenticated USING (public.can_view(company_id));
CREATE POLICY mtr_moves_select ON public.mnt_mtr_site_moves FOR SELECT TO authenticated USING (public.can_view(company_id));
CREATE POLICY mtr_status_select ON public.mnt_mtr_status_history FOR SELECT TO authenticated USING (public.can_view(company_id));

CREATE OR REPLACE FUNCTION public.mtr_is_client() RETURNS boolean LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT current_user IN ('authenticated','anon')
$$;

CREATE OR REPLACE FUNCTION public.mtr_tg_equipment_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NOT public.mtr_site_in_org(NEW.company_id, NEW.site_id) THEN
    RAISE EXCEPTION 'El site no pertenece a la organización' USING ERRCODE = '23514';
  END IF;
  IF public.mtr_is_client() THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.status <> 'operational' THEN
        RAISE EXCEPTION 'Un equipo nuevo empieza operativo' USING ERRCODE = '42501';
      END IF;
      NEW.created_by := auth.uid();
    ELSE
      IF NEW.status IS DISTINCT FROM OLD.status OR NEW.site_id IS DISTINCT FROM OLD.site_id
         OR NEW.company_id IS DISTINCT FROM OLD.company_id OR NEW.code IS DISTINCT FROM OLD.code
         OR NEW.allowed_uses IS DISTINCT FROM OLD.allowed_uses THEN
        RAISE EXCEPTION 'Estado, site, código y usos permitidos solo cambian mediante operaciones' USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER mtr_equipment_guard BEFORE INSERT OR UPDATE ON public.mnt_mtr_equipment
  FOR EACH ROW EXECUTE FUNCTION public.mtr_tg_equipment_guard();

CREATE OR REPLACE FUNCTION public.mtr_tg_plan_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW.company_id <> OLD.company_id OR NEW.equipment_id <> OLD.equipment_id) THEN
    RAISE EXCEPTION 'No se puede mover un plan de control' USING ERRCODE = '42501';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER mtr_plan_guard BEFORE INSERT OR UPDATE ON public.mnt_mtr_control_plans
  FOR EACH ROW EXECUTE FUNCTION public.mtr_tg_plan_guard();

CREATE OR REPLACE FUNCTION public.mtr_tg_record_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_plan record;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status <> 'draft' THEN
      RAISE EXCEPTION 'Un registro validado es inmutable' USING ERRCODE = '42501';
    END IF;
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status <> 'draft' THEN
    IF public.mtr_is_client() OR NOT (OLD.status = 'validated' AND NEW.status = 'superseded'
       AND (to_jsonb(NEW) - 'status' - 'updated_at') = (to_jsonb(OLD) - 'status' - 'updated_at')) THEN
      RAISE EXCEPTION 'Un registro validado es inmutable' USING ERRCODE = '42501';
    END IF;
    NEW.updated_at := now();
    RETURN NEW;
  END IF;
  IF public.mtr_is_client() THEN
    IF NEW.status <> 'draft' THEN
      RAISE EXCEPTION 'La validación solo se realiza mediante la operación de validar' USING ERRCODE = '42501';
    END IF;
    IF TG_OP = 'INSERT' THEN
      NEW.created_by := auth.uid();
      IF NEW.supersedes_id IS NOT NULL OR NEW.version <> 1 THEN
        RAISE EXCEPTION 'Las rectificaciones se crean mediante la operación de rectificar' USING ERRCODE = '42501';
      END IF;
    ELSIF NEW.supersedes_id IS DISTINCT FROM OLD.supersedes_id OR NEW.version <> OLD.version
       OR NEW.equipment_id <> OLD.equipment_id OR NEW.company_id <> OLD.company_id THEN
      RAISE EXCEPTION 'Campos de trazabilidad no editables' USING ERRCODE = '42501';
    END IF;
    NEW.validated_by := NULL; NEW.validated_by_snapshot := NULL; NEW.validated_at := NULL;
  END IF;
  SELECT equipment_id, control_kind INTO v_plan FROM public.mnt_mtr_control_plans
   WHERE id = NEW.control_plan_id AND company_id = NEW.company_id;
  IF v_plan.equipment_id IS DISTINCT FROM NEW.equipment_id OR v_plan.control_kind IS DISTINCT FROM NEW.kind THEN
    RAISE EXCEPTION 'El registro no corresponde al plan de control del equipo' USING ERRCODE = '23514';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER mtr_record_guard BEFORE INSERT OR UPDATE OR DELETE ON public.mnt_mtr_records
  FOR EACH ROW EXECUTE FUNCTION public.mtr_tg_record_guard();

CREATE OR REPLACE FUNCTION public.mtr_tg_line_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_status text; v_rec uuid;
BEGIN
  v_rec := CASE WHEN TG_OP = 'DELETE' THEN OLD.record_id ELSE NEW.record_id END;
  SELECT status INTO v_status FROM public.mnt_mtr_records WHERE id = v_rec;
  IF v_status IS NOT NULL AND v_status <> 'draft' THEN
    RAISE EXCEPTION 'Las líneas de un registro validado son inmutables' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.record_id <> OLD.record_id THEN
    RAISE EXCEPTION 'No se puede mover una línea' USING ERRCODE = '42501';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE TRIGGER mtr_line_guard BEFORE INSERT OR UPDATE OR DELETE ON public.mnt_mtr_record_lines
  FOR EACH ROW EXECUTE FUNCTION public.mtr_tg_line_guard();

CREATE OR REPLACE FUNCTION public.mtr_tg_append_only() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'Historial inmutable (%)', TG_TABLE_NAME USING ERRCODE = '42501';
END $$;
CREATE TRIGGER mtr_decisions_immutable BEFORE UPDATE OR DELETE ON public.mnt_mtr_unfit_decisions
  FOR EACH ROW EXECUTE FUNCTION public.mtr_tg_append_only();
CREATE TRIGGER mtr_moves_immutable BEFORE UPDATE OR DELETE ON public.mnt_mtr_site_moves
  FOR EACH ROW EXECUTE FUNCTION public.mtr_tg_append_only();
CREATE TRIGGER mtr_status_immutable BEFORE UPDATE OR DELETE ON public.mnt_mtr_status_history
  FOR EACH ROW EXECUTE FUNCTION public.mtr_tg_append_only();

CREATE OR REPLACE FUNCTION public.mtr_tg_impact_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' OR OLD.status = 'evaluated' THEN
    RAISE EXCEPTION 'Evaluación de impacto cerrada o no eliminable' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER mtr_impact_guard BEFORE UPDATE OR DELETE ON public.mnt_mtr_impact_reviews
  FOR EACH ROW EXECUTE FUNCTION public.mtr_tg_impact_guard();

CREATE TRIGGER audit_mnt_mtr_equipment AFTER INSERT OR UPDATE OR DELETE ON public.mnt_mtr_equipment FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();
CREATE TRIGGER audit_mnt_mtr_control_plans AFTER INSERT OR UPDATE OR DELETE ON public.mnt_mtr_control_plans FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();
CREATE TRIGGER audit_mnt_mtr_records AFTER INSERT OR UPDATE OR DELETE ON public.mnt_mtr_records FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();
CREATE TRIGGER audit_mnt_mtr_unfit_decisions AFTER INSERT ON public.mnt_mtr_unfit_decisions FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();
CREATE TRIGGER audit_mnt_mtr_impact_reviews AFTER INSERT OR UPDATE ON public.mnt_mtr_impact_reviews FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

CREATE OR REPLACE FUNCTION public.mtr_snapshot() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object('name', coalesce(p.full_name, p.email), 'email', p.email)
  FROM public.profiles p WHERE p.id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.mtr_log_status(p_company uuid, p_eq uuid, p_from text, p_to text, p_cause text, p_record uuid, p_note text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.mnt_mtr_status_history(company_id, equipment_id, from_status, to_status, cause, record_id, note, changed_by, changed_by_snapshot)
  VALUES (p_company, p_eq, p_from, p_to, p_cause, p_record, p_note, auth.uid(), public.mtr_snapshot())
$$;

CREATE OR REPLACE FUNCTION public.mtr_reference_eligible(p_company uuid, p_equipment uuid, p_on date) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.mnt_mtr_equipment e
    WHERE e.id = p_equipment AND e.company_id = p_company AND e.deleted_at IS NULL AND e.status = 'operational'
      AND NOT EXISTS (SELECT 1 FROM public.mnt_mtr_impact_reviews i
                      WHERE i.equipment_id = e.id AND i.status = 'pending')
      AND EXISTS (
        SELECT 1 FROM public.mnt_mtr_control_plans p
        WHERE p.equipment_id = e.id AND p.company_id = p_company AND p.active AND p.qualifies_as_reference
          AND (SELECT r.result = 'fit' AND coalesce(r.next_due_override, r.next_due_calculated) >= p_on
               FROM public.mnt_mtr_records r
               WHERE r.control_plan_id = p.id AND r.status = 'validated' AND r.performed_on <= p_on
               ORDER BY r.performed_on DESC, r.version DESC LIMIT 1) IS TRUE))
$$;

CREATE OR REPLACE FUNCTION public.mtr_validate_record(p_record uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r public.mnt_mtr_records%ROWTYPE; p public.mnt_mtr_control_plans%ROWTYPE; e public.mnt_mtr_equipment%ROWTYPE;
  v_result text; v_lines int; v_bad int; v_next date; v_new_status text;
BEGIN
  SELECT * INTO r FROM public.mnt_mtr_records WHERE id = p_record FOR UPDATE;
  IF NOT FOUND OR NOT coalesce(public.can_close_session(r.company_id), false) THEN
    RAISE EXCEPTION 'Sin permiso o registro inexistente' USING ERRCODE = '42501';
  END IF;
  IF r.status <> 'draft' THEN RAISE EXCEPTION 'El registro ya está validado' USING ERRCODE = '55000'; END IF;
  SELECT * INTO e FROM public.mnt_mtr_equipment WHERE id = r.equipment_id FOR UPDATE;
  SELECT * INTO p FROM public.mnt_mtr_control_plans WHERE id = r.control_plan_id;
  IF e.status = 'retired' OR e.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'Equipo dado de baja' USING ERRCODE = '55000'; END IF;
  IF r.performed_on > current_date THEN RAISE EXCEPTION 'La fecha del control no puede ser futura' USING ERRCODE = '22023'; END IF;
  IF p.requires_document AND r.document_ref IS NULL THEN
    RAISE EXCEPTION 'El control requiere certificado o documento' USING ERRCODE = '23514';
  END IF;
  IF r.kind = 'verification' AND p.method = 'internal' THEN
    IF r.reference_equipment_id IS NULL THEN RAISE EXCEPTION 'La verificación interna requiere patrón' USING ERRCODE = '23514'; END IF;
    IF NOT public.mtr_reference_eligible(r.company_id, r.reference_equipment_id, r.performed_on) THEN
      RAISE EXCEPTION 'El patrón no es apto o no tiene control habilitante vigente en la fecha' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF r.kind = 'calibration' AND p.method = 'external' AND (r.laboratory IS NULL OR r.certificate_number IS NULL) THEN
    RAISE EXCEPTION 'La calibración externa requiere laboratorio y nº de certificado' USING ERRCODE = '23514';
  END IF;

  UPDATE public.mnt_mtr_record_lines SET result = CASE
      WHEN tolerance IS NOT NULL AND measured_value IS NOT NULL AND reference_value IS NOT NULL
        THEN CASE WHEN abs(measured_value - reference_value) <= tolerance THEN 'fit' ELSE 'unfit' END
      ELSE result END
   WHERE record_id = r.id;
  SELECT count(*), count(*) FILTER (WHERE result = 'unfit') INTO v_lines, v_bad
    FROM public.mnt_mtr_record_lines WHERE record_id = r.id;
  IF EXISTS (SELECT 1 FROM public.mnt_mtr_record_lines WHERE record_id = r.id AND result IS NULL) THEN
    RAISE EXCEPTION 'Hay líneas sin resultado' USING ERRCODE = '23514';
  END IF;
  IF r.kind = 'verification' AND p.method = 'internal' AND v_lines = 0 THEN
    RAISE EXCEPTION 'La verificación interna requiere al menos una línea de medición' USING ERRCODE = '23514';
  END IF;
  v_result := CASE WHEN v_bad > 0 OR r.result = 'unfit' THEN 'unfit'
                   WHEN v_lines > 0 THEN 'fit' ELSE r.result END;
  IF v_result IS NULL THEN RAISE EXCEPTION 'Falta la evaluación apto/no apto' USING ERRCODE = '23514'; END IF;

  v_next := public.mtr_calc_next_due(r.performed_on, p.frequency_unit, p.frequency_value);
  UPDATE public.mnt_mtr_records SET status = 'validated', result = v_result, next_due_calculated = v_next,
         validated_by = auth.uid(), validated_by_snapshot = public.mtr_snapshot(), validated_at = now()
   WHERE id = r.id;
  IF r.supersedes_id IS NOT NULL THEN
    UPDATE public.mnt_mtr_records SET status = 'superseded' WHERE id = r.supersedes_id;
  END IF;
  UPDATE public.mnt_mtr_control_plans pl SET next_due_on = (
      SELECT coalesce(x.next_due_override, x.next_due_calculated) FROM public.mnt_mtr_records x
      WHERE x.control_plan_id = pl.id AND x.status = 'validated'
      ORDER BY x.performed_on DESC, x.version DESC LIMIT 1)
   WHERE pl.id = p.id;

  v_new_status := e.status;
  IF v_result = 'unfit' THEN
    v_new_status := 'unfit';
    UPDATE public.mnt_mtr_equipment SET status = 'unfit', allowed_uses = NULL WHERE id = e.id;
    PERFORM public.mtr_log_status(e.company_id, e.id, e.status, 'unfit', 'record_unfit', r.id, NULL);
    INSERT INTO public.mnt_mtr_impact_reviews(company_id, equipment_id, record_id) VALUES (e.company_id, e.id, r.id)
      ON CONFLICT (record_id) DO NOTHING;
  ELSIF e.status = 'out_of_service' THEN
    v_new_status := 'operational';
    UPDATE public.mnt_mtr_equipment SET status = 'operational' WHERE id = e.id;
    PERFORM public.mtr_log_status(e.company_id, e.id, e.status, 'operational', 'record_fit', r.id, NULL);
  END IF;
  RETURN jsonb_build_object('result', v_result, 'next_due', v_next, 'equipment_status', v_new_status);
END $$;

CREATE OR REPLACE FUNCTION public.mtr_rectify_record(p_record uuid, p_reason text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.mnt_mtr_records%ROWTYPE; v_id uuid;
BEGIN
  SELECT * INTO r FROM public.mnt_mtr_records WHERE id = p_record FOR UPDATE;
  IF NOT FOUND OR NOT coalesce(public.can_close_session(r.company_id), false) THEN
    RAISE EXCEPTION 'Sin permiso o registro inexistente' USING ERRCODE = '42501';
  END IF;
  IF r.status <> 'validated' THEN RAISE EXCEPTION 'Solo se rectifica un registro validado vigente' USING ERRCODE = '55000'; END IF;
  IF nullif(btrim(p_reason), '') IS NULL THEN RAISE EXCEPTION 'Motivo de rectificación obligatorio' USING ERRCODE = '23514'; END IF;
  INSERT INTO public.mnt_mtr_records(company_id, equipment_id, control_plan_id, kind, performed_on, performer_ref, performer_snapshot,
      result, next_due_override, override_reason, observations, document_ref, version, supersedes_id, rectification_reason,
      laboratory, certificate_number, accreditation, declared_uncertainty, adjusted_or_repaired, reference_equipment_id, created_by)
  VALUES (r.company_id, r.equipment_id, r.control_plan_id, r.kind, r.performed_on, r.performer_ref, r.performer_snapshot,
      r.result, r.next_due_override, r.override_reason, r.observations, r.document_ref, r.version + 1, r.id, p_reason,
      r.laboratory, r.certificate_number, r.accreditation, r.declared_uncertainty, r.adjusted_or_repaired, r.reference_equipment_id, auth.uid())
  RETURNING id INTO v_id;
  INSERT INTO public.mnt_mtr_record_lines(company_id, record_id, position, label, reference_value, measured_value, tolerance, result)
  SELECT company_id, v_id, position, label, reference_value, measured_value, tolerance,
         CASE WHEN tolerance IS NULL THEN result END
    FROM public.mnt_mtr_record_lines WHERE record_id = r.id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.mtr_decide_unfit(p_record uuid, p_decision text, p_notes text, p_allowed_uses text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.mnt_mtr_records%ROWTYPE; e public.mnt_mtr_equipment%ROWTYPE; v_to text;
BEGIN
  SELECT * INTO r FROM public.mnt_mtr_records WHERE id = p_record;
  IF NOT FOUND OR NOT coalesce(public.can_close_session(r.company_id), false) THEN
    RAISE EXCEPTION 'Sin permiso o registro inexistente' USING ERRCODE = '42501';
  END IF;
  IF r.status <> 'validated' OR r.result <> 'unfit' THEN
    RAISE EXCEPTION 'Solo se decide sobre un control No apto validado' USING ERRCODE = '55000';
  END IF;
  SELECT * INTO e FROM public.mnt_mtr_equipment WHERE id = r.equipment_id FOR UPDATE;
  IF e.status <> 'unfit' THEN RAISE EXCEPTION 'El equipo no está en estado No apto' USING ERRCODE = '55000'; END IF;
  v_to := CASE p_decision WHEN 'retire' THEN 'retired' WHEN 'repair' THEN 'out_of_service'
                          WHEN 'repeat' THEN 'out_of_service' WHEN 'restrict' THEN 'restricted' END;
  IF v_to IS NULL THEN RAISE EXCEPTION 'Decisión no válida' USING ERRCODE = '22023'; END IF;
  IF p_decision = 'restrict' AND nullif(btrim(p_allowed_uses), '') IS NULL THEN
    RAISE EXCEPTION 'Restringir uso exige indicar los usos permitidos' USING ERRCODE = '23514';
  END IF;
  INSERT INTO public.mnt_mtr_unfit_decisions(company_id, record_id, equipment_id, decision, notes, allowed_uses, decided_by, decided_by_snapshot)
  VALUES (r.company_id, r.id, e.id, p_decision, p_notes, CASE WHEN p_decision = 'restrict' THEN p_allowed_uses END,
          auth.uid(), public.mtr_snapshot());
  UPDATE public.mnt_mtr_equipment SET status = v_to,
         allowed_uses = CASE WHEN p_decision = 'restrict' THEN p_allowed_uses ELSE NULL END,
         restrictions = CASE WHEN p_decision = 'restrict' THEN coalesce(p_notes, restrictions) ELSE restrictions END
   WHERE id = e.id;
  PERFORM public.mtr_log_status(e.company_id, e.id, 'unfit', v_to, 'decision_' || p_decision, r.id, p_notes);
  RETURN v_to;
END $$;

CREATE OR REPLACE FUNCTION public.mtr_close_impact(p_review uuid, p_conclusion text, p_justification text,
  p_actions text, p_period text, p_reviewed_on date, p_ext_type text, p_ext_id text, p_ext_label text, p_ext_url text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE i public.mnt_mtr_impact_reviews%ROWTYPE;
BEGIN
  SELECT * INTO i FROM public.mnt_mtr_impact_reviews WHERE id = p_review FOR UPDATE;
  IF NOT FOUND OR NOT coalesce(public.can_close_session(i.company_id), false) THEN
    RAISE EXCEPTION 'Sin permiso o evaluación inexistente' USING ERRCODE = '42501';
  END IF;
  IF i.status <> 'pending' THEN RAISE EXCEPTION 'La evaluación ya está cerrada' USING ERRCODE = '55000'; END IF;
  IF p_conclusion = 'impact' AND nullif(btrim(p_actions), '') IS NULL THEN
    RAISE EXCEPTION 'Con impacto es obligatorio describir las acciones realizadas o previstas' USING ERRCODE = '23514';
  END IF;
  UPDATE public.mnt_mtr_impact_reviews SET status = 'evaluated', conclusion = p_conclusion,
         justification = p_justification, actions_taken_or_planned = p_actions, period_reviewed = p_period,
         reviewed_on = coalesce(p_reviewed_on, current_date), responsible_ref = auth.uid(),
         external_ref_type = p_ext_type, external_ref_id = p_ext_id, external_ref_label = p_ext_label, external_ref_url = p_ext_url,
         closed_by = auth.uid(), closed_by_snapshot = public.mtr_snapshot(), closed_at = now()
   WHERE id = i.id;
END $$;

CREATE OR REPLACE FUNCTION public.mtr_move_site(p_equipment uuid, p_site uuid, p_location_detail text, p_note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e public.mnt_mtr_equipment%ROWTYPE;
BEGIN
  SELECT * INTO e FROM public.mnt_mtr_equipment WHERE id = p_equipment FOR UPDATE;
  IF NOT FOUND OR NOT coalesce(public.can_manage_assets(e.company_id), false) THEN
    RAISE EXCEPTION 'Sin permiso o equipo inexistente' USING ERRCODE = '42501';
  END IF;
  IF NOT public.mtr_site_in_org(e.company_id, p_site) THEN
    RAISE EXCEPTION 'El site no pertenece a la organización' USING ERRCODE = '23514';
  END IF;
  UPDATE public.mnt_mtr_equipment SET site_id = p_site, location_detail = p_location_detail WHERE id = e.id;
  INSERT INTO public.mnt_mtr_site_moves(company_id, equipment_id, from_site_id, to_site_id, location_detail, note, moved_by, moved_by_snapshot)
  VALUES (e.company_id, e.id, e.site_id, p_site, p_location_detail, p_note, auth.uid(), public.mtr_snapshot());
END $$;

CREATE OR REPLACE FUNCTION public.mtr_set_status(p_equipment uuid, p_status text, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e public.mnt_mtr_equipment%ROWTYPE;
BEGIN
  SELECT * INTO e FROM public.mnt_mtr_equipment WHERE id = p_equipment FOR UPDATE;
  IF NOT FOUND OR NOT coalesce(public.can_manage_assets(e.company_id), false) THEN
    RAISE EXCEPTION 'Sin permiso o equipo inexistente' USING ERRCODE = '42501';
  END IF;
  IF nullif(btrim(p_reason), '') IS NULL THEN RAISE EXCEPTION 'Motivo obligatorio' USING ERRCODE = '23514'; END IF;
  IF NOT ((e.status, p_status) IN (('operational','out_of_service'), ('restricted','out_of_service'),
          ('operational','retired'), ('restricted','retired'), ('out_of_service','retired'))) THEN
    RAISE EXCEPTION 'Transición no permitida: % -> %', e.status, p_status USING ERRCODE = '55000';
  END IF;
  UPDATE public.mnt_mtr_equipment SET status = p_status, allowed_uses = NULL WHERE id = e.id;
  PERFORM public.mtr_log_status(e.company_id, e.id, e.status, p_status, 'manual', NULL, p_reason);
END $$;

REVOKE ALL ON FUNCTION public.mtr_validate_record(uuid), public.mtr_rectify_record(uuid,text),
  public.mtr_decide_unfit(uuid,text,text,text), public.mtr_close_impact(uuid,text,text,text,text,date,text,text,text,text),
  public.mtr_move_site(uuid,uuid,text,text), public.mtr_set_status(uuid,text,text),
  public.mtr_reference_eligible(uuid,uuid,date), public.mtr_site_in_org(uuid,uuid),
  public.mtr_log_status(uuid,uuid,text,text,text,uuid,text), public.mtr_snapshot() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mtr_validate_record(uuid), public.mtr_rectify_record(uuid,text),
  public.mtr_decide_unfit(uuid,text,text,text), public.mtr_close_impact(uuid,text,text,text,text,date,text,text,text,text),
  public.mtr_move_site(uuid,uuid,text,text), public.mtr_set_status(uuid,text,text),
  public.mtr_reference_eligible(uuid,uuid,date), public.mtr_site_in_org(uuid,uuid) TO authenticated;
