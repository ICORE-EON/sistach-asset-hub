-- Bloque 2B: mantenimiento correctivo sencillo (aditivo). Las sesiones sin plan existentes se conservan como 'legacy'.
ALTER TABLE public.maintenance_sessions
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'preventive',
  ADD COLUMN IF NOT EXISTS detected_on date,
  ADD COLUMN IF NOT EXISTS priority text,
  ADD COLUMN IF NOT EXISTS fault_description text,
  ADD COLUMN IF NOT EXISTS incident_id uuid REFERENCES public.incidents(id) ON DELETE RESTRICT;

UPDATE public.maintenance_sessions SET kind = 'legacy' WHERE plan_id IS NULL AND kind = 'preventive';

ALTER TABLE public.maintenance_sessions ADD CONSTRAINT maintenance_sessions_kind_chk CHECK (kind IN ('preventive','corrective','legacy'));
ALTER TABLE public.maintenance_sessions ADD CONSTRAINT maintenance_sessions_kind_plan_chk
  CHECK ((kind = 'preventive' AND plan_id IS NOT NULL) OR (kind = 'corrective' AND plan_id IS NULL) OR kind = 'legacy') NOT VALID;
ALTER TABLE public.maintenance_sessions VALIDATE CONSTRAINT maintenance_sessions_kind_plan_chk;
ALTER TABLE public.maintenance_sessions ADD CONSTRAINT maintenance_sessions_corrective_fields_chk
  CHECK (kind <> 'corrective' OR (detected_on IS NOT NULL AND priority IN ('low','normal','high') AND nullif(btrim(coalesce(fault_description,'')),'') IS NOT NULL));
ALTER TABLE public.maintenance_sessions ADD CONSTRAINT maintenance_sessions_priority_chk CHECK (priority IS NULL OR priority IN ('low','normal','high'));
ALTER TABLE public.maintenance_sessions DROP CONSTRAINT maintenance_sessions_outcome_chk;
ALTER TABLE public.maintenance_sessions ADD CONSTRAINT maintenance_sessions_outcome_chk CHECK (outcome IS NULL
  OR (kind <> 'corrective' AND outcome IN ('ok','with_incidents','incomplete','incomplete_with_incidents'))
  OR (kind = 'corrective' AND outcome IN ('repaired','not_repaired','replaced')));
CREATE INDEX IF NOT EXISTS maintenance_sessions_kind_idx ON public.maintenance_sessions(company_id, kind, status);
COMMENT ON COLUMN public.maintenance_sessions.kind IS 'preventive (con plan), corrective (sin plan, 2B), legacy (sin plan anterior a 2B, no reclasificar)';

-- Actuaciones: solo se añaden filas
CREATE TABLE public.mnt_session_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  session_id uuid NOT NULL REFERENCES public.maintenance_sessions(id) ON DELETE RESTRICT,
  performed_on date NOT NULL,
  body text NOT NULL CHECK (nullif(btrim(body),'') IS NOT NULL),
  author_id uuid,
  author_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.mnt_session_entries TO authenticated;
GRANT ALL ON public.mnt_session_entries TO service_role;
ALTER TABLE public.mnt_session_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY mse_select ON public.mnt_session_entries FOR SELECT TO authenticated USING (public.user_has_membership(company_id));
CREATE INDEX mnt_session_entries_session_idx ON public.mnt_session_entries(session_id, performed_on);

CREATE OR REPLACE FUNCTION public.mnt_sa_tg_entries_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN RAISE EXCEPTION 'Las actuaciones registradas no se pueden modificar ni eliminar' USING ERRCODE = '42501'; END $$;
CREATE TRIGGER mnt_session_entries_immutable BEFORE UPDATE OR DELETE ON public.mnt_session_entries
  FOR EACH ROW EXECUTE FUNCTION public.mnt_sa_tg_entries_immutable();

-- Autoridad de cierre correctivo: rol efectivo propietario de la RPC + bandera interna
CREATE OR REPLACE FUNCTION public.mnt_sa_corrective_authority() RETURNS boolean LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT current_user = (SELECT pg_get_userbyid(proowner) FROM pg_proc WHERE oid = 'public.mnt_sa_delete_asset(uuid,uuid,boolean)'::regprocedure)
     AND coalesce(current_setting('mnt.corrective', true), '') = 'on';
$$;

CREATE OR REPLACE FUNCTION public.mnt_sa_tg_session_kind_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.kind IS DISTINCT FROM OLD.kind THEN
    RAISE EXCEPTION 'El tipo de intervención no se puede cambiar' USING ERRCODE = '42501';
  END IF;
  IF NEW.incident_id IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.incident_id IS DISTINCT FROM OLD.incident_id) THEN
    IF NOT EXISTS (SELECT 1 FROM public.incidents x WHERE x.id = NEW.incident_id AND x.company_id = NEW.company_id) THEN
      RAISE EXCEPTION 'La incidencia no pertenece a la organización' USING ERRCODE = '42501';
    END IF;
  END IF;
  IF NEW.kind = 'corrective' AND NOT public.mnt_sa_corrective_authority() THEN
    IF TG_OP = 'UPDATE' AND OLD.status IN ('closed','cancelled') THEN
      RAISE EXCEPTION 'Una reparación finalizada o cancelada no se puede modificar' USING ERRCODE = '42501';
    END IF;
    IF NEW.status = 'closed' AND (TG_OP = 'INSERT' OR OLD.status <> 'closed') THEN
      RAISE EXCEPTION 'Las reparaciones se finalizan con su propio cierre' USING ERRCODE = '42501';
    END IF;
    IF TG_OP = 'UPDATE' AND (NEW.outcome IS DISTINCT FROM OLD.outcome OR NEW.closed_at IS DISTINCT FROM OLD.closed_at) THEN
      RAISE EXCEPTION 'Las reparaciones se finalizan con su propio cierre' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER mnt_sa_sessions_kind_guard BEFORE INSERT OR UPDATE ON public.maintenance_sessions
  FOR EACH ROW EXECUTE FUNCTION public.mnt_sa_tg_session_kind_guard();

CREATE OR REPLACE FUNCTION public.mnt_sa_tg_corrective_item_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_kind text; v_status text;
BEGIN
  SELECT kind, status INTO v_kind, v_status FROM public.maintenance_sessions WHERE id = NEW.session_id;
  IF v_kind = 'corrective' AND NOT public.mnt_sa_corrective_authority() THEN
    IF TG_OP = 'INSERT' OR v_status IN ('closed','cancelled') OR NEW.result IS DISTINCT FROM OLD.result OR NEW.completed_at IS DISTINCT FROM OLD.completed_at OR NEW.asset_id IS DISTINCT FROM OLD.asset_id THEN
      RAISE EXCEPTION 'El equipo de una reparación solo se modifica con sus acciones' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER mnt_sa_items_corrective_guard BEFORE INSERT OR UPDATE ON public.maintenance_items
  FOR EACH ROW EXECUTE FUNCTION public.mnt_sa_tg_corrective_item_guard();

-- Certificados y bitácora de fechas: nunca para reparaciones
CREATE OR REPLACE FUNCTION public.mnt_sa_tg_reject_corrective_ref() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_session uuid;
BEGIN
  IF TG_TABLE_NAME = 'certificate_items' THEN
    v_session := coalesce(NEW.maintenance_session_id, (SELECT i.session_id FROM public.maintenance_items i WHERE i.id = NEW.maintenance_item_id));
  ELSE
    v_session := NEW.session_id;
  END IF;
  IF v_session IS NOT NULL AND EXISTS (SELECT 1 FROM public.maintenance_sessions s WHERE s.id = v_session AND s.kind = 'corrective') THEN
    RAISE EXCEPTION 'Las reparaciones no emiten certificados ni modifican fechas preventivas' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER mnt_sa_cert_items_no_corrective BEFORE INSERT OR UPDATE ON public.certificate_items
  FOR EACH ROW EXECUTE FUNCTION public.mnt_sa_tg_reject_corrective_ref();
CREATE TRIGGER mnt_sa_due_changes_no_corrective BEFORE INSERT ON public.mnt_due_changes
  FOR EACH ROW EXECUTE FUNCTION public.mnt_sa_tg_reject_corrective_ref();

-- Un borrador con actuaciones no está vacío
CREATE OR REPLACE FUNCTION public.mnt_sa_session_activity(p_session uuid)
 RETURNS text[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
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
    CASE WHEN EXISTS (SELECT 1 FROM public.notification_events n WHERE n.maintenance_session_id = s.id) THEN 'tiene avisos registrados' END,
    CASE WHEN EXISTS (SELECT 1 FROM public.mnt_session_entries e WHERE e.session_id = s.id) THEN 'tiene actuaciones' END
  ], NULL) FROM public.maintenance_sessions s WHERE s.id = p_session;
$function$;

-- RPC: crear reparación
CREATE OR REPLACE FUNCTION public.mnt_sa_create_corrective(p_company uuid, p_asset uuid, p_detected_on date, p_priority text,
  p_description text, p_incident uuid DEFAULT NULL, p_external boolean DEFAULT false, p_provider text DEFAULT NULL,
  p_technician_name text DEFAULT NULL, p_mark_out_of_service boolean DEFAULT false, p_request_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid(); a record; v_today date; v_id uuid; v_code text; x record;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'No autenticado' USING ERRCODE = '42501'; END IF;
  IF NOT coalesce(public.can_run_maintenance(p_company), false) THEN RAISE EXCEPTION 'Sin permiso para registrar reparaciones' USING ERRCODE = '42501'; END IF;
  IF p_request_id IS NOT NULL THEN
    SELECT id, code INTO v_id, v_code FROM public.maintenance_sessions WHERE company_id = p_company AND kind = 'corrective' AND metadata->>'request_id' = p_request_id::text;
    IF FOUND THEN RETURN jsonb_build_object('id', v_id, 'code', v_code, 'created_now', false); END IF;
  END IF;
  SELECT id, status, location_id INTO a FROM public.assets WHERE id = p_asset AND company_id = p_company AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Equipo no encontrado en la organización activa' USING ERRCODE = 'P0002'; END IF;
  IF a.status = 'retired' THEN RAISE EXCEPTION 'El equipo está retirado' USING ERRCODE = '23514'; END IF;
  v_today := (now() AT TIME ZONE public.mnt_sa_org_tz(p_company))::date;
  IF p_detected_on IS NULL OR p_detected_on > v_today THEN RAISE EXCEPTION 'Indica una fecha de detección no futura' USING ERRCODE = '23514'; END IF;
  IF coalesce(p_priority, '') NOT IN ('low','normal','high') THEN RAISE EXCEPTION 'Prioridad no válida' USING ERRCODE = '22023'; END IF;
  IF nullif(btrim(coalesce(p_description, '')), '') IS NULL THEN RAISE EXCEPTION 'Describe la avería' USING ERRCODE = '23514'; END IF;
  IF p_external AND nullif(btrim(coalesce(p_provider, '')), '') IS NULL THEN RAISE EXCEPTION 'Indica la empresa externa' USING ERRCODE = '23514'; END IF;
  IF p_incident IS NOT NULL THEN
    SELECT id, asset_id INTO x FROM public.incidents WHERE id = p_incident AND company_id = p_company;
    IF NOT FOUND THEN RAISE EXCEPTION 'La incidencia no pertenece a la organización' USING ERRCODE = '42501'; END IF;
    IF x.asset_id IS NOT NULL AND x.asset_id <> p_asset THEN RAISE EXCEPTION 'La incidencia corresponde a otro equipo' USING ERRCODE = '23514'; END IF;
  END IF;
  IF p_mark_out_of_service THEN
    IF NOT coalesce(public.can_manage_assets(p_company), false) THEN RAISE EXCEPTION 'Sin permiso para cambiar el estado del equipo' USING ERRCODE = '42501'; END IF;
    IF a.status = 'active' THEN UPDATE public.assets SET status = 'out_of_service' WHERE id = p_asset; END IF;
  END IF;
  v_code := public.next_code(p_company, 'corrective', 'REP');
  PERFORM set_config('mnt.corrective', 'on', true);
  INSERT INTO public.maintenance_sessions(company_id, code, plan_id, location_id, technician_name, is_external, external_provider,
     status, started_at, created_by, kind, detected_on, priority, fault_description, incident_id, metadata)
  VALUES (p_company, v_code, NULL, a.location_id, nullif(btrim(coalesce(p_technician_name, '')), ''), coalesce(p_external, false),
     nullif(btrim(coalesce(p_provider, '')), ''), 'in_progress', now(), me, 'corrective', p_detected_on, p_priority, btrim(p_description), p_incident,
     jsonb_strip_nulls(jsonb_build_object('request_id', p_request_id, 'marked_out_of_service', CASE WHEN p_mark_out_of_service AND a.status = 'active' THEN true END)))
  RETURNING id INTO v_id;
  INSERT INTO public.maintenance_items(session_id, asset_id, company_id, result) VALUES (v_id, p_asset, p_company, 'pending');
  PERFORM set_config('mnt.corrective', 'off', true);
  RETURN jsonb_build_object('id', v_id, 'code', v_code, 'created_now', true);
END $$;

CREATE OR REPLACE FUNCTION public.mnt_sa_add_entry(p_company uuid, p_session uuid, p_performed_on date, p_text text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid(); s record; v_id uuid;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'No autenticado' USING ERRCODE = '42501'; END IF;
  IF NOT coalesce(public.can_run_maintenance(p_company), false) THEN RAISE EXCEPTION 'Sin permiso para registrar actuaciones' USING ERRCODE = '42501'; END IF;
  SELECT id, kind, status, detected_on INTO s FROM public.maintenance_sessions WHERE id = p_session AND company_id = p_company FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reparación no encontrada en la organización activa' USING ERRCODE = 'P0002'; END IF;
  IF s.kind <> 'corrective' THEN RAISE EXCEPTION 'Solo las reparaciones admiten actuaciones' USING ERRCODE = '23514'; END IF;
  IF s.status NOT IN ('draft','in_progress') THEN RAISE EXCEPTION 'La reparación ya está finalizada o cancelada' USING ERRCODE = '23514'; END IF;
  IF p_performed_on IS NULL OR p_performed_on > (now() AT TIME ZONE public.mnt_sa_org_tz(p_company))::date OR p_performed_on < s.detected_on THEN
    RAISE EXCEPTION 'La fecha de la actuación no puede ser futura ni anterior a la detección' USING ERRCODE = '23514';
  END IF;
  IF nullif(btrim(coalesce(p_text, '')), '') IS NULL THEN RAISE EXCEPTION 'Describe la actuación' USING ERRCODE = '23514'; END IF;
  INSERT INTO public.mnt_session_entries(company_id, session_id, performed_on, body, author_id, author_name)
  VALUES (p_company, p_session, p_performed_on, btrim(p_text), me, (SELECT full_name FROM public.profiles WHERE id = me))
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.mnt_sa_link_incident(p_company uuid, p_session uuid, p_incident uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s record; x record; v_asset uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado' USING ERRCODE = '42501'; END IF;
  IF NOT coalesce(public.can_run_maintenance(p_company), false) THEN RAISE EXCEPTION 'Sin permiso sobre reparaciones' USING ERRCODE = '42501'; END IF;
  SELECT id, kind, status INTO s FROM public.maintenance_sessions WHERE id = p_session AND company_id = p_company FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reparación no encontrada en la organización activa' USING ERRCODE = 'P0002'; END IF;
  IF s.kind <> 'corrective' OR s.status NOT IN ('draft','in_progress') THEN RAISE EXCEPTION 'Solo en reparaciones abiertas' USING ERRCODE = '23514'; END IF;
  IF p_incident IS NOT NULL THEN
    SELECT id, asset_id INTO x FROM public.incidents WHERE id = p_incident AND company_id = p_company;
    IF NOT FOUND THEN RAISE EXCEPTION 'La incidencia no pertenece a la organización' USING ERRCODE = '42501'; END IF;
    SELECT asset_id INTO v_asset FROM public.maintenance_items WHERE session_id = p_session LIMIT 1;
    IF x.asset_id IS NOT NULL AND x.asset_id <> v_asset THEN RAISE EXCEPTION 'La incidencia corresponde a otro equipo' USING ERRCODE = '23514'; END IF;
  END IF;
  UPDATE public.maintenance_sessions SET incident_id = p_incident WHERE id = p_session;
END $$;

-- RPC: finalizar reparación. Nunca toca vencimientos, mnt_due_changes, certificados ni incidencias.
CREATE OR REPLACE FUNCTION public.mnt_sa_close_corrective(p_company uuid, p_session uuid, p_performed_on date, p_outcome text,
  p_observations text DEFAULT NULL, p_provider text DEFAULT NULL, p_reference text DEFAULT NULL, p_reactivate boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid(); s public.maintenance_sessions%ROWTYPE; v_tz text; v_asset uuid; v_status text; v_name text; v_react boolean := false;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'No autenticado' USING ERRCODE = '42501'; END IF;
  IF NOT coalesce(public.can_run_maintenance(p_company), false) THEN RAISE EXCEPTION 'Sin permiso para finalizar reparaciones' USING ERRCODE = '42501'; END IF;
  SELECT * INTO s FROM public.maintenance_sessions WHERE id = p_session AND company_id = p_company FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reparación no encontrada en la organización activa' USING ERRCODE = 'P0002'; END IF;
  IF s.kind <> 'corrective' THEN RAISE EXCEPTION 'Esta acción solo finaliza reparaciones' USING ERRCODE = '23514'; END IF;
  IF s.status = 'closed' THEN RETURN jsonb_build_object('closed_now', false, 'outcome', s.outcome); END IF;
  IF s.status NOT IN ('draft','in_progress') THEN RAISE EXCEPTION 'La reparación está cancelada' USING ERRCODE = '23514'; END IF;
  IF coalesce(p_outcome, '') NOT IN ('repaired','not_repaired','replaced') THEN RAISE EXCEPTION 'Resultado no válido' USING ERRCODE = '22023'; END IF;
  v_tz := public.mnt_sa_org_tz(p_company);
  IF p_performed_on IS NULL OR p_performed_on > (now() AT TIME ZONE v_tz)::date OR p_performed_on < s.detected_on THEN
    RAISE EXCEPTION 'La fecha de finalización no puede ser futura ni anterior a la detección' USING ERRCODE = '23514';
  END IF;
  IF p_outcome = 'not_repaired' AND nullif(btrim(coalesce(p_observations, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Explica por qué no se ha reparado' USING ERRCODE = '23514';
  END IF;
  SELECT i.asset_id, a.status INTO v_asset, v_status FROM public.maintenance_items i JOIN public.assets a ON a.id = i.asset_id WHERE i.session_id = p_session LIMIT 1;
  IF coalesce(p_reactivate, false) THEN
    IF p_outcome <> 'repaired' THEN RAISE EXCEPTION 'Solo un equipo reparado puede volver a activo' USING ERRCODE = '23514'; END IF;
    IF NOT coalesce(public.can_manage_assets(p_company), false) THEN RAISE EXCEPTION 'Sin permiso para cambiar el estado del equipo' USING ERRCODE = '42501'; END IF;
    IF v_status = 'out_of_service' THEN UPDATE public.assets SET status = 'active' WHERE id = v_asset; v_react := true; END IF;
  END IF;
  SELECT full_name INTO v_name FROM public.profiles WHERE id = me;
  PERFORM set_config('mnt.corrective', 'on', true);
  UPDATE public.maintenance_items SET result = CASE WHEN p_outcome = 'not_repaired' THEN 'with_incident' ELSE 'ok' END,
         completed_at = (p_performed_on::timestamp + time '12:00') AT TIME ZONE v_tz, completed_by = me,
         observations = nullif(btrim(coalesce(p_observations, '')), '')
   WHERE session_id = p_session;
  UPDATE public.maintenance_sessions SET status = 'closed', closed_at = now(), outcome = p_outcome,
         external_provider = coalesce(nullif(btrim(coalesce(p_provider, '')), ''), external_provider),
         external_cert_number = coalesce(nullif(btrim(coalesce(p_reference, '')), ''), external_cert_number),
         signer_name = coalesce(v_name, signer_name),
         metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('corrective_close', jsonb_build_object(
           'by', me, 'by_name', v_name, 'at', now(), 'performed_on', p_performed_on, 'outcome', p_outcome, 'reactivated', v_react))
   WHERE id = p_session;
  PERFORM set_config('mnt.corrective', 'off', true);
  RETURN jsonb_build_object('closed_now', true, 'outcome', p_outcome, 'reactivated', v_react);
END $$;

REVOKE ALL ON FUNCTION public.mnt_sa_create_corrective(uuid,uuid,date,text,text,uuid,boolean,text,text,boolean,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mnt_sa_add_entry(uuid,uuid,date,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mnt_sa_link_incident(uuid,uuid,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mnt_sa_close_corrective(uuid,uuid,date,text,text,text,text,boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mnt_sa_corrective_authority() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mnt_sa_create_corrective(uuid,uuid,date,text,text,uuid,boolean,text,text,boolean,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mnt_sa_add_entry(uuid,uuid,date,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mnt_sa_link_incident(uuid,uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mnt_sa_close_corrective(uuid,uuid,date,text,text,text,text,boolean) TO authenticated;
