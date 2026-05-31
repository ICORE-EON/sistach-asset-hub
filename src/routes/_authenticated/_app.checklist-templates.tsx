import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/_app/checklist-templates")({
  head: () => ({ meta: [{ title: "Plantillas de checklist" }] }),
  component: () => <Outlet />,
});
