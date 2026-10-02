ALTER TABLE public.mnt_mtr_control_plans ADD COLUMN criteria jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.mnt_mtr_records ADD COLUMN restrictions text;
DO $$ DECLARE c text; BEGIN
  FOR c IN SELECT conname FROM pg_constraint WHERE conrelid='public.mnt_mtr_records'::regclass AND contype='c' AND pg_get_constraintdef(oid) LIKE '%result%' LOOP
    EXECUTE format('ALTER TABLE public.mnt_mtr_records DROP CONSTRAINT %I', c);
  END LOOP; END $$;
ALTER TABLE public.mnt_mtr_records ADD CONSTRAINT mnt_mtr_records_result_check CHECK (result IN ('fit','unfit','restricted'));
ALTER TABLE public.mnt_mtr_record_lines
  ADD COLUMN criterion_key text,
  ADD COLUMN mode text NOT NULL DEFAULT 'absolute' CHECK (mode IN ('absolute','percentage','manual')),
  ADD COLUMN error_value numeric;

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
  IF r.result = 'restricted' AND nullif(trim(r.restrictions), '') IS NULL THEN
    RAISE EXCEPTION 'Indica las restricciones de uso' USING ERRCODE = '23514';
  END IF;

  UPDATE public.mnt_mtr_record_lines SET
    error_value = CASE
      WHEN mode = 'absolute' AND measured_value IS NOT NULL AND reference_value IS NOT NULL THEN abs(measured_value - reference_value)
      WHEN mode = 'percentage' AND measured_value IS NOT NULL AND reference_value IS NOT NULL AND reference_value <> 0
        THEN abs(measured_value - reference_value) / abs(reference_value) * 100
      ELSE error_value END,
    result = CASE
      WHEN mode = 'manual' THEN result
      WHEN tolerance IS NULL OR measured_value IS NULL OR reference_value IS NULL THEN result
      WHEN mode = 'absolute' THEN CASE WHEN abs(measured_value - reference_value) <= tolerance THEN 'fit' ELSE 'unfit' END
      WHEN reference_value = 0 THEN result
      ELSE CASE WHEN abs(measured_value - reference_value) / abs(reference_value) * 100 <= tolerance THEN 'fit' ELSE 'unfit' END
    END
   WHERE record_id = r.id;
  SELECT count(*), count(*) FILTER (WHERE result = 'unfit') INTO v_lines, v_bad
    FROM public.mnt_mtr_record_lines WHERE record_id = r.id;
  IF EXISTS (SELECT 1 FROM public.mnt_mtr_record_lines WHERE record_id = r.id AND result IS NULL) THEN
    RAISE EXCEPTION 'Hay líneas sin resultado' USING ERRCODE = '23514';
  END IF;
  IF r.kind = 'verification' AND p.method = 'internal' AND v_lines = 0 THEN
    RAISE EXCEPTION 'La verificación interna requiere al menos una línea de medición' USING ERRCODE = '23514';
  END IF;
  v_result := CASE WHEN r.result = 'restricted' THEN 'restricted'
                   WHEN v_bad > 0 OR r.result = 'unfit' THEN 'unfit'
                   WHEN v_lines > 0 THEN 'fit' ELSE r.result END;
  IF v_result IS NULL THEN RAISE EXCEPTION 'Falta la declaración de aptitud' USING ERRCODE = '23514'; END IF;

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
  ELSIF v_result = 'restricted' THEN
    v_new_status := 'restricted';
    UPDATE public.mnt_mtr_equipment SET status = 'restricted', allowed_uses = r.restrictions WHERE id = e.id;
    PERFORM public.mtr_log_status(e.company_id, e.id, e.status, 'restricted', 'record_restricted', r.id, r.restrictions);
    IF v_bad > 0 THEN
      INSERT INTO public.mnt_mtr_impact_reviews(company_id, equipment_id, record_id) VALUES (e.company_id, e.id, r.id)
        ON CONFLICT (record_id) DO NOTHING;
    END IF;
  END IF;
  -- Un control Apto no cambia el estado: la reactivación es una decisión explícita (mtr_set_status).
  RETURN jsonb_build_object('result', v_result, 'next_due', v_next, 'equipment_status', v_new_status);
END $$;
REVOKE ALL ON FUNCTION public.mtr_validate_record(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mtr_validate_record(uuid) TO authenticated;