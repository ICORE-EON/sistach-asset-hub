CREATE TABLE public.mnt_asset_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mnt_asset_categories TO authenticated;
GRANT ALL ON public.mnt_asset_categories TO service_role;
ALTER TABLE public.mnt_asset_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY mnt_cat_select ON public.mnt_asset_categories FOR SELECT TO authenticated USING (public.user_has_membership(company_id));
CREATE POLICY mnt_cat_insert ON public.mnt_asset_categories FOR INSERT TO authenticated WITH CHECK (public.can_manage_assets(company_id));
CREATE POLICY mnt_cat_update ON public.mnt_asset_categories FOR UPDATE TO authenticated USING (public.can_manage_assets(company_id)) WITH CHECK (public.can_manage_assets(company_id));
CREATE POLICY mnt_cat_delete ON public.mnt_asset_categories FOR DELETE TO authenticated USING (public.can_manage_assets(company_id));
CREATE TRIGGER mnt_asset_categories_updated_at BEFORE UPDATE ON public.mnt_asset_categories FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();