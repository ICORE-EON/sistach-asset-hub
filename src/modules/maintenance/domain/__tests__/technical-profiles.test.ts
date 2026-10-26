import { describe, expect, it } from "vitest";
import { TECHNICAL_PROFILES, buildSheet, co2eTonnes, profileOfType, readSheet } from "../technical-profiles";

const hvac = TECHNICAL_PROFILES.hvac;

describe("ficha técnica climatización", () => {
  it("convierte a valores tipados y omite vacíos", () => {
    const r = buildSheet(hvac, { cooling_kw: "7,1", heating_kw: "", refrigerant: "R-32", charge_kg: "1.2", gwp: "675", system_type: "split" });
    expect(r.ok && r.sheet).toEqual({ profile: "hvac", version: 1, values: { cooling_kw: 7.1, refrigerant: "R-32", charge_kg: 1.2, gwp: 675, system_type: "split" } });
  });
  it("rechaza número no válido, negativo, GWP decimal y refrigerante desconocido", () => {
    const r = buildSheet(hvac, { cooling_kw: "abc", charge_kg: "-1", gwp: "1.5", refrigerant: "R-999" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(["charge_kg", "cooling_kw", "gwp", "refrigerant"]);
  });
  it("rechaza claves no previstas", () => {
    expect(buildSheet(hvac, { foo: "1" }).ok).toBe(false);
  });
  it("calcula CO2 eq = kg × GWP / 1000", () => {
    expect(co2eTonnes({ charge_kg: 1.2, gwp: 675 })).toBe(0.81);
    expect(co2eTonnes({ charge_kg: 1.2 })).toBeNull();
  });
  it("perfil por tipo solo si la empresa lo configuró", () => {
    expect(profileOfType({ technical_profile: "hvac" })?.code).toBe("hvac");
    expect(profileOfType({})).toBeNull();
    expect(readSheet({ other: 1 })).toBeNull();
  });
});
