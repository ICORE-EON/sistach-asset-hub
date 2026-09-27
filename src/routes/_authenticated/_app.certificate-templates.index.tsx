import { createFileRoute } from "@tanstack/react-router";
import { CertificateTemplatesListPage } from "@/modules/maintenance/ui/pages/CertificateTemplatesListPage";

export const Route = createFileRoute("/_authenticated/_app/certificate-templates/")({
  head: () => ({ meta: [{ title: "Plantillas de certificado" }] }),
  component: CertificateTemplatesListPage,
});
