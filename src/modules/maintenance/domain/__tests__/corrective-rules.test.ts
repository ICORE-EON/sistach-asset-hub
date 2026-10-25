import { describe, expect, it } from "vitest";
import { correctiveStatusLabel, validateCorrectiveClose, validateNewCorrective } from "../corrective-rules";

const base = { assetId: "a", detectedOn: "2026-10-20", priority: "normal" as const, description: "Fuga", incidentId: null,
  external: false, provider: null, technicianName: null, markOutOfService: false, requestId: "r" };

describe("reparaciones (2B)", () => {
  it("etiquetas sencillas de estado", () => {
    expect(["draft", "in_progress", "closed", "cancelled"].map(correctiveStatusLabel)).toEqual(["Pendiente", "En reparación", "Finalizada", "Cancelada"]);
  });
  it("detección futura rechazada", () => {
    expect(validateNewCorrective({ ...base, detectedOn: "2026-10-26" }, "2026-10-25")).toHaveLength(1);
    expect(validateNewCorrective(base, "2026-10-25")).toEqual([]);
  });
  it("externa exige empresa", () => {
    expect(validateNewCorrective({ ...base, external: true }, "2026-10-25")).toHaveLength(1);
  });
  it("no reparado exige explicación y nunca reactiva", () => {
    const c = { performedOn: "2026-10-22", outcome: "not_repaired" as const, observations: "", provider: null, reference: null, reactivate: false };
    expect(validateCorrectiveClose(c, "2026-10-20", "2026-10-25")).toHaveLength(1);
    expect(validateCorrectiveClose({ ...c, observations: "Falta pieza", reactivate: true }, "2026-10-20", "2026-10-25")).toHaveLength(1);
  });
  it("finalización entre detección y hoy", () => {
    const c = { performedOn: "2026-10-19", outcome: "repaired" as const, observations: null, provider: null, reference: null, reactivate: true };
    expect(validateCorrectiveClose(c, "2026-10-20", "2026-10-25")).toHaveLength(1);
    expect(validateCorrectiveClose({ ...c, performedOn: "2026-10-21" }, "2026-10-20", "2026-10-25")).toEqual([]);
  });
});
