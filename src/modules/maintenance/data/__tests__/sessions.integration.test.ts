/**
 * Smoke test against the real backend for maintenance sessions. Reads sessions, items, plan
 * locations and asset history of the user's org; every write is exercised only in ways the guards
 * must refuse before reaching the database (foreign org, closed session). Nothing persists.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { createSessionsRepo } from "../sessions.repo";
import { createChecklistsRepo } from "../checklists.repo";

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

describe.skipIf(!run)("sessions repo · integración real", () => {
  const client = createClient<Database>(url!, key!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const repo = createSessionsRepo(client);
  const chk = createChecklistsRepo(client);
  const orgOf = async () => (await client.from("company_members").select("company_id").eq("active", true)).data![0].company_id;

  it("lee sesiones, equipos, ubicaciones de plan e historial; aísla otras organizaciones", async () => {
    const orgId = await orgOf();
    const sessions = await repo.listSessions(orgId, "all");
    expect(await repo.listSessions(FOREIGN_ORG, "all")).toHaveLength(0);
    expect(await repo.listPlansForSession(FOREIGN_ORG)).toHaveLength(0);
    const closed = await repo.listSessions(orgId, "closed");
    for (const s of closed) expect(s.status).toBe("closed");
    let items = 0;
    for (const s of sessions.slice(0, 5)) {
      expect((await repo.getSession(orgId, s.id))?.id).toBe(s.id);
      expect(await repo.getSession(FOREIGN_ORG, s.id)).toBeNull();
      const its = await repo.listItems(orgId, s.id);
      items += its.length;
      for (const it of its) expect(it.session_id).toBe(s.id);
      await expect(repo.listItems(FOREIGN_ORG, s.id)).rejects.toThrow(/organización activa/);
    }
    const plans = await repo.listPlansForSession(orgId);
    for (const p of plans) {
      await repo.listPlanLocations(orgId, p.id);
      await expect(repo.listPlanLocations(FOREIGN_ORG, p.id)).rejects.toThrow(/organización activa/);
    }
    const { data: asset } = await client.from("assets").select("id").eq("company_id", orgId).limit(1).maybeSingle();
    let hist = 0;
    if (asset) {
      hist = (await repo.listAssetHistory(orgId, asset.id)).length;
      await expect(repo.listAssetHistory(FOREIGN_ORG, asset.id)).rejects.toThrow(/organización activa/);
    }
    console.info(`[IT] sesiones=${sessions.length} cerradas=${closed.length} equipos(5 primeras)=${items} planes=${plans.length} historial=${hist}`);
  });

  it("escrituras seguras: org ajena y sesión cerrada se rechazan antes de escribir; nada cambia", async () => {
    const orgId = await orgOf();
    const before = await repo.listSessions(orgId, "all");
    const plan = (await repo.listPlansForSession(orgId))[0];
    await expect(repo.createSession(FOREIGN_ORG, { requestId: "it-nope", planId: plan?.id ?? FOREIGN_ID, locationId: null, scheduledFor: null, technicianName: null }))
      .rejects.toThrow(/organización activa/);
    await expect(repo.createSession(orgId, { requestId: "it-nope", planId: FOREIGN_ID, locationId: null, scheduledFor: null, technicianName: null }))
      .rejects.toThrow(/organización activa/);
    const { data: leaked } = await client.from("maintenance_sessions").select("id").filter("metadata->>client_request_id", "eq", "it-nope");
    expect(leaked ?? []).toHaveLength(0);

    const closed = before.find((s) => s.status === "closed");
    if (closed) {
      const items = await repo.listItems(orgId, closed.id);
      const snapshot = JSON.stringify({ s: await repo.getSession(orgId, closed.id), items });
      await expect(repo.startSession(orgId, closed.id)).rejects.toThrow(/cerrada/);
      await expect(repo.startSession(FOREIGN_ORG, closed.id)).rejects.toThrow(/organización activa/);
      await expect(repo.closeSession(FOREIGN_ORG, closed.id, { signerName: "x", signerRole: null, signature: "x" })).rejects.toThrow(/organización activa/);
      if (items[0]) {
        await expect(repo.setItemResult(orgId, closed.id, items[0].id, "ok", null, 0)).rejects.toThrow(/cerrada/);
        await expect(repo.setItemResult(FOREIGN_ORG, closed.id, items[0].id, "ok", null, 0)).rejects.toThrow(/organización activa/);
        await expect(chk.saveResponse(orgId, items[0].id, items[0].checklist_template_version_id,
          { question_id: FOREIGN_ID, answer: true, is_fail: false, observations: null })).rejects.toThrow(/cerrada/);
      }
      // Second close of an already closed session: returns closedNow=false and writes nothing.
      const again = await repo.closeSession(orgId, closed.id, { signerName: "no", signerRole: null, signature: "no" });
      expect(again.closedNow).toBe(false);
      const after = JSON.stringify({ s: await repo.getSession(orgId, closed.id), items: await repo.listItems(orgId, closed.id) });
      expect(after).toBe(snapshot);
    }
    expect((await repo.listSessions(orgId, "all")).length).toBe(before.length);
  });
});
