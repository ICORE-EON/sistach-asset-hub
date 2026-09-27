import { createFileRoute } from "@tanstack/react-router";
import { AssetsListPage } from "@/modules/maintenance/ui/pages/AssetsListPage";

export const Route = createFileRoute("/_authenticated/_app/assets/")({
  head: () => ({ meta: [{ title: "Activos" }] }),
  component: AssetsListPage,
});
