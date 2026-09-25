import { describe, it, expect } from "vitest";
import { expandLocationIds, diffScope, groupAssets, type ScopeAsset } from "../scope";
import { resolveTemplatesForType, templateAppliesTo, type ScopedTemplate } from "../checklist-scope";
import { toItemResult, toCertificateItemResult, computeSessionOutcome, type ItemResult } from "../status";

// Árbol: BERGA > NAVE1 > ALMACEN ; MANRESA (independiente)
const locs = [
  { id: "BERGA", name: "Berga", code: "B", parent_location_id: null },
  { id: "NAVE1", name: "Nave 1", code: "N1", parent_location_id: "BERGA" },
  { id: "ALMACEN", name: "Almacén", code: "AL", parent_location_id: "NAVE1" },
  { id: "MANRESA", name: "Manresa", code: "M", parent_location_id: null },
];

const asset = (id: string, loc: string | null, type: string, typeName: string): ScopeAsset => ({
  id, code: id, name: id, status: "active", location_id: loc, asset_type_id: type,
  locations: loc ? { name: locs.find((l) => l.id === loc)!.name } : null,
  asset_types: { code: type, name_i18n: { es: typeName } },
});

describe("alcance: expansión de ubicaciones", () => {
  it("incluye todos los descendientes, no mezcla ramas y deduplica", () => {
    expect(expandLocationIds(locs, ["BERGA"], true).sort()).toEqual(["ALMACEN", "BERGA", "NAVE1"]);
    expect(expandLocationIds(locs, ["NAVE1"], true).sort()).toEqual(["ALMACEN", "NAVE1"]);
    expect(expandLocationIds(locs, ["BERGA", "NAVE1"], true).sort()).toEqual(["ALMACEN", "BERGA", "NAVE1"]);
    expect(expandLocationIds(locs, ["BERGA"], true)).not.toContain("MANRESA");
    // Sin sububicaciones: solo lo elegido, sin duplicados
    expect(expandLocationIds(locs, ["BERGA", "BERGA"], false)).toEqual(["BERGA"]);
    expect(expandLocationIds(locs, [], true)).toEqual([]);
  });
});

describe("alcance: diferencias y agrupación de equipos", () => {
  it("detecta solo los equipos del alcance que no están en el plan y agrupa por ubicación y tipo", () => {
    const a1 = asset("EXT-01", "BERGA", "CO2", "Extintor CO2");
    const a2 = asset("EXT-02", "BERGA", "POLVO", "Extintor Polvo");
    const a3 = asset("BIE-01", "NAVE1", "BIE", "BIE 25mm");
    const d = diffScope(["EXT-01", "RETIRADO"], [a1, a2, a3]);
    expect(d.missing.map((a) => a.id)).toEqual(["EXT-02", "BIE-01"]);
    expect([...d.scopedIds].sort()).toEqual(["BIE-01", "EXT-01", "EXT-02"]);
    expect(diffScope(["EXT-01", "EXT-02", "BIE-01"], [a1, a2, a3]).missing).toEqual([]);

    const g = groupAssets([a2, a3, a1]);
    expect(g.map((x) => x.locationName)).toEqual(["Berga", "Nave 1"]);
    expect(g[0].types.map((t) => t.typeName)).toEqual(["Extintor CO2", "Extintor Polvo"]);
    expect(g[1].types[0].assets.map((a) => a.id)).toEqual(["BIE-01"]);
  });
});

describe("resolución de plantilla de checklist", () => {
  const base: ScopedTemplate = { id: "", code: "", name: "", asset_type_id: null, asset_family_id: "PCI", asset_type_ids: [], location_ids: [], include_sublocations: true };
  const familia = { ...base, id: "familia", name: "a-familia" };
  const tipo = { ...base, id: "tipo", name: "b-tipo", asset_type_ids: ["CO2"] };
  const tipoCentro = { ...base, id: "tipoCentro", name: "c-tipo-centro", asset_type_ids: ["CO2"], location_ids: ["BERGA"] };
  const otroTipo = { ...base, id: "otroTipo", name: "d-otro", asset_type_ids: ["BIE"] };
  const otroCentro = { ...base, id: "otroCentro", name: "e-manresa", asset_type_ids: ["CO2"], location_ids: ["MANRESA"] };
  const all = [familia, tipo, tipoCentro, otroTipo, otroCentro];

  it("ordena de más a menos específica y excluye las que no aplican", () => {
    const r = resolveTemplatesForType(all, { assetTypeId: "CO2", familyId: "PCI", locationIds: ["ALMACEN"], locations: locs });
    expect(r.map((t) => t.id)).toEqual(["tipoCentro", "tipo", "familia"]);
  });

  it("respeta sububicaciones, familia y la plantilla legada por asset_type_id", () => {
    const sinSub = { ...tipoCentro, include_sublocations: false };
    expect(templateAppliesTo(sinSub, { assetTypeId: "CO2", familyId: "PCI", locationIds: ["ALMACEN"], locations: locs })).toBe(false);
    expect(templateAppliesTo(sinSub, { assetTypeId: "CO2", familyId: "PCI", locationIds: ["BERGA"], locations: locs })).toBe(true);
    // La plantilla genérica de familia no aplica a otra familia; las de tipo explícito sí,
    // y sin ubicación pedida todas las de centro aplican.
    expect(resolveTemplatesForType(all, { assetTypeId: "CO2", familyId: "MAQ" }).map((t) => t.id))
      .toEqual(["tipoCentro", "otroCentro", "tipo"]);
    const legada = { ...base, id: "legada", asset_family_id: null, asset_type_id: "CO2" };
    expect(templateAppliesTo(legada, { assetTypeId: "CO2" })).toBe(true);
    expect(templateAppliesTo(legada, { assetTypeId: "BIE" })).toBe(false);
    expect(templateAppliesTo(familia, { assetTypeId: "CO2", familyId: null })).toBe(false);
  });
});

describe("traducción de estados", () => {
  it("mapea todos los valores heredados de ítem y a certificado", () => {
    const cases: Array<[string | null | undefined, ItemResult]> = [
      ["ok", "ok"], ["fail", "failed"], ["failed", "failed"], ["with_incident", "failed"],
      ["na", "not_applicable"], ["not_applicable", "not_applicable"], ["skipped", "skipped"],
      ["pending", "pending"], [null, "pending"], [undefined, "pending"], ["desconocido", "pending"],
    ];
    for (const [legacy, expected] of cases) expect(toItemResult(legacy), String(legacy)).toBe(expected);
    // Solo valores aceptados por certificate_items_result_chk
    const allowed = ["ok", "conditional", "failed", "na"];
    const map: Record<ItemResult, string> = { ok: "ok", failed: "failed", not_applicable: "na", pending: "conditional", skipped: "conditional" };
    for (const [r, exp] of Object.entries(map)) {
      const v = toCertificateItemResult(r as ItemResult);
      expect(v).toBe(exp);
      expect(allowed).toContain(v);
    }
  });
});

describe("resultado de sesión", () => {
  it("prioriza incidencias, luego parcial, y no realizada si nada se revisó", () => {
    expect(computeSessionOutcome([])).toBe("not_performed");
    expect(computeSessionOutcome(["pending", "skipped"])).toBe("not_performed");
    expect(computeSessionOutcome(["ok", "ok"])).toBe("ok");
    expect(computeSessionOutcome(["ok", "not_applicable"])).toBe("ok");
    expect(computeSessionOutcome(["ok", "pending"])).toBe("partial");
    expect(computeSessionOutcome(["ok", "skipped"])).toBe("partial");
    expect(computeSessionOutcome(["failed"])).toBe("with_incidents");
    expect(computeSessionOutcome(["ok", "failed", "pending"])).toBe("with_incidents");
  });
});
