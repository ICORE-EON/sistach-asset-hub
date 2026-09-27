import { createFileRoute } from "@tanstack/react-router";
import { SessionsListPage } from "@/modules/maintenance/ui/pages/SessionsListPage";

export const Route = createFileRoute("/_authenticated/_app/maintenance/")({
  head: () => ({ meta: [{ title: "Mantenimientos" }] }),
  component: SessionsListPage,
});
