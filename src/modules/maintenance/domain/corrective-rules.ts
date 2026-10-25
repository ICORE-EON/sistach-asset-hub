/** Corrective (2B) labels and UX-only validations; the server is the authority. */
import type { CorrectiveClose, CorrectiveOutcome, CorrectivePriority, NewCorrective } from "../contracts/corrective";

export const PRIORITY_LABEL: Record<CorrectivePriority, string> = { low: "Baja", normal: "Normal", high: "Alta" };
export const OUTCOME_LABEL: Record<CorrectiveOutcome, string> = { repaired: "Reparado", not_repaired: "No reparado", replaced: "Sustituido" };

/** Repair status labels (intervention), distinct from the asset's operational status. */
export function correctiveStatusLabel(status: string): string {
  switch (status) {
    case "draft": return "Pendiente";
    case "in_progress": return "En reparación";
    case "closed": return "Finalizada";
    case "cancelled": return "Cancelada";
    default: return status;
  }
}
export const isCorrectiveOpen = (status: string) => status === "draft" || status === "in_progress";

export function validateNewCorrective(v: NewCorrective, today: string): string[] {
  const e: string[] = [];
  if (!v.assetId) e.push("Selecciona el equipo");
  if (!v.detectedOn || v.detectedOn > today) e.push("La fecha de detección no puede ser futura");
  if (!v.description.trim()) e.push("Describe la avería");
  if (v.external && !v.provider?.trim()) e.push("Indica la empresa externa");
  return e;
}

export function validateCorrectiveClose(v: CorrectiveClose, detectedOn: string, today: string): string[] {
  const e: string[] = [];
  if (!v.performedOn || v.performedOn > today || v.performedOn < detectedOn) e.push("La fecha de finalización debe estar entre la detección y hoy");
  if (v.outcome === "not_repaired" && !v.observations?.trim()) e.push("Explica por qué no se ha reparado");
  if (v.reactivate && v.outcome !== "repaired") e.push("Solo un equipo reparado puede volver a activo");
  return e;
}
