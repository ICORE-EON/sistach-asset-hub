/**
 * Maintenance plan use-cases and org-scoped query keys (orgId always at position 1).
 * Validation messages and order are identical to the previous inline dialogs.
 */
import { plansRepo as repo } from "../adapters/standalone/repos";
import type { ScopeQuery } from "../data/plans.repo";

export type { ScopeQuery };

export const FREQUENCIES = [
  { value: "monthly", label: "Mensual", months: 1 },
  { value: "quarterly", label: "Trimestral", months: 3 },
  { value: "biannual", label: "Semestral", months: 6 },
  { value: "annual", label: "Anual", months: 12 },
];

export const planKeys = {
  list: (orgId: string | null) => ["maintenance-plans", orgId] as const,
  detail: (orgId: string | null, id: string) => ["plan", orgId, id] as const,
  assets: (orgId: string | null, id: string) => ["plan-assets", orgId, id] as const,
  certTemplatesByName: (orgId: string | null) => ["cert-templates-family", orgId] as const,
  certTemplatesByCode: (orgId: string | null) => ["certificate-templates-pick", orgId] as const,
  scopeAssets: (orgId: string | null, ...f: unknown[]) => ["scope-assets", orgId, ...f] as const,
  familyAssets: (orgId: string | null, ...f: unknown[]) => ["family-assets", orgId, ...f] as const,
  scopedAssets: (orgId: string | null, ...f: unknown[]) => ["scoped-assets", orgId, ...f] as const,
};

const need = (orgId: string | null | undefined): string => {
  if (!orgId) throw new Error("Sin empresa activa");
  return orgId;
};

export type CreatePlanInput = {
  code: string; name: string; familyId: string; frequency: string; notes: string;
  scopeMode: "scoped" | "manual"; locationIds: string[]; includeSub: boolean;
  selectedIds: string[]; usedTypeIds: string[]; templateFor: (typeId: string) => string;
  certTemplateId: string;
};

export const planService = {
  listPlans: (orgId: string | null) => repo.listPlans(need(orgId)),
  getPlan: async (orgId: string | null, id: string) => {
    const p = await repo.getPlan(need(orgId), id);
    if (!p) throw new Error("Plan no encontrado");
    return p;
  },
  listPlanAssets: (orgId: string | null, planId: string) => repo.listPlanAssets(need(orgId), planId),
  listCertificateTemplates: (orgId: string | null, orderBy: "name" | "code") =>
    repo.listCertificateTemplates(need(orgId), orderBy),
  listScopeAssets: (orgId: string | null, q: ScopeQuery) => repo.listScopeAssets(need(orgId), q),

  createPlan: async (orgId: string | null, v: CreatePlanInput) => {
    if (!orgId) throw new Error("Sin empresa activa");
    if (!v.code || !v.name || !v.familyId) throw new Error("Completa los campos obligatorios");
    if (!v.selectedIds.length) throw new Error("Selecciona al menos un equipo");
    if (v.usedTypeIds.some((id) => !v.templateFor(id)))
      throw new Error("Hay tipos de activo sin plantilla de checklist publicada");
    const freq = FREQUENCIES.find((f) => f.value === v.frequency);
    await repo.createPlan(orgId, {
      code: v.code.toUpperCase(), name: v.name, asset_family_id: v.familyId, frequency: v.frequency,
      interval_months: freq?.months ?? null, notes: v.notes || null, scope_mode: v.scopeMode,
      scope_location_ids: v.scopeMode === "scoped" ? v.locationIds : [],
      scope_include_sublocations: v.includeSub, certificate_template_id: v.certTemplateId || null,
      asset_ids: v.selectedIds,
      type_templates: v.usedTypeIds.map((t) => ({ asset_type_id: t, checklist_template_id: v.templateFor(t) })),
    });
    return v.selectedIds.length;
  },
  setCertificateTemplate: (orgId: string | null, planId: string, templateId: string | null) =>
    repo.setCertificateTemplate(need(orgId), planId, templateId),
  setActive: (orgId: string | null, planId: string, active: boolean) => repo.setActive(need(orgId), planId, active),
  addAssets: async (orgId: string | null, planId: string, assetIds: string[]) => {
    if (!assetIds.length) throw new Error("Selecciona al menos un equipo");
    await repo.addAssets(need(orgId), planId, assetIds);
    return assetIds.length;
  },
  removeAsset: (orgId: string | null, planId: string, assignmentId: string) =>
    repo.removeAsset(need(orgId), planId, assignmentId),
};
