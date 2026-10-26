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
type G = { group?: string; help?: string };
const num = (key: string, label: string, unit: string | undefined, max: number, x: G & { step?: number; integer?: boolean; min?: number } = {}): AttrDef =>
  ({ key, label, type: "number", unit, min: x.min ?? 0, max, step: x.step ?? (x.integer ? 1 : 0.01), integer: x.integer, group: x.group, help: x.help });
const txt = (key: string, label: string, maxLength = 120, x: G = {}): AttrDef => ({ key, label, type: "text", maxLength, ...x });
const en = (key: string, label: string, pairs: [string, string][], x: G = {}): AttrDef => ({ key, label, type: "enum", options: opts(pairs), ...x });
const P = (code: string, label: string, attributes: AttrDef[], version = 1): TechnicalProfile => ({ code, version, label, attributes });

const PHASES: [string, string][] = [["1", "Monofásica"], ["3", "Trifásica"]];
const FUELS: [string, string][] = [["diesel", "Diésel"], ["petrol", "Gasolina"], ["natural_gas", "Gas natural"], ["lpg", "GLP"], ["biomass", "Biomasa"], ["electric", "Eléctrico"], ["other", "Otro"]];
const voltage = (label = "Tensión nominal") => num("voltage_v", label, "V", 400000, { integer: true });
const serves = txt("serves", "Instalaciones / equipos a los que da servicio", 200);

const refrigerantAttrs: AttrDef[] = [
  { key: "refrigerant", label: "Refrigerante", type: "enum", group: "Refrigerante", options: REFRIGERANTS.map((r) => ({ value: r, label: r })) },
  { key: "charge_kg", label: "Carga de refrigerante", type: "number", unit: "kg", min: 0, max: 100000, step: 0.01, group: "Refrigerante" },
  { key: "gwp", label: "PCA / GWP", type: "number", min: 0, max: 30000, step: 1, integer: true, group: "Refrigerante",
    help: "Se propone al elegir refrigerante; puedes cambiarlo por el del fabricante." },
  { key: "gwp_source", label: "Fuente del PCA", type: "text", maxLength: 120, group: "Refrigerante" },
];

const list: TechnicalProfile[] = [
  // Instalaciones eléctricas
  P("electric_meter", "Contador / punto de suministro", [
    txt("supply_point_id", "Identificador del punto de suministro", 40, { help: "p.ej. CUPS en España" }),
    txt("distributor", "Distribuidora", 80),
    txt("access_tariff", "Tarifa de acceso", 40),
    voltage(), en("phases", "Fases", PHASES),
    num("contracted_power_max_kw", "Potencia contratada máxima", "kW", 100000,
      { help: "Dato informativo. No determina por sí solo ninguna obligación legal." }),
  ]),
  P("power_analyzer", "Analizador de redes / subcontador", [
    txt("magnitudes", "Magnitudes medidas", 120, { help: "Ej.: kWh, kW, cos φ, armónicos" }),
    voltage(), txt("ct_ratio", "Relación de transformación", 30, { help: "Ej.: 200/5" }),
    txt("accuracy_class", "Clase de precisión", 20),
    en("communication", "Comunicación", [["none", "Ninguna"], ["modbus_rtu", "Modbus RTU"], ["modbus_tcp", "Modbus TCP"], ["pulse", "Impulsos"], ["other", "Otra"]]),
    txt("monitors", "Consumos / instalaciones que monitoriza", 200),
  ]),
  P("lv_installation", "Instalación / cuadro de baja tensión", [
    voltage(), num("rated_current_a", "Intensidad nominal", "A", 100000, { step: 0.1 }), en("phases", "Fases", PHASES),
    num("design_power_kw", "Potencia de diseño", "kW", 100000, { help: "Solo si es técnicamente pertinente" }),
    en("earthing_system", "Esquema de conexión a tierra", [["TT", "TT"], ["TN-S", "TN-S"], ["TN-C", "TN-C"], ["TN-C-S", "TN-C-S"], ["IT", "IT"]]),
    serves,
  ]),
  P("transformer", "Transformador", [
    num("power_kva", "Potencia", "kVA", 1000000, { step: 1 }),
    num("primary_voltage_v", "Tensión primaria", "V", 400000, { integer: true }),
    num("secondary_voltage_v", "Tensión secundaria", "V", 400000, { integer: true }),
    en("cooling", "Aislamiento / refrigeración", [["oil", "Baño de aceite"], ["dry", "Seco (resina)"], ["other", "Otro"]]),
  ]),
  P("capacitor_bank", "Batería de condensadores", [
    num("reactive_kvar", "Potencia reactiva", "kvar", 100000, { step: 0.1 }), voltage(), num("steps", "Escalones", undefined, 100, { integer: true }),
  ]),
  // Energía y generación
  P("pv_plant", "Instalación fotovoltaica", [
    num("peak_power_kwp", "Potencia pico", "kWp", 1000000), num("ac_power_kw", "Potencia nominal AC", "kW", 1000000),
    num("modules", "Nº de módulos", undefined, 1000000, { integer: true }),
    en("usage_mode", "Modalidad de utilización", [["self_no_surplus", "Autoconsumo sin excedentes"], ["self_surplus", "Autoconsumo con excedentes"], ["full_export", "Venta total"], ["other", "Otro"]]),
  ]),
  P("inverter", "Inversor", [
    num("ac_power_kw", "Potencia AC", "kW", 100000), num("dc_power_kw", "Potencia DC máx.", "kW", 100000),
    num("mppt", "Nº de MPPT", undefined, 100, { integer: true }), en("phases", "Fases", PHASES),
  ]),
  P("generator", "Grupo electrógeno", [
    num("power_kva", "Potencia aparente", "kVA", 100000, { step: 0.1 }), num("power_kw", "Potencia activa", "kW", 100000),
    en("fuel", "Combustible", FUELS), voltage(), num("tank_l", "Depósito", "l", 1000000, { step: 1 }),
  ]),
  P("ups", "SAI / UPS", [
    num("power_kva", "Potencia", "kVA", 10000, { step: 0.1 }), num("autonomy_min", "Autonomía nominal", "min", 10000, { integer: true }),
    txt("battery", "Batería", 80, { help: "Tipo y capacidad" }), voltage(), serves,
  ]),
  P("ev_charger", "Cargador de vehículo eléctrico", [
    num("power_kw", "Potencia", "kW", 1000), en("current_type", "Corriente", [["ac", "AC"], ["dc", "DC"]]),
    en("connector", "Conector", [["type2", "Tipo 2"], ["ccs2", "CCS2"], ["chademo", "CHAdeMO"], ["schuko", "Schuko"], ["other", "Otro"]]),
    num("current_a", "Intensidad", "A", 1000, { step: 0.1 }), num("points", "Puntos de carga", undefined, 100, { integer: true }),
  ]),
  P("boiler", "Caldera", [
    num("useful_power_kw", "Potencia útil", "kW", 100000), en("fuel", "Combustible", FUELS),
    num("efficiency_pct", "Rendimiento", "%", 120, { step: 0.1 }),
    num("design_pressure_bar", "Presión de diseño", "bar", 1000, { step: 0.1 }), num("design_temp_c", "Temperatura de diseño", "°C", 1000, { min: -50, step: 0.1 }),
  ]),
  // Climatización y refrigeración (hvac conserva claves de v1; añade eficiencia opcional)
  P("hvac", "Climatización", [
    en("system_type", "Tipo de sistema", [["split", "Split"], ["multisplit", "Multisplit"], ["vrf", "VRV / VRF"], ["rooftop", "Rooftop / compacto"],
      ["chiller", "Enfriadora"], ["heat_pump", "Bomba de calor"], ["other", "Otro"]], { group: "General" }),
    num("cooling_kw", "Potencia frío", "kW", 10000, { group: "Potencia" }),
    num("heating_kw", "Potencia calor", "kW", 10000, { group: "Potencia" }),
    txt("nominal_efficiency", "Eficiencia nominal", 40, { group: "Potencia", help: "Ej.: SEER 6,1 / SCOP 4,0" }),
    ...refrigerantAttrs,
  ]),
  P("refrigeration", "Instalación frigorífica", [
    num("cooling_kw", "Potencia frigorífica", "kW", 100000),
    num("design_temp_c", "Temperatura de diseño", "°C", 100, { min: -100, step: 0.1 }),
    ...refrigerantAttrs,
  ]),
  // PCI y emergencias
  P("pci_extinguisher", "Extintor", [
    en("agent", "Agente extintor", [["abc_powder", "Polvo ABC"], ["co2", "CO₂"], ["water", "Agua"], ["foam", "Espuma (AFFF)"], ["wet_chemical", "Clase F"], ["other", "Otro"]]),
    num("capacity", "Capacidad", "kg / l", 500, { step: 0.1 }),
    txt("efficacy", "Eficacia", 40, { help: "Ej.: 21A-113B-C" }),
    num("manufacture_year", "Año de fabricación", undefined, 2100, { min: 1950, integer: true }),
  ]),
  P("pci_hose", "BIE / manguera", [
    en("diameter_mm", "Diámetro", [["25", "25 mm"], ["45", "45 mm"]]),
    num("hose_length_m", "Longitud manguera", "m", 100, { step: 0.5 }),
    en("hose_type", "Tipo de manguera", [["semi_rigid", "Semirrígida"], ["flat", "Plana"]]),
  ]),
  P("fire_detection", "Detección y alarma de incendios", [
    en("system_type", "Tipo de sistema", [["conventional", "Convencional"], ["addressable", "Analógico / direccionable"], ["wireless", "Vía radio"], ["other", "Otro"]]),
    txt("technology", "Tecnología de detección", 80, { help: "Ej.: óptico, térmico, aspiración" }),
    txt("panel_zone", "Central / zona", 80),
  ]),
  P("emergency_lighting", "Alumbrado de emergencia", [
    en("lighting_type", "Tipo", [["non_maintained", "No permanente"], ["maintained", "Permanente"], ["central_battery", "Batería central"]]),
    num("autonomy_min", "Autonomía", "min", 1000, { integer: true }), num("power_w", "Potencia", "W", 10000, { step: 0.1 }),
  ]),
  // Vehículos y equipos móviles. v2: kilometraje retirado (es una lectura fechada, no un atributo).
  P("vehicle", "Vehículo", [
    txt("plate", "Matrícula / identificador", 20),
    en("fuel", "Combustible / propulsión", [["diesel", "Diésel"], ["petrol", "Gasolina"], ["electric", "Eléctrico"], ["hybrid", "Híbrido"], ["phev", "Híbrido enchufable"], ["lpg", "GLP"], ["cng", "GNC"], ["other", "Otro"]]),
    num("power_kw", "Potencia", "kW", 10000),
    num("first_registration_year", "Año de matriculación", undefined, 2100, { min: 1950, integer: true }),
    num("homologated_consumption", "Consumo homologado", undefined, 1000, { step: 0.1 }),
    en("consumption_unit", "Unidad del consumo homologado", [["l_100km", "l/100 km"], ["kwh_100km", "kWh/100 km"], ["kg_100km", "kg/100 km"]]),
    num("co2_g_km", "Emisiones CO₂ homologadas", "g/km", 2000, { step: 0.1, help: "Si procede" }),
    num("mma_kg", "MMA", "kg", 100000, { integer: true }),
  ], 2),
  P("forklift", "Carretilla / equipo móvil", [
    en("propulsion", "Propulsión", [["electric", "Eléctrica"], ["diesel", "Diésel"], ["lpg", "GLP"], ["manual", "Manual"], ["other", "Otra"]]),
    num("capacity_kg", "Capacidad nominal", "kg", 100000, { integer: true }), num("lift_height_m", "Altura de elevación", "m", 100, { step: 0.1 }),
  ]),
  // Presión y aire comprimido
  P("compressor", "Compresor", [
    num("flow_m3_min", "Caudal", "m³/min", 10000), num("pressure_bar", "Presión máxima", "bar", 1000, { step: 0.1 }),
    num("power_kw", "Potencia", "kW", 10000),
    en("technology", "Tecnología", [["screw", "Tornillo"], ["piston", "Pistón"], ["scroll", "Scroll"], ["centrifugal", "Centrífugo"], ["other", "Otra"]]),
  ]),
  P("pressure_vessel", "Depósito / equipo a presión", [
    num("volume_l", "Volumen", "l", 10000000, { step: 1 }), num("ps_bar", "Presión máxima admisible (PS)", "bar", 1000, { step: 0.1 }),
    num("design_temp_c", "Temperatura de diseño", "°C", 1000, { min: -200, step: 0.1 }), txt("fluid", "Fluido", 60),
  ]),
  // Maquinaria y elevación
  P("machine", "Máquina", [txt("function", "Función", 120), num("power_kw", "Potencia", "kW", 100000), txt("rated_capacity", "Capacidad nominal", 60)]),
  P("lifting", "Equipo de elevación", [num("max_load_kg", "Carga máxima", "kg", 1000000, { integer: true }), num("travel_m", "Altura / recorrido", "m", 1000, { step: 0.1 })]),
  P("racking", "Estantería industrial", [num("load_per_level_kg", "Carga por nivel / módulo", "kg", 100000, { integer: true }), num("height_m", "Altura", "m", 100, { step: 0.1 })]),
  // Instrumentos de medida y control (v2: exactitud, uso y control según uso)
  P("measuring", "Instrumento de medida", [
    txt("magnitude", "Magnitud", 60, { help: "Ej.: temperatura, presión, longitud" }),
    num("range_min", "Rango mínimo", undefined, 1e9, { min: -1e9, step: 0.001 }),
    num("range_max", "Rango máximo", undefined, 1e9, { min: -1e9, step: 0.001 }),
    txt("unit", "Unidad", 20),
    num("resolution", "Resolución", undefined, 1e9, { step: 0.0001 }),
    txt("declared_accuracy", "Exactitud declarada", 60),
    txt("intended_use", "Uso previsto", 120),
    en("metrological_control", "Control metrológico según uso", [["calibration", "Calibración"], ["verification", "Verificación interna"], ["none", "Sin control (uso orientativo)"]]),
  ], 2),
  // Agua y medioambiente
  P("water_tank", "Depósito", [
    num("volume_m3", "Volumen", "m³", 100000), txt("material", "Material", 60), txt("product", "Producto almacenado", 80),
    en("placement", "Tipo de instalación", [["aboveground", "Aéreo"], ["underground", "Enterrado"], ["semi", "Semienterrado"]]),
    en("construction", "Construcción", [["single_wall", "Pared simple"], ["double_wall", "Pared doble"]]),
    en("secondary_containment", "Contención secundaria", [["bund", "Cubeto"], ["other", "Otra"], ["none", "Sin contención"]]),
  ]),
  P("wwtp", "Depuradora (EDAR)", [num("nominal_flow_m3_d", "Caudal nominal", "m³/día", 1000000), txt("discharge_type", "Tipo de vertido", 80)]),
  P("ro_plant", "Ósmosis inversa", [num("capacity_l_h", "Capacidad", "l/h", 10000000, { step: 1 })]),
  P("pump", "Bomba", [num("flow_m3_h", "Caudal", "m³/h", 100000), num("head_m", "Altura manométrica", "m", 10000, { step: 0.1 }), num("power_kw", "Potencia", "kW", 10000)]),
  // Heredado (Hito 1B): se conserva para tipos ya configurados; el catálogo usa perfiles específicos.
  P("electrical", "Instalación eléctrica (genérica)", [
    voltage("Tensión"), en("phases", "Fases", PHASES), num("rated_current_a", "Intensidad nominal", "A", 100000, { step: 0.1 }),
    num("power_kw", "Potencia", "kW", 100000), num("power_kva", "Potencia aparente", "kVA", 100000, { step: 0.1 }),
  ]),
];

export const TECHNICAL_PROFILES: Record<string, TechnicalProfile> = Object.fromEntries(list.map((p) => [p.code, p]));

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

/** Valores de una ficha a strings para el formulario (descarta claves retiradas de la versión vigente). */
export const sheetToForm = (sheet: TechnicalSheet | null, profile?: TechnicalProfile): Record<string, string> => {
  const known = profile ? new Set(profile.attributes.map((a) => a.key)) : null;
  return Object.fromEntries(Object.entries(sheet?.values ?? {}).filter(([k]) => !known || known.has(k)).map(([k, v]) => [k, String(v)]));
};

export function formatValue(a: AttrDef, v: unknown): string {
  if (v === undefined || v === null || v === "") return "—";
  if (a.type === "enum") return a.options.find((o) => o.value === v)?.label ?? String(v);
  if (a.type === "number") return `${Number(v).toLocaleString("es-ES")}${a.unit ? ` ${a.unit}` : ""}`;
  return String(v);
}
