import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/_app/notifications")({
  component: NotificationsPage,
});

const TYPE_LABELS: Record<string, string> = {
  "incident.created": "Incidencia creada",
  "incident.resolved": "Incidencia resuelta",
  "incident.closed": "Incidencia cerrada",
  "maintenance.closed": "Mantenimiento cerrado",
  "document.expiring": "Documento por caducar",
  "document.expired": "Documento caducado",
  "certificate.expiring": "Certificado por caducar",
  "certificate.expired": "Certificado caducado",
  "asset.warranty_expiring": "Garantía por vencer",
};

function NotificationsPage() {
  const { user } = useAuth();
  const { activeCompanyId } = useCompany();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const { data = [], isLoading } = useQuery({
    queryKey: ["notifications", "all", activeCompanyId, user?.id],
    enabled: !!user && !!activeCompanyId,
    queryFn: async () => {
      const { data: events, error } = await supabase
        .from("notification_events")
        .select("*")
        .eq("company_id", activeCompanyId!)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      const ids = (events ?? []).map((e) => e.id);
      let readIds = new Set<string>();
      if (ids.length) {
        const { data: reads } = await supabase
          .from("notification_reads")
          .select("event_id")
          .in("event_id", ids);
        readIds = new Set((reads ?? []).map((r) => r.event_id));
      }
      return (events ?? []).map((e) => ({ ...e, read: readIds.has(e.id) }));
    },
  });

  const filtered = useMemo(
    () => (filter === "unread" ? data.filter((n) => !n.read) : data),
    [data, filter],
  );

  async function markRead(id: string, read: boolean) {
    if (!user) return;
    if (read) {
      await supabase.from("notification_reads").delete().eq("user_id", user.id).eq("event_id", id);
    } else {
      await supabase
        .from("notification_reads")
        .upsert({ user_id: user.id, event_id: id }, { onConflict: "user_id,event_id" });
    }
    qc.invalidateQueries({ queryKey: ["notifications"] });
  }

  async function markAllRead() {
    if (!user) return;
    const rows = data.filter((n) => !n.read).map((n) => ({ user_id: user.id, event_id: n.id }));
    if (!rows.length) return;
    await supabase.from("notification_reads").upsert(rows, { onConflict: "user_id,event_id" });
    qc.invalidateQueries({ queryKey: ["notifications"] });
  }

  function linkFor(n: { incident_id: string | null; maintenance_session_id: string | null; asset_id: string | null }) {
    if (n.incident_id) return `/incidents/${n.incident_id}`;
    if (n.maintenance_session_id) return `/maintenance/${n.maintenance_session_id}`;
    if (n.asset_id) return `/assets/${n.asset_id}`;
    return null;
  }

  return (
    <div className="container mx-auto max-w-4xl space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Notificaciones</h1>
          <p className="text-sm text-muted-foreground">Eventos recientes de la empresa</p>
        </div>
        <Button variant="outline" size="sm" onClick={markAllRead} disabled={!data.some((n) => !n.read)}>
          Marcar todas como leídas
        </Button>
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as "all" | "unread")}>
        <TabsList>
          <TabsTrigger value="all">Todas ({data.length})</TabsTrigger>
          <TabsTrigger value="unread">No leídas ({data.filter((n) => !n.read).length})</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading && <p className="text-sm text-muted-foreground">Cargando...</p>}

      {!isLoading && filtered.length === 0 && (
        <Card className="p-8 text-center text-sm text-muted-foreground">No hay notificaciones</Card>
      )}

      <ul className="space-y-2">
        {filtered.map((n) => {
          const href = linkFor(n);
          return (
            <Card key={n.id} className={`p-3 ${n.read ? "opacity-70" : ""}`}>
              <div className="flex items-start gap-3">
                <div className="flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={
                        n.severity === "critical" ? "destructive" : n.severity === "warning" ? "default" : "secondary"
                      }
                      className="text-[10px]"
                    >
                      {n.severity}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {TYPE_LABELS[n.event_type] ?? n.event_type}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: es })}
                    </span>
                  </div>
                  <p className="font-medium">{n.subject}</p>
                  {n.body && <p className="text-sm text-muted-foreground">{n.body}</p>}
                  {href && (
                    <Link to={href} className="inline-block text-xs text-primary hover:underline">
                      Ver detalle →
                    </Link>
                  )}
                </div>
                <Button variant="ghost" size="sm" onClick={() => markRead(n.id, n.read)}>
                  {n.read ? "Marcar no leída" : "Marcar leída"}
                </Button>
              </div>
            </Card>
          );
        })}
      </ul>
    </div>
  );
}
