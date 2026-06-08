import { supabase } from "@/integrations/supabase/client";
import { buildCertificatePdf, type IncidentRow } from "./certificate-pdf";
import { DEFAULT_CERTIFICATE_TEMPLATE } from "./certificate-templates/default";
import type { CertificateTemplate, TemplateColumn, TemplateVariables } from "./certificate-templates/types";
import type { RowSource } from "./certificate-templates/render";

async function resolveTemplate(companyId: string, planId: string | null): Promise<CertificateTemplate> {
  // 1. From plan
  if (planId) {
    const { data: plan } = await supabase
      .from("maintenance_plans")
      .select("certificate_template_id")
      .eq("id", planId)
      .maybeSingle();
    if (plan?.certificate_template_id) {
      const { data: tpl } = await supabase
        .from("certificate_templates")
        .select("*")
        .eq("id", plan.certificate_template_id)
        .maybeSingle();
      if (tpl) return tpl as unknown as CertificateTemplate;
    }
  }
  // 2. Company default
  const { data: def } = await supabase
    .from("certificate_templates")
    .select("*")
    .eq("company_id", companyId)
    .eq("is_default", true)
    .is("deleted_at", null)
    .maybeSingle();
  if (def) return def as unknown as CertificateTemplate;
  // 3. Built-in
  return DEFAULT_CERTIFICATE_TEMPLATE;
}

function formatDate(d: string | null | undefined): string {
  if (!d) return "";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });
}

export async function generateCertificatePdf(certificateId: string): Promise<{ pdfUrl: string }> {
  // Load certificate
  const { data: cert, error } = await supabase
    .from("certificates")
    .select("*")
    .eq("id", certificateId)
    .single();
  if (error) throw error;

  // Load company
  const { data: company } = await supabase
    .from("companies")
    .select("name, cif, address, logo_url")
    .eq("id", cert.company_id)
    .single();

  // Load items + assets
  const { data: items = [] } = await supabase
    .from("certificate_items")
    .select(
      "id, result, notes, asset_id, maintenance_session_id, assets(code, name, manufacturer, model, asset_types(code, name_i18n), locations(name))",
    )
    .eq("certificate_id", certificateId);

  // Resolve plan via session
  let planId: string | null = null;
  let planName: string | null = null;
  let locationName = "";
  const sessionId = items?.find((i) => i.maintenance_session_id)?.maintenance_session_id ?? null;
  if (sessionId) {
    const { data: session } = await supabase
      .from("maintenance_sessions")
      .select("plan_id, maintenance_plans(name), locations(name)")
      .eq("id", sessionId)
      .maybeSingle();
    const s = session as unknown as {
      plan_id: string | null;
      maintenance_plans: { name: string } | null;
      locations: { name: string } | null;
    } | null;
    planId = s?.plan_id ?? null;
    planName = s?.maintenance_plans?.name ?? null;
    locationName = s?.locations?.name ?? "";
  }

  // Pick most common location among assets if no session location
  if (!locationName && items && items.length > 0) {
    const counts: Record<string, number> = {};
    for (const it of items) {
      const a = it.assets as unknown as { locations?: { name?: string } | null } | null;
      const ln = a?.locations?.name;
      if (ln) counts[ln] = (counts[ln] ?? 0) + 1;
    }
    locationName = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
  }

  const template = await resolveTemplate(cert.company_id, planId);

  const vars: Partial<TemplateVariables> = {
    issuer_name: cert.issuer_name ?? "",
    issuer_role: cert.issuer_role ?? "",
    company_name: company?.name ?? "",
    company_cif: company?.cif ?? "",
    company_address: company?.address ?? "",
    location_name: locationName,
    issued_on: formatDate(cert.issued_on),
    valid_until: cert.valid_until ? formatDate(cert.valid_until) : "",
    plan_name: planName ?? "",
    cert_code: cert.code,
  };

  const rows: RowSource[] = (items ?? []).map((it) => ({
    asset: it.assets as unknown as RowSource["asset"],
    result: it.result,
    notes: it.notes,
  }));


  // Logo as signed URL if possible
  let logoUrl: string | null = null;
  if (company?.logo_url) {
    try {
      const { data: signed } = await supabase.storage
        .from("company-logos")
        .createSignedUrl(company.logo_url, 60);
      logoUrl = signed?.signedUrl ?? company.logo_url;
    } catch {
      logoUrl = company.logo_url;
    }
  }

  const pdfBytes = await buildCertificatePdf({
    template: {
      ...DEFAULT_CERTIFICATE_TEMPLATE,
      ...template,
      // ensure columns is array even if jsonb came back stringy
      columns: (Array.isArray(template.columns) ? template.columns : []) as TemplateColumn[],
    },
    vars,
    rows,
    logoUrl,
    signatureDataUrl: cert.signature_image_url ?? null,
  });

  // Upload to storage. Bucket policy expects path = {company_id}/...
  const path = `${cert.company_id}/certificates/${cert.id}.pdf`;
  const ab = pdfBytes.buffer.slice(
    pdfBytes.byteOffset,
    pdfBytes.byteOffset + pdfBytes.byteLength,
  ) as ArrayBuffer;
  const blob = new Blob([ab], { type: "application/pdf" });
  const { error: upErr } = await supabase.storage
    .from("signed-certificates")
    .upload(path, blob, { contentType: "application/pdf", upsert: true });
  if (upErr) throw upErr;

  // Compute sha256
  const hashBuf = await crypto.subtle.digest("SHA-256", ab);

  const hashHex = Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const { error: updErr } = await supabase
    .from("certificates")
    .update({ pdf_url: path, pdf_hash_sha256: hashHex })
    .eq("id", certificateId);
  if (updErr) throw updErr;

  return { pdfUrl: path };
}

export async function getCertificatePdfDownloadUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from("signed-certificates")
    .createSignedUrl(path, 300, { download: true });
  if (error) throw error;
  return data.signedUrl;
}
