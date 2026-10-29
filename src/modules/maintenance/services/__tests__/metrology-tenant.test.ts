/** Metrology service: explicit orgId propagation, fail-closed without org/adapter, UX guards. */
import { describe, it, expect } from "vitest";
import { useTestRepositories } from "./test-adapter";

const calls: { method: string; args: unknown[] }[] = [];
const recorder = new Proxy({}, { get: (_t, m) => (...args: unknown[]) => { calls.push({ method: String(m), args }); return Promise.resolve([]); } });
const { metrologyService } = await import("../metrology");
const A = "org-a", B = "org-b";

describe("metrologyService", () => {
  it("falla si el adaptador no ofrece metrología", async () => {
    useTestRepositories({});
    expect(() => metrologyService.listEquipment(A)).toThrow(/no ofrece equipos de medida/);
  });
  it("propaga orgId como primer argumento y cambia al cambiar de organización", async () => {
    useTestRepositories({ metrology: recorder } as never);
    calls.length = 0;
    await metrologyService.listEquipment(A);
    await metrologyService.getEquipment(B, "e1");
    await metrologyService.validateRecord(A, "r1");
    await metrologyService.setStatus(B, "e1", "operational", "fin revisión");
    expect(calls.map((c) => c.args[0])).toEqual([A, B, A, B]);
  });
  it("sin organización no llega al adaptador", async () => {
    useTestRepositories({ metrology: recorder } as never);
    calls.length = 0;
    expect(() => metrologyService.listEquipment(null)).toThrow(/Sin empresa/);
    expect(() => metrologyService.validateRecord(null, "r")).toThrow(/Sin empresa/);
    expect(calls).toHaveLength(0);
  });
  it("asociación N:1 conserva organización y elimina ids repetidos sin crear instrumentos", async () => {
    useTestRepositories({ metrology: recorder } as never);
    calls.length = 0;
    await metrologyService.associateEquipment(A, "caldera", ["sonda", "manómetro", "sonda"]);
    expect(calls).toEqual([{ method: "associateEquipment", args: [A, "caldera", ["sonda", "manómetro"]] }]);
    expect(() => metrologyService.associateEquipment(null, "caldera", ["sonda"])).toThrow(/Sin empresa/);
    expect(() => metrologyService.associateEquipment(A, "caldera", [])).toThrow(/Selecciona instrumentos/);
  });
  it("alta asociada conserva nombre propio y tipo ficticio elegido por el usuario", async () => {
    useTestRepositories({ metrology: recorder } as never);
    calls.length = 0;
    await metrologyService.createEquipment(A, { name: " Sonda 1 ", equipmentType: " Extintor ", siteId: "site-a", parentAssetId: "caldera" } as never);
    expect(calls[0]).toEqual({ method: "createEquipment", args: [A, { name: "Sonda 1", equipmentType: "Extintor", siteId: "site-a", parentAssetId: "caldera" }] });
  });
  it("comprobaciones UX: restringir exige usos, impacto exige acciones, estado exige motivo", async () => {
    useTestRepositories({ metrology: recorder } as never);
    expect(() => metrologyService.decideUnfit(A, "r", "restrict", null, "")).toThrow(/usos permitidos/);
    expect(() => metrologyService.closeImpact(A, "i", { conclusion: "impact", justification: "x", actions: null, periodReviewed: null, reviewedOn: "2026-01-01", externalRef: null })).toThrow(/acciones/);
    expect(() => metrologyService.setStatus(A, "e", "operational", " ")).toThrow(/motivo/);
    expect(() => metrologyService.createEquipment(A, { name: "M", equipmentType: "Calibre", siteId: "" } as never)).toThrow(/site/);
  });
});
