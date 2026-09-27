import { createFileRoute } from "@tanstack/react-router";
import { IncidentsListPage } from "@/modules/maintenance/ui/pages/IncidentsListPage";

export const Route = createFileRoute("/_authenticated/_app/incidents/")({
  head: () => ({ meta: [{ title: "Incidencias" }] }),
  component: IncidentsListPage,
});
