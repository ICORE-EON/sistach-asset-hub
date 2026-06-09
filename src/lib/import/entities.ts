import { supabase } from "@/integrations/supabase/client";
import type { ParsedRow } from "./parse";

export type TargetEntity = "assets" | "locations";

export interface EntityDef {
  key: TargetEntity;
  label: string;
  template: { headers: string[]; sample: Record<string, string> };
  requiredFields: string[];
}

export const ENTITY_DEFS: Record<TargetEntity, EntityDef> = {
  assets: {
    key: "assets",
    label: "Activos",
    requiredFields: ["asset_type_code", "name"],
    template: {
      headers: [
        "code",
        "name",
        "asset_type_code",
        "location_code",
        "manufacturer",
        "model",
        "serial_number",
        "install_date",
        "warranty_until",
        "notes",
      ],
      sample: {
        code: "",
        name: "Desfibrilador planta 1",
        asset_type_code: "DEA",
        location_code: "P1",
        manufacturer: "Philips",
        model: "HS1",
        serial_number: "SN-001",
        install_date: "2024-01-15",
        warranty_until: "2026-01-15",
        notes: "",
      },
    },
  },
  locations: {
    key: "locations",
    label: "Ubicaciones",
    requiredFields: ["code", "name"],
    template: {
      headers: ["code", "name", "kind", "address", "notes"],
      sample: {
        code: "P1",
        name: "Planta 1",
        kind: "floor",
        address: "",
        notes: "",
      },
    },
  },
};

export type RowValidation = {
  status: "ok" | "error" | "duplicate";
  normalized?: Record<string, unknown>;
  dedupe_key?: string;
  errors?: Array<{ field?: string; code: string; message: string }>;
};

interface Ctx {
  companyId: string;
  assetTypes: Map<string, string>; // code → id
  locations: Map<string, string>; // code → id
  existingAssetCodes: Set<string>;
  existingAssetSerials: Set<string>;
  existingLocationCodes: Set<string>;
}

export async function loadContext(companyId: string): Promise<Ctx> {
  const [{ data: types }, { data: locs }, { data: assets }] = await Promise.all([
    supabase
      .from("asset_types")
      .select("id, code")
      .or(`company_id.eq.${companyId},is_system.eq.true`)
      .eq("active", true),
    supabase
      .from("locations")
      .select("id, code")
      .eq("company_id", companyId)
      .is("deleted_at", null),
    supabase
      .from("assets")
      .select("code, serial_number")
      .eq("company_id", companyId)
      .is("deleted_at", null),
  ]);
  return {
    companyId,
    assetTypes: new Map((types ?? []).map((t) => [t.code.toLowerCase(), t.id])),
    locations: new Map((locs ?? []).map((l) => [l.code.toLowerCase(), l.id])),
    existingAssetCodes: new Set((assets ?? []).map((a) => (a.code ?? "").toLowerCase())),
    existingAssetSerials: new Set(
      (assets ?? []).filter((a) => a.serial_number).map((a) => a.serial_number!.toLowerCase()),
    ),
    existingLocationCodes: new Set((locs ?? []).map((l) => l.code.toLowerCase())),
  };
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const LOC_KINDS = ["site", "building", "floor", "zone", "area", "room", "vehicle", "outdoor", "other"];

function parseDate(s: string): string | null {
  if (!s) return null;
  if (ISO_DATE.test(s)) return s;
  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}

export function validateRow(
  entity: TargetEntity,
  row: ParsedRow,
  ctx: Ctx,
  seenInBatch: { assetCodes: Set<string>; assetSerials: Set<string>; locCodes: Set<string> },
): RowValidation {
  const errors: RowValidation["errors"] = [];
  if (entity === "locations") {
    const code = (row.code ?? "").trim();
    const name = (row.name ?? "").trim();
    const kind = (row.kind ?? "area").trim().toLowerCase();
    if (!code) errors.push({ field: "code", code: "required", message: "Código requerido" });
    if (!name) errors.push({ field: "name", code: "required", message: "Nombre requerido" });
    if (kind && !LOC_KINDS.includes(kind))
      errors.push({ field: "kind", code: "invalid", message: `kind debe ser uno de: ${LOC_KINDS.join(", ")}` });
    const key = code.toLowerCase();
    if (code && (ctx.existingLocationCodes.has(key) || seenInBatch.locCodes.has(key))) {
      return { status: "duplicate", dedupe_key: key };
    }
    if (errors.length) return { status: "error", errors };
    seenInBatch.locCodes.add(key);
    return {
      status: "ok",
      dedupe_key: key,
      normalized: {
        company_id: ctx.companyId,
        code,
        name,
        kind: kind || "area",
        address: row.address || null,
        notes: row.notes || null,
      },
    };
  }

  // assets
  const name = (row.name ?? "").trim();
  const typeCode = (row.asset_type_code ?? "").trim().toLowerCase();
  const locCode = (row.location_code ?? "").trim().toLowerCase();
  const code = (row.code ?? "").trim();
  const serial = (row.serial_number ?? "").trim();
  if (!name) errors.push({ field: "name", code: "required", message: "Nombre requerido" });
  if (!typeCode) errors.push({ field: "asset_type_code", code: "required", message: "Tipo requerido" });
  const typeId = typeCode ? ctx.assetTypes.get(typeCode) : undefined;
  if (typeCode && !typeId)
    errors.push({ field: "asset_type_code", code: "not_found", message: `Tipo "${typeCode}" no existe` });
  const locId = locCode ? ctx.locations.get(locCode) : undefined;
  if (locCode && !locId)
    errors.push({ field: "location_code", code: "not_found", message: `Ubicación "${locCode}" no existe` });
  const install = parseDate(row.install_date ?? "");
  if (row.install_date && !install)
    errors.push({ field: "install_date", code: "invalid_date", message: "Fecha inválida (YYYY-MM-DD)" });
  const warranty = parseDate(row.warranty_until ?? "");
  if (row.warranty_until && !warranty)
    errors.push({ field: "warranty_until", code: "invalid_date", message: "Fecha inválida (YYYY-MM-DD)" });

  const codeKey = code.toLowerCase();
  const serialKey = serial.toLowerCase();
  if (code && (ctx.existingAssetCodes.has(codeKey) || seenInBatch.assetCodes.has(codeKey)))
    return { status: "duplicate", dedupe_key: `code:${codeKey}` };
  if (serial && (ctx.existingAssetSerials.has(serialKey) || seenInBatch.assetSerials.has(serialKey)))
    return { status: "duplicate", dedupe_key: `serial:${serialKey}` };

  if (errors.length) return { status: "error", errors };
  if (code) seenInBatch.assetCodes.add(codeKey);
  if (serial) seenInBatch.assetSerials.add(serialKey);
  return {
    status: "ok",
    dedupe_key: code ? `code:${codeKey}` : serial ? `serial:${serialKey}` : undefined,
    normalized: {
      company_id: ctx.companyId,
      asset_type_id: typeId,
      location_id: locId ?? null,
      code: code || null, // null → asignamos vía RPC al insertar
      name,
      manufacturer: row.manufacturer || null,
      model: row.model || null,
      serial_number: serial || null,
      install_date: install,
      warranty_until: warranty,
      notes: row.notes || null,
      qr_token: "",
    },
  };
}

export async function insertNormalized(
  entity: TargetEntity,
  companyId: string,
  row: Record<string, unknown>,
): Promise<string> {
  if (entity === "locations") {
    const { data, error } = await supabase
      .from("locations")
      .insert(row as never)
      .select("id")
      .single();
    if (error) throw error;
    return data.id;
  }
  let payload = { ...row };
  if (!payload.code) {
    const { data: code, error: codeErr } = await supabase.rpc("next_code", {
      p_company_id: companyId,
      p_scope: "assets",
      p_prefix: "AST",
    });
    if (codeErr) throw codeErr;
    payload.code = code;
  }
  const { data, error } = await supabase
    .from("assets")
    .insert(payload as never)
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}
