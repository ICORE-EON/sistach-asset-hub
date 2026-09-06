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
  locations: { name: string } | null;
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

/** Resolves the assets that match a plan scope (asset type + locations). */
export async function fetchScopeAssets(params: {
  companyId: string;
  assetTypeId: string | null;
  locationIds: string[];
  includeSublocations: boolean;
  locations?: ScopeLocation[];
}): Promise<ScopeAsset[]> {
  const { companyId, assetTypeId, locationIds, includeSublocations } = params;
  const locs = params.locations ?? (locationIds.length ? await fetchCompanyLocations(companyId) : []);
  const expanded = expandLocationIds(locs, locationIds, includeSublocations);

  let q = supabase
    .from("assets")
    .select("id, code, name, status, location_id, locations(name)")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .neq("status", "retired");
  if (assetTypeId) q = q.eq("asset_type_id", assetTypeId);
  if (expanded.length) q = q.in("location_id", expanded);

  const { data, error } = await q.order("code");
  if (error) throw error;
  return (data ?? []) as ScopeAsset[];
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
