-- Bloque 2A: edición, desactivación y eliminación controlada (aditiva; no modifica datos existentes)
ALTER TABLE public.mnt_due_changes DROP CONSTRAINT mnt_due_changes_kind_check;
ALTER TABLE public.mnt_due_changes ADD CONSTRAINT mnt_due_changes_kind_check
  CHECK (kind IN ('initial','close','reschedule','exemption','no_advance','unlink','link_removed'));

ALTER TABLE public.maintenance_plans ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE OR REPLACE FUNCTION public.mnt_sa_freq_months(p_frequency text, p_interval int)
RETURNS int LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT coalesce(p_interval, CASE p_frequency WHEN 'monthly' THEN 1 WHEN 'quarterly' THEN 3
    WHEN 'biannual' THEN 6 WHEN 'semiannual' THEN 6 WHEN 'annual' THEN 12 WHEN 'biennial' THEN 24 END);
$$;
CREATE OR REPLACE FUNCTION public.mnt_sa_session_months(p_session uuid, p_plan uuid)
RETURNS int LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT CASE WHEN s.metadata #> '{snapshot,plan}' ? 'frequency'
              THEN public.mnt_sa_freq_months(s.metadata #>> '{snapshot,plan,frequency}',
                     nullif(s.metadata #>> '{snapshot,plan,interval_months}', '')::int)
              ELSE public.mnt_sa_plan_months(p_plan) END
    FROM public.maintenance_sessions s WHERE s.id = p_session;
$$;

CREATE OR REPLACE FUNCTION public.mnt_sa_apply_due(p_company uuid, p_session uuid, p_plan uuid, p_decisions jsonb, p_external_on date)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  me uuid := auth.uid(); v_tz text := public.mnt_sa_org_tz(p_company); v_months int := public.mnt_sa_session_months(p_session, p_plan);
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
END $function$;

CREATE OR REPLACE FUNCTION public.mnt_sa_tg_delete_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF coalesce(current_setting('mnt.safe_delete', true), '') = 'on' THEN RETURN OLD; END IF;
  IF OLD.company_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.companies c WHERE c.id = OLD.company_id) THEN RETURN OLD; END IF;
  RAISE EXCEPTION 'Este registro solo se puede eliminar con la acción «Eliminar» de la aplicación' USING ERRCODE = '42501';
END $$;
CREATE TRIGGER mnt_sa_assets_delete_guard BEFORE DELETE ON public.assets FOR EACH ROW EXECUTE FUNCTION public.mnt_sa_tg_delete_guard();
CREATE TRIGGER mnt_sa_plans_delete_guard BEFORE DELETE ON public.maintenance_plans FOR EACH ROW EXECUTE FUNCTION public.mnt_sa_tg_delete_guard();
CREATE TRIGGER mnt_sa_plan_assets_delete_guard BEFORE DELETE ON public.maintenance_plan_assets FOR EACH ROW EXECUTE FUNCTION public.mnt_sa_tg_delete_guard();
CREATE TRIGGER mnt_sa_sessions_delete_guard BEFORE DELETE ON public.maintenance_sessions FOR EACH ROW EXECUTE FUNCTION public.mnt_sa_tg_delete_guard();
CREATE TRIGGER mnt_sa_items_delete_guard BEFORE DELETE ON public.maintenance_items FOR EACH ROW EXECUTE FUNCTION public.mnt_sa_tg_delete_guard();

CREATE OR REPLACE FUNCTION public.mnt_sa_doc_is_evidence(p_session uuid, p_item uuid, p_cert uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p_cert IS NOT NULL
      OR EXISTS (SELECT 1 FROM public.maintenance_sessions s WHERE s.status = 'closed'
                  AND (s.id = p_session OR s.id = (SELECT i.session_id FROM public.maintenance_items i WHERE i.id = p_item)));
$$;
CREATE OR REPLACE FUNCTION public.mnt_sa_tg_document_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF coalesce(current_setting('mnt.safe_delete', true), '') = 'on' THEN RETURN coalesce(NEW, OLD); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.companies c WHERE c.id = OLD.company_id) THEN RETURN coalesce(NEW, OLD); END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NOT (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL) THEN RETURN NEW; END IF;
  END IF;
  IF public.mnt_sa_doc_is_evidence(OLD.maintenance_session_id, OLD.maintenance_item_id, OLD.certificate_id) THEN
    RAISE EXCEPTION 'Este documento es evidencia de un mantenimiento cerrado o de un certificado y no se puede eliminar' USING ERRCODE = '42501';
  END IF;
  RETURN coalesce(NEW, OLD);
END $$;
CREATE TRIGGER mnt_sa_documents_guard BEFORE UPDATE OF deleted_at OR DELETE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.mnt_sa_tg_document_guard();

CREATE OR REPLACE FUNCTION public.mnt_sa_storage_protected(p_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.documents d WHERE d.storage_bucket = 'documents' AND d.storage_path = p_name
                  AND public.mnt_sa_doc_is_evidence(d.maintenance_session_id, d.maintenance_item_id, d.certificate_id));
$$;
CREATE POLICY "documents protect maintenance evidence" ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated
  USING (bucket_id <> 'documents' OR NOT public.mnt_sa_storage_protected(name));

CREATE OR REPLACE FUNCTION public.mnt_sa_tg_incident_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.companies c WHERE c.id = OLD.company_id) THEN RETURN OLD; END IF;
  IF EXISTS (SELECT 1 FROM public.maintenance_items i JOIN public.maintenance_sessions s ON s.id = i.session_id
              WHERE i.id = OLD.source_maintenance_item_id AND s.status = 'closed') THEN
    RAISE EXCEPTION 'La incidencia procede de un mantenimiento cerrado; ciérrala o cancélala en lugar de eliminarla' USING ERRCODE = '42501';
  END IF;
  RETURN OLD;
END $$;
CREATE TRIGGER mnt_sa_incidents_delete_guard BEFORE DELETE ON public.incidents FOR EACH ROW EXECUTE FUNCTION public.mnt_sa_tg_incident_guard();

CREATE OR REPLACE FUNCTION public.mnt_sa_session_activity(p_session uuid)
RETURNS text[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT array_remove(ARRAY[
    CASE WHEN s.status <> 'draft' THEN 'no es un borrador' END,
    CASE WHEN s.started_at IS NOT NULL OR s.closed_at IS NOT NULL THEN 'se ha iniciado o cerrado' END,
    CASE WHEN s.signer_name IS NOT NULL OR s.signature_image_url IS NOT NULL THEN 'tiene firma' END,
    CASE WHEN nullif(btrim(coalesce(s.notes, '')), '') IS NOT NULL THEN 'tiene observaciones' END,
    CASE WHEN EXISTS (SELECT 1 FROM public.maintenance_items i WHERE i.session_id = s.id
      AND (i.result <> 'pending' OR i.completed_at IS NOT NULL OR nullif(btrim(coalesce(i.observations, '')), '') IS NOT NULL))
      THEN 'tiene resultados u observaciones en equipos' END,
    CASE WHEN EXISTS (SELECT 1 FROM public.checklist_responses r JOIN public.maintenance_items i ON i.id = r.maintenance_item_id WHERE i.session_id = s.id)
      THEN 'tiene respuestas de checklist' END,
    CASE WHEN EXISTS (SELECT 1 FROM public.documents d WHERE d.deleted_at IS NULL AND (d.maintenance_session_id = s.id
      OR d.maintenance_item_id IN (SELECT i.id FROM public.maintenance_items i WHERE i.session_id = s.id))) THEN 'tiene documentos' END,
    CASE WHEN EXISTS (SELECT 1 FROM public.incidents x JOIN public.maintenance_items i ON i.id = x.source_maintenance_item_id WHERE i.session_id = s.id)
      THEN 'tiene incidencias' END,
    CASE WHEN EXISTS (SELECT 1 FROM public.certificate_items ci WHERE ci.maintenance_session_id = s.id
      OR ci.maintenance_item_id IN (SELECT i.id FROM public.maintenance_items i WHERE i.session_id = s.id)) THEN 'tiene certificados' END,
    CASE WHEN EXISTS (SELECT 1 FROM public.session_reopen_log l WHERE l.session_id = s.id) THEN 'tiene reaperturas' END,
    CASE WHEN EXISTS (SELECT 1 FROM public.mnt_due_changes d WHERE d.session_id = s.id) THEN 'tiene cambios de fecha' END,
    CASE WHEN EXISTS (SELECT 1 FROM public.notification_events n WHERE n.maintenance_session_id = s.id) THEN 'tiene avisos registrados' END
  ], NULL) FROM public.maintenance_sessions s WHERE s.id = p_session;
$$;

CREATE OR REPLACE FUNCTION public.mnt_sa_delete_draft_session(p_company uuid, p_session uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_act text[]; v_code text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado' USING ERRCODE = '42501'; END IF;
  IF NOT public.can_run_maintenance(p_company) THEN RAISE EXCEPTION 'Sin permiso sobre sesiones en esta organización' USING ERRCODE = '42501'; END IF;
  SELECT code INTO v_code FROM public.maintenance_sessions WHERE id = p_session AND company_id = p_company FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('deleted', false, 'already', true); END IF;
  v_act := public.mnt_sa_session_activity(p_session);
  IF cardinality(v_act) > 0 THEN
    RAISE EXCEPTION 'No se puede eliminar: la sesión %', array_to_string(v_act, ', ') USING ERRCODE = '23514';
  END IF;
  PERFORM set_config('mnt.safe_delete', 'on', true);
  DELETE FROM public.maintenance_sessions WHERE id = p_session;
  PERFORM set_config('mnt.safe_delete', 'off', true);
  RETURN jsonb_build_object('deleted', true, 'code', v_code);
END $$;

CREATE OR REPLACE FUNCTION public.mnt_sa_cancel_session(p_company uuid, p_session uuid, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s record; v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado' USING ERRCODE = '42501'; END IF;
  IF NOT public.can_run_maintenance(p_company) THEN RAISE EXCEPTION 'Sin permiso sobre sesiones en esta organización' USING ERRCODE = '42501'; END IF;
  SELECT id, status INTO s FROM public.maintenance_sessions WHERE id = p_session AND company_id = p_company FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sesión no encontrada en la organización activa' USING ERRCODE = 'P0002'; END IF;
  IF s.status = 'cancelled' THEN RETURN jsonb_build_object('cancelled_now', false); END IF;
  IF s.status NOT IN ('draft', 'in_progress') THEN
    RAISE EXCEPTION 'Solo se pueden cancelar sesiones en borrador o en curso' USING ERRCODE = '23514';
  END IF;
  IF v_reason IS NULL THEN RAISE EXCEPTION 'Indica el motivo de la cancelación' USING ERRCODE = '23514'; END IF;
  UPDATE public.maintenance_sessions SET status = 'cancelled',
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('cancel', jsonb_build_object(
      'reason', v_reason, 'by', auth.uid(), 'at', now(), 'from_status', s.status))
   WHERE id = p_session;
  RETURN jsonb_build_object('cancelled_now', true);
END $$;

CREATE OR REPLACE FUNCTION public.mnt_sa_unlink_plan_asset(p_company uuid, p_link uuid, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE l record; v_today date := (now() AT TIME ZONE public.mnt_sa_org_tz(p_company))::date;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), ''); v_used boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado' USING ERRCODE = '42501'; END IF;
  IF NOT public.can_manage_assets(p_company) THEN RAISE EXCEPTION 'Sin permiso para gestionar planes en esta organización' USING ERRCODE = '42501'; END IF;
  SELECT pa.* INTO l FROM public.maintenance_plan_assets pa JOIN public.maintenance_plans p ON p.id = pa.plan_id
   WHERE pa.id = p_link AND p.company_id = p_company FOR UPDATE OF pa;
  IF NOT FOUND THEN RETURN jsonb_build_object('action', 'none', 'already', true); END IF;
  IF l.end_on IS NOT NULL AND l.end_on < v_today THEN RETURN jsonb_build_object('action', 'unlink', 'already', true); END IF;
  v_used := EXISTS (SELECT 1 FROM public.maintenance_items i JOIN public.maintenance_sessions s ON s.id = i.session_id
                     WHERE s.plan_id = l.plan_id AND i.asset_id = l.asset_id)
         OR EXISTS (SELECT 1 FROM public.mnt_due_changes d WHERE d.plan_asset_id = l.id AND d.kind <> 'initial');
  IF NOT v_used THEN
    INSERT INTO public.mnt_due_changes(company_id, plan_asset_id, plan_id, asset_id, old_due, new_due, kind, reason, changed_by)
    VALUES (p_company, l.id, l.plan_id, l.asset_id, l.next_due_on, NULL, 'link_removed', coalesce(v_reason, 'Corrección de alta'), auth.uid());
    PERFORM set_config('mnt.safe_delete', 'on', true);
    DELETE FROM public.maintenance_plan_assets WHERE id = l.id;
    PERFORM set_config('mnt.safe_delete', 'off', true);
    RETURN jsonb_build_object('action', 'removed');
  END IF;
  IF v_reason IS NULL THEN RAISE EXCEPTION 'Indica el motivo de la desvinculación' USING ERRCODE = '23514'; END IF;
  IF l.start_on IS NOT NULL AND l.start_on > v_today - 1 THEN
    RAISE EXCEPTION 'Este equipo se vinculó hoy y ya tiene actividad: podrás desvincularlo a partir de mañana, o retirar el equipo' USING ERRCODE = '23514';
  END IF;
  UPDATE public.maintenance_plan_assets SET end_on = v_today - 1 WHERE id = l.id;
  INSERT INTO public.mnt_due_changes(company_id, plan_asset_id, plan_id, asset_id, old_due, new_due, kind, reason, changed_by)
  VALUES (p_company, l.id, l.plan_id, l.asset_id, l.next_due_on, l.next_due_on, 'unlink', v_reason, auth.uid());
  RETURN jsonb_build_object('action', 'unlink', 'end_on', v_today - 1);
END $$;

CREATE OR REPLACE FUNCTION public.mnt_sa_delete_asset(p_company uuid, p_asset uuid, p_confirm boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a record; b text[]; n int; v_links int; v_kit int; v_docs int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado' USING ERRCODE = '42501'; END IF;
  IF NOT public.can_manage_company(p_company) THEN RAISE EXCEPTION 'Solo un administrador puede eliminar definitivamente' USING ERRCODE = '42501'; END IF;
  SELECT id, code INTO a FROM public.assets WHERE id = p_asset AND company_id = p_company FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('deleted', false, 'already', true, 'eligible', false, 'blockers', '[]'::jsonb); END IF;
  b := ARRAY[]::text[];
  SELECT count(DISTINCT session_id) INTO n FROM public.maintenance_items WHERE asset_id = p_asset;
  IF n > 0 THEN b := b || format('está incluido en %s sesión(es) de mantenimiento', n); END IF;
  IF EXISTS (SELECT 1 FROM public.certificate_items WHERE asset_id = p_asset) THEN b := b || 'figura en certificados'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.incidents WHERE asset_id = p_asset) THEN b := b || 'tiene incidencias'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.documents WHERE deleted_at IS NULL AND (asset_id = p_asset OR vehicle_asset_id = p_asset))
    THEN b := b || 'tiene documentos adjuntos'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.vehicles WHERE asset_id = p_asset) OR EXISTS (SELECT 1 FROM public.vehicle_mounts WHERE mounted_asset_id = p_asset)
    THEN b := b || 'tiene datos de vehículo o montaje'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.mnt_due_changes WHERE asset_id = p_asset AND company_id = p_company AND kind <> 'initial')
    THEN b := b || 'tiene historial de fechas'::text; END IF;
  SELECT count(*) INTO v_links FROM public.maintenance_plan_assets WHERE asset_id = p_asset;
  SELECT count(*) INTO v_kit FROM public.first_aid_kit_contents WHERE kit_asset_id = p_asset;
  SELECT count(*) INTO v_docs FROM public.documents WHERE deleted_at IS NOT NULL AND (asset_id = p_asset OR vehicle_asset_id = p_asset);
  IF cardinality(b) > 0 OR NOT coalesce(p_confirm, false) THEN
    RETURN jsonb_build_object('deleted', false, 'eligible', cardinality(b) = 0, 'blockers', to_jsonb(b), 'code', a.code,
      'remove', jsonb_build_object('plan_links', v_links, 'kit_items', v_kit, 'removed_documents', v_docs));
  END IF;
  INSERT INTO public.mnt_due_changes(company_id, plan_asset_id, plan_id, asset_id, old_due, new_due, kind, reason, changed_by)
  SELECT p_company, pa.id, pa.plan_id, pa.asset_id, pa.next_due_on, NULL, 'link_removed', 'Eliminación del activo ' || a.code, auth.uid()
    FROM public.maintenance_plan_assets pa WHERE pa.asset_id = p_asset;
  PERFORM set_config('mnt.safe_delete', 'on', true);
  DELETE FROM public.assets WHERE id = p_asset;
  PERFORM set_config('mnt.safe_delete', 'off', true);
  RETURN jsonb_build_object('deleted', true, 'eligible', true, 'blockers', '[]'::jsonb, 'code', a.code);
END $$;

CREATE OR REPLACE FUNCTION public.mnt_sa_delete_plan(p_company uuid, p_plan uuid, p_confirm boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p record; b text[] := ARRAY[]::text[]; v_busy int; v_drafts text[]; v_links int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado' USING ERRCODE = '42501'; END IF;
  IF NOT public.can_manage_company(p_company) THEN RAISE EXCEPTION 'Solo un administrador puede eliminar definitivamente' USING ERRCODE = '42501'; END IF;
  SELECT id, code INTO p FROM public.maintenance_plans WHERE id = p_plan AND company_id = p_company FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('deleted', false, 'already', true, 'eligible', false, 'blockers', '[]'::jsonb); END IF;
  PERFORM 1 FROM public.maintenance_sessions WHERE plan_id = p_plan FOR UPDATE;
  SELECT count(*) FILTER (WHERE cardinality(public.mnt_sa_session_activity(s.id)) > 0),
         coalesce(array_agg(s.code ORDER BY s.code) FILTER (WHERE cardinality(public.mnt_sa_session_activity(s.id)) = 0), ARRAY[]::text[])
    INTO v_busy, v_drafts FROM public.maintenance_sessions s WHERE s.plan_id = p_plan;
  IF v_busy > 0 THEN b := b || format('tiene %s sesión(es) con actividad', v_busy); END IF;
  IF EXISTS (SELECT 1 FROM public.mnt_due_changes WHERE plan_id = p_plan AND company_id = p_company AND kind <> 'initial')
    THEN b := b || 'tiene historial de fechas'::text; END IF;
  SELECT count(*) INTO v_links FROM public.maintenance_plan_assets WHERE plan_id = p_plan;
  IF cardinality(b) > 0 OR NOT coalesce(p_confirm, false) THEN
    RETURN jsonb_build_object('deleted', false, 'eligible', cardinality(b) = 0, 'blockers', to_jsonb(b), 'code', p.code,
      'remove', jsonb_build_object('empty_drafts', to_jsonb(v_drafts), 'plan_links', v_links));
  END IF;
  INSERT INTO public.mnt_due_changes(company_id, plan_asset_id, plan_id, asset_id, old_due, new_due, kind, reason, changed_by)
  SELECT p_company, pa.id, pa.plan_id, pa.asset_id, pa.next_due_on, NULL, 'link_removed', 'Eliminación del plan ' || p.code, auth.uid()
    FROM public.maintenance_plan_assets pa WHERE pa.plan_id = p_plan;
  PERFORM set_config('mnt.safe_delete', 'on', true);
  DELETE FROM public.maintenance_sessions WHERE plan_id = p_plan;
  DELETE FROM public.maintenance_plans WHERE id = p_plan;
  PERFORM set_config('mnt.safe_delete', 'off', true);
  RETURN jsonb_build_object('deleted', true, 'eligible', true, 'blockers', '[]'::jsonb, 'code', p.code, 'removed_drafts', to_jsonb(v_drafts));
END $$;

REVOKE ALL ON FUNCTION public.mnt_sa_session_activity(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mnt_sa_doc_is_evidence(uuid, uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mnt_sa_storage_protected(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mnt_sa_storage_protected(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mnt_sa_doc_is_evidence(uuid, uuid, uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.mnt_sa_delete_draft_session(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mnt_sa_cancel_session(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mnt_sa_unlink_plan_asset(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mnt_sa_delete_asset(uuid, uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mnt_sa_delete_plan(uuid, uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mnt_sa_delete_draft_session(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mnt_sa_cancel_session(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mnt_sa_unlink_plan_asset(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mnt_sa_delete_asset(uuid, uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mnt_sa_delete_plan(uuid, uuid, boolean) TO authenticated;
