/**
 * Certificate use-cases and org-scoped query keys (orgId always at position 1).
 * Messages, validations and results are identical to the previous inline screens.
 */
import { certificatesRepo as repo, renderCertificatePdf } from "../adapters/standalone/repos";
import { DEFAULT_CERTIFICATE_TEMPLATE } from "@/modules/maintenance/domain/certificate-templates/default";
import type { TemplateColumn } from "@/modules/maintenance/domain/certificate-templates/types";
import { composePdfData } from "../domain/certificate-pdf-source";
import { LOGO_INTEGRITY_ERROR, isOrgPath, planSnapshotLogo, readCertificateSnapshot, requiresCertificate } from "../domain/certificate-rules";
import type { TemplateInput } from "../data/certificates.repo";

export const certificateKeys = {
  lists: (orgId: string | null) => ["certificates", orgId] as const,
  list: (orgId: string | null, status: string) => ["certificates", orgId, status] as const,
  detail: (orgId: string | null, id: string) => ["certificate", orgId, id] as const,
  items: (orgId: string | null, id: string) => ["certificate-items", orgId, id] as const,
  incidents: (orgId: string | null, id: string) => ["certificate-incidents", orgId, id] as const,
  applied: (orgId: string | null, id: string) => ["certificate-resolved-template", orgId, id] as const,
  byAsset: (orgId: string | null, assetId: string) => ["asset-certificates", orgId, assetId] as const,
  templates: (orgId: string | null) => ["certificate-templates", orgId] as const,
  template: (orgId: string | null, id: string) => ["certificate-template", orgId, id] as const,
  externalAssets: (orgId: string | null) => ["assets-for-cert", orgId] as const,
};

const need = (orgId: string | null | undefined): string => {
  if (!orgId) throw new Error("Sin empresa activa");
  return orgId;
};

const toDataUrl = (bytes: Uint8Array, type: string) => {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:${type};base64,${btoa(bin)}`;
};

const sha256Hex = async (bytes: Uint8Array) => {
  const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", ab))).map((b) => b.toString(16).padStart(2, "0")).join("");
};

export const certificateService = {
  listCertificates: (orgId: string | null, status: string) => repo.listCertificates(need(orgId), status),
  getCertificate: (orgId: string | null, id: string) => repo.getCertificate(need(orgId), id),
  listItems: (orgId: string | null, id: string) => repo.listItems(need(orgId), id),
  listIncidents: (orgId: string | null, id: string) => repo.listIncidents(need(orgId), id),
  appliedTemplate: (orgId: string | null, id: string, metadata: unknown, sessionId: string | null) =>
    repo.appliedTemplate(need(orgId), id, readCertificateSnapshot(metadata, sessionId)),
  /** Visible warning when a snapshot certificate cannot rely on its frozen logo. */
  logoNotice: (orgId: string | null, metadata: unknown, sessionId: string | null): string | null => {
    const snap = readCertificateSnapshot(metadata, sessionId);
    if (!snap || !orgId) return null;
    const p = planSnapshotLogo(orgId, snap.logo);
    return p.kind === "missing" ? `${p.reason}. Al regenerar se conservará el PDF emitido y no se usará el logo actual.` : null;
  },
  hasSnapshot: (metadata: unknown, sessionId: string | null) => !!readCertificateSnapshot(metadata, sessionId),
  revoke: (orgId: string | null, id: string) => repo.revoke(need(orgId), id),
  updateNotes: (orgId: string | null, id: string, notes: string) => repo.updateNotes(need(orgId), id, notes.trim() || null),
  listAssetCertificates: (orgId: string | null, assetId: string) => repo.listAssetCertificates(need(orgId), assetId),
  findSessionCertificate: (orgId: string | null, sessionId: string) => repo.findSessionCertificate(need(orgId), sessionId),
  pdfDownloadUrl: (orgId: string | null, id: string) => repo.pdfDownloadUrl(need(orgId), id),

  /**
   * Builds and stores the PDF from the snapshot precedence. Snapshot certificates use ONLY the logo frozen
   * at emission, verified by SHA-256; if it cannot be verified and a PDF already exists, nothing is
   * regenerated (the issued PDF is kept) and LOGO_INTEGRITY_ERROR is raised. On first build the PDF is
   * produced without logo and a warning is returned. The current logo is never used for them.
   */
  generatePdf: async (orgId: string | null, id: string): Promise<{ pdfUrl: string; warning: string | null }> => {
    const org = need(orgId);
    const src = await repo.loadPdfSource(org, id);
    const current = readCertificateSnapshot(src.cert.metadata, src.sessionId)
      ? { source: "builtin" as const, template: null }
      : await repo.resolveTemplateForSession(org, src.session?.plan_id ?? null);
    const data = composePdfData({ ...src, orgId: org, currentTemplate: current });
    const template = data.template ?? DEFAULT_CERTIFICATE_TEMPLATE;
    let logoUrl: string | null = null;
    let warning: string | null = null;
    if (data.logo.kind === "frozen") {
      const f = await repo.readFrozenLogo(org, data.logo.path);
      if (f && (await repo.sha256Hex(f.bytes)) === data.logo.sha256) logoUrl = toDataUrl(f.bytes, f.contentType);
      else warning = "El logo congelado no se encuentra o su huella no coincide";
    } else if (data.logo.kind === "missing") {
      warning = data.logo.reason;
    } else if (data.logo.kind === "current") {
      if (!isOrgPath(org, data.logo.path)) throw new Error("El recurso no pertenece a la organización activa");
      logoUrl = await repo.signedLogoUrl(data.logo.path); // legacy only, flagged in the detail screen
    }
    if (warning && src.cert.pdf_url) {
      console.warn(`[certificates] ${id}: ${warning}`);
      throw new Error(LOGO_INTEGRITY_ERROR);
    }
    const bytes = await renderCertificatePdf({
      template: { ...DEFAULT_CERTIFICATE_TEMPLATE, ...template, columns: (Array.isArray(template.columns) ? template.columns : []) as TemplateColumn[] },
      vars: data.vars, rows: data.rows, incidents: data.incidents, logoUrl, signatureDataUrl: data.signature,
    });
    const r = await repo.storePdf(org, id, bytes, await sha256Hex(bytes));
    if (warning) console.warn(`[certificates] ${id}: PDF generado sin logo — ${warning}`);
    return { ...r, warning: warning ? `PDF generado sin logo: ${warning}` : null };
  },

  /** Emission after close (called by sessionService). Idempotent; PDF failure keeps the previous warning. */
  emitForSession: async (orgId: string | null, a: Parameters<typeof repo.emitForSession>[1] & { requiresCertificate: boolean | null | undefined }) => {
    const org = need(orgId);
    if (!requiresCertificate(a.requiresCertificate)) return { cert: null, pdfFailed: false };
    const r = await repo.emitForSession(org, a);
    if (!r.created) return { cert: r.cert, pdfFailed: false };
    let pdfFailed = false;
    try { await certificateService.generatePdf(org, r.cert.id); } catch (e) { console.error("PDF generation failed", e); pdfFailed = true; }
    return { cert: r.cert, pdfFailed };
  },

  // Templates
  listTemplates: (orgId: string | null) => repo.listTemplates(need(orgId)),
  getTemplate: (orgId: string | null, id: string) => repo.getTemplate(need(orgId), id),
  createTemplate: (orgId: string | null, v: { code: string; name: string }) => {
    const org = need(orgId);
    if (!v.code.trim() || !v.name.trim()) throw new Error("Completa código y nombre");
    const d = DEFAULT_CERTIFICATE_TEMPLATE;
    return repo.createTemplate(org, {
      code: v.code.trim().toUpperCase(), name: v.name.trim(), language: d.language, title: d.title, intro_text: d.intro_text,
      regulation_text: d.regulation_text, footer_text: d.footer_text, columns: JSON.parse(JSON.stringify(d.columns)),
      show_logo: d.show_logo, show_signature: d.show_signature, show_company_stamp: d.show_company_stamp, paper_size: d.paper_size,
    });
  },
  updateTemplate: (orgId: string | null, id: string, patch: Partial<TemplateInput>) => repo.updateTemplate(need(orgId), id, patch),
  deleteTemplate: (orgId: string | null, id: string) => repo.softDeleteTemplate(need(orgId), id),
  uploadTemplateLogo: (orgId: string | null, id: string, file: Blob & { name: string; type: string; size: number }) => {
    if (file.size > 2 * 1024 * 1024) throw new Error("La imagen no puede superar 2 MB");
    return repo.uploadTemplateLogo(need(orgId), id, file);
  },
  signedLogoUrl: (path: string) => repo.signedLogoUrl(path, 300),

  // External
  listAssetsForExternal: (orgId: string | null) => repo.listAssetsForExternal(need(orgId)),
  registerExternal: (orgId: string | null, v: {
    title: string; issuerName: string; issuerRole: string; provider: string; externalNumber: string;
    issuedOn: string; validUntil: string; assetId: string; notes: string; file: (Blob & { name: string; type: string; size: number }) | null;
  }) => {
    if (!v.title.trim()) throw new Error("Indica un título");
    if (!v.provider.trim()) throw new Error("Indica el proveedor externo");
    if (!v.file) throw new Error("Adjunta el PDF del certificado");
    return repo.registerExternal(need(orgId), {
      title: v.title.trim(), issuedOn: v.issuedOn, validUntil: v.validUntil || null,
      issuerName: v.issuerName.trim() || null, issuerRole: v.issuerRole.trim() || null, provider: v.provider.trim(),
      externalNumber: v.externalNumber.trim() || null, notes: v.notes.trim() || null,
      assetId: v.assetId !== "none" ? v.assetId : null, file: v.file,
    });
  },
};
