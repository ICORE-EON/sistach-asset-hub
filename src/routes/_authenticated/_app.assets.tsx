import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";
import { Boxes } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_app/assets")({
  head: () => ({ meta: [{ title: "Activos" }] }),
  component: () => (
    <ModulePlaceholder
      icon={Boxes}
      title="Activos"
      description="Inventario de equipos, vehículos y ubicaciones con QR y trazabilidad."
    />
  ),
});
