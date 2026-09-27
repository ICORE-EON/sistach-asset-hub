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

import { certificateResultCounts, certificateResultHasIncident } from "./certificate-results";
export const isFailResult = (r: string | null | undefined) => certificateResultHasIncident(r);

/** Outcome stored in session metadata on close; pendingCount = items marked skipped at close. */
export function legacySessionOutcome(results: string[], pendingCount: number): LegacyOutcome {
  const c = certificateResultCounts(results);
  const incomplete = pendingCount > 0 || c.skipped > 0;
  if (c.withIncidents > 0) return incomplete ? "incomplete_with_incidents" : "with_incidents";
  return incomplete ? "incomplete" : "ok";
}

/** Legacy maintenance_items.result -> certificate_items_result_chk values (single normalization). */
export { normalizeCertificateResult as legacyCertificateItemResult } from "./certificate-results";
