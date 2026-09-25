/**
 * Smoke test against the real backend for maintenance plans. Reads plans, detail, plan assets,
 * certificate pick list and scope resolution for the user's org. Writes are only exercised in ways
 * that must be refused by the repository guards BEFORE reaching the database; nothing persists.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { createPlansRepo } from "../plans.repo";

const env = Object.fromEntries(
  (() => { try { return readFileSync(".env", "utf8"); } catch { return ""; } })()
    .split("\n").map((l) => l.match(/^(\w+)="?([^"]*)"?$/)).filter(Boolean).map((m) => [m![1], m![2]]),
);
const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
const token = process.env.MNT_IT_ACCESS_TOKEN || process.env.LOVABLE_BROWSER_SUPABASE_ACCESS_TOKEN;
const run = !!(url && key && token);
const FOREIGN_ORG = "00000000-0000-0000-0000-00000000dead";
const FOREIGN_ID = "00000000-0000-0000-0000-0000000000ff";

describe.skipIf(!run)("plans repo · integración real", () => {
  const client = createClient<Database>(url!, key!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const repo = createPlansRepo(client);
  const orgOf = async () => {
    const { data } = await client.from("company_members").select("company_id").eq("active", true);
    return data![0].company_id;
  };

  it("lee planes, detalle, equipos vinculados, certificados y alcance; aísla otras organizaciones", async () => {
    const orgId = await orgOf();
    const plans = await repo.listPlans(orgId);
    expect(await repo.listPlans(FOREIGN_ORG)).toHaveLength(0);
    expect(await repo.listCertificateTemplates(FOREIGN_ORG, "code")).toHaveLength(0);
    const certs = await repo.listCertificateTemplates(orgId, "code");
    let links = 0, scoped = 0;
    for (const p of plans) {
      expect((await repo.getPlan(orgId, p.id))?.id).toBe(p.id);
      expect(await repo.getPlan(FOREIGN_ORG, p.id)).toBeNull();
      const pa = await repo.listPlanAssets(orgId, p.id);
      links += pa.length;
      await expect(repo.listPlanAssets(FOREIGN_ORG, p.id)).rejects.toThrow(/organización activa/);
      const { data: fts } = await client.from("asset_types").select("id").eq("family_id", p.asset_family_id ?? "");
      const typeIds = p.asset_family_id ? (fts ?? []).map((t) => t.id) : p.asset_type_id ? [p.asset_type_id] : [];
      if (typeIds.length) {
        const assets = await repo.listScopeAssets(orgId, {
          assetTypeIds: typeIds, locationIds: (p.scope_location_ids as string[]) ?? [],
          includeSublocations: p.scope_include_sublocations,
        });
        scoped += assets.length;
        // Every linked asset of a scoped plan is still resolvable by its scope (same rule as before).
        if (p.scope_mode === "scoped") for (const l of pa) expect(assets.map((a) => a.id)).toContain(l.asset_id);
        expect(await repo.listScopeAssets(FOREIGN_ORG, { assetTypeIds: typeIds, locationIds: [], includeSublocations: true })).toHaveLength(0);
      }
    }
    console.info(`[IT] planes=${plans.length} vínculos=${links} alcance=${scoped} certificados=${certs.length}`);
  });

  it("escrituras seguras: recursos ajenos se rechazan antes de escribir y nada cambia", async () => {
    const orgId = await orgOf();
    const before = await repo.listPlans(orgId);
    const base = {
      code: "IT-NOPE-PLAN", name: "no debe existir", frequency: "annual", interval_months: 12, notes: null,
      scope_mode: "manual" as const, scope_location_ids: [], scope_include_sublocations: true,
      certificate_template_id: null,
    };
    const { data: fam } = await client.from("asset_families").select("id").limit(1).maybeSingle();
    // Foreign asset id inside the own org → refused by the asset guard.
    await expect(repo.createPlan(orgId, {
      ...base, asset_family_id: fam!.id, asset_ids: [FOREIGN_ID],
      type_templates: [{ asset_type_id: FOREIGN_ID, checklist_template_id: FOREIGN_ID }],
    })).rejects.toThrow(/organización activa/);
    // Foreign org entirely → refused.
    await expect(repo.createPlan(FOREIGN_ORG, {
      ...base, asset_family_id: fam!.id, asset_ids: [FOREIGN_ID],
      type_templates: [{ asset_type_id: FOREIGN_ID, checklist_template_id: FOREIGN_ID }],
    })).rejects.toThrow(/organización activa/);
    const { data: leaked } = await client.from("maintenance_plans").select("id").eq("code", "IT-NOPE-PLAN");
    expect(leaked ?? []).toHaveLength(0);

    const p = before[0];
    if (p) {
      const links = (await repo.listPlanAssets(orgId, p.id)).length;
      await expect(repo.setActive(FOREIGN_ORG, p.id, !p.active)).rejects.toThrow(/organización activa/);
      await expect(repo.setCertificateTemplate(FOREIGN_ORG, p.id, null)).rejects.toThrow(/organización activa/);
      await expect(repo.setCertificateTemplate(orgId, p.id, FOREIGN_ID)).rejects.toThrow(/organización activa/);
      await expect(repo.addAssets(orgId, p.id, [FOREIGN_ID])).rejects.toThrow(/organización activa/);
      await expect(repo.addAssets(FOREIGN_ORG, p.id, [FOREIGN_ID])).rejects.toThrow(/organización activa/);
      await expect(repo.removeAsset(FOREIGN_ORG, p.id, FOREIGN_ID)).rejects.toThrow(/organización activa/);
      const after = await repo.getPlan(orgId, p.id);
      expect(after?.active).toBe(p.active);
      expect(after?.certificate_template_id).toBe(p.certificate_template_id);
      expect((await repo.listPlanAssets(orgId, p.id)).length).toBe(links);
    }
    expect((await repo.listPlans(orgId)).length).toBe(before.length);
  });
});
