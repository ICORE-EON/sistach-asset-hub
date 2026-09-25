/**
 * Checklist use-cases and org-scoped query keys. Every key has orgId at position 1.
 * Template selection priority stays in domain/checklist-scope (unchanged).
 */
import { checklistsRepo as repo } from "../adapters/standalone/repos";
import type { NewQuestion, ResponseInput, TemplateScopeInput } from "../data/checklists.repo";

export type { NewQuestion, ResponseInput, TemplateScopeInput };

export const checklistKeys = {
  list: (orgId: string | null) => ["checklist-templates", orgId] as const,
  detail: (orgId: string | null, id: string) => ["template", orgId, id] as const,
  scope: (orgId: string | null, id: string) => ["template-scope", orgId, id] as const,
  versions: (orgId: string | null, id: string) => ["template-versions", orgId, id] as const,
  questions: (orgId: string | null, versionId: string | null | undefined) => ["questions", orgId, versionId] as const,
  itemQuestions: (orgId: string | null, versionId: string) => ["item-questions", orgId, versionId] as const,
  itemResponses: (orgId: string | null, itemId: string) => ["item-responses", orgId, itemId] as const,
  published: (orgId: string | null) => ["published-templates", orgId] as const,
};

const need = (orgId: string | null | undefined): string => {
  if (!orgId) throw new Error("Sin empresa activa");
  return orgId;
};

export const checklistService = {
  listTemplates: (orgId: string | null) => repo.listTemplates(need(orgId)),
  getTemplate: async (orgId: string | null, id: string) => {
    const t = await repo.getTemplate(need(orgId), id);
    if (!t) throw new Error("Plantilla no encontrada");
    return t;
  },
  getTemplateScope: async (orgId: string | null, id: string) => {
    const s = await repo.getTemplateScope(need(orgId), id);
    if (!s) throw new Error("Plantilla no encontrada");
    return s as unknown as { asset_family_id: string | null; asset_type_ids: string[] | null; location_ids: string[] | null; include_sublocations: boolean | null };
  },
  /** Same validation messages and order as the previous inline dialog. */
  createTemplate: (orgId: string | null, v: {
    code: string; name: string; familyId: string; allTypes: boolean; typeIds: string[];
    allLocations: boolean; locationIds: string[]; includeSub: boolean; description: string;
  }) => {
    const org = need(orgId);
    if (!v.code || !v.name || !v.familyId) throw new Error("Completa los campos obligatorios");
    const types = v.allTypes ? [] : v.typeIds;
    if (!v.allTypes && !types.length) throw new Error("Selecciona al menos un tipo de activo");
    const locs = v.allLocations ? [] : v.locationIds;
    if (!v.allLocations && !locs.length) throw new Error("Selecciona al menos un centro");
    return repo.createTemplate(org, {
      code: v.code.toUpperCase(), name: v.name, asset_family_id: v.familyId, asset_type_ids: types,
      location_ids: locs, include_sublocations: v.includeSub, description: v.description || null,
    });
  },
  updateTemplateScope: (orgId: string | null, id: string, v: TemplateScopeInput) =>
    repo.updateTemplateScope(need(orgId), id, v),
  listPublishedTemplates: (orgId: string | null) => repo.listPublishedTemplates(need(orgId)),

  listVersions: (orgId: string | null, templateId: string) => repo.listVersions(need(orgId), templateId),
  latestPublishedVersions: (orgId: string | null, templateIds: string[]) =>
    repo.latestPublishedVersions(need(orgId), templateIds),
  publishVersion: (orgId: string | null, templateId: string, versionId: string, version: number) =>
    repo.publishVersion(need(orgId), templateId, versionId, version),
  createVersion: (orgId: string | null, templateId: string, next: number, cloneFrom: string | null) =>
    repo.createVersion(need(orgId), templateId, next, cloneFrom),

  listQuestions: (orgId: string | null, versionId: string) => repo.listQuestions(need(orgId), versionId),
  addQuestion: (orgId: string | null, versionId: string, q: NewQuestion) => {
    if (!q.prompt.trim()) throw new Error("Escribe la pregunta");
    return repo.addQuestion(need(orgId), versionId, { ...q, prompt: q.prompt.trim() });
  },
  deleteQuestion: (orgId: string | null, versionId: string, questionId: string) =>
    repo.deleteQuestion(need(orgId), versionId, questionId),

  listResponses: (orgId: string | null, itemId: string) => repo.listResponses(need(orgId), itemId),
  saveResponse: (orgId: string | null, itemId: string, versionId: string, r: ResponseInput) =>
    repo.saveResponse(need(orgId), itemId, versionId, r),
};
