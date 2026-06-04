import type { CertificateTemplate, TemplateColumn, TemplateVariables } from "./types";

export function substituteVariables(text: string, vars: Partial<TemplateVariables>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const v = (vars as Record<string, string | undefined>)[key];
    return v ?? "";
  });
}

export interface RowSource {
  asset?: {
    code?: string | null;
    name?: string | null;
    manufacturer?: string | null;
    model?: string | null;
    asset_types?: { name_i18n?: Record<string, string> | null; code?: string | null } | null;
    locations?: { name?: string | null } | null;
  } | null;
  result?: string | null;
  notes?: string | null;
}

const RESULT_LABELS: Record<string, string> = {
  ok: "OK",
  conditional: "Condicional",
  failed: "Fallo",
  na: "N/A",
};

function i18nName(i18n: Record<string, string> | null | undefined, fallback?: string | null): string {
  if (!i18n) return fallback ?? "";
  return i18n.es ?? i18n.en ?? i18n.ca ?? fallback ?? "";
}

export function resolveCell(col: TemplateColumn, row: RowSource): string {
  switch (col.source) {
    case "asset.code":
      return row.asset?.code ?? "";
    case "asset.name":
      return row.asset?.name ?? "";
    case "asset.manufacturer":
      return row.asset?.manufacturer ?? "";
    case "asset.model":
      return row.asset?.model ?? "";
    case "asset_type.name":
      return i18nName(row.asset?.asset_types?.name_i18n, row.asset?.asset_types?.code);
    case "location.name":
      return row.asset?.locations?.name ?? "";
    case "result":
      return RESULT_LABELS[row.result ?? ""] ?? row.result ?? "";
    case "notes":
      return row.notes ?? "";
    default:
      return "";
  }
}

export function renderTemplate(
  template: CertificateTemplate,
  vars: Partial<TemplateVariables>,
) {
  return {
    title: substituteVariables(template.title, vars),
    intro: substituteVariables(template.intro_text, vars),
    regulation: substituteVariables(template.regulation_text, vars),
    footer: substituteVariables(template.footer_text, vars),
  };
}
