import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { SessionRunPage } from "@/modules/maintenance/ui/pages/SessionRunPage";

/** Authenticated QR landing: resolves the token as the signed-in user (no public access). */
export const Route = createFileRoute("/_authenticated/_app/qr/$token")({
  head: () => ({ meta: [{ title: "Equipo · QR" }, { name: "robots", content: "noindex" }] }),
  component: QrRoute,
});

function QrRoute() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const nav = useMemo(() => ({
    openSession: (sid: string, itemId?: string) => navigate({ to: "/run/$id", params: { id: sid }, search: itemId ? { item: itemId } : {}, replace: true }),
    back: () => navigate({ to: "/run" }),
  }), [navigate]);
  return <SessionRunPage token={token} nav={nav} />;
}
