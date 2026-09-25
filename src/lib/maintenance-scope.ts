import { supabase } from "@/integrations/supabase/client";

import { expandLocationIds, type ScopeLocation, type ScopeAsset } from "@/modules/maintenance/domain/scope";

export * from "@/modules/maintenance/domain/scope";

export async function fetchCompanyLocations(companyId: string): Promise<ScopeLocation[]> {
  const { data, error } = await supabase
    .from("locations")
    .select("id, name, code, parent_location_id")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("name");
  if (error) throw error;
  return (data ?? []) as ScopeLocation[];
}

/** Resolves the assets that match a plan scope (asset types + locations). */
export async function fetchScopeAssets(params: {
  companyId: string;
  assetTypeId?: string | null;
  assetTypeIds?: string[] | null;
  locationIds: string[];
  includeSublocations: boolean;
  locations?: ScopeLocation[];
}): Promise<ScopeAsset[]> {
  const { companyId, assetTypeId, assetTypeIds, locationIds, includeSublocations } = params;
  const locs = params.locations ?? (locationIds.length ? await fetchCompanyLocations(companyId) : []);
  const expanded = expandLocationIds(locs, locationIds, includeSublocations);

  let q = supabase
    .from("assets")
    .select("id, code, name, status, location_id, asset_type_id, locations(name), asset_types(code, name_i18n)")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .neq("status", "retired");
  if (assetTypeIds && assetTypeIds.length) q = q.in("asset_type_id", assetTypeIds);
  else if (assetTypeId) q = q.eq("asset_type_id", assetTypeId);
  if (expanded.length) q = q.in("location_id", expanded);

  const { data, error } = await q.order("code");
  if (error) throw error;
  return (data ?? []) as unknown as ScopeAsset[];
}

