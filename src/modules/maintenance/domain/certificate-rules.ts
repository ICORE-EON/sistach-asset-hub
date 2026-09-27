/**
 * Certificate rules and historical representation. Pure: no Supabase, React, File or Blob.
 *
 * Emission rules (unchanged): a certificate is emitted when a session closes unless its plan's family
 * has requires_certificate === false; code = next_code("certificate","CERT"); valid_until =
 * issued_on + plan.interval_months (none when absent); status "issued"; item results mapped with
 * legacyCertificateItemResult. Only "issued" certificates may be revoked or have their PDF (re)built.
 *
 * PDF source precedence:
 *  1. "snapshot": certificate.metadata.snapshot frozen at emission (plan, company, location, items
 *     with frozen asset data and results, incidents, full template). Used verbatim; the template is
 *     the one applicable at emission.
 *  2. "session_snapshot": certificate without its own snapshot but whose session items carry
 *     opening snapshots (domain/session-history). Asset data comes from those snapshots; the
 *     template is the CURRENT resolution and is flagged templateFrozen = false.
 *  3. "legacy": no usable snapshot: current joined data, exactly as before, flagged as such.
 * Missing fields are shown empty; current master data is never presented as the original.
 */
import type { RowSource } from "@/lib/certificate-templates/render";
import type { CertificateTemplate } from "@/lib/certificate-templates/types";
import { legacyCertificateItemResult } from "./session-rules";
import { certificateResultCounts } from "./certificate-results";

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : null);
const str = (v: unknown): string => (typeof v === "string" ? v : "");

export type PdfSource = "snapshot" | "session_snapshot" | "legacy";
export const CERT_SNAPSHOT_VERSION = 1;

/** Same expiry formula as before: same day, interval_months later; null when no interval. */
export function validUntilFrom(today: Date, intervalMonths: number | null | undefined): string | null {
  if (!intervalMonths) return null;
  return new Date(today.getFullYear(), today.getMonth() + intervalMonths, today.getDate()).toISOString().slice(0, 10);
}

/** Same notes summary as before. */
export function emissionSummary(results: string[], pendingCount: number): string {
  const { ok: okCount, withIncidents: failCount } = certificateResultCounts(results);
  return `${okCount} equipo(s) OK${failCount > 0 ? `, ${failCount} con incidencias` : ""}${
    pendingCount > 0 ? `, ${pendingCount} sin revisar` : ""}.`;
}

export const requiresCertificate = (requires: boolean | null | undefined) => requires !== false;

export function assertRevocable(status: string): void {
  if (status !== "issued") throw new Error("Solo se puede revocar un certificado emitido");
}
export function assertPdfBuildable(status: string): void {
  if (status !== "issued") throw new Error("Solo se puede generar el PDF de un certificado emitido");
}

/** Template candidates in resolution order: plan → family → company default → built-in. */
export type TemplateSourceKind = "plan" | "family" | "default" | "builtin";
export function pickTemplate<T>(c: { plan?: T | null; family?: T | null; def?: T | null }): { source: TemplateSourceKind; template: T | null } {
  if (c.plan) return { source: "plan", template: c.plan };
  if (c.family) return { source: "family", template: c.family };
  if (c.def) return { source: "default", template: c.def };
  return { source: "builtin", template: null };
}

export type FrozenItem = { item_id: string; asset_id: string; result: string; notes: string | null; asset: RowSource["asset"] };
export type FrozenIncident = { asset_type: string; asset_code: string; location: string; severity: string; description: string };
export type CertificateSnapshot = {
  v: number; captured_at: string; session_id: string; session_code: string;
  plan: { id: string | null; name: string | null } | null;
  company: { name: string; cif: string; address: string; logo_url: string | null };
  location_name: string;
  items: FrozenItem[];
  incidents: FrozenIncident[];
  template: { source: TemplateSourceKind; data: CertificateTemplate | null };
};

/** Asset row shape the PDF expects, from an item opening snapshot. Null when not usable. */
export function assetFromItemSnapshot(itemMetadata: unknown, assetId: string): RowSource["asset"] | null {
  const a = obj(obj(obj(itemMetadata)?.snapshot)?.asset);
  if (!a || a.id !== assetId || !str(a.code)) return null;
  const typeName = str(a.type_name) || null, typeCode = str(a.type_code) || null;
  return {
    code: str(a.code), name: str(a.name) || null,
    manufacturer: str(a.manufacturer) || null, model: str(a.model) || null,
    asset_types: typeName || typeCode ? { name_i18n: typeName ? { es: typeName } : null, code: typeCode } : null,
    locations: str(a.location_name) ? { name: str(a.location_name) } : null,
  };
}

/** Most common location among rows (same rule as before when the session has no location). */
export function mostCommonLocation(rows: RowSource[]): string {
  const counts: Record<string, number> = {};
  for (const r of rows) { const n = r.asset?.locations?.name; if (n) counts[n] = (counts[n] ?? 0) + 1; }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
}

/** Snapshot frozen at emission from the close result. Items without an opening snapshot keep asset = null (shown empty). */
export function buildEmissionSnapshot(a: {
  now: Date; sessionId: string; sessionCode: string; sessionMetadata: unknown; sessionLocationName: string | null;
  company: CertificateSnapshot["company"];
  items: Array<{ id: string; asset_id: string; result: string; observations: string | null; metadata?: unknown }>;
  incidents: FrozenIncident[];
  template: CertificateSnapshot["template"];
}): CertificateSnapshot {
  const plan = obj(obj(obj(a.sessionMetadata)?.snapshot)?.plan);
  const items: FrozenItem[] = a.items.map((it) => ({
    item_id: it.id, asset_id: it.asset_id, result: legacyCertificateItemResult(it.result), notes: it.observations ?? null,
    asset: assetFromItemSnapshot(it.metadata, it.asset_id),
  }));
  const rows = items.map((i) => ({ asset: i.asset }));
  return {
    v: CERT_SNAPSHOT_VERSION, captured_at: a.now.toISOString(), session_id: a.sessionId, session_code: a.sessionCode,
    plan: plan ? { id: str(plan.id) || null, name: str(plan.name) || null } : null,
    company: a.company, location_name: a.sessionLocationName || mostCommonLocation(rows),
    items, incidents: a.incidents, template: a.template,
  };
}

/** The snapshot stored on the certificate, or null when absent/invalid/not matching its items' session. */
export function readCertificateSnapshot(certMetadata: unknown, linkedSessionId: string | null): CertificateSnapshot | null {
  const s = obj(obj(certMetadata)?.snapshot);
  if (!s || s.v !== CERT_SNAPSHOT_VERSION || !Array.isArray(s.items) || !obj(s.company) || !obj(s.template)) return null;
  if (linkedSessionId && s.session_id !== linkedSessionId) return null;
  return s as unknown as CertificateSnapshot;
}

export function isSessionAlreadyCertified(existing: { id: string } | null | undefined): boolean {
  return !!existing;
}
