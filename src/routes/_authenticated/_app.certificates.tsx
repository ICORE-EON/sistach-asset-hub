import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/_app/certificates")({
  head: () => ({ meta: [{ title: "Certificados" }] }),
  component: () => <Outlet />,
});
