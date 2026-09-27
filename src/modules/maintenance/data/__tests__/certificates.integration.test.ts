/**
 * Smoke test against the real backend for certificates. Reads list, detail, items, incidents,
 * applied template, templates and the asset tab; composes the PDF data without rendering or
 * storing it. Writes are only exercised in ways the guards must refuse (foreign org, foreign
 * session). Nothing is generated, replaced or deleted.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { createCertificatesRepo } from "../certificates.repo";
import { composePdfData } from "../../domain/certificate-pdf-source";
import { readCertificateSnapshot } from "../../domain/certificate-rules";

const env = Object.fromEntries(
  (() => { try { return readFileSync(".env", "utf8"); } catch { return ""; } })()
    .split("\n").map((l) => l.match(/^(\w+)="?([^"]*)"?$/)).filter(Boolean).map((m) => [m![1], m![2]]),
);
const url = env.VITE_SUPABASE_URL, key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
const token = process.env.MNT_IT_ACCESS_TOKEN || process.env.LOVABLE_BROWSER_SUPABASE_ACCESS_TOKEN;
const FOREIGN = "00000000-0000-0000-0000-00000000dead";

describe.skipIf(!(url && key && token))("certificates repo · integración real", () => {
  const client = createClient<Database>(url!, key!, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
  const repo = createCertificatesRepo(client);
  const orgOf = async () => (await client.from("company_members").select("company_id").eq("active", true)).data![0].company_id;

  it("lee certificados, ítems, plantilla aplicada, plantillas y pestaña del activo; aísla otras organizaciones", async () => {
    const org = await orgOf();
    const list = await repo.listCertificates(org, "all");
    expect(await repo.listCertificates(FOREIGN, "all")).toHaveLength(0);
    expect(await repo.listTemplates(FOREIGN)).toHaveLength(0);
    const tpls = await repo.listTemplates(org);
    const sources: Record<string, number> = {};
    let items = 0;
    for (const c of list.slice(0, 5)) {
      expect((await repo.getCertificate(org, c.id)).id).toBe(c.id);
      await expect(repo.getCertificate(FOREIGN, c.id)).rejects.toThrow(/no encontrado/);
      await expect(repo.listItems(FOREIGN, c.id)).rejects.toThrow(/no encontrado/);
      const its = await repo.listItems(org, c.id); items += its.length;
      await repo.listIncidents(org, c.id);
      const sid = its.find((i) => i.maintenance_session_id)?.maintenance_session_id ?? null;
      await repo.appliedTemplate(org, c.id, readCertificateSnapshot(c.metadata, sid));
      if (c.status === "issued") {
        const src = await repo.loadPdfSource(org, c.id);
        const cur = await repo.resolveTemplateForSession(org, src.session?.plan_id ?? null);
        const d = composePdfData({ ...src, currentTemplate: cur });
        sources[d.source] = (sources[d.source] ?? 0) + 1;
        await expect(repo.loadPdfSource(FOREIGN, c.id)).rejects.toThrow(/no encontrado/);
      }
    }
    const asset = (await client.from("assets").select("id").eq("company_id", org).limit(1)).data?.[0];
    if (asset) {
      const tab = await repo.listAssetCertificates(org, asset.id);
      await expect(repo.listAssetCertificates(FOREIGN, asset.id)).rejects.toThrow(/organización activa/);
      console.log(`[IT] certificados=${list.length} ítems(5)=${items} plantillas=${tpls.length} pestañaActivo=${tab.length} fuentesPDF=${JSON.stringify(sources)}`);
    }
  });

  it("escrituras rechazadas sin persistir nada", async () => {
    const org = await orgOf();
    const c = (await repo.listCertificates(org, "all"))[0];
    if (!c) return;
    const before = await repo.getCertificate(org, c.id);
    await expect(repo.revoke(FOREIGN, c.id)).rejects.toThrow(/no encontrado/);
    await expect(repo.updateNotes(FOREIGN, c.id, "x")).rejects.toThrow(/no encontrado/);
    await expect(repo.pdfDownloadUrl(FOREIGN, c.id)).rejects.toThrow(/no encontrado/);
    await expect(repo.storePdf(FOREIGN, c.id, new Uint8Array([1]), "0")).rejects.toThrow(/no encontrado/);
    const s = (await client.from("maintenance_sessions").select("id").eq("company_id", org).limit(1)).data?.[0];
    if (s) {
      await expect(repo.emitForSession(FOREIGN, { sessionId: s.id, sessionCode: "X", planId: null, planName: null, intervalMonths: null, sessionMetadata: {},
        sessionLocationId: null, signerName: "x", signerRole: null, signature: "x", pendingCount: 0, items: [] })).rejects.toThrow(/organización activa/);
    }
    const t = (await repo.listTemplates(org))[0];
    if (t) await expect(repo.updateTemplate(FOREIGN, t.id, { name: "x" })).rejects.toThrow(/Plantilla no encontrada/);
    const after = await repo.getCertificate(org, c.id);
    expect(after.status).toBe(before.status); expect(after.notes).toBe(before.notes); expect(after.pdf_hash_sha256).toBe(before.pdf_hash_sha256);
    expect((await repo.listCertificates(org, "all")).length).toBe((await repo.listCertificates(org, "all")).length);
  });
});
