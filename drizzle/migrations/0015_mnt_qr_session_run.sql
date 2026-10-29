-- QR operativo autenticado: asignación por sesión, ejecución idempotente, excepciones, cierre trazable, regeneración QR.
CREATE TABLE IF NOT EXISTS public.mnt_session_assignees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  session_id uuid NOT NULL REFERENCES public.maintenance_sessions(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL,
  assigned_by uuid, assigned_at timestamptz NOT NULL DEFAULT now(),
  revoked_by uuid, revoked_at timestamptz);
CREATE UNIQUE INDEX IF NOT EXISTS mnt_session_assignees_active_uq ON public.mnt_session_assignees(session_id, user_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS mnt_session_assignees_user_idx ON public.mnt_session_assignees(user_id) WHERE revoked_at IS NULL;
GRANT SELECT ON public.mnt_session_assignees TO authenticated;
GRANT ALL ON public.mnt_session_assignees TO service_role;
ALTER TABLE public.mnt_session_assignees ENABLE ROW LEVEL SECURITY;
CREATE POLICY mnt_sa_assignees_select ON public.mnt_session_assignees FOR SELECT TO authenticated USING (public.user_has_membership(company_id));

CREATE TABLE IF NOT EXISTS public.mnt_item_execution_keys (
  item_id uuid NOT NULL REFERENCES public.maintenance_items(id) ON DELETE RESTRICT,
  idempotency_key text NOT NULL CHECK (length(idempotency_key) BETWEEN 8 AND 100),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  result text NOT NULL, executed_by uuid, created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (item_id, idempotency_key));
GRANT SELECT ON public.mnt_item_execution_keys TO authenticated;
GRANT ALL ON public.mnt_item_execution_keys TO service_role;
ALTER TABLE public.mnt_item_execution_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY mnt_sa_exec_keys_select ON public.mnt_item_execution_keys FOR SELECT TO authenticated USING (public.user_has_membership(company_id));

CREATE TABLE IF NOT EXISTS public.mnt_session_item_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  session_id uuid NOT NULL REFERENCES public.maintenance_sessions(id) ON DELETE RESTRICT,
  item_id uuid NOT NULL UNIQUE REFERENCES public.maintenance_items(id) ON DELETE RESTRICT,
  asset_id uuid NOT NULL,
  reason_code text NOT NULL CHECK (reason_code IN ('not_applicable','inaccessible','other')),
  reason_text text NOT NULL CHECK (length(btrim(reason_text)) >= 3),
  recorded_by uuid NOT NULL, recorded_by_name text, recorded_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.mnt_session_item_exceptions TO authenticated;
GRANT ALL ON public.mnt_session_item_exceptions TO service_role;
ALTER TABLE public.mnt_session_item_exceptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY mnt_sa_item_exc_select ON public.mnt_session_item_exceptions FOR SELECT TO authenticated USING (public.user_has_membership(company_id));

CREATE TABLE IF NOT EXISTS public.mnt_session_closure_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  session_id uuid NOT NULL REFERENCES public.maintenance_sessions(id) ON DELETE RESTRICT,
  closed_by uuid NOT NULL, closed_at timestamptz NOT NULL DEFAULT now(),
  summary jsonb NOT NULL DEFAULT '{}');
GRANT SELECT ON public.mnt_session_closure_events TO authenticated;
GRANT ALL ON public.mnt_session_closure_events TO service_role;
ALTER TABLE public.mnt_session_closure_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY mnt_sa_closure_select ON public.mnt_session_closure_events FOR SELECT TO authenticated USING (public.user_has_membership(company_id));

CREATE TABLE IF NOT EXISTS public.mnt_qr_token_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE RESTRICT,
  regenerated_by uuid NOT NULL, regenerated_at timestamptz NOT NULL DEFAULT now(),
  old_token_sha256 text NOT NULL);
GRANT SELECT ON public.mnt_qr_token_events TO authenticated;
GRANT ALL ON public.mnt_qr_token_events TO service_role;
ALTER TABLE public.mnt_qr_token_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY mnt_sa_qr_events_select ON public.mnt_qr_token_events FOR SELECT TO authenticated USING (public.can_manage_company(company_id));

-- Item result gains 'excepted' (never counts as reviewed).
DO $$ DECLARE c record; BEGIN
  FOR c IN SELECT conname FROM pg_constraint WHERE conrelid = 'public.maintenance_items'::regclass AND contype = 'c'
            AND pg_get_constraintdef(oid) LIKE '%pending%' LOOP
    EXECUTE format('ALTER TABLE public.maintenance_items DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;
ALTER TABLE public.maintenance_items ADD CONSTRAINT maintenance_items_result_check
  CHECK (result IN ('pending','ok','with_incident','not_applicable','skipped','excepted'));

-- Who may execute a session: run permission AND (assigned OR technician OR supervisor with close permission).
CREATE OR REPLACE FUNCTION public.mnt_sa_can_execute_session(p_session uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.maintenance_sessions s
     WHERE s.id = p_session AND public.can_run_maintenance(s.company_id)
       AND (public.can_close_session(s.company_id) OR s.technician_id = auth.uid()
            OR EXISTS (SELECT 1 FROM public.mnt_session_assignees a
                        WHERE a.session_id = s.id AND a.user_id = auth.uid() AND a.revoked_at IS NULL)));
$$;

-- RLS: answers and item updates only by authorized executors.
DROP POLICY IF EXISTS mi_modify ON public.maintenance_items;
DROP POLICY IF EXISTS mi_insert ON public.maintenance_items;
DROP POLICY IF EXISTS mi_update ON public.maintenance_items;
DROP POLICY IF EXISTS mi_delete ON public.maintenance_items;
CREATE POLICY mi_insert ON public.maintenance_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.maintenance_sessions s WHERE s.id = maintenance_items.session_id AND public.can_run_maintenance(s.company_id)));
CREATE POLICY mi_update ON public.maintenance_items FOR UPDATE TO authenticated
  USING (public.mnt_sa_can_execute_session(session_id)) WITH CHECK (public.mnt_sa_can_execute_session(session_id));
CREATE POLICY mi_delete ON public.maintenance_items FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.maintenance_sessions s WHERE s.id = maintenance_items.session_id AND public.can_run_maintenance(s.company_id)));
DROP POLICY IF EXISTS cr_modify ON public.checklist_responses;
CREATE POLICY cr_modify ON public.checklist_responses FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.maintenance_items i WHERE i.id = checklist_responses.maintenance_item_id AND public.mnt_sa_can_execute_session(i.session_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.maintenance_items i WHERE i.id = checklist_responses.maintenance_item_id AND public.mnt_sa_can_execute_session(i.session_id)));

-- Generic, non-revealing QR resolution as the calling user.
CREATE OR REPLACE FUNCTION public.mnt_sa_resolve_scan(p_token text, p_session uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE na constant jsonb := '{"status":"not_available"}'; a record; r record; v_sessions jsonb;
BEGIN
  IF auth.uid() IS NULL OR p_token IS NULL OR length(p_token) NOT BETWEEN 16 AND 128 THEN RETURN na; END IF;
  SELECT id, code, name, company_id INTO a FROM public.assets WHERE qr_token = p_token AND deleted_at IS NULL;
  IF NOT FOUND OR NOT public.can_run_maintenance(a.company_id) THEN RETURN na; END IF;
  IF p_session IS NOT NULL THEN
    SELECT s.id AS session_id, s.code AS session_code, i.id AS item_id, i.result, i.checklist_template_version_id AS version_id INTO r
      FROM public.maintenance_sessions s JOIN public.maintenance_items i ON i.session_id = s.id AND i.asset_id = a.id
     WHERE s.id = p_session AND s.company_id = a.company_id AND s.status = 'in_progress'
       AND coalesce(s.kind, 'preventive') = 'preventive' AND NOT s.is_external
       AND public.mnt_sa_can_execute_session(s.id);
    IF NOT FOUND THEN RETURN na; END IF;
    RETURN jsonb_build_object('status', 'ok', 'kind', 'maintenance_asset',
      'asset', jsonb_build_object('id', a.id, 'code', a.code, 'name', a.name),
      'session_id', r.session_id, 'session_code', r.session_code, 'item_id', r.item_id,
      'item_result', r.result, 'checklist_version_id', r.version_id);
  END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('session_id', s.id, 'session_code', s.code, 'item_id', i.id,
           'item_result', i.result, 'plan_name', p.name) ORDER BY s.scheduled_for NULLS LAST, s.code), '[]') INTO v_sessions
    FROM public.maintenance_sessions s JOIN public.maintenance_items i ON i.session_id = s.id AND i.asset_id = a.id
    LEFT JOIN public.maintenance_plans p ON p.id = s.plan_id
   WHERE s.company_id = a.company_id AND s.status = 'in_progress' AND coalesce(s.kind, 'preventive') = 'preventive'
     AND NOT s.is_external AND public.mnt_sa_can_execute_session(s.id);
  IF jsonb_array_length(v_sessions) = 0 THEN RETURN na; END IF;
  RETURN jsonb_build_object('status', 'choose', 'kind', 'maintenance_asset',
    'asset', jsonb_build_object('id', a.id, 'code', a.code, 'name', a.name), 'sessions', v_sessions);
END $$;

CREATE OR REPLACE FUNCTION public.mnt_sa_list_my_runnable_sessions(p_company uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(jsonb_agg(x ORDER BY x->>'scheduled_for' NULLS LAST, x->>'code'), '[]') FROM (
    SELECT jsonb_build_object('id', s.id, 'code', s.code, 'scheduled_for', s.scheduled_for, 'plan_name', p.name,
             'total', (SELECT count(*) FROM public.maintenance_items i WHERE i.session_id = s.id),
             'done', (SELECT count(*) FROM public.maintenance_items i WHERE i.session_id = s.id AND i.result IN ('ok','with_incident','not_applicable')),
             'excepted', (SELECT count(*) FROM public.maintenance_items i WHERE i.session_id = s.id AND i.result = 'excepted')) x
      FROM public.maintenance_sessions s LEFT JOIN public.maintenance_plans p ON p.id = s.plan_id
     WHERE s.company_id = p_company AND public.user_has_membership(p_company) AND s.status = 'in_progress'
       AND coalesce(s.kind, 'preventive') = 'preventive' AND NOT s.is_external
       AND public.mnt_sa_can_execute_session(s.id)) q;
$$;

-- Idempotent execution of one session item.
CREATE OR REPLACE FUNCTION public.mnt_sa_record_item_execution(p_company uuid, p_session uuid, p_item uuid, p_result text,
  p_observations text, p_fail_count integer, p_key text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid(); i record; s record; prev text; v_at timestamptz := now();
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Equipo no disponible' USING ERRCODE = '42501'; END IF;
  IF p_key IS NULL OR length(p_key) NOT BETWEEN 8 AND 100 THEN RAISE EXCEPTION 'Clave de envío no válida' USING ERRCODE = '22023'; END IF;
  SELECT * INTO s FROM public.maintenance_sessions WHERE id = p_session AND company_id = p_company;
  IF NOT FOUND OR NOT public.mnt_sa_can_execute_session(p_session) THEN RAISE EXCEPTION 'Equipo no disponible' USING ERRCODE = '42501'; END IF;
  SELECT * INTO i FROM public.maintenance_items WHERE id = p_item AND session_id = p_session FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Equipo no disponible' USING ERRCODE = '42501'; END IF;
  SELECT result INTO prev FROM public.mnt_item_execution_keys WHERE item_id = p_item AND idempotency_key = p_key;
  IF FOUND THEN RETURN jsonb_build_object('replayed', true, 'result', prev); END IF;
  IF s.status <> 'in_progress' THEN RAISE EXCEPTION 'La sesión no está en curso' USING ERRCODE = '55000'; END IF;
  IF p_result NOT IN ('ok','with_incident','not_applicable') THEN RAISE EXCEPTION 'Resultado no válido' USING ERRCODE = '22023'; END IF;
  IF i.result = 'excepted' THEN RAISE EXCEPTION 'El equipo tiene una excepción de cierre registrada' USING ERRCODE = '55000'; END IF;
  UPDATE public.maintenance_items SET result = p_result, observations = nullif(btrim(coalesce(p_observations, '')), ''),
         completed_at = v_at, completed_by = me,
         metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('completion', jsonb_build_object(
           'result', p_result, 'fail_count', coalesce(p_fail_count, 0), 'at', v_at, 'by', me,
           'checklist_version_id', i.checklist_template_version_id, 'key', p_key))
   WHERE id = p_item;
  INSERT INTO public.mnt_item_execution_keys(item_id, idempotency_key, company_id, result, executed_by)
  VALUES (p_item, p_key, p_company, p_result, me);
  IF p_result = 'with_incident' THEN
    INSERT INTO public.mnt_outbox(org_id, event_type, aggregate_type, aggregate_id, payload)
    VALUES (p_company, 'mnt.session.item_anomaly', 'maintenance_item', p_item,
            jsonb_build_object('session_id', p_session, 'asset_id', i.asset_id, 'fail_count', coalesce(p_fail_count, 0), 'by', me));
  END IF;
  RETURN jsonb_build_object('replayed', false, 'result', p_result);
END $$;

-- Justified closing exception: close permission only; pending → excepted (never reviewed).
CREATE OR REPLACE FUNCTION public.mnt_sa_record_closure_exception(p_company uuid, p_item uuid, p_code text, p_text text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid(); i record; v_name text; v_at timestamptz := now();
BEGIN
  IF me IS NULL OR NOT public.can_close_session(p_company) THEN
    RAISE EXCEPTION 'Sin permiso para registrar excepciones de cierre' USING ERRCODE = '42501'; END IF;
  SELECT i.*, s.status AS s_status INTO i FROM public.maintenance_items i JOIN public.maintenance_sessions s ON s.id = i.session_id
   WHERE i.id = p_item AND s.company_id = p_company FOR UPDATE OF i;
  IF NOT FOUND THEN RAISE EXCEPTION 'Equipo no disponible' USING ERRCODE = '42501'; END IF;
  IF i.s_status <> 'in_progress' THEN RAISE EXCEPTION 'La sesión no está en curso' USING ERRCODE = '55000'; END IF;
  IF p_code NOT IN ('not_applicable','inaccessible','other') THEN RAISE EXCEPTION 'Motivo no válido' USING ERRCODE = '22023'; END IF;
  IF length(btrim(coalesce(p_text, ''))) < 3 THEN RAISE EXCEPTION 'Explica el motivo de la excepción' USING ERRCODE = '23514'; END IF;
  IF i.result = 'excepted' THEN RETURN jsonb_build_object('recorded_now', false); END IF;
  IF i.result <> 'pending' THEN RAISE EXCEPTION 'Solo los equipos pendientes admiten excepción' USING ERRCODE = '55000'; END IF;
  SELECT coalesce(nullif(full_name, ''), email) INTO v_name FROM public.profiles WHERE id = me;
  INSERT INTO public.mnt_session_item_exceptions(company_id, session_id, item_id, asset_id, reason_code, reason_text, recorded_by, recorded_by_name, recorded_at)
  VALUES (p_company, i.session_id, p_item, i.asset_id, p_code, btrim(p_text), me, v_name, v_at);
  UPDATE public.maintenance_items SET result = 'excepted',
         metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('exception', jsonb_build_object(
           'code', p_code, 'text', btrim(p_text), 'by', me, 'by_name', v_name, 'at', v_at))
   WHERE id = p_item;
  RETURN jsonb_build_object('recorded_now', true);
END $$;

CREATE OR REPLACE FUNCTION public.mnt_sa_assign_session_people(p_company uuid, p_session uuid, p_users uuid[]) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid(); st text; n int;
BEGIN
  IF me IS NULL OR NOT public.can_close_session(p_company) THEN
    RAISE EXCEPTION 'Sin permiso para asignar operarios' USING ERRCODE = '42501'; END IF;
  SELECT status INTO st FROM public.maintenance_sessions WHERE id = p_session AND company_id = p_company FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sesión no encontrada en la organización activa' USING ERRCODE = 'P0002'; END IF;
  IF st NOT IN ('draft','in_progress') THEN RAISE EXCEPTION 'La sesión no admite cambios de asignación' USING ERRCODE = '55000'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(coalesce(p_users, '{}')) u WHERE NOT EXISTS (
       SELECT 1 FROM public.company_members m WHERE m.company_id = p_company AND m.user_id = u AND m.active
          AND m.role IN ('administrator','system_manager','manager','employee'))) THEN
    RAISE EXCEPTION 'Solo se pueden asignar miembros activos con permiso de ejecución' USING ERRCODE = '23514'; END IF;
  UPDATE public.mnt_session_assignees SET revoked_at = now(), revoked_by = me
   WHERE session_id = p_session AND revoked_at IS NULL AND NOT (user_id = ANY (coalesce(p_users, '{}')));
  INSERT INTO public.mnt_session_assignees(company_id, session_id, user_id, assigned_by)
  SELECT p_company, p_session, u, me FROM (SELECT DISTINCT unnest(coalesce(p_users, '{}')) u) x
   WHERE NOT EXISTS (SELECT 1 FROM public.mnt_session_assignees a WHERE a.session_id = p_session AND a.user_id = x.u AND a.revoked_at IS NULL);
  SELECT count(*) INTO n FROM public.mnt_session_assignees WHERE session_id = p_session AND revoked_at IS NULL;
  RETURN n;
END $$;

-- People eligible/assigned for a session (names for the picker); members of the org only.
CREATE OR REPLACE FUNCTION public.mnt_sa_list_session_people(p_company uuid, p_session uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('user_id', m.user_id, 'name', coalesce(nullif(pr.full_name, ''), pr.email, 'Usuario'),
           'role', m.role, 'assigned', EXISTS (SELECT 1 FROM public.mnt_session_assignees a WHERE a.session_id = p_session
                                                AND a.user_id = m.user_id AND a.revoked_at IS NULL),
           'technician', s.technician_id = m.user_id) ORDER BY coalesce(pr.full_name, pr.email)), '[]')
    FROM public.maintenance_sessions s JOIN public.company_members m ON m.company_id = s.company_id AND m.active
    LEFT JOIN public.profiles pr ON pr.id = m.user_id
   WHERE s.id = p_session AND s.company_id = p_company AND public.user_has_membership(p_company)
     AND m.role IN ('administrator','system_manager','manager','employee');
$$;

CREATE OR REPLACE FUNCTION public.mnt_sa_regenerate_asset_qr(p_company uuid, p_asset uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE me uuid := auth.uid(); old text; v_new text := encode(extensions.gen_random_bytes(20), 'hex');
BEGIN
  IF me IS NULL OR NOT public.can_manage_company(p_company) THEN
    RAISE EXCEPTION 'Sin permiso para regenerar el QR' USING ERRCODE = '42501'; END IF;
  SELECT qr_token INTO old FROM public.assets WHERE id = p_asset AND company_id = p_company AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Activo no encontrado' USING ERRCODE = 'P0002'; END IF;
  UPDATE public.assets SET qr_token = v_new WHERE id = p_asset;
  INSERT INTO public.mnt_qr_token_events(company_id, asset_id, regenerated_by, old_token_sha256)
  VALUES (p_company, p_asset, me, encode(extensions.digest(old, 'sha256'), 'hex'));
  RETURN v_new;
END $$;

-- Outcome: excepted behaves like a not-performed item.
CREATE OR REPLACE FUNCTION public.mnt_sa_outcome(p_session uuid) RETURNS text
LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  SELECT CASE WHEN bool_or(result = 'with_incident') THEN
                CASE WHEN bool_or(result IN ('skipped','excepted')) THEN 'incomplete_with_incidents' ELSE 'with_incidents' END
              ELSE CASE WHEN bool_or(result IN ('skipped','excepted')) THEN 'incomplete' ELSE 'ok' END END
    FROM public.maintenance_items WHERE session_id = p_session;
$$;

-- Due application: an excepted item never advances its date.
DO $$ DECLARE d text := pg_get_functiondef('public.mnt_sa_apply_due(uuid,uuid,uuid,jsonb,date)'::regprocedure); BEGIN
  IF position($q$('skipped','pending','excepted')$q$ IN d) = 0 THEN
    EXECUTE replace(d, $q$it.result IN ('skipped','pending') AND v_action = 'advance'$q$, $q$it.result IN ('skipped','pending','excepted') AND v_action = 'advance'$q$);
  END IF;
END $$;

-- Close: blocked while applicable items are pending; records closure event with executors and exceptions.
CREATE OR REPLACE FUNCTION public.mnt_sa_close_session(p_company uuid, p_session uuid, p_signer_name text, p_signer_role text, p_signature text, p_decisions jsonb DEFAULT '[]'::jsonb)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE s public.maintenance_sessions%ROWTYPE; me uuid := auth.uid(); n_pending int; v_at timestamptz := now(); v_outcome text; v_summary jsonb;
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
  SELECT count(*) INTO n_pending FROM public.maintenance_items WHERE session_id = p_session AND result = 'pending';
  IF n_pending > 0 THEN
    RAISE EXCEPTION 'Hay % equipo(s) pendiente(s): revísalos o registra una excepción justificada', n_pending USING ERRCODE = '23514';
  END IF;
  PERFORM public.mnt_sa_apply_due(p_company, p_session, s.plan_id, p_decisions, NULL);
  v_outcome := public.mnt_sa_outcome(p_session);
  v_summary := jsonb_build_object(
    'outcome', v_outcome,
    'totals', (SELECT jsonb_object_agg(result, n) FROM (SELECT result, count(*) n FROM public.maintenance_items WHERE session_id = p_session GROUP BY result) t),
    'executors', (SELECT coalesce(jsonb_agg(jsonb_build_object('user_id', e.completed_by, 'name', coalesce(nullif(pr.full_name, ''), pr.email), 'items', e.n)), '[]')
                    FROM (SELECT completed_by, count(*) n FROM public.maintenance_items WHERE session_id = p_session AND completed_by IS NOT NULL GROUP BY completed_by) e
                    LEFT JOIN public.profiles pr ON pr.id = e.completed_by),
    'exceptions', (SELECT coalesce(jsonb_agg(jsonb_build_object('item_id', x.item_id, 'asset_id', x.asset_id, 'asset', i.metadata->'snapshot'->'asset',
                      'code', x.reason_code, 'text', x.reason_text, 'by', x.recorded_by, 'by_name', x.recorded_by_name, 'at', x.recorded_at) ORDER BY x.recorded_at), '[]')
                     FROM public.mnt_session_item_exceptions x JOIN public.maintenance_items i ON i.id = x.item_id WHERE x.session_id = p_session));
  UPDATE public.maintenance_sessions SET status = 'closed', closed_at = v_at, signer_name = btrim(p_signer_name),
         signer_role = nullif(btrim(coalesce(p_signer_role, '')), ''), signature_image_url = p_signature,
         metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('outcome', v_outcome, 'skipped_count', 0,
                    'close_snapshot', public.mnt_sa_close_snapshot(p_session, v_at), 'close_summary', v_summary)
   WHERE id = p_session;
  INSERT INTO public.mnt_session_closure_events(company_id, session_id, closed_by, closed_at, summary)
  VALUES (p_company, p_session, me, v_at, v_summary);
  RETURN jsonb_build_object('closed_now', true, 'pending_count', 0);
END $function$;

REVOKE ALL ON FUNCTION public.mnt_sa_resolve_scan(text, uuid) FROM anon, public;
REVOKE ALL ON FUNCTION public.mnt_sa_list_my_runnable_sessions(uuid) FROM anon, public;
REVOKE ALL ON FUNCTION public.mnt_sa_record_item_execution(uuid, uuid, uuid, text, text, integer, text) FROM anon, public;
REVOKE ALL ON FUNCTION public.mnt_sa_record_closure_exception(uuid, uuid, text, text) FROM anon, public;
REVOKE ALL ON FUNCTION public.mnt_sa_assign_session_people(uuid, uuid, uuid[]) FROM anon, public;
REVOKE ALL ON FUNCTION public.mnt_sa_list_session_people(uuid, uuid) FROM anon, public;
REVOKE ALL ON FUNCTION public.mnt_sa_regenerate_asset_qr(uuid, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.mnt_sa_resolve_scan(text, uuid), public.mnt_sa_list_my_runnable_sessions(uuid),
  public.mnt_sa_record_item_execution(uuid, uuid, uuid, text, text, integer, text), public.mnt_sa_record_closure_exception(uuid, uuid, text, text),
  public.mnt_sa_assign_session_people(uuid, uuid, uuid[]), public.mnt_sa_list_session_people(uuid, uuid),
  public.mnt_sa_regenerate_asset_qr(uuid, uuid), public.mnt_sa_can_execute_session(uuid) TO authenticated;
