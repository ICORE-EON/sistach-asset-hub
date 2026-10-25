-- Bloque 2A: sin membresía las funciones de permiso devuelven NULL; tratarlo como denegado
CREATE OR REPLACE FUNCTION public.mnt_sa_delete_draft_session(p_company uuid, p_session uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_act text[]; v_code text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado' USING ERRCODE = '42501'; END IF;
  IF NOT coalesce(public.can_run_maintenance(p_company), false) THEN RAISE EXCEPTION 'Sin permiso sobre sesiones en esta organización' USING ERRCODE = '42501'; END IF;
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
  IF NOT coalesce(public.can_run_maintenance(p_company), false) THEN RAISE EXCEPTION 'Sin permiso sobre sesiones en esta organización' USING ERRCODE = '42501'; END IF;
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
  IF NOT coalesce(public.can_manage_assets(p_company), false) THEN RAISE EXCEPTION 'Sin permiso para gestionar planes en esta organización' USING ERRCODE = '42501'; END IF;
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
  IF NOT coalesce(public.can_manage_company(p_company), false) THEN RAISE EXCEPTION 'Solo un administrador puede eliminar definitivamente' USING ERRCODE = '42501'; END IF;
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
  IF EXISTS (SELECT 1 FROM public.mnt_due_changes WHERE asset_id = p_asset AND company_id = p_company AND kind NOT IN ('initial', 'link_removed'))
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
  IF NOT coalesce(public.can_manage_company(p_company), false) THEN RAISE EXCEPTION 'Solo un administrador puede eliminar definitivamente' USING ERRCODE = '42501'; END IF;
  SELECT id, code INTO p FROM public.maintenance_plans WHERE id = p_plan AND company_id = p_company FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('deleted', false, 'already', true, 'eligible', false, 'blockers', '[]'::jsonb); END IF;
  PERFORM 1 FROM public.maintenance_sessions WHERE plan_id = p_plan FOR UPDATE;
  SELECT count(*) FILTER (WHERE cardinality(public.mnt_sa_session_activity(s.id)) > 0),
         coalesce(array_agg(s.code ORDER BY s.code) FILTER (WHERE cardinality(public.mnt_sa_session_activity(s.id)) = 0), ARRAY[]::text[])
    INTO v_busy, v_drafts FROM public.maintenance_sessions s WHERE s.plan_id = p_plan;
  IF v_busy > 0 THEN b := b || format('tiene %s sesión(es) con actividad', v_busy); END IF;
  IF EXISTS (SELECT 1 FROM public.mnt_due_changes WHERE plan_id = p_plan AND company_id = p_company AND kind NOT IN ('initial', 'link_removed'))
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
