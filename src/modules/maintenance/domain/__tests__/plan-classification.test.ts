import { describe, expect, it } from "vitest";
import { normalizeClassification } from "../plan-classification";

describe("plan classification", () => {
  it("old/unspecified plans default to preventive + unspecified, never legal", () => {
    expect(normalizeClassification({})).toEqual({ plan_nature: "preventive", requirement_origin: "unspecified", requirement_reference: null });
  });
  it("keeps an explicit legal origin and trims the reference", () => {
    expect(normalizeClassification({ nature: "calibration", origin: "legal", reference: "  RD 513/2017  " }))
      .toEqual({ plan_nature: "calibration", requirement_origin: "legal", requirement_reference: "RD 513/2017" });
  });
  it("rejects corrective as a plan nature and unknown origins", () => {
    expect(() => normalizeClassification({ nature: "corrective" })).toThrow(/Naturaleza/);
    expect(() => normalizeClassification({ origin: "iso" })).toThrow(/Origen/);
  });
  it("rejects references over 500 characters", () => {
    expect(() => normalizeClassification({ reference: "x".repeat(501) })).toThrow(/500/);
  });
});
