export type ColumnSource =
  | "asset.code"
  | "asset.name"
  | "asset.manufacturer"
  | "asset.model"
  | "asset_type.name"
  | "location.name"
  | "result"
  | "notes";

export interface TemplateColumn {
  key: string;
  label: string;
  source: ColumnSource;
  width?: number; // relative weight
}

export interface CertificateTemplate {
  id?: string;
  code: string;
  name: string;
  language: "es" | "ca" | "en";
  title: string;
  intro_text: string;
  regulation_text: string;
  footer_text: string;
  columns: TemplateColumn[];
  show_logo: boolean;
  show_signature: boolean;
  show_company_stamp: boolean;
  paper_size: "A4";
  is_default?: boolean;
  logo_url?: string | null;
}

export const COLUMN_SOURCE_LABELS: Record<ColumnSource, string> = {
  "asset.code": "Código del activo",
  "asset.name": "Nombre del activo",
  "asset.manufacturer": "Fabricante",
  "asset.model": "Modelo",
  "asset_type.name": "Tipo de activo",
  "location.name": "Ubicación",
  result: "Resultado",
  notes: "Observaciones",
};

export const TEMPLATE_VARIABLES = [
  { key: "issuer_name", label: "Nombre firmante" },
  { key: "issuer_role", label: "Cargo firmante" },
  { key: "company_name", label: "Empresa" },
  { key: "company_cif", label: "CIF empresa" },
  { key: "company_address", label: "Dirección empresa" },
  { key: "location_name", label: "Ubicación de revisión" },
  { key: "issued_on", label: "Fecha emisión" },
  { key: "valid_until", label: "Válido hasta" },
  { key: "plan_name", label: "Plan de mantenimiento" },
  { key: "cert_code", label: "Código del certificado" },
] as const;

export type TemplateVariables = Record<
  (typeof TEMPLATE_VARIABLES)[number]["key"],
  string
>;
