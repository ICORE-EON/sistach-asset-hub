import { describe, expect, it } from "vitest";
import { classifyInstrumentType, INSTRUMENT_TYPE_CATALOG, mergeLinkedInstruments } from "../metrology-instrument-types";

describe("instrument type catalog", () => {
  it("includes common instruments without duplicates", () => {
    for (const t of ["Termómetro", "Manómetro", "Caudalímetro", "Báscula", "Sonómetro", "Cinta métrica / flexómetro"]) expect(INSTRUMENT_TYPE_CATALOG).toContain(t);
    expect(new Set(INSTRUMENT_TYPE_CATALOG).size).toBe(INSTRUMENT_TYPE_CATALOG.length);
  });
  it("classifies catalog, other/legacy and empty", () => {
    expect(classifyInstrumentType("Termómetro")).toBe("catalog");
    expect(classifyInstrumentType("termómetetyetyro")).toBe("other");
    expect(classifyInstrumentType("  ")).toBe("empty");
  });
});

describe("mergeLinkedInstruments", () => {
  const list = [
    { id: "a", assetId: "X", parentAssetId: "X" },
    { id: "b", assetId: null, parentAssetId: "X" },
    { id: "c", assetId: null, parentAssetId: "Y" },
    { id: "d", assetId: "Y", parentAssetId: null },
  ];
  it("dedupes identity+association and ignores other assets", () => {
    const r = mergeLinkedInstruments(list, "X");
    expect(r.map((e) => [e.id, e.relation])).toEqual([["a", "identity"], ["b", "associated"]]);
  });
});
