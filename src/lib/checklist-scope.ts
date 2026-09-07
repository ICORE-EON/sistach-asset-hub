import { expandLocationIds, type ScopeLocation } from "@/lib/maintenance-scope";

export type ScopedTemplate = {
  id: string;
  code: string;
  name: string;
  asset_type_id: string | null;
  asset_family_id: string | null;
  asset_type_ids: string[] | null;
  location_ids: string[] | null;
  include_sublocations: boolean | null;
};

export type TemplateMatchTarget = {
  /** Asset type we are looking a template for. */
  assetTypeId: string;
  /** Family the asset type belongs to. */
  familyId?: string | null;
  /** Locations in play (plan scope or asset location). Empty = any location. */
  locationIds?: string[];
  /** Full company location tree, used to expand sublocations. */
  locations?: ScopeLocation[];
};

function matchesType(t: ScopedTemplate, target: TemplateMatchTarget): boolean {
  const ids = t.asset_type_ids ?? [];
  if (ids.length) return ids.includes(target.assetTypeId);
  if (t.asset_family_id) return !!target.familyId && target.familyId === t.asset_family_id;
  return t.asset_type_id === target.assetTypeId;
}

function matchesLocation(t: ScopedTemplate, target: TemplateMatchTarget): boolean {
  const scoped = t.location_ids ?? [];
  if (!scoped.length) return true;
  const wanted = target.locationIds ?? [];
  if (!wanted.length) return true;
  const expanded = new Set(
    expandLocationIds(target.locations ?? [], scoped, t.include_sublocations !== false),
  );
  return wanted.some((id) => expanded.has(id));
}

export function templateAppliesTo(t: ScopedTemplate, target: TemplateMatchTarget): boolean {
  return matchesType(t, target) && matchesLocation(t, target);
}

/** Higher = more specific. Concrete types beat "all types"; concrete centres beat "all centres". */
export function templateSpecificity(t: ScopedTemplate): number {
  return ((t.asset_type_ids ?? []).length ? 2 : 0) + ((t.location_ids ?? []).length ? 1 : 0);
}

/** Templates that apply to a target, most specific first. */
export function resolveTemplatesForType<T extends ScopedTemplate>(
  templates: T[],
  target: TemplateMatchTarget,
): T[] {
  return templates
    .filter((t) => templateAppliesTo(t, target))
    .sort((a, b) => templateSpecificity(b) - templateSpecificity(a) || a.name.localeCompare(b.name));
}

export function describeTemplateScope(
  t: ScopedTemplate,
  opts: {
    familyName?: string | null;
    typeNames?: (ids: string[]) => string[];
    locationNames?: (ids: string[]) => string[];
  } = {},
): { family: string; types: string; locations: string } {
  const typeIds = t.asset_type_ids ?? [];
  const locIds = t.location_ids ?? [];
  const typeList = opts.typeNames?.(typeIds) ?? [];
  const locList = opts.locationNames?.(locIds) ?? [];
  return {
    family: opts.familyName || "—",
    types: typeIds.length
      ? typeList.length
        ? typeList.join(", ")
        : `${typeIds.length} tipo(s)`
      : "Todos los tipos",
    locations: locIds.length
      ? locList.length
        ? locList.join(", ")
        : `${locIds.length} centro(s)`
      : "Todos los centros",
  };
}
