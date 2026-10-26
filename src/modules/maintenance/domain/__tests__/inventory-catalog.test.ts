import { describe, expect, it } from "vitest";
import { INVENTORY_GROUPS, planImport } from "../inventory-catalog";
import { TECHNICAL_PROFILES, buildSheet, co2eTonnes, gwpFor } from "../technical-profiles";

describe("configurar inventario", () => {
  it("cada tipo sugerido apunta a un perfil existente o a ninguno", () => {
    for (const g of INVENTORY_GROUPS) for (const t of g.types) if (t.profile) expect(TECHNICAL_PROFILES[t.profile]).toBeDefined();
  });
  it("no duplica tipos ni familias existentes", () => {
    const p = planImport(["EXT-POLVO", "BIE", "CLIMA-SPLIT"], { familyCodes: ["pci"], typeCodes: ["bie"] });
    expect(p.types.map((t) => t.code)).toEqual(["CLIMA-SPLIT", "EXT-POLVO"]);
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

describe("biblioteca maestra", () => {
  it("tiene 9 familias y códigos de tipo únicos", () => {
    expect(INVENTORY_GROUPS).toHaveLength(9);
    const codes = INVENTORY_GROUPS.flatMap((g) => g.types.map((t) => t.code));
    expect(new Set(codes).size).toBe(codes.length);
  });
  it("todos los instrumentos usan la ficha común de medida", () => {
    expect(INVENTORY_GROUPS.find((g) => g.code === "medida")!.types.every((t) => t.profile === "measuring")).toBe(true);
  });
  it("contador eléctrico: un único campo de potencia contratada", () => {
    const keys = TECHNICAL_PROFILES.electric_meter.attributes.map((a) => a.key);
    expect(keys.filter((k) => k.includes("power"))).toEqual(["contracted_power_max_kw"]);
  });
  it("vehículo ya no guarda kilometraje en la ficha", () => {
    expect(TECHNICAL_PROFILES.vehicle.attributes.some((a) => a.key === "odometer_km")).toBe(false);
  });
  it("claves estables compatibles con la protección de la base de datos", () => {
    for (const p of Object.values(TECHNICAL_PROFILES)) for (const a of p.attributes) expect(a.key).toMatch(/^[a-z][a-z0-9_]{0,40}$/);
  });
});
