/**
 * Plan classification: stable, language-independent codes (stored as-is in the database).
 * Corrective work is not a plan nature: repairs are ad-hoc corrective sessions.
 */
export const PLAN_NATURES = [
  { value: "preventive", label: "Preventivo" },
  { value: "predictive", label: "Predictivo / según condición" },
  { value: "calibration", label: "Calibración / verificación" },
  { value: "other", label: "Otro" },
] as const;
export type PlanNature = (typeof PLAN_NATURES)[number]["value"];

export const REQUIREMENT_ORIGINS = [
  { value: "unspecified", label: "Sin especificar" },
  { value: "legal", label: "Legal / reglamentario" },
  { value: "manufacturer", label: "Fabricante" },
  { value: "internal", label: "Interno" },
  { value: "contractual", label: "Contractual" },
  { value: "other", label: "Otro" },
] as const;
export type RequirementOrigin = (typeof REQUIREMENT_ORIGINS)[number]["value"];

export const isPlanNature = (v: unknown): v is PlanNature => PLAN_NATURES.some((n) => n.value === v);
export const isRequirementOrigin = (v: unknown): v is RequirementOrigin => REQUIREMENT_ORIGINS.some((n) => n.value === v);
export const planNatureLabel = (v: string | null | undefined) => PLAN_NATURES.find((n) => n.value === v)?.label ?? "Preventivo";
export const requirementOriginLabel = (v: string | null | undefined) =>
  REQUIREMENT_ORIGINS.find((n) => n.value === v)?.label ?? "Sin especificar";

/** Normalizes user input; unknown/missing → safe defaults (never "legal"). */
export function normalizeClassification(v: { nature?: string | null; origin?: string | null; reference?: string | null }) {
  const reference = v.reference?.trim() || null;
  if (reference && reference.length > 500) throw new Error("La referencia admite como máximo 500 caracteres");
  if (v.nature != null && !isPlanNature(v.nature)) throw new Error("Naturaleza no válida");
  if (v.origin != null && !isRequirementOrigin(v.origin)) throw new Error("Origen no válido");
  return {
    plan_nature: (v.nature ?? "preventive") as PlanNature,
    requirement_origin: (v.origin ?? "unspecified") as RequirementOrigin,
    requirement_reference: reference,
  };
}
