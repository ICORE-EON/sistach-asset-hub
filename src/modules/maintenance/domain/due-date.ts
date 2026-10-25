/**
 * Due-date rules (Bloque 1B). Pure: calendar dates only ("YYYY-MM-DD"), no Date arithmetic in local time.
 * One proposal rule: next = real execution date + plan interval. A visible alternative keeps the calendar:
 * planned date + interval. The user may always confirm or change it. The SQL functions apply the same
 * rules; these helpers exist for previews and tests.
 */
export type DueDecisionAction = "advance" | "keep";
export type DueDefault = "advance" | "keep" | "decide";

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const pad = (n: number, w = 2) => String(n).padStart(w, "0");
const daysIn = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate(); // m: 1..12

export function isCalendarDate(s: unknown): s is string {
  const m = typeof s === "string" ? ISO.exec(s) : null;
  if (!m) return false;
  const y = +m[1], mo = +m[2], d = +m[3];
  return mo >= 1 && mo <= 12 && d >= 1 && d <= daysIn(y, mo);
}

/** Adds whole months; if the day does not exist in the target month, uses its last day (31-ene + 1 = 28/29-feb). */
export function addMonthsClamped(date: string, months: number): string {
  if (!isCalendarDate(date)) throw new Error(`Fecha no válida: ${date}`);
  if (!Number.isInteger(months)) throw new Error("Intervalo no válido");
  const [y, m, d] = date.split("-").map(Number);
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12), nm = (total % 12) + 1;
  return `${pad(ny, 4)}-${pad(nm)}-${pad(Math.min(d, daysIn(ny, nm)))}`;
}

/** Calendar day of an instant in the organisation time zone (e.g. 22:30 UTC → next day in Madrid in summer? no: same rules as Intl). */
export function toOrgDate(instant: string | Date, timeZone = "Europe/Madrid"): string {
  const d = typeof instant === "string" ? new Date(instant) : instant;
  if (Number.isNaN(d.getTime())) throw new Error("Instante no válido");
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

const MONTHS: Record<string, number> = { monthly: 1, quarterly: 3, biannual: 6, semiannual: 6, annual: 12, biennial: 24 };
export function planIntervalMonths(frequency: string, intervalMonths: number | null | undefined): number | null {
  return intervalMonths ?? MONTHS[frequency] ?? null;
}

/** The single proposal rule: real execution + interval. */
export function proposeDue(executedOn: string, months: number): string {
  return addMonthsClamped(executedOn, months);
}
/** "Mantener calendario": planned + interval. Null when there was no planned date or it equals the proposal. */
export function calendarAlternative(plannedOn: string | null, executedOn: string, months: number): string | null {
  if (!plannedOn) return null;
  const alt = addMonthsClamped(plannedOn, months);
  return alt === proposeDue(executedOn, months) ? null : alt;
}

/** Item result → whether the review was performed. Skipped / pending / global N/A are not executions. */
export function isExecution(result: string): boolean {
  return result === "ok" || result === "with_incident" || result === "failed";
}
/** Default decision when closing: performed advance; skipped keep; global N/A needs an explicit decision. */
export function defaultDecision(result: string): DueDefault {
  if (isExecution(result)) return "advance";
  if (result === "not_applicable" || result === "na") return "decide";
  return "keep";
}

/** Whether a decision needs a reason (server enforces the same rule). */
export function decisionNeedsReason(a: {
  result: string; action: DueDecisionAction; due: string | null; proposed: string | null; calendar: string | null;
}): boolean {
  if (a.result === "with_incident" || a.result === "failed") {
    if (a.action === "keep") return true;
  }
  if (a.result === "not_applicable" || a.result === "na") return a.action === "advance";
  if (a.action === "advance" && a.due && a.due !== a.proposed && a.due !== a.calendar) return true;
  return false;
}

export type DueState = "unscheduled" | "not_started" | "overdue" | "soon" | "ok";
/** State shown in Próximos. A link whose start is in the future is never overdue. */
export function dueState(nextDue: string | null, today: string, startsOn?: string | null, soonDays = 30): DueState {
  if (startsOn && startsOn > today) return "not_started";
  if (!nextDue) return "unscheduled";
  if (nextDue < today) return "overdue";
  const soon = new Date(`${today}T00:00:00Z`); soon.setUTCDate(soon.getUTCDate() + soonDays);
  return nextDue <= soon.toISOString().slice(0, 10) ? "soon" : "ok";
}
