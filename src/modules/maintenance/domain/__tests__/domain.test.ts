import { describe, it, expect } from "vitest";
import { expandLocationIds, diffScope } from "../scope";
import { resolveTemplatesForType, type ScopedTemplate } from "../checklist-scope";
import { toItemResult, toCertificateItemResult, computeSessionOutcome } from "../status";

const locs = [
  { id: "A", name: "A", code: "A", parent_location_id: null },
  { id: "B", name: "B", code: "B", parent_location_id: "A" },
  { id: "C", name: "C", code: "C", parent_location_id: "B" },
];

describe("scope", () => {
  it("expands sublocations", () => {
    expect(expandLocationIds(locs, ["A"], true).sort()).toEqual(["A", "B", "C"]);
    expect(expandLocationIds(locs, ["A"], false)).toEqual(["A"]);
  });
  it("diffs missing assets", () => {
    const a = { id: "x" } as never; const b = { id: "y" } as never;
    expect(diffScope(["x"], [a, b]).missing).toEqual([b]);
  });
});

describe("checklist template resolution", () => {
  const base: ScopedTemplate = { id: "", code: "", name: "", asset_type_id: null, asset_family_id: "F", asset_type_ids: [], location_ids: [], include_sublocations: true };
  it("prefers specific type and site", () => {
    const all = { ...base, id: "all", name: "all" };
    const typed = { ...base, id: "typed", name: "typed", asset_type_ids: ["T"] };
    const sited = { ...base, id: "sited", name: "sited", asset_type_ids: ["T"], location_ids: ["A"] };
    const r = resolveTemplatesForType([all, typed, sited], { assetTypeId: "T", familyId: "F", locationIds: ["C"], locations: locs });
    expect(r.map((t) => t.id)).toEqual(["sited", "typed", "all"]);
  });
  it("excludes other families", () => {
    expect(resolveTemplatesForType([{ ...base, id: "x" }], { assetTypeId: "T", familyId: "G" })).toEqual([]);
  });
});

describe("status mapping", () => {
  it("maps legacy item results", () => {
    expect(toItemResult("with_incident")).toBe("failed");
    expect(toItemResult("na")).toBe("not_applicable");
    expect(toItemResult(null)).toBe("pending");
    expect(toCertificateItemResult("not_applicable")).toBe("na");
  });
  it("computes outcome", () => {
    expect(computeSessionOutcome([])).toBe("not_performed");
    expect(computeSessionOutcome(["ok", "ok"])).toBe("ok");
    expect(computeSessionOutcome(["ok", "pending"])).toBe("partial");
    expect(computeSessionOutcome(["ok", "failed", "pending"])).toBe("with_incidents");
  });
});
