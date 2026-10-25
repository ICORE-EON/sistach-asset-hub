-- Bloque 2A: una corrección de alta (link_removed) no cuenta como historial que impida eliminar
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
  IF NOT public.can_manage_company(p_company) THEN RAISE EXCEPTION 'Solo un administrador puede eliminar definitivamente' USING ERRCODE = '42501'; END IF;
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
