import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Boxes,
  CalendarClock,
  CheckCircle2,
  FileBadge,
  FolderOpen,
  Loader2,
  Wrench,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";
import { format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/_app/dashboard")({
  head: () => ({ meta: [{ title: "Panel" }] }),
  component: DashboardPage,
});

type Thresholds = { warning_days: number; critical_days: number };

function DashboardPage() {
  const { user } = useAuth();
  const { activeMembership } = useCompany();
  const companyId = activeMembership?.company_id ?? "";

  const { data: thresholds } = useQuery({
    queryKey: ["dash-thresholds", companyId],
    enabled: !!companyId,
    queryFn: async (): Promise<Thresholds> => {
      const { data } = await supabase
        .from("company_features")
        .select("config")
        .eq("company_id", companyId)
        .eq("feature_key", "notifications")
        .maybeSingle();
      const cfg = (data?.config ?? {}) as Partial<Thresholds>;
      return { warning_days: cfg.warning_days ?? 30, critical_days: cfg.critical_days ?? 7 };
    },
  });

  const warningDays = thresholds?.warning_days ?? 30;
  const criticalDays = thresholds?.critical_days ?? 7;

  const today = new Date().toISOString().slice(0, 10);
  const warnDate = new Date(Date.now() + warningDays * 86400000).toISOString().slice(0, 10);

  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard-stats", companyId, warningDays],
    enabled: !!companyId,
    queryFn: async () => {
      const [
        assetsTotal,
        assetsActive,
        sessionsOpen,
        incidentsOpen,
        incidentsCritical,
        certsExpiring,
        certsExpired,
        docsExpiring,
        docsExpired,
        upcomingSessions,
        recentIncidents,
        recentCerts,
      ] = await Promise.all([
        supabase.from("assets").select("id", { count: "exact", head: true }).eq("company_id", companyId).is("deleted_at", null),
        supabase.from("assets").select("id", { count: "exact", head: true }).eq("company_id", companyId).eq("status", "active").is("deleted_at", null),
        supabase.from("maintenance_sessions").select("id", { count: "exact", head: true }).eq("company_id", companyId).in("status", ["draft", "in_progress"]),
        supabase.from("incidents").select("id", { count: "exact", head: true }).eq("company_id", companyId).in("status", ["open", "in_progress"]),
        supabase.from("incidents").select("id", { count: "exact", head: true }).eq("company_id", companyId).in("status", ["open", "in_progress"]).eq("severity", "critical"),
        supabase.from("certificates").select("id", { count: "exact", head: true }).eq("company_id", companyId).is("deleted_at", null).gte("valid_until", today).lte("valid_until", warnDate),
        supabase.from("certificates").select("id", { count: "exact", head: true }).eq("company_id", companyId).is("deleted_at", null).lt("valid_until", today),
        supabase.from("documents").select("id", { count: "exact", head: true }).eq("company_id", companyId).is("deleted_at", null).gte("expires_on", today).lte("expires_on", warnDate),
        supabase.from("documents").select("id", { count: "exact", head: true }).eq("company_id", companyId).is("deleted_at", null).lt("expires_on", today),
        supabase.from("maintenance_sessions").select("id, code, scheduled_for, status").eq("company_id", companyId).eq("status", "draft").gte("scheduled_for", today).order("scheduled_for", { ascending: true }).limit(5),
        supabase.from("incidents").select("id, code, title, severity, status, created_at").eq("company_id", companyId).in("status", ["open", "in_progress"]).order("created_at", { ascending: false }).limit(5),
        supabase.from("certificates").select("id, code, title, valid_until").eq("company_id", companyId).is("deleted_at", null).not("valid_until", "is", null).gte("valid_until", today).order("valid_until", { ascending: true }).limit(5),
      ]);

      return {
        assetsTotal: assetsTotal.count ?? 0,
        assetsActive: assetsActive.count ?? 0,
        sessionsOpen: sessionsOpen.count ?? 0,
        incidentsOpen: incidentsOpen.count ?? 0,
        incidentsCritical: incidentsCritical.count ?? 0,
        certsExpiring: certsExpiring.count ?? 0,
        certsExpired: certsExpired.count ?? 0,
        docsExpiring: docsExpiring.count ?? 0,
        docsExpired: docsExpired.count ?? 0,
        upcomingSessions: upcomingSessions.data ?? [],
        recentIncidents: recentIncidents.data ?? [],
        recentCerts: recentCerts.data ?? [],
      };
    },
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Bienvenido, {user?.user_metadata?.full_name ?? user?.email}
        </h1>
        <p className="text-sm text-muted-foreground">
          Empresa activa:{" "}
          <span className="font-medium text-foreground">{activeMembership?.companies.name}</span>
          {" · "}
          Rol: <Badge variant="outline" className="ml-1 capitalize">{activeMembership?.role}</Badge>
        </p>
      </div>

      {isLoading || !stats ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={Boxes}
              title="Activos"
              value={stats.assetsTotal}
              hint={`${stats.assetsActive} activos`}
              to="/assets"
            />
            <StatCard
              icon={Wrench}
              title="Sesiones abiertas"
              value={stats.sessionsOpen}
              hint="En curso o borrador"
              to="/maintenance"
            />
            <StatCard
              icon={AlertTriangle}
              title="Incidencias"
              value={stats.incidentsOpen}
              hint={stats.incidentsCritical > 0 ? `${stats.incidentsCritical} críticas` : "Sin críticas"}
              tone={stats.incidentsCritical > 0 ? "danger" : "default"}
              to="/incidents"
            />
            <StatCard
              icon={FileBadge}
              title="Certificados"
              value={stats.certsExpired + stats.certsExpiring}
              hint={
                stats.certsExpired > 0
                  ? `${stats.certsExpired} caducados · ${stats.certsExpiring} por caducar`
                  : `${stats.certsExpiring} por caducar (${warningDays}d)`
              }
              tone={stats.certsExpired > 0 ? "danger" : stats.certsExpiring > 0 ? "warning" : "default"}
              to="/certificates"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <AlertCard
              icon={FileBadge}
              title="Certificados"
              expired={stats.certsExpired}
              expiring={stats.certsExpiring}
              warningDays={warningDays}
              criticalDays={criticalDays}
              to="/certificates"
            />
            <AlertCard
              icon={FolderOpen}
              title="Documentos"
              expired={stats.docsExpired}
              expiring={stats.docsExpiring}
              warningDays={warningDays}
              criticalDays={criticalDays}
              to="/documents"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle className="text-base">Próximos mantenimientos</CardTitle>
                  <CardDescription>Sesiones programadas</CardDescription>
                </div>
                <CalendarClock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="space-y-2">
                {stats.upcomingSessions.length === 0 ? (
                  <EmptyHint text="No hay sesiones programadas." />
                ) : (
                  stats.upcomingSessions.map((s) => (
                    <Link
                      key={s.id}
                      to="/maintenance/$id"
                      params={{ id: s.id }}
                      className="flex items-center justify-between rounded-md border p-2 text-sm hover:bg-accent"
                    >
                      <span className="truncate font-medium">{s.code}</span>
                      <span className="text-xs text-muted-foreground">
                        {s.scheduled_for ? format(new Date(s.scheduled_for), "d MMM", { locale: es }) : "—"}
                      </span>
                    </Link>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle className="text-base">Incidencias recientes</CardTitle>
                  <CardDescription>Abiertas o en curso</CardDescription>
                </div>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="space-y-2">
                {stats.recentIncidents.length === 0 ? (
                  <EmptyHint text="Sin incidencias abiertas." />
                ) : (
                  stats.recentIncidents.map((i) => (
                    <Link
                      key={i.id}
                      to="/incidents/$id"
                      params={{ id: i.id }}
                      className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm hover:bg-accent"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{i.title}</p>
                        <p className="truncate text-xs text-muted-foreground">{i.code}</p>
                      </div>
                      <Badge variant={severityVariant(i.severity)} className="shrink-0 capitalize">
                        {i.severity}
                      </Badge>
                    </Link>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle className="text-base">Certificados próximos</CardTitle>
                  <CardDescription>Por fecha de caducidad</CardDescription>
                </div>
                <FileBadge className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="space-y-2">
                {stats.recentCerts.length === 0 ? (
                  <EmptyHint text="Sin certificados con caducidad." />
                ) : (
                  stats.recentCerts.map((c) => (
                    <Link
                      key={c.id}
                      to="/certificates/$id"
                      params={{ id: c.id }}
                      className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm hover:bg-accent"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{c.title}</p>
                        <p className="truncate text-xs text-muted-foreground">{c.code}</p>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {c.valid_until
                          ? formatDistanceToNow(new Date(c.valid_until), { locale: es, addSuffix: true })
                          : "—"}
                      </span>
                    </Link>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  title,
  value,
  hint,
  to,
  tone = "default",
}: {
  icon: typeof Boxes;
  title: string;
  value: number;
  hint?: string;
  to: string;
  tone?: "default" | "warning" | "danger";
}) {
  const toneClass =
    tone === "danger"
      ? "text-destructive"
      : tone === "warning"
        ? "text-yellow-600 dark:text-yellow-400"
        : "text-foreground";
  return (
    <Link to={to} className="block">
      <Card className="transition-colors hover:bg-accent/40">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <p className={`text-3xl font-bold ${toneClass}`}>{value}</p>
          {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </CardContent>
      </Card>
    </Link>
  );
}

function AlertCard({
  icon: Icon,
  title,
  expired,
  expiring,
  warningDays,
  to,
}: {
  icon: typeof FileBadge;
  title: string;
  expired: number;
  expiring: number;
  warningDays: number;
  criticalDays: number;
  to: string;
}) {
  const ok = expired === 0 && expiring === 0;
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          <CardDescription>Estado de caducidad</CardDescription>
        </div>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="space-y-3">
        {ok ? (
          <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4" />
            Todo al día
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-md border bg-destructive/5 p-3">
              <p className="text-xs text-muted-foreground">Caducados</p>
              <p className="text-2xl font-bold text-destructive">{expired}</p>
            </div>
            <div className="rounded-md border bg-yellow-500/5 p-3">
              <p className="text-xs text-muted-foreground">Próximos {warningDays}d</p>
              <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{expiring}</p>
            </div>
          </div>
        )}
        <Button asChild variant="outline" size="sm" className="w-full">
          <Link to={to}>Ver {title.toLowerCase()}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function EmptyHint({ text }: { text: string }) {
  return <p className="py-4 text-center text-xs text-muted-foreground">{text}</p>;
}

function severityVariant(s: string): "default" | "secondary" | "destructive" | "outline" {
  if (s === "critical") return "destructive";
  if (s === "high") return "default";
  return "secondary";
}
