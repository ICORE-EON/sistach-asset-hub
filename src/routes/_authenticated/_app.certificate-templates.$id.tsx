import { createFileRoute } from "@tanstack/react-router";
import { CertificateTemplateEditorPage } from "@/modules/maintenance/ui/pages/CertificateTemplateEditorPage";

export const Route = createFileRoute("/_authenticated/_app/certificate-templates/$id")({
  head: () => ({ meta: [{ title: "Editar plantilla" }] }),
  component: CertificateTemplateEditorPage,
});
