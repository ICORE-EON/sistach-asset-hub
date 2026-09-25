/**
 * Tenant switch with live cache: two simulated orgs (A, B), real TanStack QueryClient,
 * real repository + service code over a tenant-aware fake client. No DB involved.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryObserver, MutationObserver } from "@tanstack/query-core";
import { createAssetsRepo } from "../../data/assets.repo";

const ORG_A = "00000000-0000-0000-0000-00000000000a";
const ORG_B = "00000000-0000-0000-0000-00000000000b";

type Row = Record<string, unknown>;
const DB: Record<string, Row[]> = {
  assets: [
    { id: "a1", code: "AST-A-1", company_id: ORG_A, deleted_at: null },
    { id: "b1", code: "AST-B-1", company_id: ORG_B, deleted_at: null },
  ],
  asset_families: [
    { id: "fa", code: "fam_a", company_id: ORG_A, active: true },
    { id: "fb", code: "fam_b", company_id: ORG_B, active: true },
    { id: "fs", code: "sys", company_id: null, active: true },
  ],
  asset_types: [
    { id: "ta", code: "TA", company_id: ORG_A, active: true },
    { id: "tb", code: "TB", company_id: ORG_B, active: true },
  ],
  locations: [
    { id: "la", name: "Sede A", company_id: ORG_A, active: true, deleted_at: null },
    { id: "lb", name: "Sede B", company_id: ORG_B, active: true, deleted_at: null },
  ],
  first_aid_kit_contents: [{ id: "k1", kit_asset_id: "a1", product_name: "ALCOHOL" }],
};

/** Per-org response delay, to simulate a slow tenant A response arriving after switching to B. */
const delay: Record<string, number> = {};
const gates: Record<string, Promise<void> | undefined> = {};
const writes: Array<{ table: string; op: string; filters: Array<[string, unknown]>; payload?: unknown }> = [];

function tenantClient() {
  const from = (table: string) => {
    const filters: Array<[string, unknown]> = [];
    let orFilter = "";
    let op = "select";
    let payload: unknown;
    let single = false;
    const b: Record<string, unknown> = {};
    const chain = (fn?: (...a: unknown[]) => void) => (...a: unknown[]) => { fn?.(...a); return b; };
    Object.assign(b, {
      select: chain(), order: chain(), limit: chain(), in: chain(),
      eq: chain((k, v) => filters.push([k as string, v])),
      is: chain((k, v) => filters.push([k as string, v])),
      or: chain((s) => { orFilter = s as string; }),
      insert: chain((p) => { op = "insert"; payload = p; }),
      update: chain((p) => { op = "update"; payload = p; }),
      delete: chain(() => { op = "delete"; }),
      maybeSingle: chain(() => { single = true; }),
      then: async (res: (v: unknown) => unknown) => {
        const org = (filters.find(([k]) => k === "company_id")?.[1] as string | undefined)
          ?? (orFilter.match(/company_id\.eq\.([\w-]+)/)?.[1]);
        if (org && gates[org]) await gates[org];
        if (org && delay[org]) await new Promise((r) => setTimeout(r, delay[org]));
        if (op !== "select") { writes.push({ table, op, filters: [...filters], payload }); return res({ data: null, error: null }); }
        let rows = (DB[table] ?? []).filter((r) =>
          filters.every(([k, v]) => r[k] === v || (v === null && r[k] == null)));
        if (orFilter) rows = rows.filter((r) => r.company_id === org || r.company_id == null);
        return res({ data: single ? rows[0] ?? null : rows, error: null });
      },
    });
    return b;
  };
  return {
    from, rpc: vi.fn(async (_fn: string, args: { p_company_id: string }) => ({ data: `AST-${args.p_company_id.slice(-1)}-9`, error: null })),
  };
}

const repo = createAssetsRepo(tenantClient() as never);
vi.mock("../../adapters/standalone/repos", () => ({ get assetsRepo() { return repo; } }));
const { assetKeys, assetService } = await import("../assets");

beforeEach(() => { writes.length = 0; for (const k of Object.keys(delay)) delete delay[k]; });

describe("query keys", () => {
  it("every assetKeys factory embeds orgId at position 1 and differs between tenants", () => {
    const factories = Object.entries(assetKeys) as Array<[string, (o: string, ...r: string[]) => readonly unknown[]]>;
    expect(factories.length).toBe(8);
    for (const [name, f] of factories) {
      const a = f(ORG_A, "x"), b = f(ORG_B, "x");
      expect(a[1], name).toBe(ORG_A);
      expect(b[1], name).toBe(ORG_B);
      expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
    }
  });

  it("migrated screens only build read keys through assetKeys (static scan)", () => {
    const files = [
      "src/routes/_authenticated/_app.asset-families.tsx",
      "src/routes/_authenticated/_app.asset-types.tsx",
      "src/routes/_authenticated/_app.assets.index.tsx",
      "src/routes/_authenticated/_app.assets.$id.tsx",
      "src/components/first-aid-kit-panel.tsx",
    ];
    for (const f of files) {
      const src = readFileSync(resolve(process.cwd(), f), "utf8");
      expect(src, f).not.toMatch(/@\/integrations\/supabase/);
      for (const line of src.split("\n")) {
        if (!line.includes("queryKey:") || line.includes("invalidateQueries")) continue;
        expect(line, `${f}: ${line.trim()}`).toMatch(/assetKeys\.|kitKey/);
      }
      if (src.includes("kitKey")) expect(src).toMatch(/kitKey\s*=\s*assetKeys\.kit\(/);
    }
  });
});

describe("tenant switch with active cache", () => {
  const listOpts = (org: string) => ({
    queryKey: assetKeys.list(org), queryFn: () => assetService.listAssets(org),
  });

  it("A's data is never served for B; each tenant has its own cache entry", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
    const obs = new QueryObserver<Row[]>(qc, listOpts(ORG_A));
    const seen: string[][] = [];
    const unsub = obs.subscribe((r) => { if (r.data) seen.push(r.data.map((x) => x.code as string)); });
    await vi.waitFor(() => expect(obs.getCurrentResult().data).toBeDefined());
    expect(obs.getCurrentResult().data!.map((r) => r.id)).toEqual(["a1"]);

    obs.setOptions(listOpts(ORG_B)); // switch org, as the UI does when activeCompanyId changes
    expect(obs.getCurrentResult().data).toBeUndefined(); // no placeholder from A
    await vi.waitFor(() => expect(obs.getCurrentResult().data).toBeDefined());
    expect(obs.getCurrentResult().data!.map((r) => r.id)).toEqual(["b1"]);

    expect(qc.getQueryData(assetKeys.list(ORG_A))).toEqual([expect.objectContaining({ id: "a1" })]);
    expect(qc.getQueryData(assetKeys.list(ORG_B))).toEqual([expect.objectContaining({ id: "b1" })]);
    expect(seen.flat().filter((c) => c.includes("-A-")).length).toBe(1);
    expect(seen.at(-1)).toEqual(["AST-B-1"]);
    unsub();
  });

  it("families/types/sites/detail of A don't appear in B (system rows shared only)", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const get = (org: string) => Promise.all([
      qc.fetchQuery({ queryKey: assetKeys.families(org), queryFn: () => assetService.listFamilies(org) }),
      qc.fetchQuery({ queryKey: assetKeys.types(org), queryFn: () => assetService.listTypes(org) }),
      qc.fetchQuery({ queryKey: assetKeys.sites(org), queryFn: () => assetService.listActiveSites(org) }),
    ]);
    const [fa, ta, la] = await get(ORG_A);
    const [fb, tb, lb] = await get(ORG_B);
    expect(fa.map((r) => r.id).sort()).toEqual(["fa", "fs"]);
    expect(fb.map((r) => r.id).sort()).toEqual(["fb", "fs"]);
    expect(ta.map((r) => r.id)).toEqual(["ta"]);
    expect(tb.map((r) => r.id)).toEqual(["tb"]);
    expect(la.map((r) => r.id)).toEqual(["la"]);
    expect(lb.map((r) => r.id)).toEqual(["lb"]);
    await expect(assetService.getAsset(ORG_B, "a1")).rejects.toThrow(/no encontrado/);
    await expect(assetService.listKitItems(ORG_B, "a1")).rejects.toThrow(/organización activa/);
  });

  it("clearing the cache on org change removes every A entry", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await qc.fetchQuery({ queryKey: assetKeys.list(ORG_A), queryFn: () => assetService.listAssets(ORG_A) });
    await qc.fetchQuery({ queryKey: assetKeys.detail(ORG_A, "a1"), queryFn: () => assetService.getAsset(ORG_A, "a1") });
    qc.removeQueries({ predicate: (q) => q.queryKey[1] === ORG_A });
    expect(qc.getQueryCache().findAll().filter((q) => q.queryKey.includes(ORG_A))).toHaveLength(0);
  });

  it("a late response from A cannot contaminate B's view", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    let releaseA!: () => void;
    gates[ORG_A] = new Promise((r) => { releaseA = r; });
    const obs = new QueryObserver<Row[]>(qc, listOpts(ORG_A));
    const unsub = obs.subscribe(() => {});
    await new Promise((r) => setTimeout(r, 5)); // A in flight, blocked

    obs.setOptions(listOpts(ORG_B));
    await vi.waitFor(() => expect(obs.getCurrentResult().data).toBeDefined());
    expect(obs.getCurrentResult().data!.map((r) => r.id)).toEqual(["b1"]);

    releaseA(); delete gates[ORG_A];
    await vi.waitFor(() => expect(qc.getQueryData(assetKeys.list(ORG_A))).toBeDefined());
    // A's late payload landed only under A's key; the B view is untouched.
    expect(obs.getCurrentResult().data!.map((r) => r.id)).toEqual(["b1"]);
    expect(qc.getQueryData<Row[]>(assetKeys.list(ORG_B))!.map((r) => r.id)).toEqual(["b1"]);
    unsub();
  });
});

describe("writes always use the current orgId", () => {
  it("mutation re-bound on re-render writes with B, not the A captured at mount", async () => {
    const qc = new QueryClient();
    const bind = (org: string) => ({ mutationFn: (id: string) => assetService.deleteAsset(org, id) });
    const m = new MutationObserver(qc, bind(ORG_A));
    m.setOptions(bind(ORG_B)); // what useMutation does when activeCompanyId changes
    await m.mutate("b1");
    expect(writes).toHaveLength(1);
    expect(writes[0].filters).toContainEqual(["company_id", ORG_B]);
    expect(writes[0].filters).not.toContainEqual(["company_id", ORG_A]);
  });

  it("every write path carries the passed orgId (insert payload or filter)", async () => {
    await assetService.createFamily(ORG_B, { code: "x", name: "X", color: "#000", requiresCertificate: false });
    await assetService.createType(ORG_B, { code: "t", name: "T", category: "c", familyId: "" });
    await assetService.createAsset(ORG_B, { asset_type_id: "tb", location_id: null, name: null, manufacturer: null, model: null, serial_number: null, install_date: null, notes: null });
    await assetService.updateAsset(ORG_B, "b1", { asset_type_id: "tb", location_id: null, name: "n", manufacturer: null, model: null, serial_number: null, install_date: null, notes: null, warranty_until: null, status: "active" });
    await assetService.deleteFamily(ORG_B, "fb");
    await assetService.deleteType(ORG_B, "tb");
    for (const w of writes) {
      const p = w.payload as Row | undefined;
      const scoped = p?.company_id === ORG_B || w.filters.some(([k, v]) => k === "company_id" && v === ORG_B);
      expect(scoped, `${w.table}.${w.op}`).toBe(true);
      expect(JSON.stringify(w)).not.toContain(ORG_A);
    }
    expect(writes).toHaveLength(6);
  });

  it("kit writes on another org's asset are refused before writing", async () => {
    await expect(assetService.saveKitItem(ORG_B, "a1", null, { product_code: null, product_name: "X", quantity: 1, unit: null }))
      .rejects.toThrow(/organización activa/);
    expect(writes).toHaveLength(0);
  });

  it("writes without an active org fail closed", async () => {
    expect(() => assetService.deleteAsset(null, "b1")).toThrow(/Sin empresa activa/);
    expect(writes).toHaveLength(0);
  });
});
