import { checklistService } from "@/modules/maintenance/services/checklists";
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

/** Published checklist templates available for a company. (Delegates to the maintenance module.) */
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
  return (await checklistService.listPublishedTemplates(companyId)) as unknown as PublishedTemplate[];
}

/** Latest published version id for each checklist template of the company. */
export async function fetchPublishedVersions(
  companyId: string,
  templateIds: string[],
): Promise<Map<string, string>> {
  return checklistService.latestPublishedVersions(companyId, templateIds);
}
