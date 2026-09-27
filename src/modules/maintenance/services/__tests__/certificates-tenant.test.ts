/**
 * Certificates: rules, snapshot precedence, emission idempotency, tenant switch with live cache,
 * late responses, cache separation, writes with the current orgId and cross-org refusal before
 * writing. Real repo + service over an in-memory fake client (tables + storage).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryObserver } from "@tanstack/query-core";
import { createCertificatesRepo } from "../../data/certificates.repo";
import {
  assertPdfBuildable, assertRevocable, buildEmissionSnapshot, emissionSummary, pickTemplate, readCertificateSnapshot,
  requiresCertificate, validUntilFrom,
} from "../../domain/certificate-rules";
import { composePdfData } from "../../domain/certificate-pdf-source";

const A = "00000000-0000-0000-0000-00000000000a";
const B = "00000000-0000-0000-0000-00000000000b";
type Row = Record<string, unknown>;
let DB: Record<string, Row[]> = {};
const itemSnap = (id: string, code: string) => ({ snapshot: { asset: { id, code, name: `N-${code}`, type_name: "Extintor", type_code: "ext", manufacturer: "M", model: "X", location_name: "Almacén" } } });
const seed = () => {
  DB = {
    certificates: [
      { id: "cA", company_id: A, code: "CERT-A", title: "A", status: "issued", issued_on: "2026-01-01", valid_until: null, metadata: {}, deleted_at: null, pdf_url: `${A}/certificates/cA.pdf` },
      { id: "cB", company_id: B, code: "CERT-B", title: "B", status: "issued", issued_on: "2026-01-01", valid_until: null, metadata: {}, deleted_at: null, pdf_url: null },
      { id: "cBr", company_id: B, code: "CERT-Br", title: "Br", status: "revoked", issued_on: "2026-01-01", valid_until: null, metadata: {}, deleted_at: null },
    ],
    certificate_items: [
      { id: "ciA", certificate_id: "cA", asset_id: "aA", maintenance_session_id: "sA", maintenance_item_id: "iA", result: "ok", notes: null, certificates: { id: "cA", code: "CERT-A", status: "issued", company_id: A } },
      { id: "ciB", certificate_id: "cB", asset_id: "aB", maintenance_session_id: null, maintenance_item_id: null, result: "ok", notes: null, certificates: { id: "cB", code: "CERT-B", status: "issued", company_id: B } },
    ],
    certificate_templates: [
      { id: "tA", company_id: A, code: "TA", name: "Plantilla A", is_default: true, deleted_at: null },
      { id: "tB", company_id: B, code: "TB", name: "Plantilla B", is_default: true, deleted_at: null },
    ],
    assets: [{ id: "aA", company_id: A, deleted_at: null }, { id: "aB", company_id: B, deleted_at: null }],
    maintenance_sessions: [
      { id: "sA", company_id: A, status: "closed", plan_id: null, metadata: {} },
      { id: "sB", company_id: B, status: "closed", plan_id: null, metadata: { snapshot: { plan: { id: "p", name: "Plan congelado" } } } },
      { id: "sBo", company_id: B, status: "in_progress", plan_id: null, metadata: {} },
    ],
    maintenance_items: [{ id: "iA", session_id: "sA", asset_id: "aA", metadata: itemSnap("aA", "AST-A") }],
    companies: [{ id: A, name: "Empresa A", cif: "A1", address: "", logo_url: null }, { id: B, name: "Empresa B", cif: "B1", address: "", logo_url: null }],
    incidents: [], locations: [], maintenance_plans: [],
  };
};
const writes: Array<{ table: string; op: string; filters: Array<[string, unknown]>; payload?: unknown }> = [];
const uploads: string[] = [];
const gates: Record<string, Promise<void> | undefined> = {};
let seq = 0;
function fakeClient() {
  const from = (table: string) => {
    const filters: Array<[string, unknown]> = []; const ins: Array<[string, unknown[]]> = [];
    let op = "select"; let payload: unknown; let single = false; let lim: number | null = null;
    const b: Record<string, unknown> = {};
    const chain = (fn?: (...a: unknown[]) => void) => (...a: unknown[]) => { fn?.(...a); return b; };
    const match = (r: Row) => filters.every(([k, v]) => r[k] === v || (v === null && r[k] == null)) && ins.every(([k, vs]) => vs.includes(r[k]));
    Object.assign(b, {
      select: chain(), order: chain(), limit: chain((n) => { lim = n as number; }), not: chain(),
      eq: chain((k, v) => filters.push([k as string, v])), is: chain((k, v) => filters.push([k as string, v])),
      in: chain((k, v) => ins.push([k as string, v as unknown[]])),
      insert: chain((p) => { op = "insert"; payload = p; }), update: chain((p) => { op = "update"; payload = p; }),
      single: chain(() => { single = true; }), maybeSingle: chain(() => { single = true; }),
      then: async (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => {
        const gate = filters.find(([k]) => k === "company_id")?.[1] as string | undefined;
        if (gate && gates[gate]) await gates[gate];
        await new Promise((r) => setTimeout(r, 1));
        const rows = (DB[table] ??= []);
        if (op === "insert") {
          writes.push({ table, op, filters: [...filters], payload });
          const created: Row[] = (Array.isArray(payload) ? payload : [payload]).map((p) => ({ id: `new-${++seq}`, ...(p as Row) }));
          rows.push(...created);
          if (table === "certificate_items") for (const ci of created) {
            const cert = DB.certificates.find((c) => c.id === ci.certificate_id)!;
            ci.certificates = { id: cert.id, code: cert.code, status: cert.status, company_id: cert.company_id };
          }
          return res({ data: single ? created[0] : created, error: null });
        }
        if (op === "update") {
          writes.push({ table, op, filters: [...filters], payload });
          for (const r of rows.filter(match)) Object.assign(r, payload as Row);
          return res({ data: null, error: null });
        }
        let found = rows.filter(match);
        if (table === "certificate_items" && filters.some(([k]) => k === "maintenance_session_id") === false && lim === 1) found = found.filter((r) => r.maintenance_session_id);
        if (lim) found = found.slice(0, lim);
        void rej;
        return res({ data: single ? found[0] ?? null : found, error: null });
      },
    });
    return b;
  };
  const rpc = async (_f: string, a: { p_prefix: string }) => ({ data: `${a.p_prefix}-${++seq}`, error: null });
  const storage = { from: () => ({
    upload: async (path: string) => { uploads.push(path); return { error: null }; },
    createSignedUrl: async (path: string) => ({ data: { signedUrl: `signed://${path}` }, error: null }),
  }) };
  return { from, rpc, storage };
}
const repo = createCertificatesRepo(fakeClient() as never);
const render = vi.fn(async () => new Uint8Array([1, 2, 3]));
vi.mock("../../adapters/standalone/repos", () => ({ get certificatesRepo() { return repo; }, get renderCertificatePdf() { return render; } }));
const { certificateKeys, certificateService } = await import("../certificates");

beforeEach(() => { seed(); writes.length = 0; uploads.length = 0; render.mockClear(); });
const certWrites = () => writes.filter((w) => w.table === "certificates" || w.table === "certificate_items");

describe("certificate rules (unchanged)", () => {
  it("expiry = same day interval_months later; none without interval", () => {
    expect(validUntilFrom(new Date(2026, 0, 15), 3)).toBe(new Date(2026, 3, 15).toISOString().slice(0, 10));
    expect(validUntilFrom(new Date(2026, 0, 15), null)).toBeNull();
    expect(validUntilFrom(new Date(2026, 0, 15), 0)).toBeNull();
  });
  it("summary text and requires_certificate rule", () => {
    expect(emissionSummary(["ok", "with_incident", "fail", "skipped"], 1)).toBe("1 equipo(s) OK, 2 con incidencias, 1 sin revisar.");
    expect(emissionSummary(["ok"], 0)).toBe("1 equipo(s) OK.");
    expect(requiresCertificate(false)).toBe(false);
    expect(requiresCertificate(null)).toBe(true);
    expect(requiresCertificate(true)).toBe(true);
  });
  it("only issued certificates can be revoked or have a PDF built", () => {
    expect(() => assertRevocable("issued")).not.toThrow();
    for (const s of ["revoked", "superseded"]) { expect(() => assertRevocable(s)).toThrow(); expect(() => assertPdfBuildable(s)).toThrow(); }
  });
  it("template precedence plan → family → default → builtin", () => {
    expect(pickTemplate({ plan: 1, family: 2, def: 3 })).toEqual({ source: "plan", template: 1 });
    expect(pickTemplate({ family: 2, def: 3 })).toEqual({ source: "family", template: 2 });
    expect(pickTemplate({ def: 3 })).toEqual({ source: "default", template: 3 });
    expect(pickTemplate({})).toEqual({ source: "builtin", template: null });
  });
});

describe("snapshot precedence", () => {
  const snap = buildEmissionSnapshot({
    now: new Date("2026-02-01T00:00:00Z"), sessionId: "s1", sessionCode: "MTS-1",
    sessionMetadata: { snapshot: { plan: { id: "p1", name: "Plan original" } } }, sessionLocationName: null,
    company: { name: "Empresa (al emitir)", cif: "X", address: "", logo_url: null },
    items: [{ id: "i1", asset_id: "a1", result: "with_incident", observations: "obs", metadata: itemSnap("a1", "AST-1") },
      { id: "i2", asset_id: "a2", result: "skipped", observations: null, metadata: {} }],
    incidents: [], template: { source: "default", data: { name: "Plantilla al emitir" } as never },
  });
  const cert = { id: "c", code: "CERT", status: "issued", issued_on: "2026-02-01", valid_until: null, issuer_name: "Ana", issuer_role: null, signature_image_url: "sig" };
  const live = { certItems: [{ result: "conditional", notes: "obs", asset_id: "a1", maintenance_item_id: "i1", maintenance_session_id: "s1", assets: { code: "AST-1", name: "NOMBRE ACTUAL" } }],
    sessionId: "s1", session: null, mItems: [], company: { name: "Empresa ACTUAL" }, incidents: [],
    currentTemplate: { source: "plan" as const, template: { name: "Plantilla ACTUAL" } as never } };

  it("1. frozen certificate snapshot wins over any current data and template", () => {
    const d = composePdfData({ ...live, cert: { ...cert, metadata: { snapshot: snap } } });
    expect(d.source).toBe("snapshot"); expect(d.templateFrozen).toBe(true);
    expect(d.template?.name).toBe("Plantilla al emitir");
    expect(d.vars.company_name).toBe("Empresa (al emitir)"); expect(d.vars.plan_name).toBe("Plan original");
    expect(d.rows[0].asset?.name).toBe("N-AST-1"); expect(d.rows[0].result).toBe("conditional");
    expect(d.rows[1].asset).toBeNull(); expect(d.rows[1].result).toBe("na");
    expect(d.vars.location_name).toBe("Almacén");
  });
  it("snapshot of another session is rejected (falls back)", () => {
    expect(readCertificateSnapshot({ snapshot: snap }, "other")).toBeNull();
    expect(readCertificateSnapshot({ snapshot: { ...snap, v: 99 } }, "s1")).toBeNull();
  });
  it("2. without certificate snapshot: session item snapshots for assets, current template flagged", () => {
    const d = composePdfData({ ...live, cert: { ...cert, metadata: {} }, mItems: [{ id: "i1", asset_id: "a1", metadata: itemSnap("a1", "AST-1") }] });
    expect(d.source).toBe("session_snapshot"); expect(d.templateFrozen).toBe(false);
    expect(d.rows[0].asset?.name).toBe("N-AST-1");
  });
  it("3. legacy: current data, explicitly flagged", () => {
    const d = composePdfData({ ...live, cert: { ...cert, metadata: {} } });
    expect(d.source).toBe("legacy"); expect(d.rows[0].asset?.name).toBe("NOMBRE ACTUAL"); expect(d.template?.name).toBe("Plantilla ACTUAL");
  });
});

describe("keys and screens", () => {
  it("every factory embeds orgId at position 1 and differs between tenants", () => {
    const f = Object.entries(certificateKeys) as Array<[string, (o: string, x?: string) => readonly unknown[]]>;
    for (const [n, k] of f) { expect(k(A, "x")[1], n).toBe(A); expect(JSON.stringify(k(A, "x"))).not.toBe(JSON.stringify(k(B, "x"))); }
  });
  it("migrated screens never import the client nor invalidate bare prefixes", () => {
    for (const f of ["src/routes/_authenticated/_app.certificates.index.tsx", "src/routes/_authenticated/_app.certificates.$id.tsx",
      "src/routes/_authenticated/_app.certificate-templates.index.tsx", "src/routes/_authenticated/_app.certificate-templates.$id.tsx",
      "src/components/external-certificate-dialog.tsx", "src/components/asset-history-panel.tsx"]) {
      const src = readFileSync(resolve(process.cwd(), f), "utf8");
      expect(src, f).not.toMatch(/@\/integrations\/supabase|supabase\.|\.from\(|\.rpc\(|\.storage/);
      expect(src, f).not.toMatch(/invalidateQueries\(\{\s*queryKey:\s*\[/);
    }
  });
});

describe("tenant switch with active cache", () => {
  const opts = (o: string) => ({ queryKey: certificateKeys.list(o, "all"), queryFn: () => certificateService.listCertificates(o, "all") });
  it("A's certificates never shown for B; caches are separate", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
    const obs = new QueryObserver<Row[]>(qc, opts(A)); const un = obs.subscribe(() => {});
    await vi.waitFor(() => expect(obs.getCurrentResult().data).toBeDefined());
    expect(obs.getCurrentResult().data!.map((r) => r.id)).toEqual(["cA"]);
    obs.setOptions(opts(B));
    expect(obs.getCurrentResult().data).toBeUndefined();
    await vi.waitFor(() => expect(obs.getCurrentResult().data).toBeDefined());
    expect(obs.getCurrentResult().data!.map((r) => r.id).sort()).toEqual(["cB", "cBr"]);
    qc.removeQueries({ queryKey: certificateKeys.lists(A) });
    expect(qc.getQueryData(certificateKeys.list(A, "all"))).toBeUndefined();
    expect(qc.getQueryData(certificateKeys.list(B, "all"))).toBeDefined();
    un();
  });
  it("a late A response never lands in B's view", async () => {
    let release!: () => void; gates[A] = new Promise((r) => { release = r; });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
    const obs = new QueryObserver<Row[]>(qc, opts(A)); const un = obs.subscribe(() => {});
    obs.setOptions(opts(B));
    await vi.waitFor(() => expect(obs.getCurrentResult().data).toBeDefined());
    release(); gates[A] = undefined;
    await vi.waitFor(() => expect(qc.getQueryData(certificateKeys.list(A, "all"))).toBeDefined());
    expect(obs.getCurrentResult().data!.every((r) => r.company_id === B)).toBe(true);
    un();
  });
  it("asset tab only shows certificates of the current org and refuses foreign assets", async () => {
    expect((await certificateService.listAssetCertificates(A, "aA")).length).toBe(1);
    await expect(certificateService.listAssetCertificates(B, "aA")).rejects.toThrow(/organización activa/);
  });
});

describe("writes with the current org; cross-org refusals before writing", () => {
  it("revoke / notes / PDF / download / template edits on another org's certificate are refused and nothing is written", async () => {
    await expect(certificateService.revoke(B, "cA")).rejects.toThrow(/no encontrado/);
    await expect(certificateService.updateNotes(B, "cA", "x")).rejects.toThrow(/no encontrado/);
    await expect(certificateService.generatePdf(B, "cA")).rejects.toThrow(/no encontrado/);
    await expect(certificateService.pdfDownloadUrl(B, "cA")).rejects.toThrow(/no encontrado/);
    await expect(certificateService.updateTemplate(B, "tA", { name: "x" })).rejects.toThrow(/Plantilla no encontrada/);
    await expect(certificateService.deleteTemplate(B, "tA")).rejects.toThrow(/Plantilla no encontrada/);
    await expect(certificateService.updateTemplate(A, "tA", { logo_url: `${B}/templates/x.png` })).rejects.toThrow(/organización activa/);
    expect(writes).toHaveLength(0); expect(uploads).toHaveLength(0); expect(render).not.toHaveBeenCalled();
  });
  it("revoked certificates cannot be revoked again nor regenerated; no org means no write", async () => {
    await expect(certificateService.revoke(B, "cBr")).rejects.toThrow(/emitido/);
    await expect(certificateService.generatePdf(B, "cBr")).rejects.toThrow(/emitido/);
    expect(() => certificateService.revoke(null, "cB")).toThrow(/Sin empresa activa/);
    expect(writes).toHaveLength(0);
  });
  it("writes carry the current orgId", async () => {
    await certificateService.revoke(B, "cB");
    await certificateService.updateNotes(B, "cB", " n ");
    expect(certWrites().every((w) => w.filters.some(([k, v]) => k === "company_id" && v === B))).toBe(true);
    expect(DB.certificates.find((c) => c.id === "cB")!.notes).toBe("n");
  });
  it("PDF regeneration reuses one fixed path under the org (no duplicate documents)", async () => {
    await certificateService.generatePdf(A, "cA");
    await certificateService.generatePdf(A, "cA");
    expect(new Set(uploads)).toEqual(new Set([`${A}/certificates/cA.pdf`]));
    expect(writes.filter((w) => w.table === "documents")).toHaveLength(0);
    expect(DB.certificates.find((c) => c.id === "cA")!.pdf_hash_sha256).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("emission idempotency", () => {
  const args = (sessionId: string) => ({
    requiresCertificate: true, sessionId, sessionCode: "MTS", planId: null, planName: null, intervalMonths: 3,
    sessionMetadata: DB.maintenance_sessions.find((s) => s.id === sessionId)!.metadata, sessionLocationId: null,
    signerName: "Ana", signerRole: null, signature: "sig", pendingCount: 0,
    items: [{ id: "iB", asset_id: "aB", result: "ok", observations: null, metadata: itemSnap("aB", "AST-B") }],
  });
  it("double click / retry / reload → one certificate; original signer kept", async () => {
    const [r1, r2] = await Promise.all([certificateService.emitForSession(B, args("sB")), certificateService.emitForSession(B, args("sB"))]);
    expect(r1.cert!.id).toBe(r2.cert!.id);
    const r3 = await certificateService.emitForSession(B, { ...args("sB"), signerName: "Otro" });
    expect(r3.cert!.id).toBe(r1.cert!.id);
    const created = DB.certificates.filter((c) => c.company_id === B && c.code !== "CERT-B" && c.code !== "CERT-Br");
    expect(created).toHaveLength(1);
    expect(created[0].issuer_name).toBe("Ana");
    const s = readCertificateSnapshot(created[0].metadata, "sB")!;
    expect(s.plan?.name).toBe("Plan congelado"); expect(s.items[0].asset?.code).toBe("AST-B");
    expect(s.template.data).toMatchObject({ id: "tB" });
    expect(uploads.filter((u) => u.startsWith(`${B}/certificates/`))).toHaveLength(1);
  });
  it("non-closed, foreign or not-required sessions emit nothing", async () => {
    await expect(certificateService.emitForSession(B, args("sBo"))).rejects.toThrow(/no está cerrada/);
    await expect(certificateService.emitForSession(A, args("sB"))).rejects.toThrow(/organización activa/);
    expect(await certificateService.emitForSession(B, { ...args("sB"), requiresCertificate: false })).toEqual({ cert: null, pdfFailed: false });
    expect(certWrites()).toHaveLength(0);
  });
});
