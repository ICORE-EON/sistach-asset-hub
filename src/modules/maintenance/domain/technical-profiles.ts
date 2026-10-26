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

/**
 * Biblioteca mínima de PCA/GWP (horizonte 100 años, IPCC AR4), tal como figuran en el
 * Reglamento (UE) n.º 517/2014, anexos I y IV (mezclas calculadas por ese método).
 * Es una ayuda de referencia: no sustituye la ficha del fabricante ni vale para cualquier marco normativo.
 */
export const GWP_SOURCE = "IPCC AR4 · Reg. (UE) 517/2014";
export const REFRIGERANT_GWP: Record<string, number> = {
  "R-32": 675, "R-410A": 2088, "R-407C": 1774, "R-134a": 1430, "R-404A": 3922,
  "R-22": 1810, "R-454B": 466, "R-513A": 631, "R-1234yf": 4, "R-290": 3, "R-744 (CO2)": 1,
};
export const gwpFor = (refrigerant: unknown) =>
  typeof refrigerant === "string" && refrigerant in REFRIGERANT_GWP ? { gwp: REFRIGERANT_GWP[refrigerant], source: GWP_SOURCE } : null;
const REFRIGERANTS = [...Object.keys(REFRIGERANT_GWP), "Otro"];

const opts = (pairs: [string, string][]) => pairs.map(([value, label]) => ({ value, label }));
const refrigerantAttrs: AttrDef[] = [
  { key: "refrigerant", label: "Refrigerante", type: "enum", group: "Refrigerante", options: REFRIGERANTS.map((r) => ({ value: r, label: r })) },
  { key: "charge_kg", label: "Carga de refrigerante", type: "number", unit: "kg", min: 0, max: 100000, step: 0.01, group: "Refrigerante" },
  { key: "gwp", label: "PCA / GWP", type: "number", min: 0, max: 30000, step: 1, integer: true, group: "Refrigerante",
    help: "Se propone al elegir refrigerante; puedes cambiarlo por el del fabricante." },
  { key: "gwp_source", label: "Fuente del PCA", type: "text", maxLength: 120, group: "Refrigerante" },
];

export const TECHNICAL_PROFILES: Record<string, TechnicalProfile> = {
  hvac: {
    code: "hvac", version: 1, label: "Climatización",
    attributes: [
      { key: "system_type", label: "Tipo de sistema", type: "enum", group: "General", options: opts([
        ["split", "Split"], ["multisplit", "Multisplit"], ["vrf", "VRV / VRF"], ["rooftop", "Rooftop / compacto"],
        ["chiller", "Enfriadora"], ["heat_pump", "Bomba de calor"], ["other", "Otro"]]) },
      { key: "cooling_kw", label: "Potencia frío", type: "number", unit: "kW", min: 0, max: 10000, step: 0.01, group: "Potencia" },
      { key: "heating_kw", label: "Potencia calor", type: "number", unit: "kW", min: 0, max: 10000, step: 0.01, group: "Potencia" },
      ...refrigerantAttrs,
    ],
  },
  pci_extinguisher: {
    code: "pci_extinguisher", version: 1, label: "Extintor",
    attributes: [
      { key: "agent", label: "Agente extintor", type: "enum", options: opts([
        ["abc_powder", "Polvo ABC"], ["co2", "CO₂"], ["water", "Agua"], ["foam", "Espuma (AFFF)"], ["wet_chemical", "Clase F"], ["other", "Otro"]]) },
      { key: "capacity", label: "Capacidad", type: "number", unit: "kg / l", min: 0, max: 500, step: 0.1 },
      { key: "efficacy", label: "Eficacia", type: "text", maxLength: 40, help: "Ej.: 21A-113B-C" },
      { key: "manufacture_year", label: "Año de fabricación", type: "number", min: 1950, max: 2100, integer: true },
    ],
  },
  pci_hose: {
    code: "pci_hose", version: 1, label: "BIE / manguera",
    attributes: [
      { key: "diameter_mm", label: "Diámetro", type: "enum", options: opts([["25", "25 mm"], ["45", "45 mm"]]) },
      { key: "hose_length_m", label: "Longitud manguera", type: "number", unit: "m", min: 0, max: 100, step: 0.5 },
      { key: "hose_type", label: "Tipo de manguera", type: "enum", options: opts([["semi_rigid", "Semirrígida"], ["flat", "Plana"]]) },
    ],
  },
  electrical: {
    code: "electrical", version: 1, label: "Instalación eléctrica",
    attributes: [
      { key: "voltage_v", label: "Tensión", type: "number", unit: "V", min: 0, max: 400000, integer: true },
      { key: "phases", label: "Fases", type: "enum", options: opts([["1", "Monofásica"], ["3", "Trifásica"]]) },
      { key: "rated_current_a", label: "Intensidad nominal", type: "number", unit: "A", min: 0, max: 100000, step: 0.1 },
      { key: "power_kw", label: "Potencia", type: "number", unit: "kW", min: 0, max: 100000, step: 0.01 },
      { key: "power_kva", label: "Potencia aparente", type: "number", unit: "kVA", min: 0, max: 100000, step: 0.1 },
    ],
  },
  vehicle: {
    code: "vehicle", version: 1, label: "Vehículo",
    attributes: [
      { key: "plate", label: "Matrícula", type: "text", maxLength: 15 },
      { key: "fuel", label: "Combustible", type: "enum", options: opts([
        ["diesel", "Diésel"], ["petrol", "Gasolina"], ["electric", "Eléctrico"], ["hybrid", "Híbrido"], ["lpg", "GLP"], ["other", "Otro"]]) },
      { key: "first_registration_year", label: "Año de matriculación", type: "number", min: 1950, max: 2100, integer: true },
      { key: "odometer_km", label: "Kilometraje", type: "number", unit: "km", min: 0, max: 5000000, integer: true },
      { key: "mma_kg", label: "MMA", type: "number", unit: "kg", min: 0, max: 100000, integer: true },
    ],
  },
  measuring: {
    code: "measuring", version: 1, label: "Equipo de medida",
    attributes: [
      { key: "magnitude", label: "Magnitud", type: "text", maxLength: 60, help: "Ej.: temperatura, presión, longitud" },
      { key: "range_min", label: "Rango mínimo", type: "number", min: -1e9, max: 1e9, step: 0.001 },
      { key: "range_max", label: "Rango máximo", type: "number", min: -1e9, max: 1e9, step: 0.001 },
      { key: "unit", label: "Unidad", type: "text", maxLength: 20 },
      { key: "resolution", label: "Resolución", type: "number", min: 0, max: 1e9, step: 0.0001 },
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

/** CO2 equivalente (t) = kg × GWP / 1000. Derivado del factor guardado (gwp + gwp_source). */
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
