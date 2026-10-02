// Reglas puras del control de equipos de medida (B1).
// La autoridad es PostgreSQL (RPC mtr_*); estas funciones solo sirven para UX y deben coincidir con ella.

export type MtrStoredStatus = "operational" | "restricted" | "unfit" | "out_of_service" | "retired";
export type MtrDisplayStatus = MtrStoredStatus | "due_soon" | "overdue";
export type MtrFrequencyUnit = "days" | "months" | "years" | "before_use";
export type MtrUnfitDecision = "restrict" | "repair" | "retire" | "repeat"; // = CHECK de mnt_mtr_unfit_decisions
export type MtrImpactConclusion = "no_impact" | "impact";

export const DUE_SOON_DAYS = 30;
export const DUE_COUNTER_WINDOWS = [30, 60, 90] as const;

const DAY = 86_400_000;
const toUtc = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
const fmt = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Igual que mtr_calc_next_due: null para "antes de cada uso". */
export function calcNextDue(from: string, unit: MtrFrequencyUnit, value: number): string | null {
  if (unit === "before_use") return null;
  if (!Number.isInteger(value) || value <= 0) throw new Error("Frecuencia no válida");
  const d = new Date(toUtc(from));
  if (unit === "days") d.setUTCDate(d.getUTCDate() + value);
  else {
    const months = unit === "months" ? value : value * 12;
    const day = d.getUTCDate();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() + months);
    const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    d.setUTCDate(Math.min(day, last));
  }
  return fmt(d.getTime());
}

export function daysUntil(due: string, today: string): number {
  return Math.round((toUtc(due) - toUtc(today)) / DAY);
}

/** Estado mostrado: los estados almacenados no operativos prevalecen sobre el vencimiento. */
export function displayStatus(stored: MtrStoredStatus, nextDue: string | null, today: string): MtrDisplayStatus {
  if (stored !== "operational" && stored !== "restricted") return stored;
  if (nextDue) {
    const d = daysUntil(nextDue, today);
    if (d < 0) return "overdue";
    if (d <= DUE_SOON_DAYS && stored === "operational") return "due_soon";
  }
  return stored;
}

/** Decisión ante No apto → estado resultante. restrict → restricted (nunca operational). */
export function statusAfterUnfitDecision(decision: MtrUnfitDecision): MtrStoredStatus {
  switch (decision) {
    case "restrict": return "restricted";
    case "retire": return "retired";
    case "repair": case "repeat": return "out_of_service";
  }
}

/** Un control Apto nunca cambia el estado por sí solo. Igual que mtr_set_status: volver a
 *  operational es una decisión explícita y exige que el último control validado sea Apto. */
export function canReactivate(stored: MtrStoredStatus, lastValidatedResult: "fit" | "unfit" | null): boolean {
  return (stored === "out_of_service" || stored === "restricted" || stored === "unfit") && lastValidatedResult === "fit";
}

export function validateUnfitDecision(decision: MtrUnfitDecision, allowedUses?: string | null): string[] {
  return decision === "restrict" && !allowedUses?.trim() ? ["Indica los usos permitidos"] : [];
}

export interface ImpactCloseInput {
  conclusion: MtrImpactConclusion;
  justification?: string | null;
  actionsTakenOrPlanned?: string | null;
  externalRef?: string | null;
  reviewedOn?: string | null;
}

/** Con impacto no basta la justificación: exige acciones realizadas/previstas. */
export function validateImpactClose(i: ImpactCloseInput): string[] {
  const e: string[] = [];
  if (!i.justification?.trim()) e.push("La justificación es obligatoria");
  if (!i.reviewedOn) e.push("La fecha de evaluación es obligatoria");
  if (i.conclusion === "impact" && !i.actionsTakenOrPlanned?.trim())
    e.push("Con impacto, describe las acciones realizadas o previstas");
  return e;
}

export interface ReferenceCandidate {
  status: MtrStoredStatus;
  hasPendingImpact: boolean;
  /** Controles validados de planes activos marcados qualifies_as_reference. */
  qualifyingControls: { performedOn: string; validUntil: string | null }[];
}

/** Patrón elegible en `on`: operational, sin impacto pendiente y con control habilitante vigente ese día. */
export function isReferenceEligible(c: ReferenceCandidate, on: string): boolean {
  if (c.status !== "operational" || c.hasPendingImpact) return false;
  return c.qualifyingControls.some(
    (q) => q.performedOn <= on && (q.validUntil === null || q.validUntil >= on),
  );
}

/** Resultado agregado: cualquier línea no apta → unfit; líneas sin resultado bloquean. */
export function aggregateLines(lines: { result: "fit" | "unfit" | null }[]): "fit" | "unfit" | "incomplete" {
  if (lines.some((l) => l.result === null)) return "incomplete";
  return lines.some((l) => l.result === "unfit") ? "unfit" : "fit";
}

export function lineResult(reference: number | null, measured: number | null, tolerance: number | null) {
  if (reference === null || measured === null || tolerance === null) return null;
  return Math.abs(measured - reference) <= tolerance ? "fit" : "unfit";
}

export type CriterionMode = "absolute" | "percentage" | "manual";
/** Igual que mtr_validate_record: absoluto |m-r|; % |m-r|/|r|·100 (patrón ≠ 0); manual → null. */
export function lineError(mode: CriterionMode, reference: number | null, measured: number | null): number | null {
  if (mode === "manual" || reference === null || measured === null) return null;
  const d = Math.abs(measured - reference);
  if (mode === "absolute") return d;
  return reference === 0 ? null : (d / Math.abs(reference)) * 100;
}
export function lineEval(mode: CriterionMode, reference: number | null, measured: number | null, tolerance: number | null): "fit" | "unfit" | null {
  const e = lineError(mode, reference, measured);
  if (e === null || tolerance === null) return null;
  return e <= tolerance + 1e-12 ? "fit" : "unfit";
}
