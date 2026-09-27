/**
 * Incident use-cases and org-scoped query keys (orgId always at position 1).
 */
import { incidentsRepo as repo } from "../adapters/standalone/repos";

export const incidentKeys = {
  list: (orgId: string | null, severity: string) => ["incidents", orgId, severity] as const,
  lists: (orgId: string | null) => ["incidents", orgId] as const,
  detail: (orgId: string | null, id: string) => ["incident", orgId, id] as const,
  history: (orgId: string | null, id: string) => ["incident-history", orgId, id] as const,
  members: (orgId: string | null) => ["incident-members", orgId] as const,
  assetOptions: (orgId: string | null) => ["assets-for-incident", orgId] as const,
  byAsset: (orgId: string | null, assetId: string) => ["asset-incidents", orgId, assetId] as const,
};

const need = (orgId: string | null | undefined): string => {
  if (!orgId) throw new Error("Sin empresa activa");
  return orgId;
};

export const incidentService = {
  listIncidents: (orgId: string | null, severity: string) => repo.listIncidents(need(orgId), severity),
  getIncident: (orgId: string | null, id: string) => repo.getIncident(need(orgId), id),
  listHistory: (orgId: string | null, id: string) => repo.listHistory(need(orgId), id),
  listMembers: (orgId: string | null) => repo.listMembers(need(orgId)),
  listAssetOptions: (orgId: string | null) => repo.listAssetOptions(need(orgId)),
  listAssetIncidents: (orgId: string | null, assetId: string) => repo.listAssetIncidents(need(orgId), assetId),

  createManual: async (orgId: string | null, v: { title: string; description: string; severity: string; assetId: string }) => {
    if (!v.title.trim()) throw new Error("El título es obligatorio");
    return repo.createManual(need(orgId), {
      title: v.title.trim(), description: v.description.trim() || null, severity: v.severity,
      assetId: v.assetId !== "none" ? v.assetId : null,
    });
  },

  update: (orgId: string | null, id: string, v: { title: string; description: string; severity: string; assignedTo: string; dueDate: string }) =>
    repo.update(need(orgId), id, {
      title: v.title.trim(), description: v.description.trim() || null, severity: v.severity,
      assignedTo: v.assignedTo !== "none" ? v.assignedTo : null, dueDate: v.dueDate || null,
    }),

  changeStatus: (orgId: string | null, id: string, v: { from: string; to: string; note?: string; userId: string | null }) =>
    repo.changeStatus(need(orgId), id, { from: v.from, to: v.to, note: v.note || null, userId: v.userId }),

  /** "Resolver": stores the notes and transitions to resolved in a single update (was two). */
  resolve: (orgId: string | null, id: string, v: { from: string; notes: string; userId: string | null }) =>
    repo.changeStatus(need(orgId), id, { from: v.from, to: "resolved", note: v.notes || null, userId: v.userId, resolutionNotes: v.notes }),

  remove: (orgId: string | null, id: string) => repo.remove(need(orgId), id),
};
