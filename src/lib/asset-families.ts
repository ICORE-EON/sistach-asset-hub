import { supabase } from "@/integrations/supabase/client";
import { assetService } from "@/modules/maintenance/services/assets";

export type AssetFamily = {
  id: string;
  company_id: string | null;
  code: string;
  name_i18n: unknown;
  color: string | null;
  sort_order: number;
  requires_certificate: boolean;
  is_system: boolean;
  active: boolean;
};

export type AssetTypeRow = {
  id: string;
  code: string;
  name_i18n: unknown;
  category: string;
  is_system: boolean;
  family_id: string | null;
};

/** Delegates to the maintenance module (block 1 of phase 3). */
export async function fetchAssetFamilies(companyId: string): Promise<AssetFamily[]> {
  return (await assetService.listFamilies(companyId)) as AssetFamily[];
}

export async function fetchAssetTypes(companyId: string): Promise<AssetTypeRow[]> {
  return (await assetService.listTypes(companyId)) as AssetTypeRow[];
}

/** Published checklist templates available for a company. (Checklists block — pending.) */
export type PublishedTemplate = {
  id: string;
  code: string;
  name: string;
  asset_type_id: string | null;
  asset_family_id: string | null;
  asset_type_ids: string[] | null;
  location_ids: string[] | null;
  include_sublocations: boolean | null;
};

export async function fetchPublishedTemplates(companyId: string): Promise<PublishedTemplate[]> {
  const { data, error } = await supabase
    .from("checklist_templates")
    .select(
      "id, code, name, asset_type_id, asset_family_id, asset_type_ids, location_ids, include_sublocations",
    )
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .eq("active", true)
    .gt("current_version", 0)
    .order("name");
  if (error) throw error;
  return (data ?? []) as unknown as PublishedTemplate[];
}

/** Latest published version id for each checklist template. */
export async function fetchPublishedVersions(
  templateIds: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!templateIds.length) return out;
  const { data, error } = await supabase
    .from("checklist_template_versions")
    .select("id, template_id, version")
    .in("template_id", templateIds)
    .eq("is_published", true)
    .order("version", { ascending: false });
  if (error) throw error;
  for (const row of data ?? []) {
    if (!out.has(row.template_id)) out.set(row.template_id, row.id);
  }
  return out;
}
