CREATE OR REPLACE FUNCTION public.mnt_tg_technical_sheet_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE t jsonb; k text; v jsonb;
BEGIN
  IF TG_TABLE_NAME = 'asset_types' THEN
    IF NEW.metadata ? 'technical_profile' AND coalesce(jsonb_typeof(NEW.metadata->'technical_profile'),'x') NOT IN ('string','null') THEN
      RAISE EXCEPTION 'technical_profile debe ser texto';
    END IF;
    RETURN NEW;
  END IF;
  IF NOT (NEW.metadata ? 'technical') OR jsonb_typeof(NEW.metadata->'technical') = 'null' THEN RETURN NEW; END IF;
  t := NEW.metadata->'technical';
  IF coalesce(jsonb_typeof(t),'x') <> 'object' OR coalesce(jsonb_typeof(t->'profile'),'x') <> 'string'
     OR coalesce(jsonb_typeof(t->'version'),'x') <> 'number' OR coalesce(jsonb_typeof(t->'values'),'x') <> 'object' THEN
    RAISE EXCEPTION 'Ficha técnica con formato no válido';
  END IF;
  FOR k, v IN SELECT * FROM jsonb_each(t->'values') LOOP
    IF k !~ '^[a-z][a-z0-9_]{0,40}$' THEN RAISE EXCEPTION 'Clave de ficha técnica no válida: %', k; END IF;
    IF jsonb_typeof(v) NOT IN ('number','string') THEN RAISE EXCEPTION 'Valor de ficha técnica no válido en %', k; END IF;
    IF jsonb_typeof(v) = 'string' AND length(v #>> '{}') > 200 THEN RAISE EXCEPTION 'Valor demasiado largo en %', k; END IF;
  END LOOP;
  RETURN NEW;
END $$;