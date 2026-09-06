import { supabase } from "@/integrations/supabase/client";

export type ScopeLocation = {
  id: string;
  name: string;
  code: string;
  parent_location_id: string | null;
};

export type ScopeAsset = {
  id: string;
  code: string;
  name: string | null;
  status: string;
  location_id: string | null;
  asset_type_id: string;
  locations: { name: string } | null;
  asset_types: { code: string; name_i18n: unknown } | null;
};

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

/** Expands the selected locations with all their descendants. */
export function expandLocationIds(
  locations: ScopeLocation[],
  selectedIds: string[],
  includeSublocations: boolean,
): string[] {
  if (!includeSublocations) return [...new Set(selectedIds)];
  const childrenBy = new Map<string, string[]>();
  for (const loc of locations) {
    if (!loc.parent_location_id) continue;
    const list = childrenBy.get(loc.parent_location_id) ?? [];
    list.push(loc.id);
    childrenBy.set(loc.parent_location_id, list);
  }
  const out = new Set<string>();
  const stack = [...selectedIds];
  while (stack.length) {
    const id = stack.pop()!;
    if (out.has(id)) continue;
    out.add(id);
    for (const child of childrenBy.get(id) ?? []) stack.push(child);
  }
  return [...out];
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

/** Groups assets by location and then by asset type. */
export function groupAssets(assets: ScopeAsset[]): Array<{
  locationId: string;
  locationName: string;
  types: Array<{ typeId: string; typeName: string; assets: ScopeAsset[] }>;
}> {
  const byLoc = new Map<string, ScopeAsset[]>();
  for (const a of assets) {
    const key = a.location_id ?? "none";
    byLoc.set(key, [...(byLoc.get(key) ?? []), a]);
  }
  return [...byLoc.entries()]
    .map(([locationId, list]) => {
      const byType = new Map<string, ScopeAsset[]>();
      for (const a of list) byType.set(a.asset_type_id, [...(byType.get(a.asset_type_id) ?? []), a]);
      return {
        locationId,
        locationName: list[0]?.locations?.name ?? "Sin ubicación",
        types: [...byType.entries()]
          .map(([typeId, tAssets]) => ({
            typeId,
            typeName: assetTypeName(tAssets[0]),
            assets: tAssets,
          }))
          .sort((a, b) => a.typeName.localeCompare(b.typeName)),
      };
    })
    .sort((a, b) => a.locationName.localeCompare(b.locationName));
}

export function assetTypeName(a: ScopeAsset | undefined): string {
  const n = a?.asset_types?.name_i18n as Record<string, string> | null | undefined;
  return n?.es ?? n?.ca ?? n?.en ?? a?.asset_types?.code ?? "Sin tipo";
}


export function diffScope(
  linkedAssetIds: string[],
  scopedAssets: ScopeAsset[],
): { missing: ScopeAsset[]; scopedIds: Set<string> } {
  const linked = new Set(linkedAssetIds);
  const scopedIds = new Set(scopedAssets.map((a) => a.id));
  return { missing: scopedAssets.filter((a) => !linked.has(a.id)), scopedIds };
}

export function describeScopeLocations(
  locations: ScopeLocation[],
  selectedIds: string[],
  includeSublocations: boolean,
): string {
  if (!selectedIds.length) return "Todas las ubicaciones";
  const names = selectedIds
    .map((id) => locations.find((l) => l.id === id)?.name ?? "—")
    .join(", ");
  return includeSublocations ? `${names} (incluye sububicaciones)` : names;
}
