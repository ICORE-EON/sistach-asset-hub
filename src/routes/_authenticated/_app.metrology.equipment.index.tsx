import { createFileRoute } from "@tanstack/react-router";
import { MetrologyEquipmentListPage } from "@/modules/maintenance/ui/pages/MetrologyEquipmentListPage";

export const Route = createFileRoute("/_authenticated/_app/metrology/equipment/")({
  validateSearch: (search: Record<string, unknown>): { newEquipment?: boolean; parentAssetId?: string } => ({ newEquipment: search.newEquipment === true || search.newEquipment === "true" ? true : undefined, parentAssetId: typeof search.parentAssetId === "string" ? search.parentAssetId : undefined }),
  head: () => ({ meta: [{ title: "Equipos de medida · Sistach" }, { name: "description", content: "Inventario de instrumentos, activos principales asociados y próximos controles metrológicos." }, { property: "og:title", content: "Equipos de medida · Sistach" }, { property: "og:description", content: "Instrumentos, asociaciones y controles metrológicos." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: MetrologyEquipmentListPage,
});
