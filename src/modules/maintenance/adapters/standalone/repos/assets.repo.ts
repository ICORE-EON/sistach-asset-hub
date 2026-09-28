/**
 * Assets / families / types / first-aid-kit repository. Only data layer touches the client.
 * Every read and write is scoped by orgId (company_id) to keep tenant isolation.
 */
import type { StandaloneClient } from "../adapters/standalone/client";

export type AssetFilters = {
  status?: string; typeIds?: string[] | null; siteId?: string; q?: string;
};

export type NewAsset = {
  asset_type_id: string; location_id: string | null; name: string | null;
  manufacturer: string | null; model: string | null; serial_number: string | null;
  install_date: string | null; notes: string | null;
};

export type AssetPatch = NewAsset & { warranty_until: string | null; status: string };

export type KitItemInput = {
  product_code: string | null; product_name: string; quantity: number;
  unit: string | null; batch_code?: string | null; expires_on?: string | null; notes?: string | null;
};

const NO_MATCH = "00000000-0000-0000-0000-000000000000";
const ok = <T>(r: { data: T; error: unknown }): T => { if (r.error) throw r.error; return r.data; };
const orgOrSystem = (orgId: string) => `company_id.eq.${orgId},is_system.eq.true`;

export function createAssetsRepo(c: StandaloneClient) {
  /** Kit rows are scoped through their parent asset, which must belong to the org. */
  const assertAssetInOrg = async (orgId: string, assetId: string) => {
    const row = ok(await c.from("assets").select("id").eq("id", assetId).eq("company_id", orgId).maybeSingle());
    if (!row) throw new Error("Activo no encontrado en la organización activa");
  };

  return {
    // ---- families ----
    async listFamilies(orgId: string) {
      return ok(await c.from("asset_families").select("*").or(orgOrSystem(orgId))
        .eq("active", true).order("sort_order").order("code")) ?? [];
    },
    async createFamily(orgId: string, v: { code: string; name: string; color: string; requires_certificate: boolean }) {
      ok(await c.from("asset_families").insert({
        company_id: orgId, code: v.code, name_i18n: { es: v.name }, color: v.color,
        requires_certificate: v.requires_certificate, is_system: false,
      }));
    },
    async setFamilyRequiresCertificate(orgId: string, id: string, value: boolean) {
      ok(await c.from("asset_families").update({ requires_certificate: value }).eq("id", id).or(orgOrSystem(orgId)));
    },
    async deleteFamily(orgId: string, id: string) {
      ok(await c.from("asset_families").delete().eq("id", id).eq("company_id", orgId));
    },

    // ---- types ----
    async listTypes(orgId: string) {
      return ok(await c.from("asset_types").select("id, code, name_i18n, category, is_system, family_id")
        .or(orgOrSystem(orgId)).eq("active", true).order("code")) ?? [];
    },
    async listTypesAdmin(orgId: string) {
      return ok(await c.from("asset_types").select("*").or(orgOrSystem(orgId))
        .order("is_system", { ascending: false }).order("code")) ?? [];
    },
    async createType(orgId: string, v: { code: string; name: string; category: string; family_id: string | null }) {
      ok(await c.from("asset_types").insert({
        company_id: orgId, code: v.code, name_i18n: { es: v.name }, category: v.category,
        family_id: v.family_id, is_system: false,
      }));
    },
    async setTypeFamily(orgId: string, typeId: string, familyId: string | null) {
      ok(await c.from("asset_types").update({ family_id: familyId }).eq("id", typeId).or(orgOrSystem(orgId)));
    },
    async deleteType(orgId: string, id: string) {
      ok(await c.from("asset_types").delete().eq("id", id).eq("company_id", orgId));
    },

    // ---- sites used by asset screens ----
    async listActiveSites(orgId: string) {
      return ok(await c.from("locations").select("id, code, name").eq("company_id", orgId)
        .eq("active", true).is("deleted_at", null).order("name")) ?? [];
    },
    /** Site tree (with parent) used by scope pickers: plans and checklist templates. */
    async listScopeSites(orgId: string) {
      return ok(await c.from("locations").select("id, name, code, parent_location_id").eq("company_id", orgId)
        .is("deleted_at", null).order("name")) ?? [];
    },
    async listSites(orgId: string) {
      return ok(await c.from("locations").select("id, name, code").eq("company_id", orgId).is("deleted_at", null)) ?? [];
    },

    // ---- assets ----
    async listAssets(orgId: string, f: AssetFilters = {}) {
      let q = c.from("assets")
        .select("id, code, name, status, manufacturer, model, serial_number, install_date, qr_token, asset_type_id, location_id, asset_types(code, name_i18n), locations(name, code)")
        .eq("company_id", orgId).is("deleted_at", null)
        .order("code", { ascending: false }).limit(500);
      if (f.status) q = q.eq("status", f.status);
      if (f.typeIds) q = f.typeIds.length ? q.in("asset_type_id", f.typeIds) : q.eq("asset_type_id", NO_MATCH);
      if (f.siteId) q = q.eq("location_id", f.siteId);
      if (f.q?.trim()) {
        const t = `%${f.q.trim()}%`;
        q = q.or(`name.ilike.${t},code.ilike.${t},serial_number.ilike.${t},manufacturer.ilike.${t},model.ilike.${t}`);
      }
      return ok(await q) ?? [];
    },
    /** Returns null when the asset does not exist or belongs to another org. */
    async getAsset(orgId: string, id: string) {
      return ok(await c.from("assets")
        .select("*, asset_types(code, name_i18n, category), locations(name, code)")
        .eq("id", id).eq("company_id", orgId).maybeSingle());
    },
    async createAsset(orgId: string, v: NewAsset) {
      const code = ok(await c.rpc("next_code", { p_company_id: orgId, p_scope: "assets", p_prefix: "AST" }));
      ok(await c.from("assets").insert({ ...v, company_id: orgId, qr_token: "", code: code as string }));
    },
    async updateAsset(orgId: string, id: string, v: AssetPatch) {
      ok(await c.from("assets").update(v).eq("id", id).eq("company_id", orgId));
    },
    async softDeleteAsset(orgId: string, id: string) {
      ok(await c.from("assets").update({ deleted_at: new Date().toISOString() }).eq("id", id).eq("company_id", orgId));
    },

    // ---- first-aid kit contents ----
    async listKitItems(orgId: string, assetId: string) {
      await assertAssetInOrg(orgId, assetId);
      return ok(await c.from("first_aid_kit_contents")
        .select("id, product_code, product_name, quantity, unit, batch_code, expires_on, notes")
        .eq("kit_asset_id", assetId).order("product_name")) ?? [];
    },
    async saveKitItem(orgId: string, assetId: string, id: string | null, v: KitItemInput) {
      await assertAssetInOrg(orgId, assetId);
      const payload = { ...v, kit_asset_id: assetId };
      if (id) ok(await c.from("first_aid_kit_contents").update(payload).eq("id", id).eq("kit_asset_id", assetId));
      else ok(await c.from("first_aid_kit_contents").insert(payload as never));
    },
    async insertKitItems(orgId: string, assetId: string, items: KitItemInput[]) {
      await assertAssetInOrg(orgId, assetId);
      ok(await c.from("first_aid_kit_contents").insert(items.map((i) => ({ ...i, kit_asset_id: assetId })) as never));
    },
    async deleteKitItem(orgId: string, assetId: string, id: string) {
      await assertAssetInOrg(orgId, assetId);
      ok(await c.from("first_aid_kit_contents").delete().eq("id", id).eq("kit_asset_id", assetId));
    },
  };
}

export type AssetsRepo = ReturnType<typeof createAssetsRepo>;
