/**
 * Single result rule for certificates: normalization, labels, incident counting and completeness.
 * Pure: no imports. Every screen, summary, counter, history tab and the PDF go through here.
 *
 * Accepted inputs → canonical result:
 *   ok                                   → ok           «OK»
 *   conditional, with_incident           → conditional  «Con incidencia»  (incident)
 *   failed, fail                         → failed       «Fallo»           (incident)
 *   na, n/a, not_applicable              → na           «N/A»   (reviewed, does not apply)
 *   skipped, pending, empty, unknown     → skipped      «Sin revisar»     (NOT reviewed → incomplete)
 *
 * skipped and na are different: na is a reviewed item that does not apply; skipped was never reviewed.
 * Unknown values are never promoted to OK or N/A.
 *
 * Storage: certificate_items_result_chk only accepts ok/conditional/failed/na (schema unchanged in this
 * phase), so skipped is stored as "na" in that column and its true value comes from the linked
 * maintenance item (or the certificate snapshot). resolveCertificateItemResult applies that precedence.
 */
export type CertificateResult = "ok" | "conditional" | "failed" | "na" | "skipped";

export function normalizeCertificateResult(r: string | null | undefined): CertificateResult {
  switch (r) {
    case "ok": return "ok";
    case "with_incident": case "conditional": return "conditional";
    case "fail": case "failed": return "failed";
    case "na": case "n/a": case "not_applicable": return "na";
    default: return "skipped";
  }
}

/** Value written to certificate_items.result (constraint-compatible). */
export function storedCertificateResult(r: string | null | undefined): "ok" | "conditional" | "failed" | "na" {
  const n = normalizeCertificateResult(r);
  return n === "skipped" ? "na" : n;
}

/**
 * Canonical result of a certificate item. `source` is the historical result (snapshot item or linked
 * maintenance item). A source "skipped" always wins, because the stored column cannot express it.
 * Without a source, the stored value is used as is.
 */
export function resolveCertificateItemResult(stored: string | null | undefined, source?: string | null): CertificateResult {
  if (source != null && normalizeCertificateResult(source) === "skipped" && (stored === "na" || stored == null)) return "skipped";
  if (stored == null && source != null) return normalizeCertificateResult(source);
  return normalizeCertificateResult(stored);
}

export const CERTIFICATE_RESULT_LABELS: Record<CertificateResult, string> = {
  ok: "OK",
  conditional: "Con incidencia",
  failed: "Fallo",
  na: "N/A",
  skipped: "Sin revisar",
};

export const certificateResultLabel = (r: string | null | undefined) =>
  CERTIFICATE_RESULT_LABELS[normalizeCertificateResult(r)];

/** Counts in «Con incidencias»: conditional and failed. Never skipped or na. */
export const certificateResultHasIncident = (r: string | null | undefined) => {
  const n = normalizeCertificateResult(r);
  return n === "conditional" || n === "failed";
};

export type CertificateResultCounts = {
  total: number; ok: number; conditional: number; failed: number; withIncidents: number;
  na: number; skipped: number; reviewed: number; complete: boolean;
};

/** Counters and completeness. Complete = every item reviewed (no skipped). Empty lists are incomplete. */
export function certificateResultCounts(results: Array<string | null | undefined>): CertificateResultCounts {
  const c = { total: results.length, ok: 0, conditional: 0, failed: 0, withIncidents: 0, na: 0, skipped: 0, reviewed: 0, complete: false };
  for (const r of results) c[normalizeCertificateResult(r)]++;
  c.withIncidents = c.conditional + c.failed;
  c.reviewed = c.total - c.skipped;
  c.complete = c.total > 0 && c.skipped === 0;
  return c;
}

/** One-line summary used by the detail screen and the PDF. */
export function certificateResultSummary(results: Array<string | null | undefined>): string {
  const c = certificateResultCounts(results);
  const parts = [`${c.ok} OK`, `${c.conditional} con incidencia`, `${c.failed} con fallo`, `${c.na} N/A`, `${c.skipped} sin revisar`];
  return `${c.total} equipo(s): ${parts.join(" · ")}. ${c.complete ? "Mantenimiento completo" : "Mantenimiento incompleto"}.`;
}
