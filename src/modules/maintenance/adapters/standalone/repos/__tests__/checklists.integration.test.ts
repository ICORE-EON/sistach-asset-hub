/**
 * Smoke test against the real backend. Reads templates/versions/questions/scope/responses of the
 * user's org. Writes are validated only in ways that cannot persist: into a foreign org (RLS must
 * reject) and through guards that must refuse before any write reaches the database.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { createChecklistsRepo } from "../checklists.repo";
import { resolveTemplatesForType } from "../../domain/checklist-scope";

const env = Object.fromEntries(
  (() => { try { return readFileSync(".env", "utf8"); } catch { return ""; } })()
    .split("\n").map((l) => l.match(/^(\w+)="?([^"]*)"?$/)).filter(Boolean).map((m) => [m![1], m![2]]),
);
const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
const token = process.env.MNT_IT_ACCESS_TOKEN || process.env.LOVABLE_BROWSER_SUPABASE_ACCESS_TOKEN;
const run = !!(url && key && token);
const FOREIGN_ORG = "00000000-0000-0000-0000-00000000dead";

describe.skipIf(!run)("checklists repo · integración real", () => {
  const client = createClient<Database>(url!, key!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const repo = createChecklistsRepo(client);

  it("lee plantillas, versiones, preguntas, ámbito y respuestas; aísla otras organizaciones", async () => {
    const { data: members } = await client.from("company_members").select("company_id").eq("active", true);
    const orgId = members![0].company_id;

    const templates = await repo.listTemplates(orgId);
    const published = await repo.listPublishedTemplates(orgId);
    expect(Array.isArray(templates)).toBe(true);
    for (const p of published) expect(templates.some((t) => t.id === p.id)).toBe(true);
    expect(await repo.listTemplates(FOREIGN_ORG)).toHaveLength(0);

    let questions = 0, versions = 0;
    for (const t of templates) {
      expect((await repo.getTemplate(orgId, t.id))?.id).toBe(t.id);
      expect(await repo.getTemplate(FOREIGN_ORG, t.id)).toBeNull();
      expect(await repo.getTemplateScope(FOREIGN_ORG, t.id)).toBeNull();
      const scope = await repo.getTemplateScope(orgId, t.id);
      expect(scope).not.toBeNull();
      const vs = await repo.listVersions(orgId, t.id);
      versions += vs.length;
      await expect(repo.listVersions(FOREIGN_ORG, t.id)).rejects.toThrow(/organización activa/);
      if (vs[0]) {
        questions += (await repo.listQuestions(orgId, vs[0].id)).length;
        await expect(repo.listQuestions(FOREIGN_ORG, vs[0].id)).rejects.toThrow(/organización activa/);
      }
    }
    const latest = await repo.latestPublishedVersions(orgId, published.map((p) => p.id));
    expect(latest.size).toBe(published.length);
    expect((await repo.latestPublishedVersions(FOREIGN_ORG, published.map((p) => p.id))).size).toBe(0);

    // Existing selection rule applies unchanged to real rows: each typed template matches its own types.
    for (const p of published) for (const typeId of (p.asset_type_ids as string[] | null) ?? []) {
      const hits = resolveTemplatesForType(published as never[], { assetTypeId: typeId, familyId: p.asset_family_id });
      expect(hits.map((h: { id: string }) => h.id)).toContain(p.id);
    }

    const { data: item } = await client.from("maintenance_items").select("id").limit(1).maybeSingle();
    let responses = 0;
    if (item) {
      responses = (await repo.listResponses(orgId, item.id)).length;
      await expect(repo.listResponses(FOREIGN_ORG, item.id)).rejects.toThrow(/organización activa/);
    }
    console.info(`[IT] plantillas=${templates.length} publicadas=${published.length} versiones=${versions} preguntas(últ.)=${questions} respuestas=${responses}`);
  });

  it("escrituras seguras: una organización ajena se rechaza y nada se persiste", async () => {
    await expect(repo.createTemplate(FOREIGN_ORG, {
      code: "IT-NOPE", name: "no debe existir", asset_family_id: null, asset_type_ids: [], location_ids: [],
      include_sublocations: true, description: null,
    })).rejects.toBeTruthy();
    const { data: leaked } = await client.from("checklist_templates").select("id").eq("code", "IT-NOPE");
    expect(leaked ?? []).toHaveLength(0);

    const { data: members } = await client.from("company_members").select("company_id").eq("active", true);
    const tpl = (await repo.listTemplates(members![0].company_id))[0];
    if (tpl) {
      const before = (await repo.listVersions(members![0].company_id, tpl.id)).length;
      await expect(repo.createVersion(FOREIGN_ORG, tpl.id, 999, null)).rejects.toThrow(/organización activa/);
      const scopeBefore = await repo.getTemplateScope(members![0].company_id, tpl.id);
      // Filter by company_id: a foreign-org update matches zero rows.
      await repo.updateTemplateScope(FOREIGN_ORG, tpl.id, { asset_family_id: null, asset_type_ids: [], location_ids: [], include_sublocations: false });
      expect(await repo.getTemplateScope(members![0].company_id, tpl.id)).toEqual(scopeBefore);
      expect((await repo.listVersions(members![0].company_id, tpl.id)).length).toBe(before);
    }
  });
});
