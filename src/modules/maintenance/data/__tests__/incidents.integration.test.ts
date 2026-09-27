/**
 * Smoke test against the real backend for incidents. Reads the user's org incidents, history,
 * members and asset tab; writes are only exercised in ways the guards must refuse (foreign org,
 * foreign asset, stale/invalid transition). Nothing persists.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { createIncidentsRepo } from "../incidents.repo";
import { resolveIncidentOrigin } from "../../domain/incident-rules";

const env = Object.fromEntries(
  (() => { try { return readFileSync(".env", "utf8"); } catch { return ""; } })()
    .split("\n").map((l) => l.match(/^(\w+)="?([^"]*)"?$/)).filter(Boolean).map((m) => [m![1], m![2]]),
);
const url = env.VITE_SUPABASE_URL, key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
const token = process.env.MNT_IT_ACCESS_TOKEN || process.env.LOVABLE_BROWSER_SUPABASE_ACCESS_TOKEN;
const FOREIGN = "00000000-0000-0000-0000-00000000dead";

describe.skipIf(!(url && key && token))("incidents repo · integración real", () => {
  const client = createClient<Database>(url!, key!, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
  const repo = createIncidentsRepo(client);
  const orgOf = async () => (await client.from("company_members").select("company_id").eq("active", true)).data![0].company_id;

  it("lee incidencias, historial, miembros y pestaña del activo; aísla otras organizaciones", async () => {
    const org = await orgOf();
    const list = await repo.listIncidents(org, "all");
    expect(await repo.listIncidents(FOREIGN, "all")).toHaveLength(0);
    expect(await repo.listMembers(FOREIGN)).toHaveLength(0);
    let hist = 0, auto = 0;
    for (const i of list.slice(0, 5)) {
      expect((await repo.getIncident(org, i.id)).id).toBe(i.id);
      await expect(repo.getIncident(FOREIGN, i.id)).rejects.toThrow(/no encontrada/);
      hist += (await repo.listHistory(org, i.id)).length;
      await expect(repo.listHistory(FOREIGN, i.id)).rejects.toThrow(/no encontrada/);
    }
    for (const i of list) if (i.source === "maintenance") { auto++; expect(resolveIncidentOrigin(i).kind).not.toBe("none"); }
    const withAsset = list.find((i) => i.asset_id);
    if (withAsset) {
      const tab = await repo.listAssetIncidents(org, withAsset.asset_id!);
      expect(tab.some((t) => t.id === withAsset.id)).toBe(true);
      await expect(repo.listAssetIncidents(FOREIGN, withAsset.asset_id!)).rejects.toThrow(/organización activa/);
    }
    console.info(`incidencias=${list.length} automáticas=${auto} historial(5)=${hist} miembros=${(await repo.listMembers(org)).length}`);
  });

  it("escrituras rechazadas sin persistir nada", async () => {
    const org = await orgOf();
    const before = (await repo.listIncidents(org, "all"));
    const i = before[0];
    const asset = before.find((x) => x.asset_id)?.asset_id;
    if (asset) await expect(repo.createManual(FOREIGN, { title: "IT", description: null, severity: "low", assetId: asset })).rejects.toThrow(/organización activa/);
    await expect(repo.createManual(org, { title: "IT", description: null, severity: "low", assetId: "00000000-0000-0000-0000-0000000000ff" })).rejects.toThrow(/organización activa/);
    if (i) {
      await expect(repo.changeStatus(FOREIGN, i.id, { from: i.status, to: "in_progress", note: null, userId: null })).rejects.toThrow(/no encontrada/);
      await expect(repo.changeStatus(org, i.id, { from: "__stale__", to: "in_progress", note: null, userId: null })).rejects.toThrow(/ha cambiado/);
      await expect(repo.remove(FOREIGN, i.id)).rejects.toThrow(/no encontrada/);
      await expect(repo.update(org, i.id, { title: i.title, description: i.description, severity: "urgent", assignedTo: null, dueDate: null })).rejects.toThrow(i.status === "closed" ? /cerrada/ : /Severidad/);
    }
    const after = await repo.listIncidents(org, "all");
    expect(after.length).toBe(before.length);
    expect(JSON.stringify(after)).toBe(JSON.stringify(before));
  });
});
