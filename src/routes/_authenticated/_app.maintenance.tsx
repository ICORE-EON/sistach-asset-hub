import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/_app/maintenance")({
  head: () => ({ meta: [{ title: "Mantenimientos" }] }),
  component: () => <Outlet />,
});
