import { createFileRoute } from "@tanstack/react-router";
import { MetrologyEquipmentDetailPage } from "@/modules/maintenance/ui/pages/MetrologyEquipmentDetailPage";

export const Route = createFileRoute("/_authenticated/_app/metrology/equipment/$id")({
  head: () => ({ meta: [{ title: "Ficha de equipo de medida" }] }),
  component: MetrologyEquipmentDetailPage,
});
