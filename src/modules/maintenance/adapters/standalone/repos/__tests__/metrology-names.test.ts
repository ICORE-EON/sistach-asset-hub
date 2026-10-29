import { describe, expect, it } from "vitest";
import { createMetrologyRepo } from "../metrology.repo";
import type { StandaloneClient } from "../../client";

describe("metrology identity name writes", () => {
  for (const identity of [true, false]) {
    it(identity ? "identity excludes redundant name and location" : "parent-only association keeps editable name", async () => {
      const writes: unknown[] = [];
      const row = { id: "eq", company_id: "org", asset_id: identity ? "physical" : null, parent_asset_id: "caldera", name: "Sonda" };
      const db = { from: () => {
        const chain: Record<string, unknown> = {};
        for (const k of ["select", "eq"]) chain[k] = () => chain;
        chain.maybeSingle = () => Promise.resolve({ data: row, error: null });
        chain.update = (v: unknown) => { writes.push(v); return chain; };
        chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(resolve({ data: [], error: null }));
        return chain;
      } };
      const repo = createMetrologyRepo(db as unknown as StandaloneClient);
      await repo.updateEquipment("org", "eq", { name: "Nuevo nombre", locationDetail: "Sala", equipmentType: "Extintor", parentAssetId: "otra" });
      expect(writes).toEqual([identity ? { equipment_type: "Extintor" } : { name: "Nuevo nombre", location_detail: "Sala", equipment_type: "Extintor" }]);
    });
  }
});