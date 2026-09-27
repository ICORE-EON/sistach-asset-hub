/**
 * RESIDUAL integrations kept verbatim for domains not migrated yet. Adapter layer only.
 *  - certificates (block 6): certificate emission on close, PDF generation, session certificate link
 * Every call is scoped to orgId. They will move to their own repository in block 6.
 */
import type { StandaloneClient } from "./client";
import { legacyCertificateItemResult } from "../../domain/session-rules";

const ok = <T>(r: { data: T; error: unknown }): T => { if (r.error) throw r.error; return r.data; };

export function createLegacyIntegrations(c: StandaloneClient, generatePdf: (certId: string) => Promise<unknown>) {
  return {
    async findSessionCertificate(orgId: string, sessionId: string) {
      const data = ok(await c.from("certificate_items").select("certificates(id, code, status, company_id)")
        .eq("maintenance_session_id", sessionId).limit(1).maybeSingle());
      const cert = data?.certificates as { id: string; code: string; status: string; company_id: string } | null | undefined;
      return cert && cert.company_id === orgId ? { id: cert.id, code: cert.code, status: cert.status } : null;
    },

    /** Same certificate as before. Returns pdfFailed so the UI keeps the previous warning. */
    async emitSessionCertificate(orgId: string, args: {
      sessionId: string; sessionCode: string; planName: string | null; intervalMonths: number | null;
      signerName: string; signerRole: string | null; signature: string; pendingCount: number;
      items: Array<{ id: string; asset_id: string; result: string; observations: string | null }>;
    }) {
      const code = ok(await c.rpc("next_code", { p_company_id: orgId, p_scope: "certificate", p_prefix: "CERT" }));
      const today = new Date();
      const validUntil = args.intervalMonths
        ? new Date(today.getFullYear(), today.getMonth() + args.intervalMonths, today.getDate()).toISOString().slice(0, 10)
        : null;
      const okCount = args.items.filter((i) => i.result === "ok").length;
      const failCount = args.items.filter((i) => i.result === "with_incident" || i.result === "fail").length;
      const summary = `${okCount} equipo(s) OK${failCount > 0 ? `, ${failCount} con incidencias` : ""}${
        args.pendingCount > 0 ? `, ${args.pendingCount} sin revisar` : ""}.`;
      const cert = ok(await c.from("certificates").insert({
        company_id: orgId, code: code as string,
        title: `Certificado de mantenimiento — ${args.planName ?? args.sessionCode}`,
        issued_on: today.toISOString().slice(0, 10), valid_until: validUntil,
        issuer_name: args.signerName, issuer_role: args.signerRole, signature_image_url: args.signature,
        notes: summary, status: "issued",
      }).select().single())!;
      if (args.items.length > 0) {
        ok(await c.from("certificate_items").insert(args.items.map((it) => ({
          certificate_id: cert.id, asset_id: it.asset_id, maintenance_session_id: args.sessionId,
          maintenance_item_id: it.id, result: legacyCertificateItemResult(it.result), notes: it.observations ?? null,
        }))));
      }
      let pdfFailed = false;
      try { await generatePdf(cert.id); } catch (e) { console.error("PDF generation failed", e); pdfFailed = true; }
      return { cert: { id: cert.id as string, code: cert.code as string }, pdfFailed };
    },
  };
}

export type LegacyIntegrations = ReturnType<typeof createLegacyIntegrations>;
