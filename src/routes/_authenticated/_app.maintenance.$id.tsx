import { createFileRoute } from "@tanstack/react-router";
import { SessionDetailPage } from "@/modules/maintenance/ui/pages/SessionDetailPage";

export const Route = createFileRoute("/_authenticated/_app/maintenance/$id")({
  head: () => ({ meta: [{ title: "Sesión de mantenimiento" }] }),
  component: SessionDetailPage,
});
