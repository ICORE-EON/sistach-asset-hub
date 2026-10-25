import { describe, it, expect } from "vitest";
import { addMonthsClamped, toOrgDate, proposeDue, calendarAlternative, defaultDecision, decisionNeedsReason, dueState, isExecution, planIntervalMonths } from "../due-date";

describe("fechas calendario", () => {
  it("fin de mes y bisiestos", () => {
    expect(addMonthsClamped("2027-01-31", 1)).toBe("2027-02-28");
    expect(addMonthsClamped("2028-01-31", 1)).toBe("2028-02-29");
    expect(addMonthsClamped("2028-02-29", 12)).toBe("2029-02-28");
    expect(addMonthsClamped("2026-11-30", 3)).toBe("2027-02-28");
    expect(addMonthsClamped("2026-03-31", 60)).toBe("2031-03-31");
    expect(addMonthsClamped("2026-12-15", 1)).toBe("2027-01-15");
  });
  it("rechaza fechas inexistentes", () => {
    expect(() => addMonthsClamped("2027-02-30", 1)).toThrow();
  });
  it("día local de la organización", () => {
    expect(toOrgDate("2026-06-30T21:30:00Z", "Europe/Madrid")).toBe("2026-06-30"); // 23:30 Madrid
    expect(toOrgDate("2026-06-30T22:30:00Z", "Europe/Madrid")).toBe("2026-07-01"); // 00:30 Madrid
    expect(toOrgDate("2026-01-31T23:30:00Z", "America/New_York")).toBe("2026-01-31");
  });
  it("intervalo del plan", () => {
    expect(planIntervalMonths("annual", null)).toBe(12);
    expect(planIntervalMonths("custom", 60)).toBe(60);
  });
});

describe("propuesta de próxima fecha", () => {
  it("regla única: realización + intervalo", () => {
    expect(proposeDue("2026-05-10", 3)).toBe("2026-08-10");
  });
  it("alternativa «Mantener calendario» = prevista + intervalo", () => {
    expect(calendarAlternative("2026-04-30", "2026-05-10", 3)).toBe("2026-07-30");
    expect(calendarAlternative("2026-05-10", "2026-05-10", 3)).toBeNull();
    expect(calendarAlternative(null, "2026-05-10", 3)).toBeNull();
  });
});

describe("decisión por resultado", () => {
  it("conforme e incidencias avanzan; omitido no; no aplica global exige decidir", () => {
    expect(defaultDecision("ok")).toBe("advance");
    expect(defaultDecision("with_incident")).toBe("advance");
    expect(defaultDecision("skipped")).toBe("keep");
    expect(defaultDecision("pending")).toBe("keep");
    expect(defaultDecision("not_applicable")).toBe("decide");
    expect(isExecution("skipped")).toBe(false);
  });
  it("motivo obligatorio en las excepciones", () => {
    const base = { proposed: "2026-08-10", calendar: "2026-07-30" };
    expect(decisionNeedsReason({ ...base, result: "ok", action: "advance", due: "2026-08-10" })).toBe(false);
    expect(decisionNeedsReason({ ...base, result: "ok", action: "advance", due: "2026-07-30" })).toBe(false);
    expect(decisionNeedsReason({ ...base, result: "ok", action: "advance", due: "2026-09-01" })).toBe(true);
    expect(decisionNeedsReason({ ...base, result: "with_incident", action: "keep", due: null })).toBe(true);
    expect(decisionNeedsReason({ ...base, result: "not_applicable", action: "advance", due: "2026-08-10" })).toBe(true);
    expect(decisionNeedsReason({ ...base, result: "not_applicable", action: "keep", due: null })).toBe(false);
  });
});

describe("estado en Próximos", () => {
  it("inicio futuro nunca vencido; sin fecha = sin programar", () => {
    expect(dueState("2026-01-01", "2026-10-25", "2026-12-01")).toBe("not_started");
    expect(dueState(null, "2026-10-25")).toBe("unscheduled");
    expect(dueState("2026-10-24", "2026-10-25")).toBe("overdue");
    expect(dueState("2026-11-10", "2026-10-25")).toBe("soon");
    expect(dueState("2027-05-01", "2026-10-25")).toBe("ok");
  });
});
