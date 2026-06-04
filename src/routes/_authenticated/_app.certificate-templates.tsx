import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/_app/certificate-templates")({
  head: () => ({ meta: [{ title: "Plantillas de certificado" }] }),
  component: () => <Outlet />,
});
