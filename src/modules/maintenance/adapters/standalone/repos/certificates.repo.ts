/**
 * Certificates repository: the only place that reads/writes certificates, certificate items,
 * certificate templates, the certificate PDF in storage, the asset certificates tab and the
 * external-certificate registration. Every call is scoped to orgId and ownership is verified through
 * the certificate, the session and the asset before reading, generating, downloading or modifying.
 *
 * Idempotency (no schema change; unique constraints/atomic RPCs stay for phase 7):
 *  - emitForSession: in-process single flight per session + re-check of an existing certificate for
 *    the session right before inserting; a retry returns the existing one.
 *  - storePdf: immutable content-addressed versions {org}/certificates/{id}/{sha256}.pdf, verified and
 *    then activated by compare-and-set; never overwrites or deletes (see storePdf).
 */
import type { StandaloneClient } from "../client";
import type { Json } from "@/integrations/supabase/types";
import type { CertificateTemplate } from "@/modules/maintenance/domain/certificate-templates/types";
import {
  assertPdfBuildable, assertRevocable, buildEmissionSnapshot, emissionSummary, frozenLogoPath, isOrgPath, pickTemplate, validUntilFrom,
  type CertificateSnapshot, type FrozenLogo, type FrozenIncident, type TemplateSourceKind,
} from "../../../domain/certificate-rules";
import { resolveCertificateItemResult, storedCertificateResult } from "../../../domain/certificate-results";

const ok = <T>(r: { data: T; error: unknown }): T => { if (r.error) throw r.error; return r.data; };
const NOT_FOUND = "Certificado no encontrado";
const CROSS = "El recurso no pertenece a la organización activa";
const i18n = (n: unknown, code?: string | null) => {
  const o = (n ?? {}) as Record<string, string>;
  return o.es ?? o.en ?? o.ca ?? code ?? "";
};

export const pdfVersionPath = (orgId: string, certId: string, sha256: string) => `${orgId}/certificates/${certId}/${sha256}.pdf`;
const inflightEmit = new Map<string, Promise<unknown>>();
const inflightPdf = new Map<string, Promise<unknown>>();
const single = <T>(m: Map<string, Promise<unknown>>, k: string, fn: () => Promise<T>): Promise<T> => {
  const p = m.get(k) as Promise<T> | undefined;
  if (p) return p;
  const n = fn().finally(() => m.delete(k));
  m.set(k, n);
  return n;
};

const sha256Hex = async (bytes: Uint8Array) => {
  const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", ab))).map((b) => b.toString(16).padStart(2, "0")).join("");
};
/** Immutable bucket (insert-only policy, same permission as closing a session). */
const FROZEN_BUCKET = "signed-certificates";

export type TemplateInput = { [K in keyof Omit<CertificateTemplate, "id">]?: unknown };

export function createCertificatesRepo(c: StandaloneClient) {
  const getOwn = async (orgId: string, id: string) => {
    const cert = ok(await c.from("certificates").select("*").eq("id", id).eq("company_id", orgId).maybeSingle());
    if (!cert) throw new Error(NOT_FOUND);
    return cert;
  };
  const ownTemplate = async (orgId: string, id: string) => {
    const t = ok(await c.from("certificate_templates").select("*").eq("id", id).eq("company_id", orgId).maybeSingle());
    if (!t) throw new Error("Plantilla no encontrada");
    return t;
  };
  const assertAsset = async (orgId: string, assetId: string) => {
    const a = ok(await c.from("assets").select("id").eq("id", assetId).eq("company_id", orgId).maybeSingle());
    if (!a) throw new Error(CROSS);
  };
  const assertSession = async (orgId: string, sessionId: string) => {
    const s = ok(await c.from("maintenance_sessions").select("id, status").eq("id", sessionId).eq("company_id", orgId).maybeSingle());
    if (!s) throw new Error(CROSS);
    return s;
  };

  /** plan → family → company default → built-in (null), all within orgId. */
  /**
   * Copies the logo used at emission into a content-addressed, insert-only path and records its SHA-256.
   * Never throws: failure is recorded as "unavailable" so emission proceeds and the PDF omits the logo.
   */
  const freezeLogo = async (orgId: string, sourcePath: string | null): Promise<FrozenLogo> => {
    if (!sourcePath) return { status: "none" };
    if (!isOrgPath(orgId, sourcePath)) return { status: "unavailable", source_path: sourcePath, reason: "foreign_path" };
    try {
      const { data, error } = await c.storage.from("company-logos").download(sourcePath);
      if (error || !data) return { status: "unavailable", source_path: sourcePath, reason: "download_failed" };
      const bytes = new Uint8Array(await data.arrayBuffer());
      const contentType = data.type || (sourcePath.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg");
      const sha256 = await sha256Hex(bytes);
      const path = frozenLogoPath(orgId, sha256, contentType);
      const up = await c.storage.from(FROZEN_BUCKET).upload(path, new Blob([bytes.slice().buffer as ArrayBuffer], { type: contentType }), { contentType, upsert: false });
      // Content-addressed: an existing object with this name already holds identical bytes.
      if (up.error && !/exist|duplicate|409/i.test(String((up.error as { message?: string }).message ?? up.error)))
        return { status: "unavailable", source_path: sourcePath, reason: "copy_failed" };
      return { status: "frozen", path, sha256, content_type: contentType, source_path: sourcePath };
    } catch {
      return { status: "unavailable", source_path: sourcePath, reason: "copy_failed" };
    }
  };

  /**
   * Canonical results: the stored column cannot express «Sin revisar», so the linked maintenance item
   * (only when its session belongs to orgId) supplies the historical value. See certificate-results.ts.
   */
  const withHistoricalResults = async <R extends { result: string; maintenance_item_id?: string | null }>(orgId: string, rows: R[]): Promise<R[]> => {
    const ids = [...new Set(rows.map((r) => r.maintenance_item_id).filter(Boolean) as string[])];
    if (!ids.length) return rows.map((r) => ({ ...r, result: resolveCertificateItemResult(r.result) }));
    const mi = (ok(await c.from("maintenance_items").select("id, result, session_id").in("id", ids)) ?? []) as Array<{ id: string; result: string; session_id: string }>;
    const sids = [...new Set(mi.map((m) => m.session_id))];
    const own = new Set(sids.length ? ((ok(await c.from("maintenance_sessions").select("id").in("id", sids).eq("company_id", orgId)) ?? []) as Array<{ id: string }>).map((s) => s.id) : []);
    const src = new Map(mi.filter((m) => own.has(m.session_id)).map((m) => [m.id, m.result]));
    return rows.map((r) => ({ ...r, result: resolveCertificateItemResult(r.result, r.maintenance_item_id ? src.get(r.maintenance_item_id) : null) }));
  };

  const resolveTemplate = async (orgId: string, planId: string | null) => {
    let plan = null, family = null;
    if (planId) {
      const p = ok(await c.from("maintenance_plans").select("certificate_template_id, asset_family_id").eq("id", planId).eq("company_id", orgId).maybeSingle());
      if (p?.certificate_template_id) {
        plan = ok(await c.from("certificate_templates").select("*").eq("id", p.certificate_template_id).eq("company_id", orgId).is("deleted_at", null).maybeSingle());
      }
      if (!plan && p?.asset_family_id) {
        family = ok(await c.from("certificate_templates").select("*").eq("company_id", orgId).eq("asset_family_id", p.asset_family_id)
          .is("deleted_at", null).limit(1).maybeSingle());
      }
    }
    const def = plan || family ? null : ok(await c.from("certificate_templates").select("*").eq("company_id", orgId).eq("is_default", true).is("deleted_at", null).maybeSingle());
    return pickTemplate({ plan, family, def }) as { source: TemplateSourceKind; template: (CertificateTemplate & { id: string }) | null };
  };

  const sessionIdOf = async (certId: string) => {
    const r = ok(await c.from("certificate_items").select("maintenance_session_id").eq("certificate_id", certId).not("maintenance_session_id", "is", null).limit(1).maybeSingle());
    return (r?.maintenance_session_id as string | null | undefined) ?? null;
  };

  const incidentsForItems = async (orgId: string, itemIds: string[]) => {
    if (itemIds.length === 0) return [];
    return ok(await c.from("incidents")
      .select("id, code, title, description, status, severity, asset_id, source_maintenance_item_id, assets(code, asset_types(name_i18n, code), locations(name))")
      .eq("company_id", orgId).in("source_maintenance_item_id", itemIds)) ?? [];
  };

  const findSessionCertificate = async (orgId: string, sessionId: string) => {
    const rows = ok(await c.from("certificate_items").select("certificates(id, code, status, company_id, issuer_name, issuer_role, signature_image_url)")
      .eq("maintenance_session_id", sessionId).limit(1)) ?? [];
    const cert = rows[0]?.certificates as { id: string; code: string; status: string; company_id: string } | null | undefined;
    return cert && cert.company_id === orgId ? { id: cert.id, code: cert.code, status: cert.status } : null;
  };


  return {
    resolveTemplate,

    async listCertificates(orgId: string, status: string) {
      let q = c.from("certificates").select("*").eq("company_id", orgId).is("deleted_at", null).order("issued_on", { ascending: false }).limit(500);
      if (status !== "all") q = q.eq("status", status);
      return ok(await q) ?? [];
    },
    getCertificate: getOwn,
    async listItems(orgId: string, certId: string) {
      await getOwn(orgId, certId);
      const rows = ok(await c.from("certificate_items").select("*, assets(id, code, name), maintenance_sessions(id, code)").eq("certificate_id", certId)) ?? [];
      return withHistoricalResults(orgId, rows);
    },
    async listIncidents(orgId: string, certId: string) {
      await getOwn(orgId, certId);
      const items = ok(await c.from("certificate_items").select("maintenance_item_id").eq("certificate_id", certId)) ?? [];
      const ids = items.map((i) => i.maintenance_item_id).filter(Boolean) as string[];
      return (await incidentsForItems(orgId, ids)).map((i) => ({ id: i.id, code: i.code, title: i.title, status: i.status, severity: i.severity }));
    },
    /** Template shown on the detail: frozen one when the certificate has a snapshot, else current resolution. */
    async appliedTemplate(orgId: string, certId: string, snapshot: CertificateSnapshot | null) {
      if (snapshot) {
        const t = snapshot.template;
        return { source: t.source, id: (t.data?.id as string | undefined) ?? null, name: t.data?.name ?? "Plantilla genérica integrada", frozen: true };
      }
      await getOwn(orgId, certId);
      const sid = await sessionIdOf(certId);
      let planId: string | null = null;
      if (sid) planId = ok(await c.from("maintenance_sessions").select("plan_id").eq("id", sid).eq("company_id", orgId).maybeSingle())?.plan_id ?? null;
      const r = await resolveTemplate(orgId, planId);
      return { source: r.source, id: r.template?.id ?? null, name: r.template?.name ?? "Plantilla genérica integrada", frozen: false };
    },

    async revoke(orgId: string, certId: string) {
      const cert = await getOwn(orgId, certId);
      assertRevocable(cert.status);
      ok(await c.from("certificates").update({ status: "revoked" }).eq("id", certId).eq("company_id", orgId).eq("status", "issued"));
    },
    async updateNotes(orgId: string, certId: string, notes: string | null) {
      await getOwn(orgId, certId);
      ok(await c.from("certificates").update({ notes }).eq("id", certId).eq("company_id", orgId));
    },

    async listAssetCertificates(orgId: string, assetId: string) {
      await assertAsset(orgId, assetId);
      const rows = ok(await c.from("certificate_items").select("id, result, maintenance_item_id, certificates(id, code, title, issued_on, valid_until, status, company_id)").eq("asset_id", assetId)) ?? [];
      return withHistoricalResults(orgId, rows.filter((r) => (r.certificates as { company_id?: string } | null)?.company_id === orgId));
    },

    findSessionCertificate,

    /** Emits the session certificate once. Rejects non-closed or foreign sessions before writing. */
    emitForSession(orgId: string, a: {
      sessionId: string; sessionCode: string; planId: string | null; planName: string | null; intervalMonths: number | null;
      sessionMetadata: unknown; sessionLocationId: string | null;
      signerName: string; signerRole: string | null; signature: string; pendingCount: number;
      items: Array<{ id: string; asset_id: string; result: string; observations: string | null; metadata?: unknown }>;
    }) {
      return single(inflightEmit, `${orgId}:${a.sessionId}`, async () => {
        const s = await assertSession(orgId, a.sessionId);
        if (s.status !== "closed") throw new Error("La sesión no está cerrada");
        const existing = await findSessionCertificate(orgId, a.sessionId);
        if (existing) return { cert: { id: existing.id, code: existing.code }, created: false };

        const [company, loc, tpl, incs] = await Promise.all([
          c.from("companies").select("name, cif, address, logo_url").eq("id", orgId).maybeSingle().then(ok),
          a.sessionLocationId ? c.from("locations").select("name").eq("id", a.sessionLocationId).eq("company_id", orgId).maybeSingle().then(ok) : Promise.resolve(null),
          resolveTemplate(orgId, a.planId),
          incidentsForItems(orgId, a.items.map((i) => i.id)),
        ]);
        const incidents: FrozenIncident[] = incs.map((i) => {
          const as = i.assets as { code?: string; asset_types?: { name_i18n?: unknown; code?: string } | null; locations?: { name?: string } | null } | null;
          return { asset_type: i18n(as?.asset_types?.name_i18n, as?.asset_types?.code), asset_code: as?.code ?? "", location: as?.locations?.name ?? "",
            severity: i.severity, description: [i.title, i.description].filter(Boolean).join(" — ") };
        });
        const today = new Date();
        const showLogo = tpl.template ? tpl.template.show_logo !== false : true;
        const logo = await freezeLogo(orgId, showLogo ? (tpl.template?.logo_url ?? company?.logo_url ?? null) : null);
        const snapshot = buildEmissionSnapshot({ logo,
          now: today, sessionId: a.sessionId, sessionCode: a.sessionCode, sessionMetadata: a.sessionMetadata,
          sessionLocationName: (loc as { name?: string } | null)?.name ?? null,
          company: { name: company?.name ?? "", cif: company?.cif ?? "", address: company?.address ?? "", logo_url: company?.logo_url ?? null },
          items: a.items, incidents, template: { source: tpl.source, data: tpl.template },
        });
        const code = ok(await c.rpc("next_code", { p_company_id: orgId, p_scope: "certificate", p_prefix: "CERT" }));
        const cert = ok(await c.from("certificates").insert({
          company_id: orgId, code: code as string,
          title: `Certificado de mantenimiento — ${a.planName ?? a.sessionCode}`,
          issued_on: today.toISOString().slice(0, 10), valid_until: validUntilFrom(today, a.intervalMonths),
          issuer_name: a.signerName, issuer_role: a.signerRole, signature_image_url: a.signature,
          notes: emissionSummary(a.items.map((i) => i.result), a.pendingCount), status: "issued",
          metadata: { snapshot } as unknown as Json,
        }).select("id, code").single())!;
        if (a.items.length > 0) {
          ok(await c.from("certificate_items").insert(a.items.map((it) => ({
            certificate_id: cert.id, asset_id: it.asset_id, maintenance_session_id: a.sessionId,
            maintenance_item_id: it.id, result: storedCertificateResult(it.result), notes: it.observations ?? null,
          }))));
        }
        return { cert: { id: cert.id as string, code: cert.code as string }, created: true };
      });
    },

    /** Everything the PDF needs, from the certificate snapshot or (legacy) from session snapshots/current data. */
    async loadPdfSource(orgId: string, certId: string) {
      const cert = await getOwn(orgId, certId);
      assertPdfBuildable(cert.status);
      const certItems = ok(await c.from("certificate_items")
        .select("id, result, notes, asset_id, maintenance_session_id, maintenance_item_id, assets(code, name, manufacturer, model, asset_types(code, name_i18n), locations(name))")
        .eq("certificate_id", certId)) ?? [];
      const sessionId = certItems.find((i) => i.maintenance_session_id)?.maintenance_session_id ?? null;
      type S = { plan_id: string | null; status: string; metadata: unknown; maintenance_plans: { name: string } | null; locations: { name: string } | null };
      let session = null as S | null;
      let mItems: Array<{ id: string; asset_id: string; result: string; metadata: unknown }> = [];
      if (sessionId) {
        session = ok(await c.from("maintenance_sessions").select("plan_id, status, metadata, maintenance_plans(name), locations(name)")
          .eq("id", sessionId).eq("company_id", orgId).maybeSingle()) as unknown as S | null;
        if (!session) throw new Error(CROSS);
        mItems = (ok(await c.from("maintenance_items").select("id, asset_id, result, metadata").eq("session_id", sessionId)) ?? []) as typeof mItems;
      }
      const [company, incs] = await Promise.all([
        c.from("companies").select("name, cif, address, logo_url").eq("id", orgId).maybeSingle().then(ok),
        incidentsForItems(orgId, mItems.map((m) => m.id)),
      ]);
      return { cert, certItems, sessionId, session, mItems, company, incidents: incs };
    },
    resolveTemplateForSession: async (orgId: string, planId: string | null) => resolveTemplate(orgId, planId),

    /** Bytes of a frozen logo, only under the active org. Null when it cannot be read. */
    async readFrozenLogo(orgId: string, path: string): Promise<{ bytes: Uint8Array; contentType: string } | null> {
      if (!isOrgPath(orgId, path)) throw new Error(CROSS);
      try {
        const { data, error } = await c.storage.from(FROZEN_BUCKET).download(path);
        if (error || !data) return null;
        return { bytes: new Uint8Array(await data.arrayBuffer()), contentType: data.type || (path.endsWith(".png") ? "image/png" : "image/jpeg") };
      } catch { return null; }
    },
    sha256Hex,

    async signedLogoUrl(path: string, seconds = 60) {
      try { const { data } = await c.storage.from("company-logos").createSignedUrl(path, seconds); return data?.signedUrl ?? path; }
      catch { return path; }
    },

    /**
     * Immutable PDF versioning. Each generation is written to a NEW content-addressed path
     * {org}/certificates/{certId}/{sha256}.pdf with upsert:false; nothing is ever overwritten or deleted.
     * The active reference (pdf_url, pdf_hash_sha256) is switched only after the stored object has been
     * read back and its SHA-256 verified, with compare-and-set on the previous reference. A retry of the
     * same generation (same bytes → same hash → same path) reuses the stored object and creates no new
     * version. On any failure the previous PDF and reference stay untouched.
     */
    storePdf(orgId: string, certId: string, bytes: Uint8Array, hashHex: string) {
      return single(inflightPdf, `${orgId}:${certId}`, async () => {
        const cert = await getOwn(orgId, certId);
        assertPdfBuildable(cert.status);
        const hash = await sha256Hex(bytes);
        if (hash !== hashHex) throw new Error("La huella del PDF no coincide");
        const path = pdfVersionPath(orgId, certId, hash);
        if (cert.pdf_url === path && cert.pdf_hash_sha256 === hash) return { pdfUrl: path, created: false };
        const bucket = c.storage.from("signed-certificates");
        const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
        const up = await bucket.upload(path, new Blob([ab], { type: "application/pdf" }), { contentType: "application/pdf", upsert: false });
        const exists = !!up.error && /exist|duplicate|409/i.test(String((up.error as { message?: string }).message ?? up.error));
        if (up.error && !exists) throw up.error;
        // Verify what is actually stored (new upload or equivalent earlier attempt) before switching.
        const back = await bucket.download(path);
        if (back.error || !back.data) throw new Error("No se ha podido verificar el PDF guardado. Se conserva el PDF anterior.");
        if ((await sha256Hex(new Uint8Array(await back.data.arrayBuffer()))) !== hash)
          throw new Error("El PDF guardado no supera la verificación de huella. Se conserva el PDF anterior.");
        const meta = (cert.metadata && typeof cert.metadata === "object" && !Array.isArray(cert.metadata) ? cert.metadata : {}) as Record<string, unknown>;
        const prev = Array.isArray(meta.pdf_versions) ? (meta.pdf_versions as unknown[]) : [];
        const versions = [...prev, ...(cert.pdf_url && !prev.some((v) => (v as { path?: string })?.path === cert.pdf_url)
          ? [{ path: cert.pdf_url, sha256: cert.pdf_hash_sha256 ?? null }] : []), { path, sha256: hash, stored_at: new Date().toISOString() }];
        let q = c.from("certificates").update({ pdf_url: path, pdf_hash_sha256: hash, metadata: { ...meta, pdf_versions: versions } as unknown as Json })
          .eq("id", certId).eq("company_id", orgId);
        q = cert.pdf_url ? q.eq("pdf_url", cert.pdf_url) : q.is("pdf_url", null);
        const upd = ok(await q.select("id")) as unknown as Array<{ id: string }> | null;
        if (!upd || upd.length !== 1) throw new Error("El certificado ha cambiado mientras se generaba el PDF. Se conserva el PDF anterior.");
        return { pdfUrl: path, created: true };
      });
    },

    async pdfDownloadUrl(orgId: string, certId: string) {
      const cert = await getOwn(orgId, certId);
      if (!cert.pdf_url) throw new Error("Sin PDF disponible");
      if (!cert.pdf_url.startsWith(`${orgId}/`)) throw new Error(CROSS);
      const { data, error } = await c.storage.from("signed-certificates").createSignedUrl(cert.pdf_url, 300, { download: true });
      if (error) throw error;
      return data.signedUrl;
    },

    // ---- Templates ----
    async listTemplates(orgId: string) {
      return ok(await c.from("certificate_templates").select("id, code, name, language, is_default, updated_at").eq("company_id", orgId).is("deleted_at", null).order("code")) ?? [];
    },
    getTemplate: ownTemplate,
    async createTemplate(orgId: string, t: TemplateInput) {
      return ok(await c.from("certificate_templates").insert({ company_id: orgId, ...t } as never).select("id").single())!.id as string;
    },
    async updateTemplate(orgId: string, id: string, patch: Partial<TemplateInput>) {
      await ownTemplate(orgId, id);
      if (typeof patch.logo_url === "string" && !patch.logo_url.startsWith(`${orgId}/`)) throw new Error(CROSS);
      ok(await c.from("certificate_templates").update(patch as never).eq("id", id).eq("company_id", orgId));
    },
    async softDeleteTemplate(orgId: string, id: string) {
      await ownTemplate(orgId, id);
      ok(await c.from("certificate_templates").update({ deleted_at: new Date().toISOString() }).eq("id", id).eq("company_id", orgId));
    },
    async uploadTemplateLogo(orgId: string, templateId: string, file: Blob & { name: string; type: string }) {
      await ownTemplate(orgId, templateId);
      const ext = (file.name.split(".").pop() || "png").toLowerCase();
      const path = `${orgId}/templates/${templateId}.${ext}`;
      const { error } = await c.storage.from("company-logos").upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      return path;
    },

    // ---- External certificates (document upload kept on the existing path; see block report) ----
    async listAssetsForExternal(orgId: string) {
      return ok(await c.from("assets").select("id, code, name").eq("company_id", orgId).is("deleted_at", null).order("code").limit(500)) ?? [];
    },
    async registerExternal(orgId: string, v: {
      title: string; issuedOn: string; validUntil: string | null; issuerName: string | null; issuerRole: string | null;
      provider: string; externalNumber: string | null; notes: string | null; assetId: string | null;
      file: Blob & { name: string; type: string; size: number };
    }) {
      if (v.assetId) await assertAsset(orgId, v.assetId);
      const code = ok(await c.rpc("next_code", { p_company_id: orgId, p_scope: "certificate", p_prefix: "CERT" }));
      const cert = ok(await c.from("certificates").insert({
        company_id: orgId, code: code as string, title: v.title, issued_on: v.issuedOn, valid_until: v.validUntil,
        issuer_name: v.issuerName, issuer_role: v.issuerRole, external_provider: v.provider,
        external_cert_number: v.externalNumber, notes: v.notes, status: "issued",
      }).select().single())!;
      if (v.assetId) ok(await c.from("certificate_items").insert({ certificate_id: cert.id, asset_id: v.assetId, result: "ok" }));
      const path = `certificates/${cert.id}/${Date.now()}_${v.file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error: upErr } = await c.storage.from("documents").upload(path, v.file, { contentType: v.file.type || "application/pdf" });
      if (upErr) throw upErr;
      ok(await c.from("documents").insert({
        company_id: orgId, certificate_id: cert.id, title: v.file.name, category: "certificate_pdf", storage_bucket: "documents",
        storage_path: path, mime_type: v.file.type || "application/pdf", file_size_bytes: v.file.size, is_signed: true,
      }));
      return cert;
    },
  };
}

export type CertificatesRepo = ReturnType<typeof createCertificatesRepo>;
