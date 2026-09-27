import { createFileRoute } from "@tanstack/react-router";
import { CertificateDetailPage } from "@/modules/maintenance/ui/pages/CertificateDetailPage";

export const Route = createFileRoute("/_authenticated/_app/certificates/$id")({
  head: () => ({ meta: [{ title: "Certificado" }] }),
  component: CertificateDetailPage,
});
