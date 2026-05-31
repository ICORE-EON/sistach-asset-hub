import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/_app/incidents")({
  head: () => ({ meta: [{ title: "Incidencias" }] }),
  component: () => <Outlet />,
});
