import { createFileRoute } from "@tanstack/react-router";
import { CertificatesListPage } from "@/modules/maintenance/ui/pages/CertificatesListPage";

export const Route = createFileRoute("/_authenticated/_app/certificates/")({
  head: () => ({ meta: [{ title: "Certificados" }] }),
  component: CertificatesListPage,
});
