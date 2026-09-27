import { createFileRoute } from "@tanstack/react-router";
import { IncidentDetailPage } from "@/modules/maintenance/ui/pages/IncidentDetailPage";

export const Route = createFileRoute("/_authenticated/_app/incidents/$id")({
  head: () => ({ meta: [{ title: "Incidencia" }] }),
  component: IncidentDetailPage,
});
