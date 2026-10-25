/**
 * Corrective (2B) repository over maintenance_sessions(kind='corrective') + mnt_session_entries.
 * Reads are always filtered by company; all writes go through the mnt_sa_* RPCs (server authority).
 */
import type { StandaloneClient } from "../client";
import type { CorrectiveClose, CorrectiveEntry, CorrectiveRepository, CorrectiveRow, NewCorrective } from "../../../contracts/corrective";

const ok = <T>(r: { data: T; error: unknown }): T => { if (r.error) throw r.error; return r.data; };

const SELECT = `id, code, status, priority, detected_on, fault_description, outcome, closed_at, is_external,
  external_provider, technician_name, incident_id, metadata,
  incidents!maintenance_sessions_incident_id_fkey(id, code, title, status),
  maintenance_items(completed_at, observations, assets(id, code, name, status))`;

type Raw = {
  id: string; code: string; status: string; priority: string | null; detected_on: string | null; fault_description: string | null;
  outcome: string | null; closed_at: string | null; is_external: boolean; external_provider: string | null; technician_name: string | null;
  incident_id: string | null; metadata: unknown;
  incidents: { id: string; code: string; title: string; status: string } | null;
  maintenance_items: { completed_at: string | null; observations: string | null; assets: { id: string; code: string; name: string | null; status: string } | null }[];
};

const map = (r: Raw): CorrectiveRow => {
  const it = r.maintenance_items?.[0];
  const meta = (r.metadata ?? {}) as { corrective_close?: { by_name?: string | null } };
  return {
    id: r.id, code: r.code, status: r.status, priority: (r.priority ?? "normal") as CorrectiveRow["priority"],
    detected_on: r.detected_on ?? "", fault_description: r.fault_description ?? "", outcome: r.outcome, closed_at: r.closed_at,
    is_external: r.is_external, external_provider: r.external_provider, technician_name: r.technician_name, incident_id: r.incident_id,
    asset: it?.assets ?? null, incident: r.incidents ?? null, completed_at: it?.completed_at ?? null,
    observations: it?.observations ?? null, closed_by_name: meta.corrective_close?.by_name ?? null,
  };
};

export function createCorrectiveRepo(c: StandaloneClient): CorrectiveRepository {
  return {
    async list(orgId, filter) {
      let q = c.from("maintenance_sessions").select(SELECT).eq("company_id", orgId).eq("kind", "corrective")
        .order("detected_on", { ascending: false }).limit(500);
      if (filter.open) q = q.in("status", ["draft", "in_progress"]);
      const rows = (ok(await q) ?? []) as unknown as Raw[];
      const out = rows.map(map);
      return filter.assetId ? out.filter((r) => r.asset?.id === filter.assetId) : out;
    },
    async get(orgId, id) {
      const r = ok(await c.from("maintenance_sessions").select(SELECT).eq("company_id", orgId).eq("kind", "corrective").eq("id", id).maybeSingle());
      return r ? map(r as unknown as Raw) : null;
    },
    async listEntries(orgId, id): Promise<CorrectiveEntry[]> {
      return (ok(await c.from("mnt_session_entries").select("id, performed_on, body, author_name, created_at")
        .eq("company_id", orgId).eq("session_id", id).order("performed_on").order("created_at")) ?? []) as CorrectiveEntry[];
    },
    async create(orgId, v: NewCorrective) {
      const r = ok(await c.rpc("mnt_sa_create_corrective", {
        p_company: orgId, p_asset: v.assetId, p_detected_on: v.detectedOn, p_priority: v.priority, p_description: v.description,
        p_incident: v.incidentId ?? undefined, p_external: v.external, p_provider: v.provider ?? undefined,
        p_technician_name: v.technicianName ?? undefined, p_mark_out_of_service: v.markOutOfService, p_request_id: v.requestId,
      })) as { id: string; code: string };
      return { id: r.id, code: r.code };
    },
    async addEntry(orgId, id, performedOn, text) {
      ok(await c.rpc("mnt_sa_add_entry", { p_company: orgId, p_session: id, p_performed_on: performedOn, p_text: text }));
    },
    async linkIncident(orgId, id, incidentId) {
      ok(await c.rpc("mnt_sa_link_incident", { p_company: orgId, p_session: id, p_incident: incidentId as string }));
    },
    async close(orgId, id, v: CorrectiveClose) {
      const r = ok(await c.rpc("mnt_sa_close_corrective", {
        p_company: orgId, p_session: id, p_performed_on: v.performedOn, p_outcome: v.outcome,
        p_observations: v.observations ?? undefined, p_provider: v.provider ?? undefined, p_reference: v.reference ?? undefined,
        p_reactivate: v.reactivate,
      })) as { closed_now?: boolean; reactivated?: boolean } | null;
      return { closedNow: !!r?.closed_now, reactivated: !!r?.reactivated };
    },
  };
}
