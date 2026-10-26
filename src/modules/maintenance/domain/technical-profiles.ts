/**
 * Fichas técnicas por tipo de activo (catálogo de sistema, declarativo).
 * - El catálogo vive en código y es común a todas las empresas; no contiene datos de empresa.
 * - Cada empresa decide qué perfil usa cada uno de SUS tipos (asset_types.metadata.technical_profile).
 * - Los valores de cada activo se guardan tipados en assets.metadata.technical
 *   = { profile, version, values: { clave: number | string } }.
 * - No incluye obligaciones legales ni periodicidades: solo datos técnicos.
 */
export type AttrDef =
  | { key: string; label: string; type: "number"; unit?: string; min?: number; max?: number; step?: number; integer?: boolean; group?: string; help?: string }
  | { key: string; label: string; type: "enum"; options: { value: string; label: string }[]; group?: string; help?: string }
  | { key: string; label: string; type: "text"; maxLength?: number; group?: string; help?: string };

export type TechnicalProfile = { code: string; version: number; label: string; attributes: AttrDef[] };
export type TechnicalValues = Record<string, number | string>;
export type TechnicalSheet = { profile: string; version: number; values: TechnicalValues };

const REFRIGERANTS = ["R-32", "R-410A", "R-407C", "R-134a", "R-290", "R-744 (CO2)", "R-22", "R-454B", "R-513A", "Otro"];

export const TECHNICAL_PROFILES: Record<string, TechnicalProfile> = {
  hvac: {
    code: "hvac",
    version: 1,
    label: "Climatización",
    attributes: [
      { key: "system_type", label: "Tipo de sistema", type: "enum", group: "General", options: [
        { value: "split", label: "Split" }, { value: "multisplit", label: "Multisplit" },
        { value: "vrf", label: "VRV / VRF" }, { value: "rooftop", label: "Rooftop / compacto" },
        { value: "chiller", label: "Enfriadora" }, { value: "heat_pump", label: "Bomba de calor" },
        { value: "other", label: "Otro" },
      ] },
      { key: "cooling_kw", label: "Potencia frío", type: "number", unit: "kW", min: 0, max: 10000, step: 0.01, group: "Potencia" },
      { key: "heating_kw", label: "Potencia calor", type: "number", unit: "kW", min: 0, max: 10000, step: 0.01, group: "Potencia" },
      { key: "refrigerant", label: "Refrigerante", type: "enum", group: "Refrigerante", options: REFRIGERANTS.map((r) => ({ value: r, label: r })) },
      { key: "charge_kg", label: "Carga de refrigerante", type: "number", unit: "kg", min: 0, max: 100000, step: 0.01, group: "Refrigerante" },
      { key: "gwp", label: "PCA / GWP", type: "number", min: 0, max: 30000, step: 1, integer: true, group: "Refrigerante",
        help: "Valor del fabricante o de la ficha de seguridad del gas." },
    ],
  },
};

export const listProfiles = () => Object.values(TECHNICAL_PROFILES);
export const getProfile = (code: unknown): TechnicalProfile | null =>
  typeof code === "string" ? TECHNICAL_PROFILES[code] ?? null : null;

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
export const profileOfType = (typeMetadata: unknown) => getProfile(obj(typeMetadata).technical_profile);

/** Lee la ficha guardada en assets.metadata (tolerante a datos ausentes). */
export function readSheet(assetMetadata: unknown): TechnicalSheet | null {
  const t = obj(obj(assetMetadata).technical);
  if (typeof t.profile !== "string") return null;
  return { profile: t.profile, version: Number(t.version) || 1, values: obj(t.values) as TechnicalValues };
}

/** CO2 equivalente (t) = kg × GWP / 1000. Derivado, no se guarda. */
export function co2eTonnes(values: TechnicalValues): number | null {
  const kg = values.charge_kg, gwp = values.gwp;
  if (typeof kg !== "number" || typeof gwp !== "number") return null;
  return Math.round((kg * gwp) / 10) / 100;
}

/**
 * Convierte la entrada del formulario (strings) en valores tipados y valida.
 * Campos vacíos se omiten. Claves desconocidas se rechazan.
 */
export function buildSheet(profile: TechnicalProfile, raw: Record<string, string>):
  { ok: true; sheet: TechnicalSheet } | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const values: TechnicalValues = {};
  const known = new Set(profile.attributes.map((a) => a.key));
  for (const k of Object.keys(raw)) if (!known.has(k) && raw[k]?.trim()) errors[k] = "Campo no previsto";
  for (const a of profile.attributes) {
    const s = (raw[a.key] ?? "").trim();
    if (!s) continue;
    if (a.type === "number") {
      const n = Number(s.replace(",", "."));
      if (!Number.isFinite(n)) { errors[a.key] = "Debe ser un número"; continue; }
      if (a.integer && !Number.isInteger(n)) { errors[a.key] = "Debe ser un número entero"; continue; }
      if (a.min != null && n < a.min) { errors[a.key] = `Mínimo ${a.min}`; continue; }
      if (a.max != null && n > a.max) { errors[a.key] = `Máximo ${a.max}`; continue; }
      values[a.key] = n;
    } else if (a.type === "enum") {
      if (!a.options.some((o) => o.value === s)) { errors[a.key] = "Opción no válida"; continue; }
      values[a.key] = s;
    } else {
      if (s.length > (a.maxLength ?? 200)) { errors[a.key] = "Texto demasiado largo"; continue; }
      values[a.key] = s;
    }
  }
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, sheet: { profile: profile.code, version: profile.version, values } };
}

/** Valores de una ficha a strings para el formulario. */
export const sheetToForm = (sheet: TechnicalSheet | null): Record<string, string> =>
  Object.fromEntries(Object.entries(sheet?.values ?? {}).map(([k, v]) => [k, String(v)]));

export function formatValue(a: AttrDef, v: unknown): string {
  if (v === undefined || v === null || v === "") return "—";
  if (a.type === "enum") return a.options.find((o) => o.value === v)?.label ?? String(v);
  if (a.type === "number") return `${Number(v).toLocaleString("es-ES")}${a.unit ? ` ${a.unit}` : ""}`;
  return String(v);
}
