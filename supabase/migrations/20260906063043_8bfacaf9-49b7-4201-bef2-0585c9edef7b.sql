-- Deduplicate existing rows before creating the unique index
DELETE FROM public.first_aid_kit_contents a
USING public.first_aid_kit_contents b
WHERE a.kit_asset_id = b.kit_asset_id
  AND a.product_code IS NOT NULL
  AND b.product_code IS NOT NULL
  AND upper(a.product_code) = upper(b.product_code)
  AND a.ctid > b.ctid;

CREATE UNIQUE INDEX IF NOT EXISTS first_aid_kit_contents_kit_product_uidx
  ON public.first_aid_kit_contents (kit_asset_id, upper(product_code))
  WHERE product_code IS NOT NULL;