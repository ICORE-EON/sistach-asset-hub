import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/_app/assets")({
  head: () => ({ meta: [{ title: "Activos" }] }),
  component: () => <Outlet />,
});
