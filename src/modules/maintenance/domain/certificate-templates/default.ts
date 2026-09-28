import type { CertificateTemplate } from "./types";

export const DEFAULT_CERTIFICATE_TEMPLATE: CertificateTemplate = {
  code: "DEFAULT",
  name: "Plantilla genérica",
  language: "es",
  title: "Certificado de mantenimiento",
  intro_text:
    "Por la presente, {{issuer_name}} | {{issuer_role}}, en representación de la empresa {{company_name}} con CIF {{company_cif}} y domicilio en {{company_address}},\n\nCERTIFICA:\n\nQue ha realizado el mantenimiento de los equipos ubicados en {{location_name}}, con el resultado indicado a continuación.",
  regulation_text: "",
  footer_text:
    "Firmado en {{location_name}}, a {{issued_on}}.\n\nCertificado nº {{cert_code}}.",
  columns: [
    { key: "type", label: "Tipo", source: "asset_type.name", width: 2 },
    { key: "code", label: "Código", source: "asset.code", width: 2 },
    { key: "location", label: "Ubicación", source: "location.name", width: 2 },
    { key: "result", label: "Resultado", source: "result", width: 1 },
    { key: "notes", label: "Observaciones", source: "notes", width: 3 },
  ],
  show_logo: true,
  show_signature: true,
  show_company_stamp: false,
  paper_size: "A4",
};
