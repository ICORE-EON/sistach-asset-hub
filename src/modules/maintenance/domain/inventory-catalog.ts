/**
 * Biblioteca maestra para «Configurar inventario»: 9 familias y tipos sugeridos.
 * Solo propone familias y tipos; nunca crea activos. Cada tipo trae su perfil de ficha técnica
 * (null = solo datos generales del activo). `optional` = no se premarca en el asistente.
 */
export type SuggestedType = { code: string; name: string; profile: string | null; optional?: boolean };
export type InventoryGroup = { code: string; name: string; color: string; types: SuggestedType[] };

const t = (code: string, name: string, profile: string | null, optional?: boolean): SuggestedType => ({ code, name, profile, optional });

export const INVENTORY_GROUPS: InventoryGroup[] = [
  { code: "electricidad", name: "Instalaciones eléctricas", color: "#ca8a04", types: [
    t("CONTADOR-ELEC", "Contador eléctrico / punto de suministro", "electric_meter"),
    t("ANALIZADOR-RED", "Analizador de redes / subcontador", "power_analyzer"),
    t("CUADRO-BT", "Cuadro eléctrico de baja tensión", "lv_installation"),
    t("INST-BT", "Instalación eléctrica BT y puesta a tierra", "lv_installation"),
    t("TRAFO", "Transformador", "transformer", true),
    t("BAT-CONDENS", "Batería de condensadores", "capacitor_bank", true),
  ] },
  { code: "energia", name: "Energía y generación", color: "#ea580c", types: [
    t("FV", "Instalación fotovoltaica", "pv_plant"),
    t("INVERSOR", "Inversor", "inverter"),
    t("GRUPO-ELEC", "Grupo electrógeno", "generator"),
    t("SAI", "SAI / UPS", "ups"),
    t("CALDERA", "Caldera", "boiler"),
    t("CARGADOR-VE", "Cargador de vehículo eléctrico", "ev_charger"),
    t("SOLAR-TERM", "Instalación solar térmica", null, true),
  ] },
  { code: "climatizacion", name: "Climatización y refrigeración", color: "#0284c7", types: [
    t("CLIMA-SPLIT", "Split / multisplit", "hvac"),
    t("CLIMA-VRF", "Sistema VRV / VRF", "hvac"),
    t("BOMBA-CALOR", "Bomba de calor / aerotermia", "hvac"),
    t("ENFRIADORA", "Enfriadora", "hvac"),
    t("INST-FRIGO", "Instalación frigorífica", "refrigeration"),
  ] },
  { code: "pci", name: "PCI y emergencias", color: "#dc2626", types: [
    t("EXT-POLVO", "Extintor de polvo", "pci_extinguisher"),
    t("EXT-CO2", "Extintor de CO₂", "pci_extinguisher"),
    t("BIE", "Boca de incendio equipada (BIE)", "pci_hose"),
    t("DETECCION-INC", "Sistema de detección y alarma de incendios", "fire_detection"),
    t("ALUMBRADO-EMERG", "Alumbrado de emergencia", "emergency_lighting"),
    t("SENALIZACION", "Señalización de emergencia", null),
    t("BOTIQUIN", "Botiquín", null),
    t("DEA", "Desfibrilador (DEA)", null),
    t("ERA", "Equipo de respiración autónoma", null, true),
  ] },
  { code: "vehiculos", name: "Vehículos y equipos móviles", color: "#4b5563", types: [
    t("TURISMO", "Turismo", "vehicle"),
    t("FURGONETA", "Furgoneta", "vehicle"),
    t("CAMION", "Camión", "vehicle"),
    t("CARRETILLA", "Carretilla elevadora", "forklift"),
    t("PLATAFORMA", "Plataforma elevadora móvil", "forklift", true),
  ] },
  { code: "presion", name: "Presión y aire comprimido", color: "#0f766e", types: [
    t("COMPRESOR", "Compresor de aire", "compressor"),
    t("DEPOSITO-AIRE", "Depósito de aire comprimido", "pressure_vessel"),
    t("INST-AIRE", "Instalación de aire comprimido", null, true),
  ] },
  { code: "maquinaria", name: "Maquinaria y elevación", color: "#059669", types: [
    t("MAQUINA", "Máquina industrial", "machine"),
    t("PUENTE-GRUA", "Puente grúa / polipasto", "lifting"),
    t("ASCENSOR", "Ascensor / montacargas", "lifting"),
    t("ESTANTERIA", "Estantería industrial", "racking", true),
  ] },
  { code: "medida", name: "Instrumentos de medida y control", color: "#7c3aed", types: [
    t("TERMOMETRO", "Termómetro", "measuring"),
    t("MANOMETRO", "Manómetro", "measuring"),
    t("MULTIMETRO", "Multímetro", "measuring"),
    t("BALANZA", "Balanza", "measuring"),
    t("CALIBRE", "Calibre / pie de rey", "measuring"),
    t("MICROMETRO", "Micrómetro", "measuring"),
    t("FLEXOMETRO", "Cinta métrica / flexómetro", "measuring"),
  ] },
  { code: "agua_ma", name: "Agua y medioambiente", color: "#2563eb", types: [
    t("EDAR", "Depuradora (EDAR)", "wwtp", true),
    t("OSMOSIS", "Equipo de ósmosis", "ro_plant", true),
    t("BOMBA", "Bomba", "pump", true),
    t("DEPOSITO", "Depósito", "water_tank", true),
    t("INST-LEGIONELA", "Instalación con riesgo de legionela", null, true),
  ] },
];

/** Nombres de instrumentos, reutilizados como sugerencias en Equipos de medida (sin crear registros). */
export const MEASURING_TYPE_NAMES = INVENTORY_GROUPS.find((g) => g.code === "medida")!.types.map((x) => x.name);

/** Qué falta crear: omite familias y tipos cuyo código ya existe (no duplica ni sobrescribe). */
export function planImport(
  selected: string[],
  existing: { familyCodes: string[]; typeCodes: string[] },
) {
  const fam = new Set(existing.familyCodes.map((c) => c.toLowerCase()));
  const typ = new Set(existing.typeCodes.map((c) => c.toUpperCase()));
  const families: InventoryGroup[] = [];
  const types: (SuggestedType & { group: string })[] = [];
  for (const g of INVENTORY_GROUPS) {
    const picks = g.types.filter((x) => selected.includes(x.code) && !typ.has(x.code));
    if (!picks.length) continue;
    if (!fam.has(g.code)) families.push(g);
    types.push(...picks.map((x) => ({ ...x, group: g.code })));
  }
  return { families, types };
}
