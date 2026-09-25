/**
 * Asset use-cases and org-scoped query keys. UI imports from here, never the client.
 * Every key starts with the domain name and includes orgId so switching org never reuses cache.
 */
import { assetsRepo as repo } from "../adapters/standalone/repos";
import type { AssetFilters, AssetPatch, KitItemInput, NewAsset } from "../data/assets.repo";

export type { AssetFilters, AssetPatch, KitItemInput, NewAsset };

export const assetKeys = {
  families: (orgId: string | null) => ["asset-families", orgId] as const,
  typesForFamilies: (orgId: string | null) => ["asset-types-family", orgId] as const,
  typesAdmin: (orgId: string | null) => ["asset-types-admin", orgId] as const,
  types: (orgId: string | null) => ["asset-types", orgId] as const,
  sites: (orgId: string | null) => ["locations", orgId] as const,
  scopeSites: (orgId: string | null) => ["locations-scope", orgId] as const,
  list: (orgId: string | null, ...f: unknown[]) => ["assets", orgId, ...f] as const,
  detail: (orgId: string | null, id: string) => ["asset", orgId, id] as const,
  kit: (orgId: string | null, assetId: string) => ["kit-contents", orgId, assetId] as const,
};

const need = (orgId: string | null | undefined): string => {
  if (!orgId) throw new Error("Sin empresa activa");
  return orgId;
};

export const assetService = {
  listFamilies: (orgId: string | null) => repo.listFamilies(need(orgId)),
  createFamily: (orgId: string | null, v: { code: string; name: string; color: string; requiresCertificate: boolean }) => {
    if (!v.code || !v.name) throw new Error("Código y nombre son obligatorios");
    return repo.createFamily(need(orgId), {
      code: v.code.toLowerCase().replace(/\s+/g, "_"), name: v.name, color: v.color,
      requires_certificate: v.requiresCertificate,
    });
  },
  setFamilyRequiresCertificate: (orgId: string | null, id: string, value: boolean) =>
    repo.setFamilyRequiresCertificate(need(orgId), id, value),
  deleteFamily: (orgId: string | null, id: string) => repo.deleteFamily(need(orgId), id),

  listTypes: (orgId: string | null) => repo.listTypes(need(orgId)),
  listTypesAdmin: (orgId: string | null) => repo.listTypesAdmin(need(orgId)),
  createType: (orgId: string | null, v: { code: string; name: string; category: string; familyId: string }) => {
    if (!v.code || !v.name) throw new Error("Código y nombre son obligatorios");
    return repo.createType(need(orgId), { code: v.code.toUpperCase(), name: v.name, category: v.category, family_id: v.familyId || null });
  },
  setTypeFamily: (orgId: string | null, typeId: string, familyId: string | null) =>
    repo.setTypeFamily(need(orgId), typeId, familyId),
  deleteType: (orgId: string | null, id: string) => repo.deleteType(need(orgId), id),

  listActiveSites: (orgId: string | null) => repo.listActiveSites(need(orgId)),
  listSites: (orgId: string | null) => repo.listSites(need(orgId)),
  listScopeSites: (orgId: string | null) => repo.listScopeSites(need(orgId)),

  listAssets: (orgId: string | null, f?: AssetFilters) => repo.listAssets(need(orgId), f),
  getAsset: async (orgId: string | null, id: string) => {
    const a = await repo.getAsset(need(orgId), id);
    if (!a) throw new Error("Activo no encontrado");
    return a;
  },
  createAsset: (orgId: string | null, v: NewAsset) => {
    if (!v.asset_type_id) throw new Error("Selecciona un tipo");
    return repo.createAsset(need(orgId), v);
  },
  updateAsset: (orgId: string | null, id: string, v: AssetPatch) => repo.updateAsset(need(orgId), id, v),
  deleteAsset: (orgId: string | null, id: string) => repo.softDeleteAsset(need(orgId), id),

  listKitItems: (orgId: string | null, assetId: string) => repo.listKitItems(need(orgId), assetId),
  saveKitItem: (orgId: string | null, assetId: string, id: string | null, v: KitItemInput) =>
    repo.saveKitItem(need(orgId), assetId, id, v),
  insertKitItems: (orgId: string | null, assetId: string, items: KitItemInput[]) =>
    repo.insertKitItems(need(orgId), assetId, items),
  deleteKitItem: (orgId: string | null, assetId: string, id: string) => repo.deleteKitItem(need(orgId), assetId, id),
};
