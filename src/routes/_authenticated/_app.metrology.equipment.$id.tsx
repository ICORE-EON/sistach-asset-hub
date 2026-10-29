import { createFileRoute } from "@tanstack/react-router";
import { MetrologyEquipmentDetailPage } from "@/modules/maintenance/ui/pages/MetrologyEquipmentDetailPage";

export const Route = createFileRoute("/_authenticated/_app/metrology/equipment/$id")({
  head: () => ({ meta: [{ title: "Ficha metrológica · Sistach" }, { name: "description", content: "Datos del instrumento, plan de control y consulta de calibraciones y verificaciones con trazabilidad de versiones." }, { property: "og:title", content: "Ficha metrológica · Sistach" }, { property: "og:description", content: "Instrumento, controles y registros metrológicos." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: MetrologyEquipmentDetailPage,
});
