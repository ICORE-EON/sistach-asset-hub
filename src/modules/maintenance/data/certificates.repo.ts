/**
 * Certificates repository: the only place that reads/writes certificates, certificate items,
 * certificate templates, the certificate PDF in storage, the asset certificates tab and the
 * external-certificate registration. Every call is scoped to orgId and ownership is verified through
 * the certificate, the session and the asset before reading, generating, downloading or modifying.
 *
 * Idempotency (no schema change; unique constraints/atomic RPCs stay for phase 7):
 *  - emitForSession: in-process single flight per session + re-check of an existing certificate for
 *    the session right before inserting; a retry returns the existing one.
 *  - storePdf: fixed storage path {org}/certificates/{id}.pdf with upsert, so regenerating replaces
 *    the same object and never creates another document.
 */
import type { StandaloneClient } from "../adapters/standalone/client";
import type { Json } from "@/integrations/supabase/types";
import type { CertificateTemplate } from "@/lib/certificate-templates/types";
import {
  assertPdfBuildable, assertRevocable, buildEmissionSnapshot, emissionSummary, pickTemplate, validUntilFrom,
  type CertificateSnapshot, type FrozenIncident, type TemplateSourceKind,
} from "../domain/certificate-rules";
import { legacyCertificateItemResult } from "../domain/session-rules";

const ok = <T>(r: { data: T; error: unknown }): T => { if (r.error) throw r.error; return r.data; };
const NOT_FOUND = "Certificado no encontrado";
const CROSS = "El recurso no pertenece a la organización activa";
const i18n = (n: unknown, code?: string | null) => {
  const o = (n ?? {}) as Record<string, string>;
  return o.es ?? o.en ?? o.ca ?? code ?? "";
};

const inflightEmit = new Map<string, Promise<unknown>>();
const inflightPdf = new Map<string, Promise<unknown>>();
const single = <T>(m: Map<string, Promise<unknown>>, k: string, fn: () => Promise<T>): Promise<T> => {
  const p = m.get(k) as Promise<T> | undefined;
  if (p) return p;
  const n = fn().finally(() => m.delete(k));
  m.set(k, n);
  return n;
};

export type TemplateInput = Omit<CertificateTemplate, "id" | "paper_size"> & { paper_size?: string };

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
      return ok(await c.from("certificate_items").select("*, assets(id, code, name), maintenance_sessions(id, code)").eq("certificate_id", certId)) ?? [];
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
      const rows = ok(await c.from("certificate_items").select("id, result, certificates(id, code, title, issued_on, valid_until, status, company_id)").eq("asset_id", assetId)) ?? [];
      return rows.filter((r) => (r.certificates as { company_id?: string } | null)?.company_id === orgId);
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
        const snapshot = buildEmissionSnapshot({
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
            maintenance_item_id: it.id, result: legacyCertificateItemResult(it.result), notes: it.observations ?? null,
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
      let session: { plan_id: string | null; status: string; metadata: unknown; maintenance_plans: { name: string } | null; locations: { name: string } | null } | null = null;
      let mItems: Array<{ id: string; asset_id: string; metadata: unknown }> = [];
      if (sessionId) {
        session = ok(await c.from("maintenance_sessions").select("plan_id, status, metadata, maintenance_plans(name), locations(name)")
          .eq("id", sessionId).eq("company_id", orgId).maybeSingle()) as typeof session;
        if (!session) throw new Error(CROSS);
        mItems = (ok(await c.from("maintenance_items").select("id, asset_id, metadata").eq("session_id", sessionId)) ?? []) as typeof mItems;
      }
      const [company, incs] = await Promise.all([
        c.from("companies").select("name, cif, address, logo_url").eq("id", orgId).maybeSingle().then(ok),
        incidentsForItems(orgId, mItems.map((m) => m.id)),
      ]);
      return { cert, certItems, sessionId, session, mItems, company, incidents: incs };
    },
    resolveTemplateForSession: async (orgId: string, planId: string | null) => resolveTemplate(orgId, planId),

    async signedLogoUrl(path: string, seconds = 60) {
      try { const { data } = await c.storage.from("company-logos").createSignedUrl(path, seconds); return data?.signedUrl ?? path; }
      catch { return path; }
    },

    storePdf(orgId: string, certId: string, bytes: Uint8Array, hashHex: string) {
      return single(inflightPdf, `${orgId}:${certId}`, async () => {
        const cert = await getOwn(orgId, certId);
        assertPdfBuildable(cert.status);
        const path = `${orgId}/certificates/${certId}.pdf`;
        const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
        const { error } = await c.storage.from("signed-certificates").upload(path, new Blob([ab], { type: "application/pdf" }), { contentType: "application/pdf", upsert: true });
        if (error) throw error;
        ok(await c.from("certificates").update({ pdf_url: path, pdf_hash_sha256: hashHex }).eq("id", certId).eq("company_id", orgId));
        return { pdfUrl: path };
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
      if (patch.logo_url && !patch.logo_url.startsWith(`${orgId}/`)) throw new Error(CROSS);
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
