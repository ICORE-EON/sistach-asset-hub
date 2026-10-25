CREATE OR REPLACE FUNCTION public.mnt_sa_tg_delete_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_company uuid; v_owner name;
BEGIN
  SELECT pg_get_userbyid(proowner) INTO v_owner FROM pg_proc WHERE oid = 'public.mnt_sa_delete_asset(uuid,uuid,boolean)'::regprocedure;
  IF current_user = v_owner AND coalesce(current_setting('mnt.safe_delete', true), '') = 'on' THEN RETURN OLD; END IF;
  IF TG_TABLE_NAME = 'maintenance_plan_assets' THEN
    SELECT p.company_id INTO v_company FROM public.maintenance_plans p WHERE p.id = OLD.plan_id;
  ELSIF TG_TABLE_NAME = 'maintenance_items' THEN
    SELECT s.company_id INTO v_company FROM public.maintenance_sessions s WHERE s.id = OLD.session_id;
  ELSE
    v_company := OLD.company_id;
  END IF;
  IF v_company IS NULL OR NOT EXISTS (SELECT 1 FROM public.companies c WHERE c.id = v_company) THEN RETURN OLD; END IF;
  RAISE EXCEPTION 'Este registro solo se puede eliminar con la acción «Eliminar» de la aplicación' USING ERRCODE = '42501';
END $$;