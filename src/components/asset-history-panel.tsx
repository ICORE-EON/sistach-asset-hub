import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCompany } from "@/contexts/CompanyContext";
import { sessionKeys, sessionService } from "@/modules/maintenance/services/sessions";

const RESULT_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  ok: { label: "OK", variant: "default" },
  with_incident: { label: "Con incidencia", variant: "destructive" },
  fail: { label: "No conforme", variant: "destructive" },
  not_applicable: { label: "No aplica", variant: "secondary" },
  na: { label: "No aplica", variant: "secondary" },
  skipped: { label: "No revisado", variant: "outline" },
  pending: { label: "Pendiente", variant: "outline" },
};

function fdate(d: string | null | undefined) {
  if (!d) return "—";
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? "—" : format(dt, "dd/MM/yyyy");
}

export function AssetHistoryPanel({ assetId }: { assetId: string }) {
  const { activeCompanyId } = useCompany();
  const { data: maintenance = [] } = useQuery({
    queryKey: sessionKeys.assetHistory(activeCompanyId, assetId),
    enabled: !!activeCompanyId,
    queryFn: () => sessionService.listAssetHistory(activeCompanyId, assetId),
  });

  // Residual (blocks 5 and 6): incidents and certificates tabs keep their current reads.
  const { data: incidents = [] } = useQuery({
    queryKey: ["asset-incidents", assetId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("incidents")
        .select("id, code, title, severity, status, created_at")
        .eq("asset_id", assetId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: certificates = [] } = useQuery({
    queryKey: ["asset-certificates", assetId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("certificate_items")
        .select("id, result, certificates(id, code, title, issued_on, valid_until, status)")
        .eq("asset_id", assetId);
      if (error) throw error;
      return data.filter((r) => r.certificates);
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Historial del equipo</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="maintenance">
          <TabsList>
            <TabsTrigger value="maintenance">Mantenimientos ({maintenance.length})</TabsTrigger>
            <TabsTrigger value="incidents">Incidencias ({incidents.length})</TabsTrigger>
            <TabsTrigger value="certificates">Certificados ({certificates.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="maintenance" className="space-y-2 pt-3">
            {maintenance.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Aún no hay mantenimientos registrados.
              </p>
            ) : (
              maintenance.map((m) => {
                const r = RESULT_LABELS[m.result] ?? { label: m.result, variant: "outline" as const };
                return (
                  <Link
                    key={m.id}
                    to="/maintenance/$id"
                    params={{ id: m.maintenance_sessions?.id ?? "" }}
                    className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm transition hover:bg-muted/50"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {m.maintenance_sessions?.maintenance_plans?.name ?? "Sesión ad-hoc"}
                      </p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {m.maintenance_sessions?.code} ·{" "}
                        {fdate(
                          m.completed_at ??
                            m.maintenance_sessions?.closed_at ??
                            m.maintenance_sessions?.scheduled_for,
                        )}
                      </p>
                    </div>
                    <Badge variant={r.variant}>{r.label}</Badge>
                  </Link>
                );
              })
            )}
          </TabsContent>

          <TabsContent value="incidents" className="space-y-2 pt-3">
            {incidents.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Sin incidencias registradas.
              </p>
            ) : (
              incidents.map((i) => (
                <Link
                  key={i.id}
                  to="/incidents/$id"
                  params={{ id: i.id }}
                  className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm transition hover:bg-muted/50"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{i.title}</p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {i.code} · {fdate(i.created_at)}
                    </p>
                  </div>
                  <Badge variant={i.status === "closed" ? "secondary" : "destructive"}>
                    {i.status}
                  </Badge>
                </Link>
              ))
            )}
          </TabsContent>

          <TabsContent value="certificates" className="space-y-2 pt-3">
            {certificates.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Sin certificados relacionados.
              </p>
            ) : (
              certificates.map((c) => (
                <Link
                  key={c.id}
                  to="/certificates/$id"
                  params={{ id: c.certificates!.id }}
                  className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm transition hover:bg-muted/50"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{c.certificates!.title}</p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {c.certificates!.code} · Emitido {fdate(c.certificates!.issued_on)}
                      {c.certificates!.valid_until
                        ? ` · Válido hasta ${fdate(c.certificates!.valid_until)}`
                        : ""}
                    </p>
                  </div>
                  <Badge variant="outline">{c.result}</Badge>
                </Link>
              ))
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
