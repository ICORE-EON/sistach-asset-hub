ALTER TABLE public.checklist_templates
  ADD COLUMN IF NOT EXISTS asset_family_id uuid REFERENCES public.asset_families(id),
  ADD COLUMN IF NOT EXISTS asset_type_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS location_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS include_sublocations boolean NOT NULL DEFAULT true;

ALTER TABLE public.checklist_templates ALTER COLUMN asset_type_id DROP NOT NULL;

UPDATE public.checklist_templates ct
SET asset_family_id = at.family_id
FROM public.asset_types at
WHERE ct.asset_type_id = at.id AND ct.asset_family_id IS NULL;

UPDATE public.checklist_templates
SET asset_type_ids = ARRAY[asset_type_id]
WHERE asset_type_id IS NOT NULL AND cardinality(asset_type_ids) = 0;

CREATE INDEX IF NOT EXISTS checklist_templates_asset_type_ids_idx
  ON public.checklist_templates USING gin (asset_type_ids);
CREATE INDEX IF NOT EXISTS checklist_templates_location_ids_idx
  ON public.checklist_templates USING gin (location_ids);
CREATE INDEX IF NOT EXISTS checklist_templates_family_idx
  ON public.checklist_templates (asset_family_id);