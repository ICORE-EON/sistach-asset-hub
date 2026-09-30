/**
 * Metrology use-cases and org-scoped query keys (orgId always at position 1).
 * TypeScript checks here are UX only; the database operations decide transitions.
 */
import { getRepositories } from "../contracts/registry";
import type { MtrControlPlanInput, MtrEquipmentInput, MtrImpactCloseInput, MtrRecordDraft } from "../contracts/metrology";
import {
  validateImpactClose, validateUnfitDecision, type MtrStoredStatus, type MtrUnfitDecision,
} from "../domain/metrology";

const repo = () => {
  const m = getRepositories().metrology;
  if (!m) throw new Error("Mantenimiento: el adaptador registrado no ofrece equipos de medida");
  return m;
};
const need = (orgId: string | null | undefined): string => {
  if (!orgId) throw new Error("Sin empresa activa");
  return orgId;
};
const fail = (errs: string[]) => { if (errs.length) throw new Error(errs.join(". ")); };

export const metrologyKeys = {
  all: (orgId: string | null) => ["mtr", orgId] as const,
  equipment: (orgId: string | null) => ["mtr", orgId, "equipment"] as const,
  detail: (orgId: string | null, id: string) => ["mtr", orgId, "equipment", id] as const,
  plans: (orgId: string | null, id: string) => ["mtr", orgId, "plans", id] as const,
  records: (orgId: string | null, id: string) => ["mtr", orgId, "records", id] as const,
  lines: (orgId: string | null, recordId: string) => ["mtr", orgId, "lines", recordId] as const,
  impacts: (orgId: string | null, id: string | null) => ["mtr", orgId, "impacts", id] as const,
  history: (orgId: string | null, id: string) => ["mtr", orgId, "history", id] as const,
};

export const metrologyService = {
  listEquipment: (orgId: string | null) => repo().listEquipment(need(orgId)),
  getEquipment: (orgId: string | null, id: string) => repo().getEquipment(need(orgId), id),
  createEquipment: (orgId: string | null, v: MtrEquipmentInput) => {
    fail([!v.name?.trim() && "El nombre es obligatorio", !v.equipmentType?.trim() && "El tipo es obligatorio", !v.siteId && "El site es obligatorio"].filter(Boolean) as string[]);
    return repo().createEquipment(need(orgId), { ...v, name: v.name.trim(), equipmentType: v.equipmentType.trim() });
  },
  updateEquipment: (orgId: string | null, id: string, v: Partial<MtrEquipmentInput>) => repo().updateEquipment(need(orgId), id, v),
  listPlans: (orgId: string | null, equipmentId: string) => repo().listPlans(need(orgId), equipmentId),
  savePlan: (orgId: string | null, equipmentId: string, planId: string | null, v: MtrControlPlanInput) => {
    fail(v.frequencyUnit !== "before_use" && !(v.frequencyValue && v.frequencyValue > 0) ? ["La frecuencia debe ser mayor que 0"] : []);
    return repo().savePlan(need(orgId), equipmentId, planId, v);
  },
  listRecords: (orgId: string | null, equipmentId: string) => repo().listRecords(need(orgId), equipmentId),
  getRecordLines: (orgId: string | null, recordId: string) => repo().getRecordLines(need(orgId), recordId),
  saveDraft: (orgId: string | null, equipmentId: string, recordId: string | null, v: MtrRecordDraft) => {
    fail(v.nextDueOverride && !v.overrideReason?.trim() ? ["El ajuste de próxima fecha requiere motivo"] : []);
    return repo().saveDraft(need(orgId), equipmentId, recordId, v);
  },
  validateRecord: (orgId: string | null, recordId: string) => repo().validateRecord(need(orgId), recordId),
  rectifyRecord: (orgId: string | null, recordId: string, reason: string) => {
    fail(!reason?.trim() ? ["La rectificación requiere motivo"] : []);
    return repo().rectifyRecord(need(orgId), recordId, reason.trim());
  },
  decideUnfit: (orgId: string | null, recordId: string, decision: MtrUnfitDecision, notes: string | null, allowedUses: string | null) => {
    fail(validateUnfitDecision(decision, allowedUses));
    return repo().decideUnfit(need(orgId), recordId, decision, notes, allowedUses);
  },
  listImpactReviews: (orgId: string | null, equipmentId: string | null) => repo().listImpactReviews(need(orgId), equipmentId),
  closeImpact: (orgId: string | null, reviewId: string, v: MtrImpactCloseInput) => {
    fail(validateImpactClose({ conclusion: v.conclusion, justification: v.justification, actions: v.actions, externalRefId: v.externalRef?.id ?? null } as never));
    return repo().closeImpact(need(orgId), reviewId, v);
  },
  moveSite: (orgId: string | null, equipmentId: string, siteId: string, locationDetail: string | null, note: string | null) => {
    fail(!siteId ? ["El site es obligatorio"] : []);
    return repo().moveSite(need(orgId), equipmentId, siteId, locationDetail, note);
  },
  setStatus: (orgId: string | null, equipmentId: string, status: MtrStoredStatus, reason: string) => {
    fail(!reason?.trim() ? ["El cambio de estado requiere motivo"] : []);
    return repo().setStatus(need(orgId), equipmentId, status, reason.trim());
  },
  listHistory: (orgId: string | null, equipmentId: string) => repo().listHistory(need(orgId), equipmentId),
};
