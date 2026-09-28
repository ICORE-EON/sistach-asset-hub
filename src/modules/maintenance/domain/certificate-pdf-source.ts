/**
 * Builds the PDF input (variables, rows, incidents, template) with the precedence documented in
 * certificate-rules.ts. Pure: no Supabase, React, File or Blob.
 */
import type { RowSource } from "./certificate-templates/render";
import type { CertificateTemplate, TemplateVariables } from "./certificate-templates/types";
import {
  assetFromItemSnapshot, mostCommonLocation, planSnapshotLogo, readCertificateSnapshot,
  type LogoPlan,
  type FrozenIncident, type PdfSource, type TemplateSourceKind,
} from "./certificate-rules";
import { historicalSession } from "./session-history";
import { normalizeCertificateResult, resolveCertificateItemResult } from "./certificate-results";

export function formatDateEs(d: string | null | undefined): string {
  if (!d) return "";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });
}

type Cert = { id: string; code: string; status: string; issued_on: string; valid_until: string | null; issuer_name: string | null; issuer_role: string | null; signature_image_url: string | null; metadata?: unknown };
type CertItem = { result: string; notes: string | null; asset_id: string | null; maintenance_item_id: string | null; maintenance_session_id: string | null; assets?: unknown };
type Incident = { title: string; description: string | null; severity: string; assets?: unknown };
type Company = { name?: string | null; cif?: string | null; address?: string | null; logo_url?: string | null } | null;

export type PdfData = {
  source: PdfSource; templateFrozen: boolean; templateSource: TemplateSourceKind;
  template: CertificateTemplate | null; vars: Partial<TemplateVariables>; rows: RowSource[];
  incidents: FrozenIncident[]; signature: string | null;
  /** Snapshot certificates: frozen logo or explicit "missing". Legacy: the current logo, flagged by source. */
  logo: LogoPlan | { kind: "current"; path: string };
};

const i18n = (n: unknown, code?: string | null) => {
  const o = (n ?? {}) as Record<string, string>;
  return o.es ?? o.en ?? o.ca ?? code ?? "";
};

export function composePdfData(a: {
  orgId: string; cert: Cert; certItems: CertItem[]; sessionId: string | null;
  session: { plan_id: string | null; status: string; metadata: unknown; maintenance_plans: { name: string } | null; locations: { name: string } | null } | null;
  mItems: Array<{ id: string; asset_id: string; result?: string | null; metadata: unknown }>;
  company: Company; incidents: Incident[];
  currentTemplate: { source: TemplateSourceKind; template: CertificateTemplate | null };
}): PdfData {
  const base = {
    issuer_name: a.cert.issuer_name ?? "", issuer_role: a.cert.issuer_role ?? "",
    issued_on: formatDateEs(a.cert.issued_on), valid_until: a.cert.valid_until ? formatDateEs(a.cert.valid_until) : "",
    cert_code: a.cert.code,
  };
  const snap = readCertificateSnapshot(a.cert.metadata, a.sessionId);
  if (snap) {
    const tpl = snap.template.data;
    return {
      source: "snapshot", templateFrozen: true, templateSource: snap.template.source, template: tpl,
      vars: { ...base, company_name: snap.company.name, company_cif: snap.company.cif, company_address: snap.company.address,
        location_name: snap.location_name, plan_name: snap.plan?.name ?? "" },
      rows: snap.items.map((i) => ({ asset: i.asset, result: normalizeCertificateResult(i.result), notes: i.notes })),
      incidents: snap.incidents,
      logo: planSnapshotLogo(a.orgId, snap.logo), signature: a.cert.signature_image_url ?? null,
    };
  }

  // Fallback: frozen asset data from the session's opening snapshots when present, else current data.
  const byItem = new Map(a.mItems.map((m) => [m.id, m]));
  let allFrozen = a.certItems.length > 0;
  const rows: RowSource[] = a.certItems.map((it) => {
    const m = it.maintenance_item_id ? byItem.get(it.maintenance_item_id) : undefined;
    const frozen = m && it.asset_id ? assetFromItemSnapshot(m.metadata, it.asset_id) : null;
    if (!frozen) allFrozen = false;
    return { asset: frozen ?? (it.assets as RowSource["asset"]), result: resolveCertificateItemResult(it.result, m?.result), notes: it.notes };
  });
  const hs = a.session ? historicalSession(a.session) : null;
  if (hs && hs.history_source === "legacy") allFrozen = false;
  const assetByCode = new Map(rows.map((r) => [r.asset?.code ?? "", r.asset]));
  const incidents: FrozenIncident[] = a.incidents.map((i) => {
    const live = i.assets as { code?: string; asset_types?: { name_i18n?: unknown; code?: string } | null; locations?: { name?: string } | null } | null;
    const frozen = live?.code ? assetByCode.get(live.code) : null;
    const at = frozen?.asset_types ?? live?.asset_types;
    return { asset_type: i18n(at?.name_i18n, at?.code), asset_code: live?.code ?? "",
      location: (frozen?.locations ?? live?.locations)?.name ?? "", severity: i.severity,
      description: [i.title, i.description].filter(Boolean).join(" — ") };
  });
  const tpl = a.currentTemplate.template;
  return {
    source: allFrozen && a.sessionId ? "session_snapshot" : "legacy", templateFrozen: false, templateSource: a.currentTemplate.source,
    template: tpl,
    vars: { ...base, company_name: a.company?.name ?? "", company_cif: a.company?.cif ?? "", company_address: a.company?.address ?? "",
      location_name: a.session?.locations?.name || mostCommonLocation(rows),
      plan_name: (hs?.maintenance_plans as { name?: string } | null | undefined)?.name ?? "" },
    rows, incidents,
    logo: (() => { const p = tpl?.logo_url ?? a.company?.logo_url ?? null; return p ? { kind: "current" as const, path: p } : { kind: "none" as const }; })(),
    signature: a.cert.signature_image_url ?? null,
  };
}

/** Visible label for the detail screen. */
export function pdfSourceNotice(source: "snapshot" | "fallback", frozen: boolean): string | null {
  if (source === "snapshot" && frozen) return null;
  return "Certificado emitido antes del registro histórico: al generar el PDF se usan los datos congelados de la sesión cuando existen y, si no, los datos y la plantilla actuales.";
}
