/**
 * Maintenance session use-cases and org-scoped query keys (orgId always at position 1).
 * Messages, order of validations and results are identical to the previous inline screens.
 */
import { checklistsRepo, legacyIntegrations as legacy, sessionsRepo as repo } from "../adapters/standalone/repos";
import { itemResultFor } from "../domain/session-rules";

export const sessionKeys = {
  list: (orgId: string | null, status: string) => ["maintenance-sessions", orgId, status] as const,
  lists: (orgId: string | null) => ["maintenance-sessions", orgId] as const,
  detail: (orgId: string | null, id: string) => ["session", orgId, id] as const,
  items: (orgId: string | null, id: string) => ["session-items", orgId, id] as const,
  certificate: (orgId: string | null, id: string) => ["session-cert", orgId, id] as const,
  plansForSession: (orgId: string | null) => ["plans-for-session", orgId] as const,
  planLocations: (orgId: string | null, planId: string) => ["plan-locations", orgId, planId] as const,
  assetHistory: (orgId: string | null, assetId: string) => ["asset-maintenance", orgId, assetId] as const,
};

const need = (orgId: string | null | undefined): string => {
  if (!orgId) throw new Error("Sin empresa activa");
  return orgId;
};

type Question = { id: string; prompt: string; creates_incident: boolean };

export const sessionService = {
  listSessions: (orgId: string | null, status: string) => repo.listSessions(need(orgId), status),
  getSession: async (orgId: string | null, id: string) => {
    const s = await repo.getSession(need(orgId), id);
    if (!s) throw new Error("Sesión no encontrada");
    return s;
  },
  listItems: (orgId: string | null, id: string) => repo.listItems(need(orgId), id),
  listPlansForSession: (orgId: string | null) => repo.listPlansForSession(need(orgId)),
  listPlanLocations: (orgId: string | null, planId: string) => repo.listPlanLocations(need(orgId), planId),
  listAssetHistory: (orgId: string | null, assetId: string) => repo.listAssetHistory(need(orgId), assetId),
  getSessionCertificate: (orgId: string | null, id: string) => legacy.findSessionCertificate(need(orgId), id),

  createSession: (orgId: string | null, v: { requestId: string; planId: string; locationId: string; scheduledFor: string; technicianName: string }) => {
    if (!v.planId) throw new Error("Selecciona un plan");
    return repo.createSession(need(orgId), {
      requestId: v.requestId, planId: v.planId, locationId: v.locationId || null,
      scheduledFor: v.scheduledFor || null, technicianName: v.technicianName || null,
    });
  },
  startSession: (orgId: string | null, id: string) => repo.startSession(need(orgId), id),

  /** Saves the item result; opens incidents for failed answers flagged creates_incident (block-5 residual). */
  completeItem: async (orgId: string | null, a: {
    sessionId: string; item: { id: string; asset_id: string }; intent: "complete" | "na";
    observations: string; questions: Question[];
  }) => {
    const org = need(orgId);
    const it = await repo.assertItemWritable(org, a.sessionId, a.item.id);
    let createdIncidents = 0, failsWithoutIncident = 0, failCount = 0;
    if (a.intent === "complete") {
      // Fresh answers from the database, never the cache.
      const fresh = await checklistsRepo.listResponses(org, a.item.id);
      const fails = fresh.filter((r) => r.is_fail);
      failCount = fails.length;
      const withIncident = fails.filter((r) => a.questions.find((q) => q.id === r.question_id)?.creates_incident);
      failsWithoutIncident = fails.length - withIncident.length;
      createdIncidents = await legacy.openIncidentsForFailures(org, { id: it.id, asset_id: it.asset_id },
        withIncident.map((r) => ({ id: r.id, observations: r.observations, prompt: a.questions.find((q) => q.id === r.question_id)?.prompt })));
    }
    const dbResult = itemResultFor(a.intent, failCount);
    await repo.setItemResult(org, a.sessionId, a.item.id, dbResult, a.observations || null, failCount);
    return { dbResult, createdIncidents, failsWithoutIncident };
  },

  /**
   * Close and sign. Idempotent: a repeated close does not re-close; it only emits the certificate if
   * the first attempt closed the session but failed before the certificate existed.
   */
  closeSession: async (orgId: string | null, sessionId: string, v: { signerName: string; signerRole: string; signature: string | null }) => {
    if (!v.signerName.trim()) throw new Error("Indica el nombre del firmante");
    if (!v.signature) throw new Error("Firma para continuar");
    const org = need(orgId);
    const signer = { signerName: v.signerName.trim(), signerRole: v.signerRole.trim() || null, signature: v.signature };
    const r = await repo.closeSession(org, sessionId, signer);
    const plan = r.session.maintenance_plans as { name: string; interval_months: number | null; asset_families: { requires_certificate: boolean } | null } | null;
    if (plan?.asset_families?.requires_certificate === false) return { cert: null, pdfFailed: false };
    if (!r.closedNow) {
      const existing = await legacy.findSessionCertificate(org, sessionId);
      if (existing) return { cert: { id: existing.id, code: existing.code }, pdfFailed: false };
      if (r.session.status !== "closed") throw new Error("La sesión ya se ha cerrado en otro dispositivo");
    }
    return legacy.emitSessionCertificate(org, {
      sessionId, sessionCode: r.session.code, planName: plan?.name ?? null, intervalMonths: plan?.interval_months ?? null,
      signerName: r.closedNow ? signer.signerName : (r.session.signer_name ?? signer.signerName),
      signerRole: r.closedNow ? signer.signerRole : (r.session.signer_role ?? signer.signerRole),
      signature: r.closedNow ? signer.signature : (r.session.signature_image_url ?? signer.signature),
      pendingCount: r.pendingCount, items: r.items,
    });
  },
};
