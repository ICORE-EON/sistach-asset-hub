import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";
import { AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_app/incidents")({
  head: () => ({ meta: [{ title: "Incidencias" }] }),
  component: () => (
    <ModulePlaceholder
      icon={AlertTriangle}
      title="Incidencias"
      description="Detección, seguimiento y cierre con histórico de estados."
    />
  ),
});
