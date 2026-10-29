/**
 * Mobile execution of a maintenance session (portable, ~390 px). No router or host-auth imports:
 * the host wrapper passes ids and navigation callbacks; org/person/role come from MaintenanceUiProvider.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, Ban, CheckCircle2, Circle, Loader2, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useMaintenanceRequest } from "../host";
import { makeContext, scanKeys, scanService } from "../../services/scan";
import { sessionKeys, sessionService } from "../../services/sessions";
import { ItemChecklist } from "../components/item-checklist";
import { QrScannerDialog } from "../components/qr-scanner";
import type { ScanResolution } from "../../contracts/scan";

const NA_MSG = "Código no disponible para ti en esta sesión.";
const STATE: Record<string, { label: string; icon: typeof Circle; cls: string }> = {
  pending: { label: "Pendiente", icon: Circle, cls: "text-muted-foreground" },
  ok: { label: "Revisado", icon: CheckCircle2, cls: "text-emerald-600" },
  not_applicable: { label: "Revisado (N/A)", icon: CheckCircle2, cls: "text-emerald-600" },
  with_incident: { label: "Con incidencia", icon: AlertTriangle, cls: "text-destructive" },
  excepted: { label: "Excepción", icon: Ban, cls: "text-amber-600" },
};

export type SessionRunNav = {
  openSession: (sessionId: string, itemId?: string) => void;
  back: () => void;
};

/** Without sessionId: lists only the caller's runnable sessions (or resolves a scanned token). */
export function SessionRunPage({ sessionId, token, initialItemId, nav }: {
  sessionId?: string; token?: string; initialItemId?: string; nav: SessionRunNav;
}) {
  const { orgId, userId, role } = useMaintenanceRequest();
  const ctx = useMemo(() => (orgId ? makeContext(orgId, userId, role) : null), [orgId, userId, role]);
  if (!ctx) return <p className="p-4 text-sm text-muted-foreground">Sin empresa activa.</p>;
  if (!sessionId) return <RunnableList ctx={ctx} token={token} nav={nav} />;
  return <RunSession ctx={ctx} sessionId={sessionId} initialItemId={initialItemId} nav={nav} />;
}

function RunnableList({ ctx, token, nav }: { ctx: ReturnType<typeof makeContext>; token?: string; nav: SessionRunNav }) {
  const { data: sessions = [], isLoading } = useQuery({
    queryKey: scanKeys.runnable(ctx.orgId), queryFn: () => scanService.listMyRunnableSessions(ctx),
  });
  const { data: res, isLoading: resolving } = useQuery({
    queryKey: scanKeys.resolve(ctx.orgId, token ?? ""), enabled: !!token, retry: false,
    queryFn: () => scanService.resolve(ctx, token!),
  });
  useEffect(() => {
    if (res?.status === "choose" && res.sessions.length === 1) nav.openSession(res.sessions[0].sessionId, res.sessions[0].itemId);
  }, [res, nav]);

  return (
    <div className="mx-auto max-w-md space-y-4 p-4">
      <h1 className="text-xl font-semibold">Mis mantenimientos</h1>
      {token && (resolving ? <Loader2 className="h-5 w-5 animate-spin" /> : res?.status === "not_available" ? (
        <p className="rounded-md border p-3 text-sm">{NA_MSG}</p>
      ) : res?.status === "choose" && res.sessions.length > 1 ? (
        <Card><CardContent className="space-y-2 py-3 text-sm">
          <p><span className="font-mono">{res.asset.code}</span> está en varias de tus sesiones:</p>
          {res.sessions.map((s) => (
            <Button key={s.sessionId} variant="outline" className="w-full justify-start" onClick={() => nav.openSession(s.sessionId, s.itemId)}>
              {s.sessionCode} · {s.planName ?? "—"}
            </Button>
          ))}
        </CardContent></Card>
      ) : null)}
      {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : sessions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No tienes sesiones en curso asignadas.</p>
      ) : sessions.map((s) => (
        <button key={s.id} onClick={() => nav.openSession(s.id)} className="w-full rounded-lg border bg-card p-3 text-left">
          <p className="font-medium">{s.planName ?? "Sesión"}</p>
          <p className="font-mono text-xs text-muted-foreground">{s.code}{s.scheduledFor ? ` · ${s.scheduledFor}` : ""}</p>
          <Progress className="mt-2 h-2" value={s.total ? ((s.done + s.excepted) / s.total) * 100 : 0} />
          <p className="mt-1 text-xs text-muted-foreground">{s.done}/{s.total} revisados{s.excepted ? ` · ${s.excepted} excepción(es)` : ""}</p>
        </button>
      ))}
    </div>
  );
}

function RunSession({ ctx, sessionId, initialItemId, nav }: {
  ctx: ReturnType<typeof makeContext>; sessionId: string; initialItemId?: string; nav: SessionRunNav;
}) {
  const qc = useQueryClient();
  const [scanOpen, setScanOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(initialItemId ?? null);
  const { data: session } = useQuery({ queryKey: sessionKeys.detail(ctx.orgId, sessionId), queryFn: () => sessionService.getSession(ctx.orgId, sessionId) });
  const { data: runnable = [], isLoading: loadingRunnable } = useQuery({
    queryKey: scanKeys.runnable(ctx.orgId), queryFn: () => scanService.listMyRunnableSessions(ctx),
  });
  const { data: items = [] } = useQuery({ queryKey: sessionKeys.items(ctx.orgId, sessionId), queryFn: () => sessionService.listItems(ctx.orgId, sessionId) });
  const authorized = runnable.some((s) => s.id === sessionId);

  const onScan = useCallback(async (raw: string) => {
    setScanOpen(false); setMsg(null);
    const r: ScanResolution = await scanService.resolve(ctx, raw, sessionId).catch(() => ({ status: "not_available" as const }));
    if (r.status === "ok") setActiveId(r.itemId); else setMsg(NA_MSG);
  }, [ctx, sessionId]);

  if (loadingRunnable) return <div className="p-4"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  if (!authorized) return (
    <div className="mx-auto max-w-md space-y-3 p-4">
      <p className="rounded-md border p-3 text-sm">Sesión no disponible para ti.</p>
      <Button variant="outline" onClick={nav.back}>Volver</Button>
    </div>
  );

  const reviewed = items.filter((i) => ["ok", "with_incident", "not_applicable"].includes(i.result)).length;
  const excepted = items.filter((i) => i.result === "excepted").length;
  const active = items.find((i) => i.id === activeId) ?? null;

  if (active) return (
    <div className="mx-auto max-w-md space-y-3 p-3">
      <Button variant="ghost" size="sm" onClick={() => setActiveId(null)}><ArrowLeft className="mr-1.5 h-4 w-4" />Equipos</Button>
      <ItemChecklist
        key={active.id}
        item={{ ...active, checklist_template_version_id: active.checklist_template_version_id ?? "" }}
        editable={session?.status === "in_progress" && active.result !== "excepted"}
        companyId={ctx.orgId}
        sessionId={sessionId}
      />
      <Button className="w-full" variant="secondary" onClick={() => { qc.invalidateQueries({ queryKey: scanKeys.runnable(ctx.orgId) }); setActiveId(null); setScanOpen(true); }}>
        <QrCode className="mr-2 h-4 w-4" />Escanear siguiente
      </Button>
      <QrScannerDialog open={scanOpen} onOpenChange={setScanOpen} onResult={onScan} />
    </div>
  );

  return (
    <div className="mx-auto max-w-md space-y-3 p-3">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={nav.back} aria-label="Volver"><ArrowLeft className="h-4 w-4" /></Button>
        <div className="min-w-0">
          <p className="truncate font-semibold">{session?.maintenance_plans?.name ?? "Sesión"}</p>
          <p className="font-mono text-xs text-muted-foreground">{session?.code}</p>
        </div>
      </div>
      <div>
        <Progress className="h-2" value={items.length ? ((reviewed + excepted) / items.length) * 100 : 0} />
        <p className="mt-1 text-xs text-muted-foreground">{reviewed}/{items.length} revisados{excepted ? ` · ${excepted} excepción(es)` : ""}</p>
      </div>
      <Button className="h-12 w-full" onClick={() => setScanOpen(true)}><QrCode className="mr-2 h-5 w-5" />Escanear equipo</Button>
      {msg && <p className="rounded-md border p-2 text-sm">{msg}</p>}
      <ul className="space-y-1.5">
        {items.map((i) => {
          const st = STATE[i.result] ?? STATE.pending;
          const Icon = st.icon;
          return (
            <li key={i.id}>
              <button onClick={() => setActiveId(i.id)} className="flex w-full items-center gap-3 rounded-lg border bg-card p-3 text-left">
                <Icon className={`h-5 w-5 shrink-0 ${st.cls}`} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{i.assets?.name ?? i.assets?.code}</span>
                  <span className="block font-mono text-xs text-muted-foreground">{i.assets?.code}</span>
                </span>
                <Badge variant="outline" className="shrink-0 text-[10px]">{st.label}</Badge>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-muted-foreground">El cierre lo realiza un responsable con permiso de cierre desde la ficha de la sesión.</p>
      <QrScannerDialog open={scanOpen} onOpenChange={setScanOpen} onResult={onScan} />
    </div>
  );
}
