import { describe, expect, it } from "vitest";
import { DEFAULT_REACTIVATE, shouldReactivate, isCorrectiveOpen, validateCorrectiveEdit, correctiveStatusLabel, validateCorrectiveClose, validateNewCorrective } from "../corrective-rules";

const base = { assetId: "a", detectedOn: "2026-10-20", priority: "normal" as const, description: "Fuga", incidentId: null,
  external: false, provider: null, technicianName: null, markOutOfService: false, requestId: "r" };

describe("reparaciones (2B)", () => {
  it("reactivación desmarcada por defecto", () => {
    expect(DEFAULT_REACTIVATE).toBe(false);
    expect(shouldReactivate(DEFAULT_REACTIVATE, "repaired", "out_of_service", true)).toBe(false);
  });
  it("reactivar requiere elección explícita y permiso", () => {
    expect(shouldReactivate(true, "repaired", "out_of_service", true)).toBe(true);
    expect(shouldReactivate(true, "repaired", "out_of_service", false)).toBe(false);
  });
  it("no reparado y sustituido no reactivan", () => {
    expect(shouldReactivate(true, "not_repaired", "out_of_service", true)).toBe(false);
    expect(shouldReactivate(true, "replaced", "out_of_service", true)).toBe(false);
  });
  it("solo estados abiertos editables", () => {
    expect(["draft", "in_progress", "closed", "cancelled"].map(isCorrectiveOpen)).toEqual([true, true, false, false]);
  });
  it("edición exige descripción y token de conflicto", () => {
    const v = { expectedUpdatedAt: "2026-10-27T06:00:00Z", description: "Fuga", priority: "normal" as const, external: false, provider: null, technicianName: null };
    expect(validateCorrectiveEdit(v)).toEqual([]);
    expect(validateCorrectiveEdit({ ...v, description: " " })).toHaveLength(1);
    expect(validateCorrectiveEdit({ ...v, expectedUpdatedAt: "" })).toHaveLength(1);
    expect(validateCorrectiveEdit({ ...v, external: true })).toHaveLength(1);
  });
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
