-- Bloque 1B: persisted next due date per plan↔asset link, append-only change log, atomic close functions.
ALTER TABLE public.maintenance_plan_assets ADD COLUMN IF NOT EXISTS next_due_on date;
COMMENT ON COLUMN public.maintenance_plan_assets.next_due_on IS 'Current planned due date (NULL = sin programar). Written only by mnt_sa_* functions; history in mnt_due_changes. start_on keeps its meaning (link start).';

CREATE TABLE IF NOT EXISTS public.mnt_due_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  plan_asset_id uuid NOT NULL,
  plan_id uuid NOT NULL,
  asset_id uuid NOT NULL,
  session_id uuid,
  item_id uuid,
  old_due date,
  new_due date,
  kind text NOT NULL CHECK (kind IN ('initial','close','reschedule','exemption','no_advance')),
  reason text,
  changed_by uuid NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mnt_due_changes_link_idx ON public.mnt_due_changes(company_id, plan_asset_id, changed_at DESC);
GRANT SELECT ON public.mnt_due_changes TO authenticated;
GRANT ALL ON public.mnt_due_changes TO service_role;
ALTER TABLE public.mnt_due_changes ENABLE ROW LEVEL SECURITY;
CREATE POLICY mnt_due_changes_select ON public.mnt_due_changes FOR SELECT TO authenticated
  USING (public.user_has_membership(company_id));

CREATE OR REPLACE FUNCTION public.mnt_sa_tg_due_log_immutable() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'La bitácora de fechas no se puede modificar' USING ERRCODE = '55000';
END $$;
DROP TRIGGER IF EXISTS mnt_due_changes_immutable ON public.mnt_due_changes;
CREATE TRIGGER mnt_due_changes_immutable BEFORE UPDATE ON public.mnt_due_changes
  FOR EACH ROW EXECUTE FUNCTION public.mnt_sa_tg_due_log_immutable();

-- next_due_on can only change through the functions below (they set mnt.due_writer for the transaction).
CREATE OR REPLACE FUNCTION public.mnt_sa_tg_due_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF coalesce(current_setting('mnt.due_writer', true), '') <> 'on' THEN
    IF TG_OP = 'INSERT' AND NEW.next_due_on IS NOT NULL THEN
      RAISE EXCEPTION 'La próxima fecha solo se puede fijar con la función de programación' USING ERRCODE = '42501';
    END IF;
    IF TG_OP = 'UPDATE' AND NEW.next_due_on IS DISTINCT FROM OLD.next_due_on THEN
      RAISE EXCEPTION 'La próxima fecha solo se puede cambiar con la función de programación' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS mnt_plan_assets_due_guard ON public.maintenance_plan_assets;
CREATE TRIGGER mnt_plan_assets_due_guard BEFORE INSERT OR UPDATE ON public.maintenance_plan_assets
  FOR EACH ROW EXECUTE FUNCTION public.mnt_sa_tg_due_guard();

CREATE OR REPLACE FUNCTION public.mnt_sa_plan_months(p_plan uuid) RETURNS integer
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT coalesce(p.interval_months, CASE p.frequency WHEN 'monthly' THEN 1 WHEN 'quarterly' THEN 3
    WHEN 'biannual' THEN 6 WHEN 'semiannual' THEN 6 WHEN 'annual' THEN 12 WHEN 'biennial' THEN 24 END)
  FROM public.maintenance_plans p WHERE p.id = p_plan;
$$;

CREATE OR REPLACE FUNCTION public.mnt_sa_org_tz(p_company uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT CASE WHEN c.timezone IS NOT NULL AND EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = c.timezone)
                               THEN c.timezone END FROM public.companies c WHERE c.id = p_company), 'Europe/Madrid');
$$;

-- First date (batch) and free rescheduling. Requires plan-management permission.
CREATE OR REPLACE FUNCTION public.mnt_sa_set_due(p_company uuid, p_items jsonb, p_reason text DEFAULT NULL) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  me uuid := auth.uid(); it jsonb; r record; v_new date; v_reason text; n int := 0;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'No autenticado' USING ERRCODE = '42501'; END IF;
  IF NOT public.can_manage_assets(p_company) THEN
    RAISE EXCEPTION 'Sin permiso para programar fechas en esta organización' USING ERRCODE = '42501';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN RAISE EXCEPTION 'Lista de equipos no válida' USING ERRCODE = '22023'; END IF;
  FOR it IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    SELECT pa.id, pa.plan_id, pa.asset_id, pa.next_due_on INTO r
      FROM public.maintenance_plan_assets pa JOIN public.maintenance_plans p ON p.id = pa.plan_id
     WHERE pa.id = (it->>'plan_asset_id')::uuid AND p.company_id = p_company
     FOR UPDATE OF pa;
    IF NOT FOUND THEN RAISE EXCEPTION 'Equipo del plan no encontrado en la organización activa' USING ERRCODE = 'P0002'; END IF;
    v_new := nullif(it->>'due', '')::date;
    IF v_new IS NOT DISTINCT FROM r.next_due_on THEN CONTINUE; END IF;
    v_reason := nullif(btrim(coalesce(it->>'reason', p_reason, '')), '');
    IF r.next_due_on IS NOT NULL AND v_reason IS NULL THEN
      RAISE EXCEPTION 'Indica el motivo del cambio de fecha' USING ERRCODE = '23514';
    END IF;
    PERFORM set_config('mnt.due_writer', 'on', true);
    UPDATE public.maintenance_plan_assets SET next_due_on = v_new WHERE id = r.id;
    PERFORM set_config('mnt.due_writer', 'off', true);
    INSERT INTO public.mnt_due_changes(company_id, plan_asset_id, plan_id, asset_id, old_due, new_due, kind, reason, changed_by)
    VALUES (p_company, r.id, r.plan_id, r.asset_id, r.next_due_on, v_new,
            CASE WHEN r.next_due_on IS NULL THEN 'initial' ELSE 'reschedule' END, v_reason, me);
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;

-- Per-item due decisions applied inside the close transaction (internal helper, not callable by clients).
CREATE OR REPLACE FUNCTION public.mnt_sa_apply_due(p_company uuid, p_session uuid, p_plan uuid, p_decisions jsonb, p_external_on date)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  me uuid := auth.uid(); v_tz text := public.mnt_sa_org_tz(p_company); v_months int := public.mnt_sa_plan_months(p_plan);
  it record; d jsonb; l record; v_exec date; v_planned date; v_prop date; v_cal date; v_action text; v_due date;
  v_reason text; v_need boolean; v_kind text; v_has_link boolean;
BEGIN
  FOR it IN SELECT i.id, i.asset_id, i.result, i.completed_at FROM public.maintenance_items i
             WHERE i.session_id = p_session ORDER BY i.created_at, i.id LOOP
    SELECT x INTO d FROM jsonb_array_elements(coalesce(p_decisions, '[]'::jsonb)) x WHERE x->>'item_id' = it.id::text LIMIT 1;
    SELECT pa.id, pa.next_due_on INTO l FROM public.maintenance_plan_assets pa
     WHERE pa.plan_id = p_plan AND pa.asset_id = it.asset_id
     ORDER BY (pa.end_on IS NULL) DESC, pa.created_at DESC LIMIT 1 FOR UPDATE;
    v_has_link := FOUND;
    v_planned := CASE WHEN v_has_link THEN l.next_due_on END;
    v_exec := CASE WHEN it.result IN ('ok','with_incident')
                   THEN coalesce(p_external_on, (it.completed_at AT TIME ZONE v_tz)::date) END;
    v_prop := CASE WHEN v_exec IS NOT NULL AND v_months IS NOT NULL THEN (v_exec + make_interval(months => v_months))::date END;
    v_cal := CASE WHEN v_exec IS NOT NULL AND v_planned IS NOT NULL AND v_months IS NOT NULL
                  THEN (v_planned + make_interval(months => v_months))::date END;
    v_action := coalesce(d->>'action', CASE WHEN it.result IN ('ok','with_incident') THEN 'advance'
                                            WHEN it.result = 'not_applicable' THEN NULL ELSE 'keep' END);
    IF v_action IS NULL THEN
      RAISE EXCEPTION 'Decide la próxima fecha de los equipos marcados como «No aplica»' USING ERRCODE = '23514';
    END IF;
    IF v_action NOT IN ('advance','keep') THEN RAISE EXCEPTION 'Decisión no válida' USING ERRCODE = '22023'; END IF;
    IF it.result IN ('skipped','pending') AND v_action = 'advance' THEN
      RAISE EXCEPTION 'Un equipo no realizado no avanza al cerrar; reprográmalo desde Próximos' USING ERRCODE = '23514';
    END IF;
    v_reason := nullif(btrim(coalesce(d->>'reason', '')), '');
    v_due := CASE WHEN v_action = 'advance' THEN coalesce(nullif(d->>'due', '')::date, v_prop) END;
    IF v_action = 'advance' AND v_due IS NULL THEN
      RAISE EXCEPTION 'Indica la próxima fecha' USING ERRCODE = '23514';
    END IF;
    v_need := (it.result = 'with_incident' AND v_action = 'keep')
           OR (it.result = 'not_applicable' AND v_action = 'advance')
           OR (v_action = 'advance' AND v_due IS DISTINCT FROM v_prop AND v_due IS DISTINCT FROM v_cal);
    IF v_need AND v_reason IS NULL THEN
      RAISE EXCEPTION 'Indica el motivo de la decisión sobre la próxima fecha' USING ERRCODE = '23514';
    END IF;
    v_kind := CASE WHEN it.result = 'not_applicable' AND v_action = 'advance' THEN 'exemption'
                   WHEN it.result = 'with_incident' AND v_action = 'keep' THEN 'no_advance' ELSE 'close' END;
    UPDATE public.maintenance_items SET metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('due', jsonb_build_object(
      'planned_on', v_planned, 'executed_on', v_exec, 'late', (v_exec IS NOT NULL AND v_planned IS NOT NULL AND v_exec > v_planned),
      'proposed_on', v_prop, 'calendar_on', v_cal, 'advanced', v_action = 'advance',
      'applied_due', CASE WHEN v_action = 'advance' THEN v_due ELSE v_planned END, 'reason', v_reason, 'linked', v_has_link))
     WHERE id = it.id;
    IF v_has_link AND v_action = 'advance' AND v_due IS DISTINCT FROM l.next_due_on THEN
      PERFORM set_config('mnt.due_writer', 'on', true);
      UPDATE public.maintenance_plan_assets SET next_due_on = v_due WHERE id = l.id;
      PERFORM set_config('mnt.due_writer', 'off', true);
      INSERT INTO public.mnt_due_changes(company_id, plan_asset_id, plan_id, asset_id, session_id, item_id, old_due, new_due, kind, reason, changed_by)
      SELECT p_company, l.id, p_plan, it.asset_id, p_session, it.id, l.next_due_on, v_due, v_kind, v_reason, me;
    ELSIF v_has_link AND v_kind = 'no_advance' THEN
      INSERT INTO public.mnt_due_changes(company_id, plan_asset_id, plan_id, asset_id, session_id, item_id, old_due, new_due, kind, reason, changed_by)
      SELECT p_company, l.id, p_plan, it.asset_id, p_session, it.id, l.next_due_on, l.next_due_on, v_kind, v_reason, me;
    END IF;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.mnt_sa_outcome(p_session uuid) RETURNS text
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT CASE WHEN bool_or(result = 'with_incident') THEN
                CASE WHEN bool_or(result = 'skipped') THEN 'incomplete_with_incidents' ELSE 'with_incidents' END
              ELSE CASE WHEN bool_or(result = 'skipped') THEN 'incomplete' ELSE 'ok' END END
    FROM public.maintenance_items WHERE session_id = p_session;
$$;

CREATE OR REPLACE FUNCTION public.mnt_sa_close_snapshot(p_session uuid, p_at timestamptz) RETURNS jsonb
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT jsonb_build_object('at', p_at, 'items', coalesce(jsonb_agg(jsonb_build_object('item_id', i.id, 'asset_id', i.asset_id,
           'result', i.result, 'asset', i.metadata->'snapshot'->'asset') ORDER BY i.created_at, i.id), '[]'::jsonb))
    FROM public.maintenance_items i WHERE i.session_id = p_session;
$$;

-- Internal close: results, outcome, snapshot and due dates in one transaction. Idempotent: a closed session returns closed_now=false.
CREATE OR REPLACE FUNCTION public.mnt_sa_close_session(p_company uuid, p_session uuid, p_signer_name text, p_signer_role text,
  p_signature text, p_decisions jsonb DEFAULT '[]'::jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.maintenance_sessions%ROWTYPE; me uuid := auth.uid(); n_pending int; v_at timestamptz := now(); v_outcome text;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'No autenticado' USING ERRCODE = '42501'; END IF;
  SELECT * INTO s FROM public.maintenance_sessions WHERE id = p_session AND company_id = p_company FOR UPDATE;
  IF NOT FOUND OR NOT public.user_has_membership(p_company) THEN
    RAISE EXCEPTION 'Sesión no encontrada en la organización activa' USING ERRCODE = 'P0002';
  END IF;
  IF s.status = 'closed' THEN
    RETURN jsonb_build_object('closed_now', false, 'pending_count', coalesce((s.metadata->>'skipped_count')::int, 0));
  END IF;
  IF NOT public.can_close_session(p_company) THEN RAISE EXCEPTION 'Sin permiso para cerrar la sesión' USING ERRCODE = '42501'; END IF;
  IF s.status <> 'in_progress' THEN RAISE EXCEPTION 'Transición no permitida: % → closed', s.status USING ERRCODE = '55000'; END IF;
  IF coalesce(btrim(p_signer_name), '') = '' THEN RAISE EXCEPTION 'Indica el nombre del firmante' USING ERRCODE = '23514'; END IF;
  IF coalesce(p_signature, '') = '' THEN RAISE EXCEPTION 'Firma para continuar' USING ERRCODE = '23514'; END IF;
  UPDATE public.maintenance_items SET result = 'skipped' WHERE session_id = p_session AND result = 'pending';
  GET DIAGNOSTICS n_pending = ROW_COUNT;
  PERFORM public.mnt_sa_apply_due(p_company, p_session, s.plan_id, p_decisions, NULL);
  v_outcome := public.mnt_sa_outcome(p_session);
  UPDATE public.maintenance_sessions SET status = 'closed', closed_at = v_at, signer_name = btrim(p_signer_name),
         signer_role = nullif(btrim(coalesce(p_signer_role, '')), ''), signature_image_url = p_signature,
         metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('outcome', v_outcome, 'skipped_count', n_pending,
                    'close_snapshot', public.mnt_sa_close_snapshot(p_session, v_at))
   WHERE id = p_session;
  RETURN jsonb_build_object('closed_now', true, 'pending_count', n_pending);
END $$;

-- External review: common result + per-item exceptions, due dates, close. Same transaction, idempotent.
CREATE OR REPLACE FUNCTION public.mnt_sa_record_external(p_company uuid, p_session uuid, p_performed_on date, p_provider text,
  p_reference text, p_result text, p_description text, p_exceptions jsonb DEFAULT '[]'::jsonb, p_decisions jsonb DEFAULT '[]'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.maintenance_sessions%ROWTYPE; me uuid := auth.uid(); v_tz text; v_at timestamptz; v_now timestamptz := now();
  v_common text; v_outcome text; n_skip int;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'No autenticado' USING ERRCODE = '42501'; END IF;
  SELECT * INTO s FROM public.maintenance_sessions WHERE id = p_session AND company_id = p_company FOR UPDATE;
  IF NOT FOUND OR NOT public.user_has_membership(p_company) THEN
    RAISE EXCEPTION 'Sesión no encontrada en la organización activa' USING ERRCODE = 'P0002';
  END IF;
  IF s.status = 'closed' THEN RETURN jsonb_build_object('closed_now', false); END IF;
  IF s.status NOT IN ('draft','in_progress') THEN RAISE EXCEPTION 'La sesión está cerrada' USING ERRCODE = '55000'; END IF;
  IF NOT public.can_close_session(p_company) THEN RAISE EXCEPTION 'Sin permiso para registrar y cerrar la revisión' USING ERRCODE = '42501'; END IF;
  IF p_performed_on IS NULL THEN RAISE EXCEPTION 'Indica la fecha de realización' USING ERRCODE = '23514'; END IF;
  IF coalesce(btrim(p_provider), '') = '' THEN RAISE EXCEPTION 'Indica la empresa que ha realizado la revisión' USING ERRCODE = '23514'; END IF;
  IF p_result NOT IN ('ok','with_incidents') THEN RAISE EXCEPTION 'Resultado no válido' USING ERRCODE = '22023'; END IF;
  IF p_result = 'with_incidents' AND coalesce(btrim(p_description), '') = '' THEN
    RAISE EXCEPTION 'Describe las incidencias detectadas' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(coalesce(p_exceptions, '[]'::jsonb)) x
              WHERE x->>'result' NOT IN ('ok','with_incident','skipped')
                 OR NOT EXISTS (SELECT 1 FROM public.maintenance_items i WHERE i.session_id = p_session AND i.id::text = x->>'item_id')) THEN
    RAISE EXCEPTION 'Excepción por equipo no válida' USING ERRCODE = '22023';
  END IF;
  v_tz := public.mnt_sa_org_tz(p_company);
  v_at := (p_performed_on::timestamp + time '12:00') AT TIME ZONE v_tz;
  v_common := CASE p_result WHEN 'ok' THEN 'ok' ELSE 'with_incident' END;
  UPDATE public.maintenance_items i SET
    result = coalesce(x.res, v_common),
    observations = coalesce(nullif(btrim(x.note), ''), p_description),
    completed_at = CASE WHEN coalesce(x.res, v_common) = 'skipped' THEN NULL ELSE v_at END,
    metadata = coalesce(i.metadata, '{}'::jsonb) || jsonb_build_object('completion',
      jsonb_build_object('result', coalesce(x.res, v_common), 'external', true, 'at', v_at, 'exception', x.res IS NOT NULL))
  FROM (SELECT ii.id, e->>'result' AS res, e->>'note' AS note FROM public.maintenance_items ii
          LEFT JOIN LATERAL (SELECT e FROM jsonb_array_elements(coalesce(p_exceptions, '[]'::jsonb)) e WHERE e->>'item_id' = ii.id::text LIMIT 1) ex ON true
         WHERE ii.session_id = p_session) x
  WHERE i.id = x.id;
  PERFORM public.mnt_sa_apply_due(p_company, p_session, s.plan_id, p_decisions, p_performed_on);
  v_outcome := public.mnt_sa_outcome(p_session);
  SELECT count(*) INTO n_skip FROM public.maintenance_items WHERE session_id = p_session AND result = 'skipped';
  UPDATE public.maintenance_sessions SET status = 'closed', started_at = coalesce(started_at, v_at), closed_at = v_now,
         is_external = true, external_provider = btrim(p_provider), external_cert_number = nullif(btrim(coalesce(p_reference, '')), ''),
         signer_name = btrim(p_provider), outcome = v_outcome,
         metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('outcome', v_outcome, 'skipped_count', n_skip,
           'close_snapshot', public.mnt_sa_close_snapshot(p_session, v_now),
           'external', jsonb_build_object('performed_on', p_performed_on, 'result', p_result, 'description', p_description))
   WHERE id = p_session;
  RETURN jsonb_build_object('closed_now', true, 'pending_count', n_skip);
END $$;

REVOKE ALL ON FUNCTION public.mnt_sa_apply_due(uuid, uuid, uuid, jsonb, date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mnt_sa_set_due(uuid, jsonb, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mnt_sa_close_session(uuid, uuid, text, text, text, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mnt_sa_record_external(uuid, uuid, date, text, text, text, text, jsonb, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mnt_sa_org_tz(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mnt_sa_set_due(uuid, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mnt_sa_close_session(uuid, uuid, text, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mnt_sa_record_external(uuid, uuid, date, text, text, text, text, jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mnt_sa_org_tz(uuid) TO authenticated;
