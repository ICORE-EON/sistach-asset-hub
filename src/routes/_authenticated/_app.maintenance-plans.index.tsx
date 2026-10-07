import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/_app/maintenance-plans/")({
  beforeLoad: () => {
    throw redirect({ to: "/maintenance", search: { tab: "plans" } });
  },
});
