/**
 * Plans: tenant switch with live cache, late responses, cache separation, writes with the current
 * orgId and guards that refuse cross-org resources before any write. Real repo + service over a fake client.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryObserver, MutationObserver } from "@tanstack/query-core";
import { createPlansRepo } from "../../data/plans.repo";

const A = "00000000-0000-0000-0000-00000000000a";
const B = "00000000-0000-0000-0000-00000000000b";
type Row = Record<string, unknown>;

const DB: Record<string, Row[]> = {
  maintenance_plans: [
    { id: "pA", code: "PLAN-A", company_id: A, deleted_at: null, active: true },
    { id: "pB", code: "PLAN-B", company_id: B, deleted_at: null, active: true },
  ],
  maintenance_plan_assets: [
    { id: "paA", plan_id: "pA", asset_id: "aA" },
    { id: "paB", plan_id: "pB", asset_id: "aB" },
  ],
  assets: [
    { id: "aA", company_id: A, deleted_at: null, status: "active", asset_type_id: "tSys", location_id: "lA" },
    { id: "aB", company_id: B, deleted_at: null, status: "active", asset_type_id: "tSys", location_id: "lB" },
    { id: "aB2", company_id: B, deleted_at: null, status: "retired", asset_type_id: "tSys", location_id: "lB" },
  ],
  asset_families: [
    { id: "fSys", company_id: null, is_system: true },
    { id: "fA", company_id: A, is_system: false },
  ],
  asset_types: [
    { id: "tSys", company_id: null, is_system: true },
    { id: "tA", company_id: A, is_system: false },
  ],
  checklist_templates: [{ id: "cA", company_id: A }, { id: "cB", company_id: B }],
  certificate_templates: [
    { id: "ctA", company_id: A, deleted_at: null },
    { id: "ctB", company_id: B, deleted_at: null },
  ],
  locations: [
    { id: "lA", company_id: A, deleted_at: null, parent_location_id: null },
    { id: "lB", company_id: B, deleted_at: null, parent_location_id: null },
  ],
};

const gates: Record<string, Promise<void> | undefined> = {};
const writes: Array<{ table: string; op: string; filters: Array<[string, unknown]>; payload?: unknown }> = [];

function fakeClient() {
  const from = (table: string) => {
    const filters: Array<[string, unknown]> = [];
    const neqs: Array<[string, unknown]> = [];
    const ins: Array<[string, unknown[]]> = [];
    let op = "select"; let payload: unknown; let single = false;
    const b: Record<string, unknown> = {};
    const chain = (fn?: (...a: unknown[]) => void) => (...a: unknown[]) => { fn?.(...a); return b; };
    Object.assign(b, {
      select: chain(), order: chain(), limit: chain(),
      eq: chain((k, v) => filters.push([k as string, v])),
      is: chain((k, v) => filters.push([k as string, v])),
      neq: chain((k, v) => neqs.push([k as string, v])),
      in: chain((k, v) => ins.push([k as string, v as unknown[]])),
      insert: chain((p) => { op = "insert"; payload = p; }),
      update: chain((p) => { op = "update"; payload = p; }),
      delete: chain(() => { op = "delete"; }),
      maybeSingle: chain(() => { single = true; }), single: chain(() => { single = true; }),
      then: async (res: (v: unknown) => unknown) => {
        const org = filters.find(([k]) => k === "company_id")?.[1] as string | undefined;
        const gateKey = org ?? (filters.find(([k]) => k === "plan_id")?.[1] as string | undefined);
        if (gateKey && gates[gateKey]) await gates[gateKey];
        if (op !== "select") {
          writes.push({ table, op, filters: [...filters], payload });
          return res({ data: single ? { id: `new-${table}` } : null, error: null });
        }
        const rows = (DB[table] ?? []).filter((r) =>
          filters.every(([k, v]) => r[k] === v || (v === null && r[k] == null)) &&
          neqs.every(([k, v]) => r[k] !== v) &&
          ins.every(([k, vs]) => vs.includes(r[k])));
        return res({ data: single ? rows[0] ?? null : rows, error: null });
      },
    });
    return b;
  };
  return { from };
}

const repo = createPlansRepo(fakeClient() as never);
vi.mock("../../adapters/standalone/repos", () => ({ get plansRepo() { return repo; }, assetsRepo: {}, checklistsRepo: {} }));
const { planKeys, planService } = await import("../plans");

beforeEach(() => { writes.length = 0; });

const baseCreate = {
  code: "plan-x", name: "N", familyId: "fSys", frequency: "quarterly", notes: "",
  scopeMode: "manual" as const, locationIds: [], includeSub: true,
  selectedIds: ["aB"], usedTypeIds: ["tSys"], templateFor: () => "cB", certTemplateId: "",
};

describe("plan query keys", () => {
  it("every factory embeds orgId at position 1 and differs between tenants", () => {
    const f = Object.entries(planKeys) as Array<[string, (o: string, x?: string) => readonly unknown[]]>;
    expect(f.length).toBe(8);
    for (const [name, k] of f) {
      expect(k(A, "x")[1], name).toBe(A);
      expect(JSON.stringify(k(A, "x"))).not.toBe(JSON.stringify(k(B, "x")));
    }
  });

  it("plan screens never import the client, build keys through factories and never invalidate bare prefixes", () => {
    for (const f of [
      "src/routes/_authenticated/_app.maintenance-plans.index.tsx",
      "src/routes/_authenticated/_app.maintenance-plans.$id.tsx",
    ]) {
      const src = readFileSync(resolve(process.cwd(), f), "utf8");
      expect(src, f).not.toMatch(/@\/integrations\/supabase|supabase\.|@\/lib\/maintenance-scope|@\/lib\/asset-families/);
      expect(src, f).not.toMatch(/invalidateQueries\(\{\s*queryKey:\s*\[/);
      for (const line of src.split("\n")) {
        if (!line.includes("queryKey:")) continue;
        expect(line, `${f}: ${line.trim()}`).toMatch(/planKeys\.|assetKeys\.|checklistKeys\./);
      }
    }
  });
});

describe("tenant switch with active cache", () => {
  const listOpts = (org: string) => ({ queryKey: planKeys.list(org), queryFn: () => planService.listPlans(org) });

  it("A's plans are never shown for B; each org keeps its own entry", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
    const obs = new QueryObserver<Row[]>(qc, listOpts(A));
    const unsub = obs.subscribe(() => {});
    await vi.waitFor(() => expect(obs.getCurrentResult().data).toBeDefined());
    expect(obs.getCurrentResult().data!.map((r) => r.id)).toEqual(["pA"]);
    obs.setOptions(listOpts(B));
    expect(obs.getCurrentResult().data).toBeUndefined();
    await vi.waitFor(() => expect(obs.getCurrentResult().data).toBeDefined());
    expect(obs.getCurrentResult().data!.map((r) => r.id)).toEqual(["pB"]);
    expect((qc.getQueryData(planKeys.list(A)) as Row[]).map((r) => r.id)).toEqual(["pA"]);
    unsub();
  });

  it("detail, plan assets, scope assets and cert templates of A never leak into B", async () => {
    await expect(planService.getPlan(B, "pA")).rejects.toThrow(/no encontrado/);
    await expect(planService.listPlanAssets(B, "pA")).rejects.toThrow(/organización activa/);
    const scope = await planService.listScopeAssets(B, { assetTypeIds: ["tSys"], locationIds: [], includeSublocations: true });
    expect(scope.map((a) => a.id)).toEqual(["aB"]); // retired excluded, A's asset absent
    expect((await planService.listCertificateTemplates(B, "code")).map((r) => r.id)).toEqual(["ctB"]);
    expect((await planService.listPlanAssets(B, "pB")).map((r) => r.id)).toEqual(["paB"]);
  });

  it("a late response for A's plan assets cannot land in B's view", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    let release!: () => void;
    gates["pA"] = new Promise((r) => { release = r; });
    const q = (org: string, p: string) => ({ queryKey: planKeys.assets(org, p), queryFn: () => planService.listPlanAssets(org, p) });
    const obs = new QueryObserver<Row[]>(qc, q(A, "pA"));
    const unsub = obs.subscribe(() => {});
    await new Promise((r) => setTimeout(r, 5));
    obs.setOptions(q(B, "pB"));
    await vi.waitFor(() => expect(obs.getCurrentResult().data).toBeDefined());
    release(); delete gates["pA"];
    await vi.waitFor(() => expect(qc.getQueryData(planKeys.assets(A, "pA"))).toBeDefined());
    expect(obs.getCurrentResult().data!.map((r) => r.id)).toEqual(["paB"]);
    unsub();
  });

  it("invalidating B's list/detail leaves A's cache untouched; removing A leaves nothing of A", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
    await qc.fetchQuery(listOpts(A)); await qc.fetchQuery(listOpts(B));
    await qc.fetchQuery({ queryKey: planKeys.detail(A, "pA"), queryFn: () => planService.getPlan(A, "pA") });
    await qc.invalidateQueries({ queryKey: planKeys.list(B), exact: true });
    await qc.invalidateQueries({ queryKey: planKeys.detail(B, "pB"), exact: true });
    expect(qc.getQueryState(planKeys.list(A))!.isInvalidated).toBe(false);
    expect(qc.getQueryState(planKeys.detail(A, "pA"))!.isInvalidated).toBe(false);
    expect(qc.getQueryState(planKeys.list(B))!.isInvalidated).toBe(true);
    qc.removeQueries({ predicate: (q) => q.queryKey[1] === A });
    expect(qc.getQueryCache().getAll().filter((q) => q.queryKey[1] === A)).toHaveLength(0);
    expect(qc.getQueryData(planKeys.list(B))).toBeDefined();
  });
});

describe("cross-org guards and writes", () => {
  it("any relation or change on another org's resources is refused before writing", async () => {
    await expect(planService.setActive(B, "pA", false)).rejects.toThrow(/organización activa/);
    await expect(planService.setCertificateTemplate(B, "pA", null)).rejects.toThrow(/organización activa/);
    await expect(planService.setCertificateTemplate(B, "pB", "ctA")).rejects.toThrow(/certificado/);
    await expect(planService.addAssets(B, "pB", ["aA"])).rejects.toThrow(/Equipo/);
    await expect(planService.addAssets(B, "pA", ["aB"])).rejects.toThrow(/Plan/);
    await expect(planService.removeAsset(B, "pA", "paA")).rejects.toThrow(/organización activa/);
    await expect(planService.createPlan(B, { ...baseCreate, familyId: "fA" })).rejects.toThrow(/Familia/);
    await expect(planService.createPlan(B, { ...baseCreate, selectedIds: ["aA"] })).rejects.toThrow(/Equipo/);
    await expect(planService.createPlan(B, { ...baseCreate, usedTypeIds: ["tA"] })).rejects.toThrow(/Tipo/);
    await expect(planService.createPlan(B, { ...baseCreate, templateFor: () => "cA" })).rejects.toThrow(/checklist/);
    await expect(planService.createPlan(B, { ...baseCreate, certTemplateId: "ctA" })).rejects.toThrow(/certificado/);
    expect(writes).toHaveLength(0);
  });

  it("create keeps prior validation messages, uppercases code and writes plan, links and type templates with B", async () => {
    await expect(planService.createPlan(null, baseCreate)).rejects.toThrow(/Sin empresa activa/);
    await expect(planService.createPlan(B, { ...baseCreate, name: "" })).rejects.toThrow(/obligatorios/);
    await expect(planService.createPlan(B, { ...baseCreate, selectedIds: [] })).rejects.toThrow(/al menos un equipo/);
    await expect(planService.createPlan(B, { ...baseCreate, templateFor: () => "" })).rejects.toThrow(/sin plantilla/);
    expect(writes).toHaveLength(0);
    expect(await planService.createPlan(B, baseCreate)).toBe(1);
    expect(writes.map((w) => `${w.op}:${w.table}`)).toEqual([
      "insert:maintenance_plans", "insert:maintenance_plan_assets", "insert:maintenance_plan_type_templates",
    ]);
    const plan = writes[0].payload as Row;
    expect(plan).toMatchObject({ company_id: B, code: "PLAN-X", asset_type_id: "tSys", checklist_template_id: "cB", interval_months: 3, scope_location_ids: [], notes: null, certificate_template_id: null });
    expect(writes[2].payload).toEqual([{ plan_id: "new-maintenance_plans", asset_type_id: "tSys", checklist_template_id: "cB" }]);
    expect(JSON.stringify(writes)).not.toContain(A);
  });

  it("a mutation re-bound after an org switch writes with B, never the captured A", async () => {
    const qc = new QueryClient();
    const bind = (org: string) => ({ mutationFn: () => planService.setActive(org, "pB", false) });
    const m = new MutationObserver(qc, bind(A));
    m.setOptions(bind(B));
    await m.mutate();
    expect(writes).toHaveLength(1);
    expect(writes[0].filters).toContainEqual(["company_id", B]);
    expect(JSON.stringify(writes)).not.toContain(A);
    writes.length = 0;
    // Stale binding to A against B's plan is refused, nothing written.
    await expect(new MutationObserver(qc, bind(A)).mutate()).rejects.toThrow(/organización activa/);
    expect(writes).toHaveLength(0);
  });

  it("add/remove on own plan are scoped to the plan and org", async () => {
    expect(await planService.addAssets(B, "pB", ["aB"])).toBe(1);
    await planService.removeAsset(B, "pB", "paB");
    expect(writes[0]).toMatchObject({ table: "maintenance_plan_assets", op: "insert", payload: [{ plan_id: "pB", asset_id: "aB" }] });
    expect(writes[1].filters).toEqual([["id", "paB"], ["plan_id", "pB"]]);
    await expect(planService.addAssets(B, "pB", [])).rejects.toThrow(/al menos un equipo/);
  });
});
