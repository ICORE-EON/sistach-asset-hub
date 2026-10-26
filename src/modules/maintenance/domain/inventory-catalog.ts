/**
 * Catálogo de ejemplo para «Configurar inventario». Solo propone familias y tipos;
 * nunca crea activos. Cada tipo sugerido trae su perfil de ficha técnica.
 */
export type SuggestedType = { code: string; name: string; profile: string | null };
export type InventoryGroup = { code: string; name: string; color: string; types: SuggestedType[] };

export const INVENTORY_GROUPS: InventoryGroup[] = [
  { code: "pci", name: "Protección contra incendios", color: "#dc2626", types: [
    { code: "EXT-POLVO", name: "Extintor de polvo", profile: "pci_extinguisher" },
    { code: "EXT-CO2", name: "Extintor de CO₂", profile: "pci_extinguisher" },
    { code: "BIE", name: "Boca de incendio equipada (BIE)", profile: "pci_hose" },
    { code: "CENTRAL-INC", name: "Central de detección de incendios", profile: "electrical" },
  ] },
  { code: "climatizacion", name: "Climatización", color: "#0284c7", types: [
    { code: "CLIMA-SPLIT", name: "Aire acondicionado split", profile: "hvac" },
    { code: "BOMBA-CALOR", name: "Bomba de calor", profile: "hvac" },
    { code: "ENFRIADORA", name: "Enfriadora", profile: "hvac" },
  ] },
  { code: "electricidad", name: "Electricidad", color: "#ca8a04", types: [
    { code: "CUADRO-BT", name: "Cuadro eléctrico de baja tensión", profile: "electrical" },
    { code: "TRAFO", name: "Centro de transformación", profile: "electrical" },
    { code: "GRUPO-ELEC", name: "Grupo electrógeno", profile: "electrical" },
  ] },
  { code: "vehiculos", name: "Vehículos", color: "#4b5563", types: [
    { code: "TURISMO", name: "Turismo", profile: "vehicle" },
    { code: "FURGONETA", name: "Furgoneta", profile: "vehicle" },
    { code: "CARRETILLA", name: "Carretilla elevadora", profile: "vehicle" },
  ] },
  { code: "medida", name: "Equipos de medida", color: "#7c3aed", types: [
    { code: "TERMOMETRO", name: "Termómetro", profile: "measuring" },
    { code: "MANOMETRO", name: "Manómetro", profile: "measuring" },
    { code: "MULTIMETRO", name: "Multímetro", profile: "measuring" },
  ] },
  { code: "maquinaria", name: "Maquinaria y otros", color: "#059669", types: [
    { code: "COMPRESOR", name: "Compresor de aire", profile: null },
    { code: "MAQUINA", name: "Máquina de producción", profile: null },
  ] },
];

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
    const picks = g.types.filter((t) => selected.includes(t.code) && !typ.has(t.code));
    if (!picks.length) continue;
    if (!fam.has(g.code)) families.push(g);
    types.push(...picks.map((t) => ({ ...t, group: g.code })));
  }
  return { families, types };
}
