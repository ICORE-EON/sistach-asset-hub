CREATE OR REPLACE FUNCTION public.mnt_sa_update_corrective(p_company uuid, p_session uuid, p_expected_updated_at timestamptz, p_description text, p_priority text, p_external boolean, p_provider text DEFAULT NULL, p_technician_name text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.maintenance_sessions%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT coalesce(public.can_run_maintenance(p_company), false) THEN RAISE EXCEPTION 'Sin permiso para editar reparaciones' USING ERRCODE='42501'; END IF;
  SELECT * INTO s FROM public.maintenance_sessions WHERE company_id=p_company AND id=p_session FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reparación no encontrada en la organización activa' USING ERRCODE='P0002'; END IF;
  IF s.kind <> 'corrective' OR s.status NOT IN ('draft','in_progress') THEN RAISE EXCEPTION 'Solo se editan reparaciones abiertas' USING ERRCODE='23514'; END IF;
  IF p_expected_updated_at IS NULL OR p_expected_updated_at IS DISTINCT FROM s.updated_at THEN RAISE EXCEPTION 'La reparación ha cambiado. Cierra este formulario y vuelve a abrirlo antes de guardar.' USING ERRCODE='40001'; END IF;
  IF nullif(btrim(coalesce(p_description,'')),'') IS NULL THEN RAISE EXCEPTION 'Describe la avería' USING ERRCODE='23514'; END IF;
  IF coalesce(p_priority,'') NOT IN ('low','normal','high') THEN RAISE EXCEPTION 'Prioridad no válida' USING ERRCODE='22023'; END IF;
  IF p_external IS NULL OR (p_external AND nullif(btrim(coalesce(p_provider,'')),'') IS NULL) THEN RAISE EXCEPTION 'Indica la empresa externa' USING ERRCODE='23514'; END IF;
  UPDATE public.maintenance_sessions SET fault_description=btrim(p_description), priority=p_priority, is_external=p_external,
    external_provider=CASE WHEN p_external THEN btrim(p_provider) ELSE NULL END,
    technician_name=nullif(btrim(coalesce(p_technician_name,'')),'') WHERE id=p_session AND company_id=p_company;
END $$;
REVOKE ALL ON FUNCTION public.mnt_sa_update_corrective(uuid,uuid,timestamptz,text,text,boolean,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.mnt_sa_update_corrective(uuid,uuid,timestamptz,text,text,boolean,text,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.mnt_sa_tg_corrective_edit_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF OLD.kind='corrective' AND (NEW.fault_description,NEW.priority,NEW.is_external,NEW.technician_name) IS DISTINCT FROM (OLD.fault_description,OLD.priority,OLD.is_external,OLD.technician_name) THEN
  IF current_user <> (SELECT pg_get_userbyid(proowner) FROM pg_proc WHERE oid='public.mnt_sa_update_corrective(uuid,uuid,timestamptz,text,text,boolean,text,text)'::regprocedure) THEN RAISE EXCEPTION 'Edita la reparación con la acción segura' USING ERRCODE='42501'; END IF;
  NEW.updated_at := greatest(clock_timestamp(),OLD.updated_at + interval '1 microsecond');
 END IF;
 IF OLD.kind='corrective' AND NEW.external_provider IS DISTINCT FROM OLD.external_provider THEN
  IF current_user <> (SELECT pg_get_userbyid(proowner) FROM pg_proc WHERE oid='public.mnt_sa_update_corrective(uuid,uuid,timestamptz,text,text,boolean,text,text)'::regprocedure) THEN RAISE EXCEPTION 'Edita la reparación con la acción segura' USING ERRCODE='42501'; END IF;
  NEW.updated_at := greatest(clock_timestamp(),OLD.updated_at + interval '1 microsecond');
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.mnt_sa_tg_corrective_edit_guard() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER zz_mnt_corrective_edit_guard BEFORE UPDATE ON public.maintenance_sessions FOR EACH ROW EXECUTE FUNCTION public.mnt_sa_tg_corrective_edit_guard();