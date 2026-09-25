/**
 * Sessions: tenant switch with live cache, late responses, cache separation, writes with the current
 * orgId, cross-org refusal before writing, state transitions, idempotent create/start/close and
 * historical snapshots. Real repo + service over an in-memory fake client that applies writes.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryObserver, MutationObserver } from "@tanstack/query-core";
import { createSessionsRepo } from "../../data/sessions.repo";
import { createChecklistsRepo } from "../../data/checklists.repo";
import { canTransition, legacySessionOutcome, itemResultFor, legacyCertificateItemResult } from "../../domain/session-rules";

const A = "00000000-0000-0000-0000-00000000000a";
const B = "00000000-0000-0000-0000-00000000000b";
type Row = Record<string, unknown>;

let DB: Record<string, Row[]> = {};
const seed = () => {
  DB = {
    maintenance_sessions: [
      { id: "sA", company_id: A, code: "MTS-A", status: "in_progress", metadata: {}, created_at: "1", maintenance_plans: { name: "PA", interval_months: 3, asset_families: { requires_certificate: false } } },
      { id: "sB", company_id: B, code: "MTS-B", status: "draft", metadata: {}, created_at: "1", maintenance_plans: { name: "PB", interval_months: 3, asset_families: { requires_certificate: false } } },
      { id: "sB2", company_id: B, code: "MTS-B2", status: "in_progress", metadata: {}, created_at: "2", maintenance_plans: { name: "PB", interval_months: 3, asset_families: { requires_certificate: false } } },
    ],
    maintenance_items: [
      { id: "iA", session_id: "sA", asset_id: "aA", result: "pending", metadata: {} },
      { id: "iB1", session_id: "sB2", asset_id: "aB", result: "ok", metadata: { snapshot: { asset: { code: "AST-B" } } } },
      { id: "iB2", session_id: "sB2", asset_id: "aB2", result: "pending", metadata: {} },
    ],
    maintenance_plans: [
      { id: "pA", company_id: A, code: "PLAN-A", name: "PA", checklist_template_id: "cA", active: true, deleted_at: null },
      { id: "pB", company_id: B, code: "PLAN-B", name: "PB", frequency: "annual", interval_months: 12, checklist_template_id: "cB", active: true, deleted_at: null, scope_mode: "manual", scope_location_ids: [], scope_include_sublocations: true },
    ],
    maintenance_plan_assets: [
      { plan_id: "pA", asset_id: "aA", assets: { id: "aA", code: "AST-A", company_id: A, asset_type_id: "t", location_id: "lA" } },
      { plan_id: "pB", asset_id: "aB", assets: { id: "aB", code: "AST-B", name: "Ext B", company_id: B, asset_type_id: "t", location_id: "lB", locations: { name: "Sede B" }, asset_types: { code: "EXT" } } },
      { plan_id: "pB", asset_id: "aX", assets: { id: "aX", code: "AST-X", company_id: A, asset_type_id: "t", location_id: "lA" } }, // foreign asset linked by mistake
    ],
    maintenance_plan_type_templates: [{ plan_id: "pB", asset_type_id: "t", checklist_template_id: "cB" }],
    checklist_templates: [{ id: "cA", company_id: A }, { id: "cB", company_id: B }],
    checklist_template_versions: [{ id: "vB", template_id: "cB", version: 2, is_published: true }],
    checklist_responses: [],
    assets: [{ id: "aA", company_id: A }, { id: "aB", company_id: B }],
  };
};

const gates: Record<string, Promise<void> | undefined> = {};
const writes: Array<{ table: string; op: string; filters: Array<[string, unknown]>; payload?: unknown }> = [];
let codeSeq = 0;

function fakeClient() {
  const from = (table: string) => {
    const filters: Array<[string, unknown]> = [];
    const ins: Array<[string, unknown[]]> = [];
    let op = "select"; let payload: unknown; let single = false; let returning = false;
    const b: Record<string, unknown> = {};
    const chain = (fn?: (...a: unknown[]) => void) => (...a: unknown[]) => { fn?.(...a); return b; };
    const match = (r: Row) =>
      filters.every(([k, v]) => {
        if (k.startsWith("metadata->>")) return (r.metadata as Row | undefined)?.[k.slice(11)] === v;
        return r[k] === v || (v === null && r[k] == null);
      }) && ins.every(([k, vs]) => vs.includes(r[k]));
    Object.assign(b, {
      select: chain(() => { if (op !== "select") returning = true; }), order: chain(), limit: chain(),
      eq: chain((k, v) => filters.push([k as string, v])),
      is: chain((k, v) => filters.push([k as string, v])),
      filter: chain((k, _op, v) => filters.push([k as string, v])),
      in: chain((k, v) => ins.push([k as string, v as unknown[]])),
      insert: chain((p) => { op = "insert"; payload = p; }),
      upsert: chain((p) => { op = "upsert"; payload = p; }),
      update: chain((p) => { op = "update"; payload = p; }),
      delete: chain(() => { op = "delete"; }),
      maybeSingle: chain(() => { single = true; }), single: chain(() => { single = true; }),
      then: async (res: (v: unknown) => unknown) => {
        const org = filters.find(([k]) => k === "company_id")?.[1] as string | undefined;
        const gateKey = org ?? (filters.find(([k]) => k === "session_id")?.[1] as string | undefined);
        if (gateKey && gates[gateKey]) await gates[gateKey];
        const rows = DB[table] ?? (DB[table] = []);
        if (op === "insert") {
          writes.push({ table, op, filters: [...filters], payload });
          const list = (Array.isArray(payload) ? payload : [payload]) as Row[];
          const created = list.map((p, i) => ({ id: `new-${table}-${rows.length + i}`, ...p }));
          rows.push(...created);
          return res({ data: single ? created[0] : returning ? created : null, error: null });
        }
        if (op === "update" || op === "delete" || op === "upsert") {
          writes.push({ table, op, filters: [...filters], payload });
          const hit = rows.filter(match);
          if (op === "update") for (const r of hit) Object.assign(r, payload as Row);
          return res({ data: returning ? hit.map((r) => ({ id: r.id })) : null, error: null });
        }
        const found = rows.filter(match);
        return res({ data: single ? found[0] ?? null : found, error: null });
      },
    });
    return b;
  };
  const rpc = async (_fn: string, args: { p_prefix: string }) => ({ data: `${args.p_prefix}-${++codeSeq}`, error: null });
  return { from, rpc };
}

const client = fakeClient();
const repo = createSessionsRepo(client as never);
const chkRepo = createChecklistsRepo(client as never);
const legacy = {
  openIncidentsForFailures: vi.fn(async () => 0),
  findSessionCertificate: vi.fn(async () => null as null | { id: string; code: string }),
  emitSessionCertificate: vi.fn(async () => ({ cert: { id: "c1", code: "CERT-1" }, pdfFailed: false })),
};
vi.mock("../../adapters/standalone/repos", () => ({
  get sessionsRepo() { return repo; }, get checklistsRepo() { return chkRepo; }, get legacyIntegrations() { return legacy; },
  assetsRepo: {}, plansRepo: {},
}));
const { sessionKeys, sessionService } = await import("../sessions");

beforeEach(() => { seed(); writes.length = 0; vi.clearAllMocks(); });

const sig = { signerName: " Ana ", signerRole: "", signature: "data:image/png;base64,x" };

describe("session rules (unchanged)", () => {
  it("transitions: only draft→in_progress and in_progress→closed", () => {
    expect(canTransition("draft", "in_progress")).toBe(true);
    expect(canTransition("in_progress", "closed")).toBe(true);
    for (const [f, t] of [["draft", "closed"], ["closed", "in_progress"], ["closed", "closed"], ["cancelled", "in_progress"], ["in_progress", "draft"]])
      expect(canTransition(f, t), `${f}->${t}`).toBe(false);
  });
  it("outcome, item result and certificate mapping match the previous inline code", () => {
    expect(legacySessionOutcome(["ok", "ok"], 0)).toBe("ok");
    expect(legacySessionOutcome(["ok", "skipped"], 1)).toBe("incomplete");
    expect(legacySessionOutcome(["with_incident", "ok"], 0)).toBe("with_incidents");
    expect(legacySessionOutcome(["fail", "skipped"], 1)).toBe("incomplete_with_incidents");
    expect(itemResultFor("na", 3)).toBe("not_applicable");
    expect(itemResultFor("complete", 0)).toBe("ok");
    expect(itemResultFor("complete", 1)).toBe("with_incident");
    expect(["ok", "with_incident", "fail", "skipped", "not_applicable", "pending"].map(legacyCertificateItemResult))
      .toEqual(["ok", "conditional", "failed", "na", "ok", "ok"]);
  });
});

describe("session query keys and screens", () => {
  it("every factory embeds orgId at position 1 and differs between tenants", () => {
    const f = Object.entries(sessionKeys) as Array<[string, (o: string, x?: string) => readonly unknown[]]>;
    expect(f.length).toBe(8);
    for (const [name, k] of f) {
      expect(k(A, "x")[1], name).toBe(A);
      expect(JSON.stringify(k(A, "x"))).not.toBe(JSON.stringify(k(B, "x")));
    }
  });
  it("session screens never import the client and never invalidate bare prefixes", () => {
    for (const f of [
      "src/routes/_authenticated/_app.maintenance.index.tsx",
      "src/routes/_authenticated/_app.maintenance.$id.tsx",
    ]) {
      const src = readFileSync(resolve(process.cwd(), f), "utf8");
      expect(src, f).not.toMatch(/@\/integrations\/supabase|supabase\.|\.from\(|\.rpc\(/);
      expect(src, f).not.toMatch(/invalidateQueries\(\{\s*queryKey:\s*\[/);
      for (const line of src.split("\n")) {
        if (!line.includes("queryKey:")) continue;
        expect(line, `${f}: ${line.trim()}`).toMatch(/sessionKeys\.|checklistKeys\./);
      }
    }
    const hist = readFileSync(resolve(process.cwd(), "src/components/asset-history-panel.tsx"), "utf8");
    expect(hist).not.toMatch(/from\("maintenance_items"\)/);
  });
});

describe("tenant switch with active cache", () => {
  const listOpts = (org: string) => ({ queryKey: sessionKeys.list(org, "all"), queryFn: () => sessionService.listSessions(org, "all") });

  it("A's sessions are never shown for B; each org keeps its own entry", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
    const obs = new QueryObserver<Row[]>(qc, listOpts(A));
    const unsub = obs.subscribe(() => {});
    await vi.waitFor(() => expect(obs.getCurrentResult().data).toBeDefined());
    expect(obs.getCurrentResult().data!.map((r) => r.id)).toEqual(["sA"]);
    obs.setOptions(listOpts(B));
    expect(obs.getCurrentResult().data).toBeUndefined();
    await vi.waitFor(() => expect(obs.getCurrentResult().data).toBeDefined());
    expect(obs.getCurrentResult().data!.map((r) => r.id).sort()).toEqual(["sB", "sB2"]);
    unsub();
  });

  it("detail/items of A never readable from B", async () => {
    await expect(sessionService.getSession(B, "sA")).rejects.toThrow(/no encontrada/);
    await expect(sessionService.listItems(B, "sA")).rejects.toThrow(/organización activa/);
    await expect(sessionService.listPlanLocations(B, "pA")).rejects.toThrow(/organización activa/);
    await expect(sessionService.listAssetHistory(B, "aA")).rejects.toThrow(/organización activa/);
    expect((await sessionService.listItems(B, "sB2")).map((r) => r.id)).toEqual(["iB1", "iB2"]);
  });

  it("a late response for A's items cannot land in B's view", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    let release!: () => void;
    gates["sA"] = new Promise((r) => { release = r; });
    const q = (org: string, s: string) => ({ queryKey: sessionKeys.items(org, s), queryFn: () => sessionService.listItems(org, s) });
    const obs = new QueryObserver<Row[]>(qc, q(A, "sA"));
    const unsub = obs.subscribe(() => {});
    await new Promise((r) => setTimeout(r, 5));
    obs.setOptions(q(B, "sB2"));
    await vi.waitFor(() => expect(obs.getCurrentResult().data).toBeDefined());
    release(); delete gates["sA"];
    await vi.waitFor(() => expect(qc.getQueryData(sessionKeys.items(A, "sA"))).toBeDefined());
    expect(obs.getCurrentResult().data!.map((r) => r.id)).toEqual(["iB1", "iB2"]);
    unsub();
  });

  it("invalidating B's lists/detail leaves A's cache untouched", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
    await qc.fetchQuery(listOpts(A)); await qc.fetchQuery(listOpts(B));
    await qc.fetchQuery({ queryKey: sessionKeys.detail(A, "sA"), queryFn: () => sessionService.getSession(A, "sA") });
    await qc.invalidateQueries({ queryKey: sessionKeys.lists(B) });
    await qc.invalidateQueries({ queryKey: sessionKeys.detail(B, "sB"), exact: true });
    expect(qc.getQueryState(sessionKeys.list(A, "all"))!.isInvalidated).toBe(false);
    expect(qc.getQueryState(sessionKeys.detail(A, "sA"))!.isInvalidated).toBe(false);
    expect(qc.getQueryState(sessionKeys.list(B, "all"))!.isInvalidated).toBe(true);
  });
});

describe("cross-org guards, transitions and idempotency", () => {
  it("operations on another org's session/plan/item are refused before writing", async () => {
    await expect(sessionService.startSession(B, "sA")).rejects.toThrow(/organización activa/);
    await expect(sessionService.closeSession(B, "sA", sig)).rejects.toThrow(/organización activa/);
    await expect(sessionService.completeItem(B, { sessionId: "sA", item: { id: "iA", asset_id: "aA" }, intent: "na", observations: "", questions: [] })).rejects.toThrow(/organización activa/);
    await expect(sessionService.completeItem(B, { sessionId: "sB2", item: { id: "iA", asset_id: "aA" }, intent: "na", observations: "", questions: [] })).rejects.toThrow(/organización activa/);
    await expect(sessionService.createSession(B, { requestId: "r", planId: "pA", locationId: "", scheduledFor: "", technicianName: "" })).rejects.toThrow(/organización activa/);
    await expect(chkRepo.saveResponse(B, "iA", "v", { question_id: "q", answer: 1, is_fail: false, observations: null })).rejects.toThrow(/organización activa/);
    expect(writes).toHaveLength(0);
  });

  it("invalid transitions and writes on non-running sessions are rejected", async () => {
    await expect(sessionService.closeSession(B, "sB", sig)).rejects.toThrow(/Transición no permitida/);
    await expect(sessionService.completeItem(B, { sessionId: "sB", item: { id: "x", asset_id: "x" }, intent: "na", observations: "", questions: [] })).rejects.toThrow(/no está iniciada/);
    DB.maintenance_sessions.find((s) => s.id === "sB2")!.status = "closed";
    await expect(sessionService.completeItem(B, { sessionId: "sB2", item: { id: "iB1", asset_id: "aB" }, intent: "na", observations: "", questions: [] })).rejects.toThrow(/cerrada/);
    await expect(chkRepo.saveResponse(B, "iB1", "vB", { question_id: "q", answer: 1, is_fail: false, observations: null })).rejects.toThrow(/cerrada/);
    await expect(sessionService.startSession(B, "sB2")).rejects.toThrow(/cerrada/);
    expect(writes).toHaveLength(0);
  });

  it("start is idempotent: a second start writes nothing", async () => {
    expect(await sessionService.startSession(B, "sB")).toBe(true);
    expect(await sessionService.startSession(B, "sB")).toBe(false);
    expect(writes.filter((w) => w.op === "update")).toHaveLength(1);
    expect(writes[0].filters).toContainEqual(["status", "draft"]);
    expect(writes[0].filters).toContainEqual(["company_id", B]);
  });

  it("create is idempotent by requestId, skips foreign assets and stores plan/asset/checklist snapshots", async () => {
    const v = { requestId: "req-1", planId: "pB", locationId: "", scheduledFor: "", technicianName: "Tec" };
    const id1 = await sessionService.createSession(B, v);
    const id2 = await sessionService.createSession(B, v); // retry / double click
    expect(id2).toBe(id1);
    const sessions = DB.maintenance_sessions.filter((s) => (s.metadata as Row).client_request_id === "req-1");
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({ company_id: B, status: "draft", technician_name: "Tec", plan_id: "pB" });
    expect((sessions[0].metadata as Row).snapshot).toMatchObject({ plan: { id: "pB", code: "PLAN-B", name: "PB", frequency: "annual" } });
    const items = DB.maintenance_items.filter((i) => i.session_id === id1);
    expect(items.map((i) => i.asset_id)).toEqual(["aB"]); // aX belongs to A → excluded, no duplicates
    expect(items[0]).toMatchObject({ result: "pending", checklist_template_version_id: "vB" });
    expect((items[0].metadata as Row).snapshot).toMatchObject({ asset: { code: "AST-B", name: "Ext B", location_name: "Sede B", type_code: "EXT" }, checklist: { version_id: "vB", version: 2 } });
    expect(JSON.stringify(writes)).not.toContain(A);
  });

  it("completing an item writes with the current org and keeps the snapshot", async () => {
    const r = await sessionService.completeItem(B, { sessionId: "sB2", item: { id: "iB1", asset_id: "aB" }, intent: "complete", observations: "", questions: [] });
    expect(r).toEqual({ dbResult: "ok", createdIncidents: 0, failsWithoutIncident: 0 });
    const it = DB.maintenance_items.find((i) => i.id === "iB1")!;
    expect((it.metadata as Row).snapshot).toEqual({ asset: { code: "AST-B" } });
    expect(it.observations).toBeNull();
    expect(writes.at(-1)!.filters).toEqual([["id", "iB1"], ["session_id", "sB2"]]);
  });

  it("close is idempotent: second close does not re-close nor re-emit; pending → skipped; outcome frozen", async () => {
    const first = await sessionService.closeSession(B, "sB2", sig);
    expect(first).toEqual({ cert: null, pdfFailed: false });
    const s = DB.maintenance_sessions.find((x) => x.id === "sB2")!;
    expect(s).toMatchObject({ status: "closed", signer_name: "Ana", signer_role: null });
    expect(s.metadata).toMatchObject({ outcome: "incomplete", skipped_count: 1 });
    expect((s.metadata as { close_snapshot: { items: Row[] } }).close_snapshot.items).toEqual([
      { item_id: "iB1", asset_id: "aB", result: "ok", asset: { code: "AST-B" } },
      { item_id: "iB2", asset_id: "aB2", result: "skipped", asset: null },
    ]);
    const n = writes.length;
    await sessionService.closeSession(B, "sB2", sig);
    expect(writes.length).toBe(n);
  });

  it("close with certificate: emitted once; retry after close resumes only a missing certificate", async () => {
    const s = DB.maintenance_sessions.find((x) => x.id === "sB2")!;
    (s.maintenance_plans as Row).asset_families = { requires_certificate: true };
    await sessionService.closeSession(B, "sB2", sig);
    expect(legacy.emitSessionCertificate).toHaveBeenCalledTimes(1);
    expect(legacy.emitSessionCertificate.mock.calls[0][0]).toBe(B);
    legacy.findSessionCertificate.mockResolvedValueOnce({ id: "c1", code: "CERT-1" });
    expect(await sessionService.closeSession(B, "sB2", sig)).toEqual({ cert: { id: "c1", code: "CERT-1" }, pdfFailed: false });
    expect(legacy.emitSessionCertificate).toHaveBeenCalledTimes(1);
    // Closed but certificate missing (first attempt failed after closing) → emitted with stored signer.
    await sessionService.closeSession(B, "sB2", { ...sig, signerName: "Otro" });
    expect(legacy.emitSessionCertificate).toHaveBeenCalledTimes(2);
    expect((legacy.emitSessionCertificate.mock.calls[1] as unknown as [string, Row])[1].signerName).toBe("Ana");
  });

  it("validation messages unchanged and a mutation re-bound after org switch writes with B", async () => {
    await expect(sessionService.closeSession(B, "sB2", { ...sig, signerName: " " })).rejects.toThrow("Indica el nombre del firmante");
    await expect(sessionService.closeSession(B, "sB2", { ...sig, signature: null })).rejects.toThrow("Firma para continuar");
    expect(() => sessionService.createSession(B, { requestId: "r", planId: "", locationId: "", scheduledFor: "", technicianName: "" })).toThrow("Selecciona un plan");
    expect(() => sessionService.listSessions(null, "all")).toThrow(/Sin empresa activa/);
    const qc = new QueryClient();
    const bind = (org: string) => ({ mutationFn: () => sessionService.startSession(org, "sB") });
    const m = new MutationObserver(qc, bind(A));
    m.setOptions(bind(B));
    await m.mutate();
    expect(writes.at(-1)!.filters).toContainEqual(["company_id", B]);
    expect(JSON.stringify(writes)).not.toContain(A);
  });
});
