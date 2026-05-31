import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

type NotifEvent = {
  id: string;
  event_type: string;
  severity: string;
  subject: string;
  body: string | null;
  created_at: string;
  asset_id: string | null;
  incident_id: string | null;
  maintenance_session_id: string | null;
};

export function NotificationsBell() {
  const { user } = useAuth();
  const { activeCompanyId } = useCompany();
  const qc = useQueryClient();

  const { data = [] } = useQuery({
    queryKey: ["notifications", "recent", activeCompanyId, user?.id],
    enabled: !!user && !!activeCompanyId,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data: events, error } = await supabase
        .from("notification_events")
        .select("id, event_type, severity, subject, body, created_at, asset_id, incident_id, maintenance_session_id")
        .eq("company_id", activeCompanyId!)
        .order("created_at", { ascending: false })
        .limit(15);
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
      return (events as NotifEvent[]).map((e) => ({ ...e, read: readIds.has(e.id) }));
    },
  });

  const unread = useMemo(() => data.filter((n) => !n.read).length, [data]);

  async function markAllRead() {
    if (!user) return;
    const rows = data
      .filter((n) => !n.read)
      .map((n) => ({ user_id: user.id, event_id: n.id }));
    if (!rows.length) return;
    await supabase.from("notification_reads").upsert(rows, { onConflict: "user_id,event_id" });
    qc.invalidateQueries({ queryKey: ["notifications"] });
  }

  async function markRead(id: string) {
    if (!user) return;
    await supabase
      .from("notification_reads")
      .upsert({ user_id: user.id, event_id: id }, { onConflict: "user_id,event_id" });
    qc.invalidateQueries({ queryKey: ["notifications"] });
  }

  function linkFor(n: NotifEvent): string | null {
    if (n.incident_id) return `/incidents/${n.incident_id}`;
    if (n.maintenance_session_id) return `/maintenance/${n.maintenance_session_id}`;
    if (n.asset_id) return `/assets/${n.asset_id}`;
    return null;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-semibold">Notificaciones</span>
          <Button variant="ghost" size="sm" onClick={markAllRead} disabled={unread === 0}>
            Marcar todas
          </Button>
        </div>
        <ScrollArea className="max-h-96">
          {data.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              No hay notificaciones
            </p>
          )}
          <ul className="divide-y">
            {data.map((n) => {
              const href = linkFor(n);
              const Inner = (
                <div className={`flex flex-col gap-1 px-3 py-2 text-sm ${n.read ? "opacity-60" : "bg-muted/30"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium leading-tight">{n.subject}</span>
                    <Badge
                      variant={
                        n.severity === "critical" ? "destructive" : n.severity === "warning" ? "default" : "secondary"
                      }
                      className="shrink-0 text-[10px]"
                    >
                      {n.severity}
                    </Badge>
                  </div>
                  {n.body && <span className="line-clamp-2 text-xs text-muted-foreground">{n.body}</span>}
                  <span className="text-[10px] text-muted-foreground">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: es })}
                  </span>
                </div>
              );
              return (
                <li key={n.id}>
                  {href ? (
                    <Link to={href} onClick={() => markRead(n.id)} className="block hover:bg-muted/50">
                      {Inner}
                    </Link>
                  ) : (
                    <button onClick={() => markRead(n.id)} className="block w-full text-left hover:bg-muted/50">
                      {Inner}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </ScrollArea>
        <div className="border-t p-2">
          <Link to="/notifications" className="block w-full">
            <Button variant="ghost" size="sm" className="w-full">
              Ver todas
            </Button>
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
