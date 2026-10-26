import { assetTypeName, type ScopeAsset, type ScopeLocation } from './scope';

export const normalizeAssetSearch = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim();

/** A location and its host-provided ancestors (centre/site), without fetching extra data. */
export function assetLocationContext(asset: ScopeAsset, locations: ScopeLocation[] = []): string {
  const names: string[] = [];
  const seen = new Set<string>();
  let id = asset.location_id;
  while (id && !seen.has(id)) {
    seen.add(id);
    const location = locations.find(l => l.id === id);
    if (!location) break;
    names.unshift(location.name);
    id = location.parent_location_id;
  }
  return names.length ? names.join(' / ') : asset.locations?.name ?? 'Sin ubicación';
}

/** Only searches the already eligible, org-scoped candidates supplied by existing services. */
export function filterAssetCandidates(candidates: ScopeAsset[], query: string, locations: ScopeLocation[] = [], locationId?: string): ScopeAsset[] {
  const words = normalizeAssetSearch(query).split(/\s+/).filter(Boolean);
  const seen = new Set<string>();
  return candidates.filter(a => {
    if (seen.has(a.id)) return false;
    seen.add(a.id);
    if (locationId && a.location_id !== locationId) return false;
    const text = normalizeAssetSearch(`${a.code} ${a.name ?? ''} ${assetTypeName(a)} ${a.asset_types?.code ?? ''} ${assetLocationContext(a, locations)}`);
    return words.every(word => text.includes(word));
  });
}

/** Toggling a result/page never discards selections outside the current search. */
export function setAssetSelection(selected: string[], ids: string[], checked: boolean): string[] {
  const set = new Set(ids);
  return checked ? [...new Set([...selected, ...ids])] : selected.filter(id => !set.has(id));
}