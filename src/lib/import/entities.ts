import { supabase } from "@/integrations/supabase/client";
import type { ParsedRow } from "./parse";

export type TargetEntity = "assets" | "locations" | "first_aid_kit_contents";

export interface EntityDef {
  key: TargetEntity;
  label: string;
  template: { headers: string[]; samples: Record<string, string>[] };
  requiredFields: string[];
}

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
      samples: [
        {
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
      ],
    },
  },
  locations: {
    key: "locations",
    label: "Ubicaciones",
    requiredFields: ["code", "name"],
    template: {
      headers: ["code", "name", "kind", "address", "notes"],
      samples: [
        {
          code: "P1",
          name: "Planta 1",
          kind: "floor",
          address: "",
          notes: "",
        },
      ],
    },
  },
  first_aid_kit_contents: {
    key: "first_aid_kit_contents",
    label: "Contenido de botiquines",
    requiredFields: ["kit_asset_code", "product_name"],
    template: {
      headers: [
        "kit_asset_code",
        "product_code",
        "product_name",
        "quantity",
        "unit",
        "batch_code",
        "expires_on",
        "notes",
      ],
      samples: FIRST_AID_PRODUCTS.map((p) => ({
        kit_asset_code: "BOT-001",
        product_code: p.code,
        product_name: p.name,
        quantity: p.quantity,
        unit: p.unit,
        batch_code: "",
        expires_on: "",
        notes: "",
      })),
    },
  },
};

export type RowValidation = {
  status: "ok" | "error" | "duplicate" | "update";
  normalized?: Record<string, unknown>;
  dedupe_key?: string;
  errors?: Array<{ field?: string; code: string; message: string }>;
};

interface Ctx {
  companyId: string;
  assetTypes: Map<string, string>; // code → id
  locations: Map<string, string>; // code → id
  assetsByCode: Map<string, string>; // code → id
  existingAssetCodes: Set<string>;
  existingAssetSerials: Set<string>;
  existingLocationCodes: Set<string>;
  existingKitProducts: Set<string>; // `${kit_asset_id}:${PRODUCT_CODE}`
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
      .select("id, code, serial_number")
      .eq("company_id", companyId)
      .is("deleted_at", null),
  ]);

  const assetIds = (assets ?? []).map((a) => a.id);
  const existingKitProducts = new Set<string>();
  if (assetIds.length) {
    for (let i = 0; i < assetIds.length; i += 300) {
      const { data: contents } = await supabase
        .from("first_aid_kit_contents")
        .select("kit_asset_id, product_code")
        .in("kit_asset_id", assetIds.slice(i, i + 300));
      for (const c of contents ?? []) {
        if (c.product_code) existingKitProducts.add(`${c.kit_asset_id}:${c.product_code.toUpperCase()}`);
      }
    }
  }

  return {
    companyId,
    assetTypes: new Map((types ?? []).map((t) => [t.code.toLowerCase(), t.id])),
    locations: new Map((locs ?? []).map((l) => [l.code.toLowerCase(), l.id])),
    assetsByCode: new Map((assets ?? []).map((a) => [(a.code ?? "").toLowerCase(), a.id])),
    existingAssetCodes: new Set((assets ?? []).map((a) => (a.code ?? "").toLowerCase())),
    existingAssetSerials: new Set(
      (assets ?? []).filter((a) => a.serial_number).map((a) => a.serial_number!.toLowerCase()),
    ),
    existingLocationCodes: new Set((locs ?? []).map((l) => l.code.toLowerCase())),
    existingKitProducts,
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

export function slugProductCode(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

export function validateRow(
  entity: TargetEntity,
  row: ParsedRow,
  ctx: Ctx,
  seenInBatch: {
    assetCodes: Set<string>;
    assetSerials: Set<string>;
    locCodes: Set<string>;
    kitProducts?: Set<string>;
  },
): RowValidation {
  const errors: RowValidation["errors"] = [];

  if (entity === "first_aid_kit_contents") {
    const kitCode = (row.kit_asset_code ?? "").trim();
    const productName = (row.product_name ?? "").trim();
    const productCode = slugProductCode((row.product_code ?? "").trim() || productName);
    if (!kitCode) errors.push({ field: "kit_asset_code", code: "required", message: "Código de botiquín requerido" });
    if (!productName) errors.push({ field: "product_name", code: "required", message: "Nombre de producto requerido" });
    const kitId = kitCode ? ctx.assetsByCode.get(kitCode.toLowerCase()) : undefined;
    if (kitCode && !kitId)
      errors.push({ field: "kit_asset_code", code: "not_found", message: `Activo "${kitCode}" no existe` });

    const qtyRaw = (row.quantity ?? "").trim().replace(",", ".");
    let quantity = 1;
    if (qtyRaw) {
      const n = Number(qtyRaw);
      if (!Number.isFinite(n) || n < 0)
        errors.push({ field: "quantity", code: "invalid", message: "Cantidad inválida" });
      else quantity = Math.round(n);
    }

    const expires = parseDate((row.expires_on ?? "").trim());
    if (row.expires_on && !expires)
      errors.push({ field: "expires_on", code: "invalid_date", message: "Fecha inválida (YYYY-MM-DD)" });

    if (errors.length) return { status: "error", errors };

    const key = `${kitId}:${productCode}`;
    const seen = seenInBatch.kitProducts ?? (seenInBatch.kitProducts = new Set());
    if (seen.has(key)) return { status: "duplicate", dedupe_key: key };
    seen.add(key);

    const isUpdate = ctx.existingKitProducts.has(key);
    return {
      status: isUpdate ? "update" : "ok",
      dedupe_key: key,
      normalized: {
        kit_asset_id: kitId,
        product_code: productCode,
        product_name: productName,
        quantity,
        unit: row.unit || null,
        batch_code: row.batch_code || null,
        expires_on: expires,
        notes: row.notes || null,
      },
    };
  }

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
  if (entity === "first_aid_kit_contents") {
    const { data: existing } = await supabase
      .from("first_aid_kit_contents")
      .select("id")
      .eq("kit_asset_id", row.kit_asset_id as string)
      .eq("product_code", row.product_code as string)
      .maybeSingle();
    if (existing) {
      const { error } = await supabase
        .from("first_aid_kit_contents")
        .update({
          product_name: row.product_name as string,
          quantity: row.quantity as number,
          unit: (row.unit as string) ?? null,
          batch_code: (row.batch_code as string) ?? null,
          expires_on: (row.expires_on as string) ?? null,
          notes: (row.notes as string) ?? null,
        })
        .eq("id", existing.id);
      if (error) throw error;
      return existing.id;
    }
    const { data, error } = await supabase
      .from("first_aid_kit_contents")
      .insert(row as never)
      .select("id")
      .single();
    if (error) throw error;
    return data.id;
  }

  if (entity === "locations") {
    const { data, error } = await supabase
      .from("locations")
      .insert(row as never)
      .select("id")
      .single();
    if (error) throw error;
    return data.id;
  }
  const payload = { ...row };
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
