ALTER TABLE public.mnt_mtr_equipment ADD COLUMN IF NOT EXISTS parent_asset_id uuid;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.mnt_mtr_equipment'::regclass AND conname='mnt_mtr_equipment_parent_asset_fkey') THEN
  ALTER TABLE public.mnt_mtr_equipment ADD CONSTRAINT mnt_mtr_equipment_parent_asset_fkey FOREIGN KEY (company_id,parent_asset_id) REFERENCES public.assets(company_id,id) ON DELETE RESTRICT;
 END IF;
END $$;
CREATE INDEX IF NOT EXISTS mnt_mtr_equipment_parent_asset_idx ON public.mnt_mtr_equipment(company_id,parent_asset_id);
COMMENT ON COLUMN public.mnt_mtr_equipment.parent_asset_id IS 'Optional operational N:1 association to a principal asset, separate from physical identity asset_id; no silent reassignment.';
CREATE OR REPLACE FUNCTION public.mnt_mtr_tg_parent_asset_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 IF TG_OP='UPDATE' THEN
  IF OLD.parent_asset_id IS NOT NULL AND NEW.parent_asset_id IS DISTINCT FROM OLD.parent_asset_id THEN
   RAISE EXCEPTION 'El instrumento ya está asociado a otro activo principal; no se permite reasignarlo' USING ERRCODE='42501';
  END IF;
  IF OLD.asset_id IS NOT NULL AND NEW.name IS DISTINCT FROM OLD.name THEN
   RAISE EXCEPTION 'El nombre de este equipo se gestiona en Activos' USING ERRCODE='42501';
  END IF;
 END IF;
 IF NEW.parent_asset_id IS NOT NULL THEN
  IF NOT EXISTS (SELECT 1 FROM public.assets WHERE company_id=NEW.company_id AND id=NEW.parent_asset_id AND deleted_at IS NULL) THEN
   RAISE EXCEPTION 'El activo principal no existe en la organización' USING ERRCODE='23514';
  END IF;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS mtr_parent_asset_guard ON public.mnt_mtr_equipment;
CREATE TRIGGER mtr_parent_asset_guard BEFORE INSERT OR UPDATE OF parent_asset_id,name,company_id ON public.mnt_mtr_equipment FOR EACH ROW EXECUTE FUNCTION public.mnt_mtr_tg_parent_asset_guard();
CREATE OR REPLACE FUNCTION public.mtr_associate_equipment(p_org uuid,p_parent uuid,p_equipment uuid[]) RETURNS integer LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE n integer; affected integer;
BEGIN
 IF public.can_manage_assets(p_org) IS DISTINCT FROM true THEN RAISE EXCEPTION 'Sin permiso para asociar equipos' USING ERRCODE='42501'; END IF;
 IF p_equipment IS NULL OR cardinality(p_equipment)=0 OR array_position(p_equipment,NULL) IS NOT NULL THEN RAISE EXCEPTION 'Selecciona instrumentos' USING ERRCODE='23514'; END IF;
 SELECT count(DISTINCT x) INTO n FROM unnest(p_equipment) x;
 PERFORM 1 FROM public.assets WHERE company_id=p_org AND id=p_parent AND deleted_at IS NULL FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Activo principal no disponible en la organización' USING ERRCODE='23514'; END IF;
 PERFORM 1 FROM public.mnt_mtr_equipment WHERE company_id=p_org AND id=ANY(p_equipment) AND deleted_at IS NULL ORDER BY id FOR UPDATE;
 SELECT count(*) INTO affected FROM public.mnt_mtr_equipment WHERE company_id=p_org AND id=ANY(p_equipment) AND deleted_at IS NULL;
 IF affected<>n THEN RAISE EXCEPTION 'Instrumento no disponible en la organización' USING ERRCODE='23514'; END IF;
 IF EXISTS (SELECT 1 FROM public.mnt_mtr_equipment WHERE company_id=p_org AND id=ANY(p_equipment) AND parent_asset_id IS NOT NULL AND parent_asset_id<>p_parent) THEN
  RAISE EXCEPTION 'Algún instrumento ya está asociado a otro activo principal' USING ERRCODE='42501';
 END IF;
 UPDATE public.mnt_mtr_equipment SET parent_asset_id=p_parent WHERE company_id=p_org AND id=ANY(p_equipment) AND parent_asset_id IS NULL;
 RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.mtr_associate_equipment(uuid,uuid,uuid[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.mtr_associate_equipment(uuid,uuid,uuid[]) TO authenticated,service_role;