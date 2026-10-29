import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { SessionRunPage } from "@/modules/maintenance/ui/pages/SessionRunPage";

export const Route = createFileRoute("/_authenticated/_app/run/")({
  head: () => ({ meta: [{ title: "Mis mantenimientos" }, { name: "robots", content: "noindex" }] }),
  component: RunListRoute,
});

function RunListRoute() {
  const navigate = useNavigate();
  const nav = useMemo(() => ({
    openSession: (sid: string, itemId?: string) => navigate({ to: "/run/$id", params: { id: sid }, search: itemId ? { item: itemId } : {} }),
    back: () => navigate({ to: "/dashboard" }),
  }), [navigate]);
  return <SessionRunPage nav={nav} />;
}
