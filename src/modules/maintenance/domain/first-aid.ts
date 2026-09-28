/** First-aid kit catalogue owned by the maintenance module (the 12 standard products). */
export const FIRST_AID_PRODUCTS: Array<{ code: string; name: string; unit: string; quantity: string }> = [
  { code: "ALCOHOL", name: "Alcohol", unit: "ud", quantity: "1" },
  { code: "AIGUA_OXIGENADA", name: "Aigua oxigenada", unit: "ud", quantity: "1" },
  { code: "ANTISEPTIC", name: "Antisèptic", unit: "ud", quantity: "1" },
  { code: "GASES_ESTERILS", name: "Gases estèrils", unit: "ud", quantity: "10" },
  { code: "COTO_HIDROFIL", name: "Cotó hidròfil", unit: "ud", quantity: "1" },
  { code: "BENES", name: "Benes", unit: "ud", quantity: "2" },
  { code: "ESPARADRAP", name: "Esparadrap", unit: "ud", quantity: "1" },
  { code: "APOSITS_ADHESIUS", name: "Apòsits adhesius", unit: "ud", quantity: "10" },
  { code: "TISORES", name: "Tisores", unit: "ud", quantity: "1" },
  { code: "PINCES", name: "Pinces", unit: "ud", quantity: "1" },
  { code: "GUANTS_UN_SOL_US", name: "Guants d'un sol ús", unit: "parell", quantity: "2" },
  { code: "SUERO_FISIOLOGIC", name: "Suero fisiològic", unit: "ud", quantity: "1" },
];

export function slugProductCode(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}
