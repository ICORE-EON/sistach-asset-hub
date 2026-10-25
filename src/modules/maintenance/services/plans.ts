/**
 * Maintenance plan use-cases and org-scoped query keys (orgId always at position 1).
 * Validation messages and order are identical to the previous inline dialogs.
 */
import { getRepositories } from "../contracts/registry";
import type { ScopeQuery } from "../contracts/repositories";
import { addMonthsClamped, isCalendarDate } from "../domain/due-date";

/** Resolved per call from the registered host adapter (no org/user state is kept). */
const repo = () => getRepositories().plans;

export type { ScopeQuery };

export const FREQUENCIES = [
  { value: "monthly", label: "Mensual", months: 1 },
  { value: "quarterly", label: "Trimestral", months: 3 },
  { value: "biannual", label: "Semestral", months: 6 },
  { value: "annual", label: "Anual", months: 12 },
  { value: "custom", label: "Cada X años", months: null },
];

/** Etiqueta legible de la frecuencia de un plan (custom = cada N años). */
export const planFrequencyLabel = (frequency: string, intervalMonths?: number | null): string => {
  if (frequency === "custom") {
    const years = Math.max(1, Math.round((intervalMonths ?? 12) / 12));
    return years === 1 ? "Cada año" : `Cada ${years} años`;
  }
  return FREQUENCIES.find((f) => f.value === frequency)?.label ?? frequency;
};

export const planKeys = {
  list: (orgId: string | null) => ["maintenance-plans", orgId] as const,
  detail: (orgId: string | null, id: string) => ["plan", orgId, id] as const,
  scopeCounts: (orgId: string | null) => ["plan-scope-counts", orgId] as const,
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
  executionMode?: "internal" | "external"; defaultProvider?: string;
  /** Número de años cuando frequency === "custom". */
  customYears?: number;
  /** Primera fecha común para todos los equipos (fecha directa o calculada desde la última revisión); vacío = sin programar. */
  initialDue?: string | null;
};

export const planService = {
  listPlans: (orgId: string | null) => repo().listPlans(need(orgId)),
  getPlan: async (orgId: string | null, id: string) => {
    const p = await repo().getPlan(need(orgId), id);
    if (!p) throw new Error("Plan no encontrado");
    return p;
  },
  listPlanScopeCounts: (orgId: string | null) => repo().listPlanScopeCounts(need(orgId)),
  listPlanAssets: (orgId: string | null, planId: string) => repo().listPlanAssets(need(orgId), planId),
  listCertificateTemplates: (orgId: string | null, orderBy: "name" | "code") =>
    repo().listCertificateTemplates(need(orgId), orderBy),
  listScopeAssets: (orgId: string | null, q: ScopeQuery) => repo().listScopeAssets(need(orgId), q),

  createPlan: async (orgId: string | null, v: CreatePlanInput) => {
    if (!orgId) throw new Error("Sin empresa activa");
    if (!v.code || !v.name || !v.familyId) throw new Error("Completa los campos obligatorios");
    if (!v.selectedIds.length) throw new Error("Selecciona al menos un equipo");
    const external = v.executionMode === "external";
    if (!external && v.usedTypeIds.some((id) => !v.templateFor(id)))
      throw new Error("Hay tipos de activo sin plantilla de checklist publicada");
    const freq = FREQUENCIES.find((f) => f.value === v.frequency);
    const intervalMonths =
      v.frequency === "custom"
        ? Math.max(1, Math.round(v.customYears ?? 0)) * 12
        : (freq?.months ?? null);
    if (v.frequency === "custom" && !intervalMonths) throw new Error("Indica cada cuántos años se repite");
    await repo().createPlan(orgId, {
      code: v.code.toUpperCase(), name: v.name, asset_family_id: v.familyId, frequency: v.frequency,
      interval_months: intervalMonths, notes: v.notes || null, scope_mode: v.scopeMode,
      scope_location_ids: v.scopeMode === "scoped" ? v.locationIds : [],
      scope_include_sublocations: v.includeSub, certificate_template_id: v.certTemplateId || null,
      asset_ids: v.selectedIds,
      execution_mode: external ? "external" : "internal", default_provider: external ? v.defaultProvider?.trim() || null : null,
      type_templates: external ? [] : v.usedTypeIds.map((t) => ({ asset_type_id: t, checklist_template_id: v.templateFor(t) })),
      initial_due: v.initialDue || null,
    });
    return v.selectedIds.length;
  },
  setCertificateTemplate: (orgId: string | null, planId: string, templateId: string | null) =>
    repo().setCertificateTemplate(need(orgId), planId, templateId),
  setActive: (orgId: string | null, planId: string, active: boolean) => repo().setActive(need(orgId), planId, active),
  addAssets: async (orgId: string | null, planId: string, assetIds: string[], initialDue?: string | null) => {
    if (!assetIds.length) throw new Error("Selecciona al menos un equipo");
    if (initialDue) await repo().addAssets(need(orgId), planId, assetIds, initialDue);
    else await repo().addAssets(need(orgId), planId, assetIds);
    return assetIds.length;
  },
  removeAsset: (orgId: string | null, planId: string, assignmentId: string) =>
    repo().removeAsset(need(orgId), planId, assignmentId),
  /**
   * Programar / reprogramar: misma fecha para un lote con excepciones por equipo. Solo envía lo que cambia.
   * El motivo es obligatorio si se modifica una fecha ya establecida (la base de datos lo exige igualmente).
   */
  setDue: async (orgId: string | null, rows: Array<{ planAssetId: string; current: string | null; due: string | null }>, reason: string) => {
    const changes = rows.filter((r) => (r.due || null) !== (r.current || null));
    if (!changes.length) throw new Error("No hay cambios de fecha");
    if (changes.some((r) => r.due && !isCalendarDate(r.due))) throw new Error("Fecha no válida");
    if (changes.some((r) => r.current) && !reason.trim()) throw new Error("Indica el motivo del cambio de fecha");
    return repo().setDue(need(orgId), changes.map((r) => ({ planAssetId: r.planAssetId, due: r.due || null })), reason.trim() || null);
  },
  /** Primera fecha sugerida desde la última revisión: última + intervalo del plan. */
  dueFromLastReview: (lastReview: string, months: number | null) => (months && isCalendarDate(lastReview) ? addMonthsClamped(lastReview, months) : null),
};
