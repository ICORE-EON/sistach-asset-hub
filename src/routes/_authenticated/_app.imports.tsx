import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";
import { Upload } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_app/imports")({
  head: () => ({ meta: [{ title: "Importación" }] }),
  component: () => (
    <ModulePlaceholder
      icon={Upload}
      title="Importación"
      description="Carga masiva de activos, ubicaciones y plantillas desde CSV/Excel."
    />
  ),
});
