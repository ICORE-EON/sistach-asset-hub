/**
 * Maintenance plans repository: plans, plan↔asset links, per-type checklist assignments, scope
 * resolution and the certificate-template pick list used by plan screens.
 * maintenance_plans carries company_id; child rows (plan assets, type templates) are reached only
 * after proving their parent plan belongs to orgId. Every referenced resource (family, types,
 * assets, checklist and certificate templates) is checked against orgId BEFORE any write.
 * scope_location_ids stays an array until the phase-5 normalization.
 */
import type { StandaloneClient } from "../adapters/standalone/client";
import { expandLocationIds, type ScopeAsset, type ScopeLocation } from "../domain/scope";

export const PLAN_LIST_SELECT =
  "*, asset_types(code, name_i18n), asset_families(code, name_i18n), checklist_templates(code, name)";
export const PLAN_DETAIL_SELECT =
  "*, asset_types(code, name_i18n), asset_families(code, name_i18n), checklist_templates(code, name, current_version), certificate_templates(id, code, name)";

export type NewPlan = {
  code: string; name: string; asset_family_id: string; frequency: string; interval_months: number | null;
  notes: string | null; scope_mode: "scoped" | "manual"; scope_location_ids: string[];
  scope_include_sublocations: boolean; certificate_template_id: string | null;
  asset_ids: string[]; type_templates: Array<{ asset_type_id: string; checklist_template_id: string }>;
};

export type ScopeQuery = {
  assetTypeIds: string[]; locationIds: string[]; includeSublocations: boolean; locations?: ScopeLocation[];
};

const ok = <T>(r: { data: T; error: unknown }): T => { if (r.error) throw r.error; return r.data; };
const uniq = (xs: string[]) => [...new Set(xs)];
const DENY = "no encontrado en la organización activa";

export function createPlansRepo(c: StandaloneClient) {
  const assertPlan = async (orgId: string, planId: string) => {
    const row = ok(await c.from("maintenance_plans").select("id").eq("id", planId).eq("company_id", orgId).maybeSingle());
    if (!row) throw new Error(`Plan ${DENY}`);
  };
  const assertAssets = async (orgId: string, ids: string[]) => {
    const want = uniq(ids);
    if (!want.length) return;
    const rows = ok(await c.from("assets").select("id").eq("company_id", orgId).in("id", want)) ?? [];
    if (rows.length !== want.length) throw new Error(`Equipo ${DENY}`);
  };
  const assertFamily = async (orgId: string, id: string) => {
    const row = ok(await c.from("asset_families").select("id, company_id, is_system").eq("id", id).maybeSingle());
    if (!row || !(row.is_system || row.company_id === orgId)) throw new Error(`Familia ${DENY}`);
  };
  const assertTypes = async (orgId: string, ids: string[]) => {
    const want = uniq(ids);
    if (!want.length) return;
    const rows = ok(await c.from("asset_types").select("id, company_id, is_system").in("id", want)) ?? [];
    const visible = rows.filter((r) => r.is_system || r.company_id === orgId);
    if (visible.length !== want.length) throw new Error(`Tipo de activo ${DENY}`);
  };
  const assertChecklistTemplates = async (orgId: string, ids: string[]) => {
    const want = uniq(ids);
    if (!want.length) return;
    const rows = ok(await c.from("checklist_templates").select("id").eq("company_id", orgId).in("id", want)) ?? [];
    if (rows.length !== want.length) throw new Error(`Plantilla de checklist ${DENY}`);
  };
  const assertCertTemplate = async (orgId: string, id: string | null) => {
    if (!id) return;
    const row = ok(await c.from("certificate_templates").select("id").eq("id", id).eq("company_id", orgId).maybeSingle());
    if (!row) throw new Error(`Plantilla de certificado ${DENY}`);
  };
  const listSites = async (orgId: string) =>
    (ok(await c.from("locations").select("id, name, code, parent_location_id").eq("company_id", orgId)
      .is("deleted_at", null).order("name")) ?? []) as ScopeLocation[];

  return {
    async listPlans(orgId: string) {
      return ok(await c.from("maintenance_plans").select(PLAN_LIST_SELECT)
        .eq("company_id", orgId).is("deleted_at", null).order("code")) ?? [];
    },
    async getPlan(orgId: string, id: string) {
      return ok(await c.from("maintenance_plans").select(PLAN_DETAIL_SELECT)
        .eq("id", id).eq("company_id", orgId).maybeSingle());
    },
    async listPlanAssets(orgId: string, planId: string) {
      await assertPlan(orgId, planId);
      return ok(await c.from("maintenance_plan_assets")
        .select("*, assets(id, code, name, status, locations(name))").eq("plan_id", planId)) ?? [];
    },
    /** Certificate templates offered on plan screens (read only; certificates domain is block 6). */
    async listCertificateTemplates(orgId: string, orderBy: "name" | "code") {
      return ok(await c.from("certificate_templates").select("id, code, name, is_default, asset_family_id")
        .eq("company_id", orgId).is("deleted_at", null).order(orderBy)) ?? [];
    },
    /** Assets that match a plan scope (types + locations), same filters as before. */
    async listScopeAssets(orgId: string, q: ScopeQuery): Promise<ScopeAsset[]> {
      const locs = q.locations ?? (q.locationIds.length ? await listSites(orgId) : []);
      const expanded = expandLocationIds(locs, q.locationIds, q.includeSublocations);
      let b = c.from("assets")
        .select("id, code, name, status, location_id, asset_type_id, locations(name), asset_types(code, name_i18n)")
        .eq("company_id", orgId).is("deleted_at", null).neq("status", "retired");
      if (q.assetTypeIds.length) b = b.in("asset_type_id", q.assetTypeIds);
      if (expanded.length) b = b.in("location_id", expanded);
      return (ok(await b.order("code")) ?? []) as unknown as ScopeAsset[];
    },

    async createPlan(orgId: string, v: NewPlan) {
      // All guards first: nothing is written if any referenced resource is outside the org.
      await assertFamily(orgId, v.asset_family_id);
      await assertAssets(orgId, v.asset_ids);
      await assertTypes(orgId, v.type_templates.map((t) => t.asset_type_id));
      await assertChecklistTemplates(orgId, v.type_templates.map((t) => t.checklist_template_id));
      await assertCertTemplate(orgId, v.certificate_template_id);
      const types = v.type_templates.map((t) => t.asset_type_id);
      const plan = ok(await c.from("maintenance_plans").insert({
        company_id: orgId, code: v.code, name: v.name, asset_family_id: v.asset_family_id,
        asset_type_id: types.length === 1 ? types[0] : null,
        checklist_template_id: v.type_templates[0].checklist_template_id,
        certificate_template_id: v.certificate_template_id, frequency: v.frequency,
        interval_months: v.interval_months, notes: v.notes, scope_mode: v.scope_mode,
        scope_location_ids: v.scope_location_ids, scope_include_sublocations: v.scope_include_sublocations,
      }).select("id").single())!;
      ok(await c.from("maintenance_plan_assets").insert(v.asset_ids.map((asset_id) => ({ plan_id: plan.id, asset_id }))));
      ok(await c.from("maintenance_plan_type_templates").insert(v.type_templates.map((t) => ({ plan_id: plan.id, ...t }))));
      return plan.id as string;
    },
    async setCertificateTemplate(orgId: string, planId: string, templateId: string | null) {
      await assertPlan(orgId, planId);
      await assertCertTemplate(orgId, templateId);
      ok(await c.from("maintenance_plans").update({ certificate_template_id: templateId }).eq("id", planId).eq("company_id", orgId));
    },
    async setActive(orgId: string, planId: string, active: boolean) {
      await assertPlan(orgId, planId);
      ok(await c.from("maintenance_plans").update({ active }).eq("id", planId).eq("company_id", orgId));
    },
    async addAssets(orgId: string, planId: string, assetIds: string[]) {
      await assertPlan(orgId, planId);
      await assertAssets(orgId, assetIds);
      ok(await c.from("maintenance_plan_assets").insert(assetIds.map((asset_id) => ({ plan_id: planId, asset_id }))));
    },
    async removeAsset(orgId: string, planId: string, assignmentId: string) {
      await assertPlan(orgId, planId);
      ok(await c.from("maintenance_plan_assets").delete().eq("id", assignmentId).eq("plan_id", planId));
    },
  };
}

export type PlansRepo = ReturnType<typeof createPlansRepo>;
