/**
 * Corrective maintenance (Bloque 2B) contract: unplanned repairs of one asset.
 * Optional capability; every call receives the org explicitly. The server (RPC/RLS) decides
 * permissions, dates and transitions; closing never touches preventive due dates or certificates,
 * and never changes a linked incident.
 */
export type CorrectivePriority = "low" | "normal" | "high";
export type CorrectiveOutcome = "repaired" | "not_repaired" | "replaced";

export type NewCorrective = {
  assetId: string;
  detectedOn: string; // yyyy-mm-dd
  priority: CorrectivePriority;
  description: string;
  incidentId: string | null;
  external: boolean;
  provider: string | null;
  technicianName: string | null;
  /** Optional, off by default; requires asset-management permission on the server. */
  markOutOfService: boolean;
  requestId: string;
};

export type CorrectiveClose = {
  performedOn: string; // effective completion date of the work
  outcome: CorrectiveOutcome;
  observations: string | null;
  provider: string | null;
  reference: string | null;
  /** Only for "repaired"; requires asset-management permission on the server. */
  reactivate: boolean;
};

/** Editable description only; optimistic token prevents overwriting another user's changes. */
export type CorrectiveEdit = {
  expectedUpdatedAt: string;
  description: string;
  priority: CorrectivePriority;
  external: boolean;
  provider: string | null;
  technicianName: string | null;
};

export type CorrectiveRow = {
  id: string; code: string; status: string; priority: CorrectivePriority; detected_on: string;
  fault_description: string; outcome: string | null; closed_at: string | null; is_external: boolean;
  external_provider: string | null; technician_name: string | null; incident_id: string | null;
  asset: { id: string; code: string; name: string | null; status: string } | null;
  incident: { id: string; code: string; title: string; status: string } | null;
  completed_at: string | null; observations: string | null; closed_by_name: string | null;
  updated_at: string;
  cancellation_reason: string | null;
};

export type CorrectiveEntry = { id: string; performed_on: string; body: string; author_name: string | null; created_at: string };

export interface CorrectiveRepository {
  list(orgId: string, filter: { open?: boolean; assetId?: string }): Promise<CorrectiveRow[]>;
  get(orgId: string, sessionId: string): Promise<CorrectiveRow | null>;
  listEntries(orgId: string, sessionId: string): Promise<CorrectiveEntry[]>;
  create(orgId: string, v: NewCorrective): Promise<{ id: string; code: string }>;
  update(orgId: string, sessionId: string, v: CorrectiveEdit): Promise<void>;
  addEntry(orgId: string, sessionId: string, performedOn: string, text: string): Promise<void>;
  linkIncident(orgId: string, sessionId: string, incidentId: string | null): Promise<void>;
  close(orgId: string, sessionId: string, v: CorrectiveClose): Promise<{ closedNow: boolean; reactivated: boolean }>;
}
