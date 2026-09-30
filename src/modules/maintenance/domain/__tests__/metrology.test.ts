import { describe, expect, it } from "vitest";
import {
  aggregateLines, calcNextDue, canReactivate, displayStatus, isReferenceEligible, lineResult,
  statusAfterUnfitDecision, validateImpactClose, validateUnfitDecision,
} from "../metrology";

describe("metrología: fechas", () => {
  it("calcula próxima fecha", () => {
    expect(calcNextDue("2026-01-31", "months", 1)).toBe("2026-02-28");
    expect(calcNextDue("2026-01-10", "years", 5)).toBe("2031-01-10");
    expect(calcNextDue("2026-01-10", "days", 7)).toBe("2026-01-17");
    expect(calcNextDue("2026-01-10", "before_use", 1)).toBeNull();
    expect(() => calcNextDue("2026-01-10", "days", 0)).toThrow();
  });
  it("estado mostrado con umbral de 30 días", () => {
    expect(displayStatus("operational", "2026-02-09", "2026-01-10")).toBe("due_soon");
    expect(displayStatus("operational", "2026-02-10", "2026-01-10")).toBe("operational");
    expect(displayStatus("operational", "2026-01-09", "2026-01-10")).toBe("overdue");
    expect(displayStatus("restricted", "2026-01-20", "2026-01-10")).toBe("restricted");
    expect(displayStatus("unfit", "2020-01-01", "2026-01-10")).toBe("unfit");
  });
});

describe("metrología: no apto y restricción", () => {
  it("restringir lleva a restricted y exige usos", () => {
    expect(statusAfterUnfitDecision("restrict")).toBe("restricted");
    expect(statusAfterUnfitDecision("retire")).toBe("retired");
    expect(validateUnfitDecision("restrict", " ")).toHaveLength(1);
    expect(validateUnfitDecision("restrict", "solo > 15 mm")).toEqual([]);
  });
});

describe("metrología: cierre de impacto", () => {
  const base = { justification: "x", reviewedOn: "2026-01-10" };
  it("con impacto exige acciones", () => {
    expect(validateImpactClose({ ...base, conclusion: "impact" })).toHaveLength(1);
    expect(validateImpactClose({ ...base, conclusion: "impact", externalRef: "NC-7" })).toHaveLength(1);
    expect(validateImpactClose({ ...base, conclusion: "impact", actionsTakenOrPlanned: "repetir" })).toEqual([]);
    expect(validateImpactClose({ ...base, conclusion: "no_impact" })).toEqual([]);
    expect(validateImpactClose({ conclusion: "no_impact", justification: " " })).toHaveLength(2);
  });
});

describe("metrología: elegibilidad del patrón", () => {
  const ok = { status: "operational" as const, hasPendingImpact: false,
    qualifyingControls: [{ performedOn: "2026-01-01", validUntil: "2031-01-01" }] };
  it("reglas", () => {
    expect(isReferenceEligible(ok, "2026-06-01")).toBe(true);
    expect(isReferenceEligible(ok, "2025-12-31")).toBe(false);
    expect(isReferenceEligible(ok, "2031-01-02")).toBe(false);
    expect(isReferenceEligible({ ...ok, status: "restricted" }, "2026-06-01")).toBe(false);
    expect(isReferenceEligible({ ...ok, hasPendingImpact: true }, "2026-06-01")).toBe(false);
    expect(isReferenceEligible({ ...ok, qualifyingControls: [] }, "2026-06-01")).toBe(false);
  });
});

describe("metrología: líneas", () => {
  it("resultado y agregado", () => {
    expect(lineResult(10, 10.05, 0.1)).toBe("fit");
    expect(lineResult(10, 10.5, 0.2)).toBe("unfit");
    expect(lineResult(10, null, 0.2)).toBeNull();
    expect(aggregateLines([{ result: "fit" }, { result: "unfit" }])).toBe("unfit");
    expect(aggregateLines([{ result: "fit" }, { result: null }])).toBe("incomplete");
    expect(aggregateLines([{ result: "fit" }])).toBe("fit");
  });
});

describe("canReactivate", () => {
  it("exige decisión explícita y último control Apto", () => {
    expect(canReactivate("unfit", "unfit")).toBe(false);
    expect(canReactivate("unfit", "fit")).toBe(true);
    expect(canReactivate("out_of_service", null)).toBe(false);
    expect(canReactivate("restricted", "fit")).toBe(true);
    expect(canReactivate("retired", "fit")).toBe(false);
    expect(canReactivate("operational", "fit")).toBe(false);
  });
});
