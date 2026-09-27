/**
 * Incidents: rules, provenance fallback, tenant switch with live cache, late responses, cache
 * separation, writes with the current orgId, cross-org refusal before writing and idempotent
 * automatic creation. Real repo + service over an in-memory fake client that applies writes.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryObserver } from "@tanstack/query-core";
import { createIncidentsRepo } from "../../data/incidents.repo";
import { canTransitionIncident, resolveIncidentOrigin, transitionPatch } from "../../domain/incident-rules";

const A = "00000000-0000-0000-0000-00000000000a";
const B = "00000000-0000-0000-0000-00000000000b";
type Row = Record<string, unknown>;
let DB: Record<string, Row[]> = {};
const seed = () => {
  DB = {
    incidents: [
      { id: "incA", company_id: A, code: "INC-A", title: "A", status: "open", severity: "low", asset_id: "aA", source: "manual", metadata: {}, created_at: "1" },
      { id: "incB", company_id: B, code: "INC-B", title: "B", status: "open", severity: "high", asset_id: "aB", source: "manual", metadata: {}, created_at: "1" },
      { id: "incBc", company_id: B, code: "INC-Bc", title: "Bc", status: "closed", severity: "low", asset_id: "aB", source: "manual", metadata: {}, created_at: "2" },
    ],
    incident_status_history: [{ id: "h1", incident_id: "incA", to_status: "open" }, { id: "h2", incident_id: "incB", to_status: "open" }],
    assets: [{ id: "aA", company_id: A, deleted_at: null }, { id: "aB", company_id: B, deleted_at: null }],
    company_members: [{ company_id: A, user_id: "uA", active: true }, { company_id: B, user_id: "uB", active: true }],
  };
};
const writes: Array<{ table: string; op: string; filters: Array<[string, unknown]>; payload?: unknown }> = [];
const gates: Record<string, Promise<void> | undefined> = {};
let seq = 0;
function fakeClient() {
  const from = (table: string) => {
    const filters: Array<[string, unknown]> = [];
    let op = "select"; let payload: unknown; let single = false; let returning = false;
    const b: Record<string, unknown> = {};
    const chain = (fn?: (...a: unknown[]) => void) => (...a: unknown[]) => { fn?.(...a); return b; };
    const match = (r: Row) => filters.every(([k, v]) => r[k] === v || (v === null && r[k] == null));
    Object.assign(b, {
      select: chain(() => { if (op !== "select") returning = true; }), order: chain(), limit: chain(),
      eq: chain((k, v) => filters.push([k as string, v])), is: chain((k, v) => filters.push([k as string, v])),
      insert: chain((p) => { op = "insert"; payload = p; }), update: chain((p) => { op = "update"; payload = p; }),
      delete: chain(() => { op = "delete"; }),
      single: chain(() => { single = true; }), maybeSingle: chain(() => { single = true; }),
      then: async (res: (v: unknown) => unknown) => {
        const gate = filters.find(([k]) => k === "company_id")?.[1] as string | undefined;
        if (gate && gates[gate]) await gates[gate];
        await new Promise((r) => setTimeout(r, 1));
        const rows = (DB[table] ??= []);
        if (op === "insert") {
          writes.push({ table, op, filters: [...filters], payload });
          const created = (Array.isArray(payload) ? payload : [payload]).map((p) => ({ id: `new-${++seq}`, ...(p as Row) }));
          rows.push(...created);
          return res({ data: single ? created[0] : returning ? created : null, error: null });
        }
        if (op === "update" || op === "delete") {
          writes.push({ table, op, filters: [...filters], payload });
          const hit = rows.filter(match);
          if (op === "update") for (const r of hit) Object.assign(r, payload as Row);
          else DB[table] = rows.filter((r) => !match(r));
          return res({ data: returning ? hit.map((r) => ({ id: r.id })) : null, error: null });
        }
        const found = rows.filter(match);
        return res({ data: single ? found[0] ?? null : found, error: null });
      },
    });
    return b;
  };
  const rpc = async (_f: string, a: { p_prefix: string }) => ({ data: `${a.p_prefix}-${++seq}`, error: null });
  return { from, rpc };
}
const repo = createIncidentsRepo(fakeClient() as never);
vi.mock("../../adapters/standalone/repos", () => ({ get incidentsRepo() { return repo; } }));
const { incidentKeys, incidentService } = await import("../incidents");

beforeEach(() => { seed(); writes.length = 0; });
const incWrites = () => writes.filter((w) => w.table === "incidents");

describe("incident rules (unchanged)", () => {
  it("only the transitions the screen offers", () => {
    const okT = [["open", "in_progress"], ["open", "resolved"], ["in_progress", "open"], ["in_progress", "resolved"], ["resolved", "closed"], ["resolved", "in_progress"], ["closed", "in_progress"]];
    for (const [f, t] of okT) expect(canTransitionIncident(f, t), `${f}->${t}`).toBe(true);
    for (const [f, t] of [["open", "closed"], ["closed", "resolved"], ["closed", "open"], ["resolved", "open"], ["cancelled", "open"], ["acknowledged", "in_progress"], ["open", "open"]])
      expect(canTransitionIncident(f, t), `${f}->${t}`).toBe(false);
  });
  it("patch stamps resolved_at/closed_at and notes only when resolving", () => {
    expect(transitionPatch("resolved", "T", "n")).toEqual({ status: "resolved", resolved_at: "T", resolution_notes: "n" });
    expect(transitionPatch("closed", "T")).toEqual({ status: "closed", closed_at: "T" });
    expect(transitionPatch("in_progress", "T", "n")).toEqual({ status: "in_progress" });
  });
  it("provenance: snapshot, pre-snapshot legacy and malformed are distinguished; manual has none", () => {
    const base = { source_maintenance_item_id: "i", source_response_id: "r" };
    expect(resolveIncidentOrigin({ ...base, source: "manual", metadata: {} }).kind).toBe("none");
    expect(resolveIncidentOrigin({ ...base, source: "maintenance", metadata: {} })).toEqual({ kind: "legacy", reason: "pre_snapshot", hasSessionLink: true, hasResponseLink: true });
    expect(resolveIncidentOrigin({ ...base, source: "maintenance", metadata: { origin: { schema: 1 } } })).toMatchObject({ kind: "legacy", reason: "malformed" });
    const snapshot = { schema: 1, kind: "checklist_failure", captured_at: "2026-01-01", session: { id: "s", code: "MTS" }, item: { id: "i" }, asset: { id: "a", code: "AST", name: null }, question: { id: "q", prompt: "P", version_id: null } };
    expect(resolveIncidentOrigin({ ...base, source: "maintenance", metadata: { origin: snapshot } })).toEqual({ kind: "snapshot", snapshot });
  });
});

describe("keys and screens", () => {
  it("every factory embeds orgId at position 1 and differs between tenants", () => {
    const f = Object.entries(incidentKeys) as Array<[string, (o: string, x?: string) => readonly unknown[]]>;
    expect(f.length).toBe(7);
    for (const [n, k] of f) { expect(k(A, "x")[1], n).toBe(A); expect(JSON.stringify(k(A, "x"))).not.toBe(JSON.stringify(k(B, "x"))); }
  });
  it("incident screens and the asset tab never import the client nor invalidate bare prefixes", () => {
    for (const f of ["src/modules/maintenance/ui/pages/IncidentsListPage.tsx", "src/modules/maintenance/ui/pages/IncidentDetailPage.tsx"]) {
      const src = readFileSync(resolve(process.cwd(), f), "utf8");
      expect(src, f).not.toMatch(/@\/integrations\/supabase|supabase\.|\.from\(|\.rpc\(/);
      expect(src, f).not.toMatch(/invalidateQueries\(\{\s*queryKey:\s*\[/);
      for (const l of src.split("\n")) if (l.includes("queryKey:")) expect(l, l).toMatch(/incidentKeys\./);
    }
    const hist = readFileSync(resolve(process.cwd(), "src/modules/maintenance/ui/components/asset-history-panel.tsx"), "utf8");
    expect(hist).not.toMatch(/from\("incidents"\)/);
  });
});

describe("tenant switch with active cache", () => {
  const listOpts = (o: string) => ({ queryKey: incidentKeys.list(o, "all"), queryFn: () => incidentService.listIncidents(o, "all") });
  it("A's incidents never shown for B", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
    const obs = new QueryObserver<Row[]>(qc, listOpts(A)); const un = obs.subscribe(() => {});
    await vi.waitFor(() => expect(obs.getCurrentResult().data).toBeDefined());
    expect(obs.getCurrentResult().data!.map((r) => r.id)).toEqual(["incA"]);
    obs.setOptions(listOpts(B));
    expect(obs.getCurrentResult().data).toBeUndefined();
    await vi.waitFor(() => expect(obs.getCurrentResult().data).toBeDefined());
    expect(obs.getCurrentResult().data!.map((r) => r.id).sort()).toEqual(["incB", "incBc"]);
    un();
  });
  it("detail, history and asset tab of A not readable from B", async () => {
    await expect(incidentService.getIncident(B, "incA")).rejects.toThrow(/no encontrada/);
    await expect(incidentService.listHistory(B, "incA")).rejects.toThrow(/no encontrada/);
    await expect(incidentService.listAssetIncidents(B, "aA")).rejects.toThrow(/organización activa/);
    expect((await incidentService.listHistory(B, "incB")).map((h) => h.id)).toEqual(["h2"]);
  });
  it("a late response for A cannot land in B's view", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    let release!: () => void; gates[A] = new Promise((r) => { release = r; });
    const obs = new QueryObserver<Row[]>(qc, listOpts(A)); const un = obs.subscribe(() => {});
    await new Promise((r) => setTimeout(r, 5));
    obs.setOptions(listOpts(B));
    await vi.waitFor(() => expect(obs.getCurrentResult().data).toBeDefined());
    release(); delete gates[A];
    await vi.waitFor(() => expect(qc.getQueryData(incidentKeys.list(A, "all"))).toBeDefined());
    expect(obs.getCurrentResult().data!.map((r) => r.id).sort()).toEqual(["incB", "incBc"]);
    un();
  });
  it("invalidating B leaves A's cache untouched", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
    await qc.fetchQuery(listOpts(A)); await qc.fetchQuery(listOpts(B));
    await qc.invalidateQueries({ queryKey: incidentKeys.lists(B) });
    expect(qc.getQueryState(incidentKeys.list(A, "all"))!.isInvalidated).toBe(false);
    expect(qc.getQueryState(incidentKeys.list(B, "all"))!.isInvalidated).toBe(true);
  });
});

describe("writes, guards and idempotency", () => {
  it("writes carry the current org, never a captured one", async () => {
    let org = A; const current = () => org;
    org = B;
    await incidentService.createManual(current(), { title: " T ", description: "", severity: "low", assetId: "aB" });
    await incidentService.update(current(), "incB", { title: "x", description: "", severity: "high", assignedTo: "uB", dueDate: "" });
    await incidentService.changeStatus(current(), "incB", { from: "open", to: "in_progress", userId: "uB" });
    for (const w of incWrites()) {
      const org = (w.payload as Row | undefined)?.company_id ?? w.filters.find(([k]) => k === "company_id")?.[1];
      expect(org).toBe(B);
    }
    expect(incWrites()).toHaveLength(3);
  });
  it("cross-org references and resources are refused before writing", async () => {
    await expect(incidentService.createManual(B, { title: "T", description: "", severity: "low", assetId: "aA" })).rejects.toThrow(/organización activa/);
    await expect(incidentService.update(B, "incB", { title: "x", description: "", severity: "low", assignedTo: "uA", dueDate: "" })).rejects.toThrow(/organización activa/);
    await expect(incidentService.update(B, "incA", { title: "x", description: "", severity: "low", assignedTo: "none", dueDate: "" })).rejects.toThrow(/no encontrada/);
    await expect(incidentService.changeStatus(B, "incA", { from: "open", to: "in_progress", userId: null })).rejects.toThrow(/no encontrada/);
    await expect(incidentService.remove(B, "incA")).rejects.toThrow(/no encontrada/);
    await expect(repo.openForFailures(B, { session: { id: "s", code: null }, item: { id: "i", asset_id: "aA" }, asset: { code: null, name: null } }, [{ id: "r", observations: null, prompt: "P" }])).rejects.toThrow(/organización activa/);
    await expect(incidentService.createManual(null, { title: "T", description: "", severity: "low", assetId: "none" })).rejects.toThrow(/Sin empresa/);
    expect(writes).toHaveLength(0);
  });
  it("invalid transitions, stale screens, closed edits and bad severity are refused", async () => {
    await expect(incidentService.changeStatus(B, "incB", { from: "open", to: "closed", userId: null })).rejects.toThrow(/no permitida/);
    await expect(incidentService.changeStatus(B, "incB", { from: "in_progress", to: "open", userId: null })).rejects.toThrow(/ha cambiado/);
    await expect(incidentService.update(B, "incBc", { title: "x", description: "", severity: "low", assignedTo: "none", dueDate: "" })).rejects.toThrow(/cerrada/);
    await expect(incidentService.createManual(B, { title: "T", description: "", severity: "urgent", assetId: "none" })).rejects.toThrow(/Severidad/);
    await expect(incidentService.createManual(B, { title: "  ", description: "", severity: "low", assetId: "none" })).rejects.toThrow(/obligatorio/);
    expect(writes).toHaveLength(0);
    await incidentService.changeStatus(B, "incBc", { from: "closed", to: "in_progress", userId: null }); // reopen still allowed
    expect(DB.incidents.find((i) => i.id === "incBc")!.status).toBe("in_progress");
  });
  it("resolve stores notes and status in one update plus one history row", async () => {
    await incidentService.resolve(B, "incB", { from: "open", notes: "hecho", userId: "uB" });
    const i = DB.incidents.find((x) => x.id === "incB")!;
    expect(i).toMatchObject({ status: "resolved", resolution_notes: "hecho" });
    expect(incWrites().filter((w) => w.op === "update")).toHaveLength(1);
    expect(DB.incident_status_history.filter((h) => h.incident_id === "incB" && h.to_status === "resolved")).toHaveLength(1);
  });
  it("automatic creation: snapshot stored, retries and double clicks never duplicate", async () => {
    const ctx = { session: { id: "sB", code: "MTS-B" }, item: { id: "iB", asset_id: "aB" }, asset: { code: "AST-B", name: "Ext" } };
    const failed = [{ id: "rB1", observations: "roto", prompt: "¿Presión?", question_id: "q1", version_id: "v1" }, { id: "rB2", observations: null, prompt: undefined }];
    const [n1, n2] = await Promise.all([repo.openForFailures(B, ctx, failed), repo.openForFailures(B, ctx, failed)]);
    expect(n1 + n2).toBe(2);
    expect(await repo.openForFailures(B, ctx, failed)).toBe(0);
    const auto = DB.incidents.filter((i) => i.source === "maintenance");
    expect(auto).toHaveLength(2);
    const o = resolveIncidentOrigin(auto[0] as never);
    expect(o.kind).toBe("snapshot");
    if (o.kind === "snapshot") expect(o.snapshot).toMatchObject({ session: { code: "MTS-B" }, asset: { code: "AST-B" }, question: { prompt: "¿Presión?", version_id: "v1" } });
    expect(auto.every((i) => i.company_id === B && i.status === "open" && i.severity === "medium")).toBe(true);
  });
});
