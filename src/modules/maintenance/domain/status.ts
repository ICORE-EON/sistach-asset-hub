/** Canonical domain states for the maintenance module and mappings from legacy values. */
export type PlanStatus = "active" | "paused" | "archived";
export type SessionStatus = "draft" | "in_progress" | "closed" | "reopened" | "cancelled";
export type SessionOutcome = "ok" | "with_incidents" | "partial" | "not_performed";
export type ItemResult = "pending" | "ok" | "failed" | "not_applicable" | "skipped";
export type IncidentStatus = "open" | "in_progress" | "resolved" | "closed" | "cancelled";
export type CertificateItemResult = "ok" | "conditional" | "failed" | "na";

/** Legacy maintenance_items.result -> canonical ItemResult. */
export function toItemResult(legacy: string | null | undefined): ItemResult {
  switch (legacy) {
    case "ok": return "ok";
    case "fail": case "failed": case "with_incident": return "failed";
    case "na": case "not_applicable": return "not_applicable";
    case "skipped": return "skipped";
    default: return "pending";
  }
}

/** Canonical item result -> value accepted by certificate_items_result_chk. */
export function toCertificateItemResult(r: ItemResult): CertificateItemResult {
  switch (r) {
    case "ok": return "ok";
    case "failed": return "failed";
    case "not_applicable": return "na";
    default: return "conditional"; // pending / skipped = not reviewed
  }
}

export function computeSessionOutcome(items: ItemResult[]): SessionOutcome {
  if (!items.length) return "not_performed";
  const reviewed = items.filter((r) => r !== "pending" && r !== "skipped");
  if (!reviewed.length) return "not_performed";
  if (reviewed.some((r) => r === "failed")) return "with_incidents";
  if (reviewed.length < items.length) return "partial";
  return "ok";
}
