import { describe, expect, it } from "vitest";
import { INVENTORY_GROUPS, planImport } from "../inventory-catalog";
import { TECHNICAL_PROFILES, buildSheet, co2eTonnes, gwpFor } from "../technical-profiles";

describe("configurar inventario", () => {
  it("cada tipo sugerido apunta a un perfil existente o a ninguno", () => {
    for (const g of INVENTORY_GROUPS) for (const t of g.types) if (t.profile) expect(TECHNICAL_PROFILES[t.profile]).toBeDefined();
  });
  it("no duplica tipos ni familias existentes", () => {
    const p = planImport(["EXT-POLVO", "BIE", "CLIMA-SPLIT"], { familyCodes: ["pci"], typeCodes: ["bie"] });
    expect(p.types.map((t) => t.code)).toEqual(["EXT-POLVO", "CLIMA-SPLIT"]);
    expect(p.families.map((f) => f.code)).toEqual(["climatizacion"]);
  });
  it("sin selección no crea nada", () => {
    expect(planImport([], { familyCodes: [], typeCodes: [] })).toEqual({ families: [], types: [] });
  });
});

describe("PCA / GWP", () => {
  it("propone factor documentado para refrigerantes conocidos", () => {
    expect(gwpFor("R-410A")?.gwp).toBe(2088);
    expect(gwpFor("R-32")?.gwp).toBe(675);
    expect(gwpFor("Otro")).toBeNull();
  });
  it("calcula tCO2eq = kg × GWP / 1000 y guarda la fuente", () => {
    const r = buildSheet(TECHNICAL_PROFILES.hvac, { refrigerant: "R-410A", charge_kg: "3", gwp: "2088", gwp_source: "IPCC AR4 · Reg. (UE) 517/2014" });
    expect(r.ok && r.sheet.values.gwp_source).toBe("IPCC AR4 · Reg. (UE) 517/2014");
    expect(co2eTonnes({ charge_kg: 3, gwp: 2088 })).toBe(6.26);
  });
  it("valida campos de vehículo y extintor", () => {
    expect(buildSheet(TECHNICAL_PROFILES.vehicle, { odometer_km: "12.5" }).ok).toBe(false);
    expect(buildSheet(TECHNICAL_PROFILES.pci_extinguisher, { agent: "co2", capacity: "5" }).ok).toBe(true);
  });
});
