import { createFileRoute } from "@tanstack/react-router";
import { MetrologyEquipmentListPage } from "@/modules/maintenance/ui/pages/MetrologyEquipmentListPage";

export const Route = createFileRoute("/_authenticated/_app/metrology/equipment/")({
  head: () => ({ meta: [{ title: "Equipos de medida" }] }),
  component: MetrologyEquipmentListPage,
});
