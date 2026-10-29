ALTER TABLE public.mnt_mtr_equipment ADD COLUMN IF NOT EXISTS asset_id uuid;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'mnt_mtr_equipment_asset_fkey') THEN
    ALTER TABLE public.mnt_mtr_equipment ADD CONSTRAINT mnt_mtr_equipment_asset_fkey
      FOREIGN KEY (company_id, asset_id) REFERENCES public.assets(company_id, id) ON DELETE RESTRICT;
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS mnt_mtr_equipment_asset_uk ON public.mnt_mtr_equipment(company_id, asset_id)
  WHERE asset_id IS NOT NULL AND deleted_at IS NULL;
COMMENT ON COLUMN public.mnt_mtr_equipment.asset_id IS 'Optional physical identity in the asset inventory (same org). Code/name/location are read from the asset when set.';

CREATE OR REPLACE FUNCTION public.mnt_mtr_tg_asset_link_guard()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.asset_id IS NOT NULL AND NEW.asset_id IS DISTINCT FROM OLD.asset_id THEN
    RAISE EXCEPTION 'El vínculo con el activo no se puede cambiar' USING ERRCODE = '42501';
  END IF;
  IF NEW.asset_id IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.asset_id IS NULL) THEN
    IF NOT EXISTS (SELECT 1 FROM public.assets a WHERE a.company_id = NEW.company_id AND a.id = NEW.asset_id AND a.deleted_at IS NULL) THEN
      RAISE EXCEPTION 'El activo no existe en la organización' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END $function$;
DROP TRIGGER IF EXISTS mtr_equipment_asset_link_guard ON public.mnt_mtr_equipment;
CREATE TRIGGER mtr_equipment_asset_link_guard BEFORE INSERT OR UPDATE OF asset_id ON public.mnt_mtr_equipment
  FOR EACH ROW EXECUTE FUNCTION public.mnt_mtr_tg_asset_link_guard();