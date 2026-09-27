import { createFileRoute } from "@tanstack/react-router";
import { AssetTypesPage } from "@/modules/maintenance/ui/pages/AssetTypesPage";

export const Route = createFileRoute("/_authenticated/_app/asset-types")({
  head: () => ({ meta: [{ title: "Tipos de activo" }] }),
  component: AssetTypesPage,
});
