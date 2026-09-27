import { createFileRoute } from "@tanstack/react-router";
import { PlanDetailPage } from "@/modules/maintenance/ui/pages/PlanDetailPage";

export const Route = createFileRoute("/_authenticated/_app/maintenance-plans/$id")({
  head: () => ({ meta: [{ title: "Detalle plan" }] }),
  component: PlanDetailPage,
});
