import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";
import { FolderOpen } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_app/documents")({
  head: () => ({ meta: [{ title: "Documentos" }] }),
  component: () => (
    <ModulePlaceholder
      icon={FolderOpen}
      title="Documentos"
      description="Manuales, fichas técnicas y documentación adjunta a activos."
    />
  ),
});
