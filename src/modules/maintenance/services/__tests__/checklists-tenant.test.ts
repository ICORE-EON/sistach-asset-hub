/**
 * Checklists: tenant switch with live cache, late responses, no cache contamination, writes with the
 * current orgId and guards that refuse cross-org children. Real repo + service over a fake client.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryObserver, MutationObserver } from "@tanstack/query-core";
import { createChecklistsRepo } from "../../data/checklists.repo";

const A = "00000000-0000-0000-0000-00000000000a";
const B = "00000000-0000-0000-0000-00000000000b";
type Row = Record<string, unknown>;

const DB: Record<string, Row[]> = {
  checklist_templates: [
    { id: "tA", code: "CHK-A", name: "A", company_id: A, deleted_at: null, active: true, current_version: 1 },
    { id: "tB", code: "CHK-B", name: "B", company_id: B, deleted_at: null, active: true, current_version: 1 },
  ],
  checklist_template_versions: [
    { id: "vA", template_id: "tA", version: 1, is_published: true },
    { id: "vB", template_id: "tB", version: 1, is_published: true },
  ],
  checklist_questions: [
    { id: "qA", template_version_id: "vA", position: 1, prompt: "¿A?" },
    { id: "qB", template_version_id: "vB", position: 1, prompt: "¿B?" },
  ],
  maintenance_sessions: [{ id: "sA", company_id: A }, { id: "sB", company_id: B }],
  maintenance_items: [{ id: "iA", session_id: "sA" }, { id: "iB", session_id: "sB" }],
  checklist_responses: [
    { id: "rA", maintenance_item_id: "iA", question_id: "qA" },
    { id: "rB", maintenance_item_id: "iB", question_id: "qB" },
  ],
};

const gates: Record<string, Promise<void> | undefined> = {};
const writes: Array<{ table: string; op: string; filters: Array<[string, unknown]>; payload?: unknown }> = [];

function fakeClient() {
  const from = (table: string) => {
    const filters: Array<[string, unknown]> = [];
    const ins: Array<[string, unknown[]]> = [];
    let op = "select"; let payload: unknown; let single = false;
    const b: Record<string, unknown> = {};
    const chain = (fn?: (...a: unknown[]) => void) => (...a: unknown[]) => { fn?.(...a); return b; };
    Object.assign(b, {
      select: chain(), order: chain(), limit: chain(), gt: chain(),
      eq: chain((k, v) => filters.push([k as string, v])),
      is: chain((k, v) => filters.push([k as string, v])),
      in: chain((k, v) => ins.push([k as string, v as unknown[]])),
      insert: chain((p) => { op = "insert"; payload = p; }),
      upsert: chain((p) => { op = "upsert"; payload = p; }),
      update: chain((p) => { op = "update"; payload = p; }),
      delete: chain(() => { op = "delete"; }),
      maybeSingle: chain(() => { single = true; }), single: chain(() => { single = true; }),
      then: async (res: (v: unknown) => unknown) => {
        const org = filters.find(([k]) => k === "company_id")?.[1] as string | undefined;
        const gateKey = org ?? (filters.find(([k]) => k === "template_version_id" || k === "template_id")?.[1] as string);
        if (gateKey && gates[gateKey]) await gates[gateKey];
        if (op !== "select") {
          writes.push({ table, op, filters: [...filters], payload });
          return res({ data: single ? { id: `new-${table}` } : null, error: null });
        }
        const rows = (DB[table] ?? []).filter((r) =>
          filters.every(([k, v]) => r[k] === v || (v === null && r[k] == null)) &&
          ins.every(([k, vs]) => vs.includes(r[k])));
        return res({ data: single ? rows[0] ?? null : rows, error: null });
      },
    });
    return b;
  };
  return { from };
}

const repo = createChecklistsRepo(fakeClient() as never);
vi.mock("../../adapters/standalone/repos", () => ({ get checklistsRepo() { return repo; }, assetsRepo: {} }));
const { checklistKeys, checklistService } = await import("../checklists");

beforeEach(() => { writes.length = 0; });

describe("checklist query keys", () => {
  it("every factory embeds orgId at position 1 and differs between tenants", () => {
    const f = Object.entries(checklistKeys) as Array<[string, (o: string, x?: string) => readonly unknown[]]>;
    expect(f.length).toBe(8);
    for (const [name, k] of f) {
      expect(k(A, "x")[1], name).toBe(A);
      expect(JSON.stringify(k(A, "x"))).not.toBe(JSON.stringify(k(B, "x")));
    }
  });

  it("migrated screens use checklistKeys/assetKeys and never import the client", () => {
    for (const f of [
      "src/routes/_authenticated/_app.checklist-templates.index.tsx",
      "src/routes/_authenticated/_app.checklist-templates.$id.tsx",
    ]) {
      const src = readFileSync(resolve(process.cwd(), f), "utf8");
      expect(src, f).not.toMatch(/@\/integrations\/supabase|supabase\./);
      for (const line of src.split("\n")) {
        if (!line.includes("queryKey:")) continue;
        expect(line, `${f}: ${line.trim()}`).toMatch(/checklistKeys\.|assetKeys\./);
      }
    }
    const session = readFileSync(resolve(process.cwd(), "src/routes/_authenticated/_app.maintenance.$id.tsx"), "utf8");
    expect(session).not.toMatch(/from\("checklist_/);
  });

  it("migrated domains never invalidate a bare, org-less prefix", () => {
    for (const f of [
      "src/routes/_authenticated/_app.checklist-templates.index.tsx",
      "src/routes/_authenticated/_app.checklist-templates.$id.tsx",
      "src/routes/_authenticated/_app.asset-families.tsx",
      "src/routes/_authenticated/_app.asset-types.tsx",
      "src/routes/_authenticated/_app.assets.index.tsx",
      "src/routes/_authenticated/_app.assets.$id.tsx",
      "src/components/first-aid-kit-panel.tsx",
    ]) {
      const src = readFileSync(resolve(process.cwd(), f), "utf8");
      expect(src, f).not.toMatch(/invalidateQueries\(\{\s*queryKey:\s*\[/);
    }
  });
});

describe("tenant switch with active cache", () => {
  const opts = (org: string) => ({ queryKey: checklistKeys.list(org), queryFn: () => checklistService.listTemplates(org) });

  it("A's templates are never shown for B; each org keeps its own entry", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
    const obs = new QueryObserver<Row[]>(qc, opts(A));
    const unsub = obs.subscribe(() => {});
    await vi.waitFor(() => expect(obs.getCurrentResult().data).toBeDefined());
    expect(obs.getCurrentResult().data!.map((r) => r.id)).toEqual(["tA"]);
    obs.setOptions(opts(B));
    expect(obs.getCurrentResult().data).toBeUndefined();
    await vi.waitFor(() => expect(obs.getCurrentResult().data).toBeDefined());
    expect(obs.getCurrentResult().data!.map((r) => r.id)).toEqual(["tB"]);
    unsub();
  });

  it("a late response for A's questions cannot land in B's view", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    let release!: () => void;
    gates["vA"] = new Promise((r) => { release = r; });
    const q = (org: string, v: string) => ({ queryKey: checklistKeys.questions(org, v), queryFn: () => checklistService.listQuestions(org, v) });
    const obs = new QueryObserver<Row[]>(qc, q(A, "vA"));
    const unsub = obs.subscribe(() => {});
    await new Promise((r) => setTimeout(r, 5));
    obs.setOptions(q(B, "vB"));
    await vi.waitFor(() => expect(obs.getCurrentResult().data).toBeDefined());
    release(); delete gates["vA"];
    await vi.waitFor(() => expect(qc.getQueryData(checklistKeys.questions(A, "vA"))).toBeDefined());
    expect(obs.getCurrentResult().data!.map((r) => r.id)).toEqual(["qB"]);
    unsub();
  });

  it("invalidating B's list leaves A's cached list untouched", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
    await qc.fetchQuery(opts(A)); await qc.fetchQuery(opts(B));
    await qc.invalidateQueries({ queryKey: checklistKeys.list(B) });
    expect(qc.getQueryState(checklistKeys.list(A))!.isInvalidated).toBe(false);
    expect(qc.getQueryState(checklistKeys.list(B))!.isInvalidated).toBe(true);
  });
});

describe("cross-org guards and writes", () => {
  it("children of another org's template/session are refused before any write", async () => {
    await expect(checklistService.listVersions(B, "tA")).rejects.toThrow(/organización activa/);
    await expect(checklistService.listQuestions(B, "vA")).rejects.toThrow(/organización activa/);
    await expect(checklistService.listResponses(B, "iA")).rejects.toThrow(/organización activa/);
    await expect(checklistService.addQuestion(B, "vA", { position: 1, prompt: "x", help_text: null, response_type: "boolean", required: true, creates_incident: false, options: null })).rejects.toThrow(/organización activa/);
    await expect(checklistService.deleteQuestion(B, "vA", "qA")).rejects.toThrow(/organización activa/);
    await expect(checklistService.saveResponse(B, "iA", "vA", { question_id: "qA", answer: true, is_fail: false, observations: null })).rejects.toThrow(/organización activa/);
    await expect(checklistService.createVersion(B, "tA", 2, null)).rejects.toThrow(/organización activa/);
    await expect(checklistService.publishVersion(B, "tA", "vA", 1)).rejects.toThrow(/organización activa/);
    expect(writes).toHaveLength(0);
    expect(await checklistService.latestPublishedVersions(B, ["tA"])).toEqual(new Map());
    await expect(checklistService.getTemplate(B, "tA")).rejects.toThrow(/no encontrada/);
  });

  it("mutation re-bound after org switch writes with B", async () => {
    const qc = new QueryClient();
    const bind = (org: string) => ({ mutationFn: () => checklistService.updateTemplateScope(org, "tB", { asset_family_id: null, asset_type_ids: [], location_ids: [], include_sublocations: true }) });
    const m = new MutationObserver(qc, bind(A));
    m.setOptions(bind(B));
    await m.mutate();
    expect(writes).toHaveLength(1);
    expect(writes[0].filters).toContainEqual(["company_id", B]);
    expect(JSON.stringify(writes)).not.toContain(A);
  });

  it("create keeps prior validation and scopes the insert to the org; legacy single type mirrored", async () => {
    const base = { code: "chk", name: "N", familyId: "f", allTypes: false, typeIds: ["t1"], allLocations: true, locationIds: [], includeSub: true, description: "" };
    expect(() => checklistService.createTemplate(B, { ...base, familyId: "" })).toThrow(/obligatorios/);
    expect(() => checklistService.createTemplate(B, { ...base, typeIds: [] })).toThrow(/tipo de activo/);
    expect(() => checklistService.createTemplate(B, { ...base, allLocations: false })).toThrow(/centro/);
    expect(() => checklistService.createTemplate(null, base)).toThrow(/Sin empresa activa/);
    await checklistService.createTemplate(B, base);
    const tpl = writes[0].payload as Row;
    expect(tpl).toMatchObject({ company_id: B, code: "CHK", asset_type_ids: ["t1"], asset_type_id: "t1", location_ids: [] });
    expect(writes[1]).toMatchObject({ table: "checklist_template_versions", payload: { version: 1, is_published: false } });
  });

  it("responses are saved for the current org's item with the same upsert shape", async () => {
    await checklistService.saveResponse(B, "iB", "vB", { question_id: "qB", answer: "OK", is_fail: false, observations: null });
    expect(writes[0]).toMatchObject({ table: "checklist_responses", op: "upsert", payload: { maintenance_item_id: "iB", answer: { value: "OK" } } });
  });
});
