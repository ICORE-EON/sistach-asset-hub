/**
 * Declarative catalog of metrology instrument types (portable, no DB). Reuses the inventory
 * "medida" names and adds common SME instruments. Values outside the catalog ("Otro" or legacy
 * free text) are preserved verbatim, never transformed.
 */
import { MEASURING_TYPE_NAMES } from "./inventory-catalog";

const EXTRA = ["Caudalímetro", "Báscula", "Sonómetro", "Higrómetro", "Luxómetro", "Pinza amperimétrica", "Medidor de pH", "Conductímetro", "Cronómetro", "Detector de gas", "Analizador de combustión", "Torquímetro / llave dinamométrica"];

export const INSTRUMENT_TYPE_CATALOG: readonly string[] = [...new Set([...MEASURING_TYPE_NAMES, ...EXTRA])];

export type InstrumentTypeKind = "empty" | "catalog" | "other";
export function classifyInstrumentType(value: string | null | undefined): InstrumentTypeKind {
  const v = (value ?? "").trim();
  if (!v) return "empty";
  return INSTRUMENT_TYPE_CATALOG.includes(v) ? "catalog" : "other";
}

export type LinkedInstrument = { id: string; assetId: string | null; parentAssetId: string | null };
/** One row per metrology record linked to an asset by identity (1:1) or association (N:1); identity wins on duplicates. */
export function mergeLinkedInstruments<T extends LinkedInstrument>(list: T[], assetId: string): (T & { relation: "identity" | "associated" })[] {
  const out = new Map<string, T & { relation: "identity" | "associated" }>();
  for (const e of list) {
    if (e.assetId === assetId) out.set(e.id, { ...e, relation: "identity" });
    else if (e.parentAssetId === assetId && !out.has(e.id)) out.set(e.id, { ...e, relation: "associated" });
  }
  return [...out.values()].sort((a, b) => (a.relation === b.relation ? 0 : a.relation === "identity" ? -1 : 1));
}
