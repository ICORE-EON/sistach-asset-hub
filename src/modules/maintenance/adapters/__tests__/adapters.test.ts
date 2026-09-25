import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  createAuthzPort, createAssetPort, createDocumentPort, createPeoplePort, createSitePort, createTenantPort, PERMISSION_RPC,
} from "../standalone/ports";
import { createStandaloneHost } from "../standalone/host";
import { createIcoreHostStub } from "../icore";
import { REQUIRED_PERMISSIONS, isCompatible, runPreflight } from "../../manifest";
import { CONTRACT_VERSION } from "../../contracts";
import type { StandaloneClient } from "../standalone/client";

type Res = { data: unknown; error: unknown };
/** Chainable fake: every builder method records the call and returns itself; awaiting resolves `tables[table]`. */
function fakeClient(opts: {
  tables?: Record<string, Res>;
  rpc?: (fn: string, args: unknown) => Res | Promise<Res>;
  session?: { user: { id: string } } | null;
  signed?: Res;
}) {
  const calls: Array<[string, string, unknown[]]> = [];
  const from = (table: string) => {
    const res = () => opts.tables?.[table] ?? { data: [], error: null };
    const b: Record<string, unknown> = {};
    for (const m of ["select", "eq", "in", "is", "or", "order", "limit"]) {
      b[m] = (...a: unknown[]) => { calls.push([table, m, a]); return b; };
    }
    b.maybeSingle = () => Promise.resolve(res());
    b.then = (ok: (v: Res) => unknown, ko: (e: unknown) => unknown) => Promise.resolve(res()).then(ok, ko);
    return b;
  };
  const client = {
    from,
    rpc: vi.fn(async (fn: string, args: unknown) => (opts.rpc ? opts.rpc(fn, args) : { data: true, error: null })),
    auth: { getSession: async () => ({ data: { session: opts.session ?? null } }) },
    storage: { from: () => ({ createSignedUrl: async () => opts.signed ?? { data: { signedUrl: "https://x/signed" }, error: null } }) },
  };
  return { client: client as unknown as StandaloneClient, calls, rpc: client.rpc };
}
const ORG = "11111111-1111-1111-1111-111111111111";

describe("TenantPort", () => {
  it("reflects the active company and returns null when none", () => {
    let id: string | null = ORG;
    const t = createTenantPort(() => id);
    expect(t.currentOrgId()).toBe(ORG);
    id = null; expect(t.currentOrgId()).toBeNull();
    id = ""; expect(t.currentOrgId()).toBeNull();
  });
});

describe("AuthzPort (UX only, fail-closed)", () => {
  it("maps every module permission to an existing can_* RPC", () => {
    for (const p of REQUIRED_PERMISSIONS) expect(PERMISSION_RPC[p]).toMatch(/^can_/);
  });
  it("returns true only when the RPC returns exactly true", async () => {
    const { client, rpc } = fakeClient({ rpc: () => ({ data: true, error: null }) });
    await expect(createAuthzPort(client).can("mnt.close", ORG)).resolves.toBe(true);
    expect(rpc).toHaveBeenCalledWith("can_close_session", { p_company_id: ORG });
  });
  it("denies on error, rejection, non-boolean result, missing org or unknown permission", async () => {
    const cases: Array<(fn: string) => Res | Promise<Res>> = [
      () => ({ data: null, error: { message: "boom" } }),
      () => Promise.reject(new Error("net")),
      () => ({ data: "true", error: null }),
      () => ({ data: false, error: null }),
    ];
    for (const rpc of cases) {
      const { client } = fakeClient({ rpc });
      await expect(createAuthzPort(client).can("mnt.view", ORG)).resolves.toBe(false);
    }
    const { client, rpc } = fakeClient({});
    const a = createAuthzPort(client);
    await expect(a.can("mnt.view", "")).resolves.toBe(false);
    await expect(a.can("mnt.hack" as never, ORG)).resolves.toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("PeoplePort (person_ref = profile id)", () => {
  it("builds PersonRef with name fallback to email and null when signed out", async () => {
    const { client } = fakeClient({
      session: { user: { id: "u1" } },
      tables: { profiles: { data: [{ id: "u1", full_name: " ", email: "a@b.c" }], error: null } },
    });
    const p = createPeoplePort(client);
    await expect(p.current()).resolves.toEqual({ id: "u1", displayName: "a@b.c", external: false });
    await expect(createPeoplePort(fakeClient({}).client).current()).resolves.toBeNull();
    await expect(p.get([])).resolves.toEqual([]);
  });
  it("sanitises search input and skips empty queries", async () => {
    const { client, calls } = fakeClient({});
    const p = createPeoplePort(client);
    await expect(p.search("  ")).resolves.toEqual([]);
    await p.search("ana,(x)%");
    const or = calls.find((c) => c[1] === "or")!;
    expect(or[2][0]).toBe("full_name.ilike.%anax%,email.ilike.%anax%");
  });
});

describe("SitePort", () => {
  const locs = [
    { id: "a", name: "A", code: "A", parent_location_id: null },
    { id: "b", name: "B", code: "B", parent_location_id: "a" },
    { id: "c", name: "C", code: "C", parent_location_id: "b" },
  ];
  it("maps tree scoped to org and expands descendants", async () => {
    const { client, calls } = fakeClient({ tables: { locations: { data: locs, error: null } } });
    const s = createSitePort(client);
    const tree = await s.tree(ORG);
    expect(tree[1]).toEqual({ id: "b", name: "B", code: "B", parentId: "a" });
    expect(calls).toContainEqual(["locations", "eq", ["company_id", ORG]]);
    expect((await s.expand(["a"], true)).sort()).toEqual(["a", "b", "c"]);
    expect(await s.expand(["a", "a"], false)).toEqual(["a"]);
    await expect(s.tree("")).resolves.toEqual([]);
  });
});

describe("AssetPort", () => {
  it("maps rows, filters by org and fails closed on empty inputs", async () => {
    const row = { id: "x", code: "EXT-1", name: null, asset_type_id: "t", location_id: "l", status: "active" };
    const { client, calls } = fakeClient({ tables: { assets: { data: [row], error: null } } });
    const a = createAssetPort(client);
    const list = await a.list(ORG, { typeIds: ["t"] });
    expect(list[0]).toEqual({ id: "x", code: "EXT-1", name: null, assetTypeId: "t", siteId: "l", status: "active" });
    expect(calls).toContainEqual(["assets", "eq", ["company_id", ORG]]);
    expect(calls).toContainEqual(["assets", "in", ["asset_type_id", ["t"]]]);
    await expect(a.list("")).resolves.toEqual([]);
    await expect(a.byQr("")).resolves.toBeNull();
  });
  it("propagates RLS/query errors instead of returning partial data", async () => {
    const { client } = fakeClient({ tables: { assets: { data: null, error: new Error("rls") } } });
    await expect(createAssetPort(client).list(ORG)).rejects.toThrow("rls");
  });
});

describe("DocumentPort", () => {
  it("delegates registration to the server function", async () => {
    const reg = vi.fn(async () => ({ documentId: "d", versionId: "d", sha256: "h" }));
    const d = createDocumentPort(fakeClient({}).client, reg);
    const input = { orgId: ORG, kind: "other", subject: { type: "asset", id: "x" }, bytesRef: `${ORG}/a.pdf`, mime: "application/pdf" };
    await expect(d.registerVersion(input)).resolves.toEqual({ documentId: "d", versionId: "d", sha256: "h" });
    expect(reg).toHaveBeenCalledWith(input);
  });
  it("signs only when the stored hash matches the reference", async () => {
    const doc = { storage_bucket: "documents", storage_path: "p", file_hash_sha256: "h1" };
    const { client } = fakeClient({ tables: { documents: { data: doc, error: null } } });
    const d = createDocumentPort(client, vi.fn());
    await expect(d.signedUrl({ documentId: "d", versionId: "d", sha256: "h1" })).resolves.toBe("https://x/signed");
    await expect(d.signedUrl({ documentId: "d", versionId: "d", sha256: "OTHER" })).rejects.toThrow(/huella/);
    const missing = createDocumentPort(fakeClient({ tables: { documents: { data: null, error: null } } }).client, vi.fn());
    await expect(missing.signedUrl({ documentId: "d", versionId: "d", sha256: "h" })).rejects.toThrow(/no encontrado/);
  });
});

describe("Manifest and preflight (fail-fast, fail-closed)", () => {
  it("TS manifest matches host-manifest.json", () => {
    const json = JSON.parse(readFileSync(path.resolve(__dirname, "../../host-manifest.json"), "utf8"));
    expect(json.contractVersion).toBe(CONTRACT_VERSION);
    expect(json.permissions).toEqual([...REQUIRED_PERMISSIONS]);
  });
  it("semver compatibility", () => {
    expect(isCompatible("1.2.0", "1.0.0")).toBe(true);
    expect(isCompatible("2.0.0", "1.0.0")).toBe(false);
    expect(isCompatible("1.0.0", "1.1.0")).toBe(false);
    expect(isCompatible("garbage", "1.0.0")).toBe(false);
  });
  it("reports throwing, rejecting and non-true checks as missing; empty list fails", async () => {
    const r = await runPreflight([
      { name: "ok", run: async () => true },
      { name: "throws", run: () => { throw new Error("x"); } },
      { name: "rejects", run: () => Promise.reject(new Error("x")) },
      { name: "truthy", run: async () => 1 as unknown as boolean },
    ], CONTRACT_VERSION);
    expect(r.ok).toBe(false);
    expect(r.missing).toEqual(["throws", "rejects", "truthy"]);
    expect((await runPreflight([], CONTRACT_VERSION)).ok).toBe(false);
    expect((await runPreflight([{ name: "ok", run: async () => true }], "2.0.0")).ok).toBe(false);
  });
  it("standalone host preflight passes with prerequisites and fails without org or permission RPC", async () => {
    const ok = createStandaloneHost({ client: fakeClient({}).client, getActiveCompanyId: () => ORG, registerVersion: vi.fn() });
    await expect(ok.manifest.preflight()).resolves.toMatchObject({ ok: true, missing: [] });

    const noOrg = createStandaloneHost({ client: fakeClient({}).client, getActiveCompanyId: () => null, registerVersion: vi.fn() });
    const r1 = await noOrg.manifest.preflight();
    expect(r1.ok).toBe(false);
    expect(r1.missing).toContain("organización activa");

    const noRpc = fakeClient({ rpc: () => ({ data: null, error: { code: "PGRST202" } }), tables: { documents: { data: null, error: { code: "42P01" } } } });
    const r2 = await createStandaloneHost({ client: noRpc.client, getActiveCompanyId: () => ORG, registerVersion: vi.fn() }).manifest.preflight();
    expect(r2.missing).toEqual(expect.arrayContaining(["función de permisos (can_view)", "documentos (documents)"]));
  });
  it("ICORE stub fails closed everywhere", async () => {
    const h = createIcoreHostStub();
    expect(h.tenant.currentOrgId()).toBeNull();
    await expect(h.authz.can("mnt.view", ORG)).resolves.toBe(false);
    await expect(h.assets.list(ORG)).rejects.toThrow();
    const r = await h.manifest.preflight();
    expect(r.ok).toBe(false);
    expect(r.missing.length).toBeGreaterThan(0);
  });
});
