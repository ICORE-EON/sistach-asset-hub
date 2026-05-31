import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/_app/maintenance-plans")({
  head: () => ({ meta: [{ title: "Planes de mantenimiento" }] }),
  component: () => <Outlet />,
});
