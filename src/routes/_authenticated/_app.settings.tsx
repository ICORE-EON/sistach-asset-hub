import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";
import { Settings } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_app/settings")({
  head: () => ({ meta: [{ title: "Administración" }] }),
  component: () => (
    <ModulePlaceholder
      icon={Settings}
      title="Administración"
      description="Usuarios, roles, plantillas de checklist y ajustes de empresa."
    />
  ),
});
