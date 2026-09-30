CREATE OR REPLACE FUNCTION public.mtr_set_status(p_equipment uuid, p_status text, p_reason text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE e public.mnt_mtr_equipment%ROWTYPE; v_last text;
BEGIN
  SELECT * INTO e FROM public.mnt_mtr_equipment WHERE id = p_equipment FOR UPDATE;
  IF NOT FOUND OR NOT coalesce(public.can_manage_assets(e.company_id), false) THEN
    RAISE EXCEPTION 'Sin permiso o equipo inexistente' USING ERRCODE = '42501';
  END IF;
  IF nullif(btrim(p_reason), '') IS NULL THEN RAISE EXCEPTION 'Motivo obligatorio' USING ERRCODE = '23514'; END IF;
  IF NOT ((e.status, p_status) IN (('operational','out_of_service'), ('restricted','out_of_service'),
          ('operational','retired'), ('restricted','retired'), ('out_of_service','retired'),
          ('out_of_service','operational'), ('restricted','operational'), ('unfit','operational'))) THEN
    RAISE EXCEPTION 'Transición no permitida: % -> %', e.status, p_status USING ERRCODE = '55000';
  END IF;
  IF p_status = 'operational' THEN
    -- Reactivación explícita: el último control validado del equipo debe ser Apto.
    SELECT result INTO v_last FROM public.mnt_mtr_records
     WHERE equipment_id = e.id AND status = 'validated'
     ORDER BY validated_at DESC NULLS LAST, performed_on DESC LIMIT 1;
    IF v_last IS DISTINCT FROM 'fit' THEN
      RAISE EXCEPTION 'La reactivación exige un control Apto validado posterior' USING ERRCODE = '55000';
    END IF;
  END IF;
  UPDATE public.mnt_mtr_equipment SET status = p_status, allowed_uses = NULL WHERE id = e.id;
  PERFORM public.mtr_log_status(e.company_id, e.id, e.status, p_status, 'manual', NULL, p_reason);
END $function$;

DO $$
DECLARE d text;
BEGIN
  SELECT pg_get_functiondef('public.mtr_validate_record(uuid)'::regprocedure) INTO d;
  d := replace(d, $x$  ELSIF e.status = 'out_of_service' THEN
    v_new_status := 'operational';
    UPDATE public.mnt_mtr_equipment SET status = 'operational' WHERE id = e.id;
    PERFORM public.mtr_log_status(e.company_id, e.id, e.status, 'operational', 'record_fit', r.id, NULL);
  END IF;$x$, $x$  END IF;
  -- Un control Apto no cambia el estado: la reactivación es una decisión explícita (mtr_set_status).$x$);
  IF position('record_fit' in d) > 0 THEN RAISE EXCEPTION 'patch not applied'; END IF;
  EXECUTE d;
END $$;