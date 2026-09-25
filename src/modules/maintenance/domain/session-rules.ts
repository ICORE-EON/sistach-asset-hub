/**
 * Session state machine and result rules, exactly as the current screens apply them.
 * Pure: no Supabase, React, File or Blob.
 */
export type LegacySessionStatus = "draft" | "in_progress" | "closed" | "cancelled";
export type LegacyItemResult = "pending" | "ok" | "with_incident" | "fail" | "not_applicable" | "na" | "skipped";
export type LegacyOutcome = "ok" | "with_incidents" | "incomplete" | "incomplete_with_incidents";

/** Only transitions the app performs today. Everything else is rejected. */
const TRANSITIONS: Record<string, readonly string[]> = {
  draft: ["in_progress"],
  in_progress: ["closed"],
  closed: [],
  cancelled: [],
};

export function canTransition(from: string, to: string): boolean {
  return (TRANSITIONS[from] ?? []).includes(to);
}

export function assertTransition(from: string, to: string): void {
  if (!canTransition(from, to)) {
    if (from === "closed" || from === "cancelled") throw new Error("La sesión está cerrada");
    throw new Error(`Transición no permitida: ${from} → ${to}`);
  }
}

export const isSessionLocked = (status: string) => status === "closed" || status === "cancelled";

/** Item result when the technician saves the checklist (same rule as before). */
export function itemResultFor(intent: "complete" | "na", failCount: number): "ok" | "with_incident" | "not_applicable" {
  if (intent === "na") return "not_applicable";
  return failCount > 0 ? "with_incident" : "ok";
}

export const isFailResult = (r: string | null | undefined) => r === "with_incident" || r === "fail";

/** Outcome stored in session metadata on close; pendingCount = items marked skipped at close. */
export function legacySessionOutcome(results: string[], pendingCount: number): LegacyOutcome {
  const hasIncidents = results.some(isFailResult);
  if (hasIncidents) return pendingCount > 0 ? "incomplete_with_incidents" : "with_incidents";
  return pendingCount > 0 ? "incomplete" : "ok";
}

/** Legacy maintenance_items.result -> certificate_items_result_chk values (unchanged mapping). */
export function legacyCertificateItemResult(r: string | null | undefined): "ok" | "conditional" | "failed" | "na" {
  switch (r) {
    case "ok": return "ok";
    case "with_incident": case "conditional": return "conditional";
    case "fail": case "failed": return "failed";
    case "na": case "n/a": case "skipped": return "na";
    default: return "ok";
  }
}
