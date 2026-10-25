import { describe, it, expect } from "vitest";
import { effectiveExecution, interventionScope } from "../intervention";

describe("fecha efectiva de intervención", () => {
  it("externa usa performed_on, no la fecha de cierre", () => {
    expect(effectiveExecution({ is_external: true, metadata: { external: { performed_on: "2026-03-10" } }, item_completions: ["2026-10-01T10:00:00Z"] }))
      .toEqual({ date: "2026-03-10", source: "performed_on" });
  });
  it("externa sin performed_on queda como no consta", () => {
    expect(effectiveExecution({ is_external: true, metadata: {}, item_completions: ["2026-10-01T10:00:00Z"] })).toEqual({ date: null, source: null });
  });
  it("interna usa la última finalización de equipo e ignora omitidos", () => {
    expect(effectiveExecution({ is_external: false, metadata: null, item_completions: ["2026-05-01T09:00:00Z", null, "2026-05-02T09:00:00Z"] }))
      .toEqual({ date: "2026-05-02T09:00:00Z", source: "items" });
  });
  it("interna sin finalizaciones queda como no consta", () => {
    expect(effectiveExecution({ is_external: false, metadata: null, item_completions: [null] }).date).toBeNull();
  });
  it("alcance desde snapshot de cierre o ítems vivos", () => {
    expect(interventionScope({ close_snapshot: { items: [1, 2, 3] } }, 5)).toBe(3);
    expect(interventionScope({}, 5)).toBe(5);
  });
});
