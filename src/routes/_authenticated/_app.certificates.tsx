import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";
import { FileBadge } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_app/certificates")({
  head: () => ({ meta: [{ title: "Certificados" }] }),
  component: () => (
    <ModulePlaceholder
      icon={FileBadge}
      title="Certificados"
      description="Generación, firma y archivado de certificados de mantenimiento."
    />
  ),
});
