-- «excepted» solo puede fijarse mediante la RPC de excepción justificada (que antes inserta la excepción).
DROP POLICY IF EXISTS mi_update ON public.maintenance_items;
CREATE POLICY mi_update ON public.maintenance_items FOR UPDATE TO authenticated
  USING (public.mnt_sa_can_execute_session(session_id))
  WITH CHECK (public.mnt_sa_can_execute_session(session_id) AND result <> 'excepted');

CREATE OR REPLACE FUNCTION public.mnt_sa_tg_excepted_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.result = 'excepted' AND OLD.result IS DISTINCT FROM 'excepted'
     AND NOT EXISTS (SELECT 1 FROM public.mnt_session_item_exceptions x WHERE x.item_id = NEW.id) THEN
    RAISE EXCEPTION 'Una excepción de cierre solo se registra con motivo, persona y fecha' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS mnt_sa_items_excepted_guard ON public.maintenance_items;
CREATE TRIGGER mnt_sa_items_excepted_guard BEFORE UPDATE OF result ON public.maintenance_items
  FOR EACH ROW EXECUTE FUNCTION public.mnt_sa_tg_excepted_guard();