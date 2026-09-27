import { createFileRoute } from "@tanstack/react-router";
import { PlansListPage } from "@/modules/maintenance/ui/pages/PlansListPage";

export const Route = createFileRoute("/_authenticated/_app/maintenance-plans/")({
  head: () => ({ meta: [{ title: "Planes de mantenimiento" }] }),
  component: PlansListPage,
});
