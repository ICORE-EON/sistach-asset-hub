CREATE OR REPLACE FUNCTION public.mnt_sa_record_closure_exception(p_company uuid, p_item uuid, p_code text, p_text text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid(); r record; v_name text; v_at timestamptz := now();
BEGIN
  IF me IS NULL OR NOT public.can_close_session(p_company) THEN
    RAISE EXCEPTION 'Sin permiso para registrar excepciones de cierre' USING ERRCODE = '42501'; END IF;
  SELECT mi.id, mi.session_id, mi.asset_id, mi.result, s.status AS s_status INTO r
    FROM public.maintenance_items mi JOIN public.maintenance_sessions s ON s.id = mi.session_id
   WHERE mi.id = p_item AND s.company_id = p_company FOR UPDATE OF mi;
  IF NOT FOUND THEN RAISE EXCEPTION 'Equipo no disponible' USING ERRCODE = '42501'; END IF;
  IF r.s_status <> 'in_progress' THEN RAISE EXCEPTION 'La sesión no está en curso' USING ERRCODE = '55000'; END IF;
  IF p_code NOT IN ('not_applicable','inaccessible','other') THEN RAISE EXCEPTION 'Motivo no válido' USING ERRCODE = '22023'; END IF;
  IF length(btrim(coalesce(p_text, ''))) < 3 THEN RAISE EXCEPTION 'Explica el motivo de la excepción' USING ERRCODE = '23514'; END IF;
  IF r.result = 'excepted' THEN RETURN jsonb_build_object('recorded_now', false); END IF;
  IF r.result <> 'pending' THEN RAISE EXCEPTION 'Solo los equipos pendientes admiten excepción' USING ERRCODE = '55000'; END IF;
  SELECT coalesce(nullif(full_name, ''), email) INTO v_name FROM public.profiles WHERE id = me;
  INSERT INTO public.mnt_session_item_exceptions(company_id, session_id, item_id, asset_id, reason_code, reason_text, recorded_by, recorded_by_name, recorded_at)
  VALUES (p_company, r.session_id, p_item, r.asset_id, p_code, btrim(p_text), me, v_name, v_at);
  UPDATE public.maintenance_items SET result = 'excepted',
         metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('exception', jsonb_build_object(
           'code', p_code, 'text', btrim(p_text), 'by', me, 'by_name', v_name, 'at', v_at))
   WHERE id = p_item;
  RETURN jsonb_build_object('recorded_now', true);
END $$;