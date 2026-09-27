/**
 * Incident rules exactly as the current screens apply them. Pure: no Supabase, React, File or Blob.
 */
export const INCIDENT_SEVERITIES = ["low", "medium", "high", "critical"] as const;

/** Transitions offered today by the detail screen ("Resolver" is open|in_progress → resolved). */
const TRANSITIONS: Record<string, readonly string[]> = {
  open: ["in_progress", "resolved"],
  in_progress: ["open", "resolved"],
  resolved: ["closed", "in_progress"],
  closed: ["in_progress"],
  // Legacy values accepted by the database but never offered by the app: no transitions.
  acknowledged: [],
  cancelled: [],
};

export function canTransitionIncident(from: string, to: string): boolean {
  return (TRANSITIONS[from] ?? []).includes(to);
}

export function assertIncidentTransition(from: string, to: string): void {
  if (!canTransitionIncident(from, to)) throw new Error(`Transición no permitida: ${from} → ${to}`);
}

export const isIncidentClosed = (status: string) => status === "closed" || status === "cancelled";

/** Same patch as before: stamps resolved_at / closed_at, and resolution notes when resolving. */
export function transitionPatch(to: string, now: string, resolutionNotes?: string) {
  const p: { status: string; resolved_at?: string; closed_at?: string; resolution_notes?: string } = { status: to };
  if (to === "resolved") { p.resolved_at = now; if (resolutionNotes !== undefined) p.resolution_notes = resolutionNotes; }
  if (to === "closed") p.closed_at = now;
  return p;
}

export function assertSeverity(s: string): void {
  if (!(INCIDENT_SEVERITIES as readonly string[]).includes(s)) throw new Error("Severidad no válida");
}

/** Snapshot stored in incidents.metadata.origin when created from a checklist failure. */
export type IncidentOriginSnapshot = {
  schema: 1;
  kind: "checklist_failure";
  captured_at: string;
  session: { id: string; code: string | null };
  item: { id: string };
  asset: { id: string; code: string | null; name: string | null };
  question: { id: string | null; prompt: string | null; version_id: string | null };
};

export type IncidentOrigin =
  | { kind: "none" }
  | { kind: "snapshot"; snapshot: IncidentOriginSnapshot }
  | { kind: "legacy"; reason: "pre_snapshot" | "malformed"; hasSessionLink: boolean; hasResponseLink: boolean };

/** Provenance to show: snapshot when valid; explicit legacy fallback otherwise (never invented). */
export function resolveIncidentOrigin(i: {
  source: string; metadata: unknown; source_maintenance_item_id: string | null; source_response_id: string | null;
}): IncidentOrigin {
  if (i.source !== "maintenance") return { kind: "none" };
  const origin = (i.metadata && typeof i.metadata === "object" ? (i.metadata as Record<string, unknown>).origin : undefined) as
    | Partial<IncidentOriginSnapshot> | undefined;
  const links = { hasSessionLink: !!i.source_maintenance_item_id, hasResponseLink: !!i.source_response_id };
  if (origin === undefined) return { kind: "legacy", reason: "pre_snapshot", ...links };
  const valid = origin.schema === 1 && origin.kind === "checklist_failure" && !!origin.session?.id && !!origin.asset?.id && !!origin.question;
  return valid ? { kind: "snapshot", snapshot: origin as IncidentOriginSnapshot } : { kind: "legacy", reason: "malformed", ...links };
}
