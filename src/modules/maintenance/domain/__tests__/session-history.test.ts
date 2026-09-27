import { describe, it, expect } from "vitest";
import { closeResults, historicalItem, historicalSession } from "../session-history";

const planSnap = { id: "p1", code: "PL-1", name: "Trimestral", frequency: "quarterly", interval_months: 3, scope_mode: "family", scope_location_ids: ["l1"], scope_include_sublocations: true };
const assetSnap = { id: "a1", code: "AST-1", name: "Extintor 1", manufacturer: "ACME", model: "X6", asset_type_id: "t1", type_code: "EXT", type_name: "Extintor", location_id: "l1", location_name: "Planta 1" };
const closedMeta = { snapshot: { plan: planSnap }, close_snapshot: { items: [{ item_id: "i1", asset_id: "a1", result: "with_incident" }] } };

const session = (plan: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
  ({ id: "s1", status: "closed", plan_id: "p1", metadata: closedMeta, maintenance_plans: plan, ...extra });
const item = (asset: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
  ({ id: "i1", asset_id: "a1", result: "ok", checklist_template_version_id: "v1",
    metadata: { snapshot: { asset: assetSnap, checklist: { template_id: "c1", version_id: "v1", version: 2 } } }, assets: asset, ...extra });

const view = (s: ReturnType<typeof session>, i: ReturnType<typeof item>) => {
  const hs = historicalSession(s);
  return { plan: hs.maintenance_plans, src: hs.history_source, item: historicalItem(i, s.status, closeResults(s.metadata)) };
};

describe("sesión cerrada · representación histórica inmutable", () => {
  const original = view(
    session({ name: "Trimestral", code: "PL-1" }),
    item({ id: "a1", code: "AST-1", name: "Extintor 1", manufacturer: "ACME", model: "X6", asset_type_id: "t1", location_id: "l1", locations: { name: "Planta 1" }, asset_types: { code: "EXT", name_i18n: { es: "Extintor" } } }),
  );

  it("modificar activo, tipo, ubicación, plan y plantilla no altera la vista", () => {
    const after = view(
      session({ name: "PLAN RENOMBRADO", code: "PL-9" }),
      item(
        { id: "a1", code: "AST-999", name: "Otro nombre", manufacturer: "Z", model: "Q", asset_type_id: "t2", location_id: "l9", locations: { name: "Almacén" }, asset_types: { code: "BIE", name_i18n: { es: "BIE" } } },
        { checklist_template_version_id: "v1" },
      ),
    );
    expect(after).toEqual(original);
    expect(after.plan).toMatchObject({ name: "Trimestral", code: "PL-1", scope_location_ids: ["l1"] });
    expect(after.item.assets).toMatchObject({ code: "AST-1", name: "Extintor 1", manufacturer: "ACME", locations: { name: "Planta 1" }, asset_types: { code: "EXT", name_i18n: { es: "Extintor" } } });
    expect(after.item.result).toBe("with_incident"); // frozen at close, not the column
    expect(after.item.history_source).toBe("snapshot");
  });

  it("sesión abierta: siempre datos vivos", () => {
    const s = historicalSession({ status: "in_progress", plan_id: "p1", metadata: closedMeta, maintenance_plans: { name: "Vivo" } });
    expect(s.maintenance_plans).toEqual({ name: "Vivo" });
    expect(s.history_source).toBe("live");
    const i = historicalItem(item({ code: "VIVO" }), "in_progress", new Map());
    expect(i.assets).toEqual({ code: "VIVO" });
  });

  it("legacy sin snapshot: conserva datos actuales y lo marca", () => {
    const s = historicalSession({ status: "closed", plan_id: "p1", metadata: {}, maintenance_plans: { name: "Actual" } });
    expect(s).toMatchObject({ maintenance_plans: { name: "Actual" }, history_source: "legacy" });
    const i = historicalItem({ id: "i1", asset_id: "a1", result: "ok", metadata: null, assets: { code: "ACT" } }, "closed", new Map());
    expect(i).toMatchObject({ assets: { code: "ACT" }, result: "ok", history_source: "legacy" });
  });

  it.each([
    ["no es objeto", "texto"], ["array", [1, 2]], ["plan sin nombre", { snapshot: { plan: { id: "p1" } } }],
    ["plan de otro id", { snapshot: { plan: { ...planSnap, id: "OTRO" } } }], ["nulo", null],
  ])("snapshot de plan malformado (%s) → legacy seguro", (_n, metadata) => {
    const s = historicalSession({ status: "closed", plan_id: "p1", metadata, maintenance_plans: { name: "Actual" } });
    expect(s).toMatchObject({ maintenance_plans: { name: "Actual" }, history_source: "legacy" });
  });

  it.each([
    ["asset id de otro equipo", { snapshot: { asset: { ...assetSnap, id: "ajeno" } } }],
    ["sin código", { snapshot: { asset: { id: "a1", code: "" } } }],
    ["asset no objeto", { snapshot: { asset: 42 } }],
  ])("snapshot de equipo malformado (%s) → legacy, nunca datos del snapshot", (_n, metadata) => {
    const i = historicalItem({ id: "i1", asset_id: "a1", result: "ok", metadata, assets: { code: "ACT" } }, "closed", new Map());
    expect(i.assets).toEqual({ code: "ACT" });
    expect(i.history_source).toBe("legacy");
  });

  it("snapshot parcial: campos ausentes vacíos (no actuales) y marcado partial", () => {
    const i = historicalItem(
      { id: "i1", asset_id: "a1", result: "ok", metadata: { snapshot: { asset: { id: "a1", code: "AST-1", type_code: "EXT", location_id: "l1" } } },
        assets: { code: "NUEVO", manufacturer: "NUEVO", locations: { name: "NUEVA" }, asset_types: { code: "X", name_i18n: { es: "Nuevo tipo" } } } },
      "closed", new Map(),
    );
    expect(i.assets).toMatchObject({ code: "AST-1", manufacturer: null, locations: null, asset_types: { code: "EXT", name_i18n: null } });
    expect(i.history_source).toBe("partial");
    const s = historicalSession({ status: "closed", plan_id: "p1", metadata: { snapshot: { plan: { id: "p1", name: "Solo nombre" } } }, maintenance_plans: { name: "Actual", code: "ACT" } });
    expect(s.maintenance_plans).toMatchObject({ name: "Solo nombre", code: null });
    expect(s.history_source).toBe("partial");
  });

  it("close_snapshot malformado se ignora", () => {
    expect(closeResults({ close_snapshot: { items: "x" } }).size).toBe(0);
    expect(closeResults({ close_snapshot: { items: [null, { item_id: 1 }, { item_id: "i", result: "ok" }] } })).toEqual(new Map([["i", "ok"]]));
  });
});
