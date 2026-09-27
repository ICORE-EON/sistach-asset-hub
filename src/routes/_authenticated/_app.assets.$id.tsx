import { createFileRoute } from "@tanstack/react-router";
import { AssetDetailPage } from "@/modules/maintenance/ui/pages/AssetDetailPage";

export const Route = createFileRoute("/_authenticated/_app/assets/$id")({
  head: () => ({ meta: [{ title: "Detalle de activo" }] }),
  component: AssetDetailPage,
});
