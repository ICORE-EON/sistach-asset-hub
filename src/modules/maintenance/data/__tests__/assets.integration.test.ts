/**
 * Smoke test against the real backend (read-only). Runs only when a user session token is available
 * (MNT_IT_ACCESS_TOKEN or LOVABLE_BROWSER_SUPABASE_ACCESS_TOKEN); otherwise skipped.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { createAssetsRepo } from "../assets.repo";

const env = Object.fromEntries(
  (() => { try { return readFileSync(".env", "utf8"); } catch { return ""; } })()
    .split("\n").map((l) => l.match(/^(\w+)="?([^"]*)"?$/)).filter(Boolean).map((m) => [m![1], m![2]]),
);
const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
const token = process.env.MNT_IT_ACCESS_TOKEN || process.env.LOVABLE_BROWSER_SUPABASE_ACCESS_TOKEN;
const run = !!(url && key && token);
const FOREIGN_ORG = "00000000-0000-0000-0000-00000000dead";

describe.skipIf(!run)("assets repo · integración real", () => {
  const client = createClient<Database>(url!, key!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const repo = createAssetsRepo(client);

  it("lee familias, tipos, ubicaciones, activos y detalle de la organización del usuario, y aísla otras organizaciones", async () => {
    const { data: members, error } = await client.from("company_members").select("company_id").eq("active", true);
    expect(error).toBeNull();
    expect(members!.length).toBeGreaterThan(0);
    const orgId = members![0].company_id;

    const families = await repo.listFamilies(orgId);
    const types = await repo.listTypes(orgId);
    const sites = await repo.listActiveSites(orgId);
    const assets = await repo.listAssets(orgId);
    expect(Array.isArray(families) && Array.isArray(types) && Array.isArray(sites)).toBe(true);
    for (const f of families) expect(f.company_id === orgId || f.is_system).toBe(true);

    if (assets.length) {
      const a = assets[0];
      const detail = await repo.getAsset(orgId, a.id);
      expect(detail?.id).toBe(a.id);
      expect(await repo.getAsset(FOREIGN_ORG, a.id)).toBeNull();
      await expect(repo.listKitItems(FOREIGN_ORG, a.id)).rejects.toThrow();
      expect(Array.isArray(await repo.listKitItems(orgId, a.id))).toBe(true);
      const filtered = await repo.listAssets(orgId, { typeIds: [] });
      expect(filtered).toHaveLength(0);
    }
    expect(await repo.listAssets(FOREIGN_ORG)).toHaveLength(0);
    console.info(`[IT] org=${orgId.slice(0, 8)} familias=${families.length} tipos=${types.length} ubicaciones=${sites.length} activos=${assets.length}`);
  });
});
