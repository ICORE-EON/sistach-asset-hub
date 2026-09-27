/**
 * Single normalization of certificate item results. Pure: no imports.
 * Every screen, summary, counter and the PDF go through here so no case can diverge.
 *
 * Accepted inputs → canonical certificate result (certificate_items_result_chk values):
 *   ok                                   → ok
 *   conditional, with_incident           → conditional   (reviewed with incidents)
 *   failed, fail                         → failed        (reviewed with incidents)
 *   na, n/a, not_applicable, skipped     → na
 *   anything else / empty / pending      → ok   (legacy default kept as before at emission)
 */
export type CertificateResult = "ok" | "conditional" | "failed" | "na";

export function normalizeCertificateResult(r: string | null | undefined): CertificateResult {
  switch (r) {
    case "ok": return "ok";
    case "with_incident": case "conditional": return "conditional";
    case "fail": case "failed": return "failed";
    case "na": case "n/a": case "not_applicable": case "skipped": return "na";
    default: return "ok";
  }
}

export const CERTIFICATE_RESULT_LABELS: Record<CertificateResult, string> = {
  ok: "OK",
  conditional: "Con incidencia",
  failed: "Fallo",
  na: "N/A",
};

/** Label for display (UI and PDF). Unknown values are normalized, never shown raw. */
export const certificateResultLabel = (r: string | null | undefined) =>
  CERTIFICATE_RESULT_LABELS[normalizeCertificateResult(r)];

/** Counts in «Con incidencias»: conditional and failed. */
export const certificateResultHasIncident = (r: string | null | undefined) => {
  const n = normalizeCertificateResult(r);
  return n === "conditional" || n === "failed";
};

export function certificateResultCounts(results: Array<string | null | undefined>) {
  const c = { total: results.length, ok: 0, withIncidents: 0, na: 0 };
  for (const r of results) {
    const n = normalizeCertificateResult(r);
    if (n === "ok") c.ok++;
    else if (n === "na") c.na++;
    else c.withIncidents++;
  }
  return c;
}
