import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { z } from "zod";
import { SessionRunPage } from "@/modules/maintenance/ui/pages/SessionRunPage";

export const Route = createFileRoute("/_authenticated/_app/run/$id")({
  validateSearch: z.object({ item: z.string().uuid().optional() }),
  head: () => ({ meta: [{ title: "Ejecutar mantenimiento" }, { name: "robots", content: "noindex" }] }),
  component: RunSessionRoute,
});

function RunSessionRoute() {
  const { id } = Route.useParams();
  const { item } = Route.useSearch();
  const navigate = useNavigate();
  const nav = useMemo(() => ({
    openSession: (sid: string, itemId?: string) => navigate({ to: "/run/$id", params: { id: sid }, search: itemId ? { item: itemId } : {} }),
    back: () => navigate({ to: "/run" }),
  }), [navigate]);
  return <SessionRunPage key={`${id}:${item ?? ""}`} sessionId={id} initialItemId={item} nav={nav} />;
}
