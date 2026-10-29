import { DueDecisionsPanel, buildDueDecisions, type DueChoices, type DuePanelRow } from "../components/due-decisions-panel";
import { addMonthsClamped } from "../../domain/due-date";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  AlertTriangle,
  PlayCircle,
  Lock,
  PenLine,
  Eraser,
  Ban,
  Trash2,
} from "lucide-react";
import { format } from "date-fns";
import { useMaintenanceRequest, useMaintenanceUi } from "../host";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { ReasonDialog } from "../components/safe-actions";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { checklistKeys, checklistService } from "../../services/checklists";
import { sessionKeys, sessionService } from "../../services/sessions";
import { newIdempotencyKey } from "../../services/scan";
import { SessionExecutionPanel } from "../components/session-execution";
import { ItemChecklist } from "../components/item-checklist";


const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  draft: { label: "Borrador", variant: "outline" },
  in_progress: { label: "En curso", variant: "secondary" },
  closed: { label: "Cerrada", variant: "default" },
  cancelled: { label: "Cancelada", variant: "destructive" },
};

export function SessionDetailPage() {
  const { id } = useParams({ from: "/_authenticated/_app/maintenance/$id" });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { orgId: activeCompanyId, role } = useMaintenanceRequest();
  const { Attachments: AttachmentsPanel } = useMaintenanceUi();
  const orgId = activeCompanyId;
  const canRun =
    role === "administrator" || role === "system_manager" || role === "manager";

  const { data: session } = useQuery({
    queryKey: sessionKeys.detail(orgId, id),
    enabled: !!orgId,
    queryFn: () => sessionService.getSession(orgId, id),
  });

  const { data: items = [] } = useQuery({
    queryKey: sessionKeys.items(orgId, id),
    enabled: !!orgId,
    queryFn: () => sessionService.listItems(orgId, id),
  });

  const { data: linkedCert } = useQuery({
    queryKey: sessionKeys.certificate(orgId, id),
    enabled: !!orgId,
    queryFn: () => sessionService.getSessionCertificate(orgId, id),
  });

  const itemGroups = useMemo(() => {
    type It = (typeof items)[number];
    const locMap = new Map<string, { locationId: string; locationName: string; types: Map<string, { typeId: string; typeName: string; items: It[] }> }>();
    for (const it of items) {
      const locId = it.assets?.location_id ?? "__none__";
      const locName = it.assets?.locations?.name ?? "Sin ubicación";
      if (!locMap.has(locId)) locMap.set(locId, { locationId: locId, locationName: locName, types: new Map() });
      const loc = locMap.get(locId)!;
      const typeId = it.assets?.asset_type_id ?? "__none__";
      const n = it.assets?.asset_types?.name_i18n as
        | { es?: string; ca?: string; en?: string }
        | null
        | undefined;
      const typeName = n?.es ?? n?.ca ?? n?.en ?? it.assets?.asset_types?.code ?? "Sin tipo";
      if (!loc.types.has(typeId)) loc.types.set(typeId, { typeId, typeName, items: [] });
      loc.types.get(typeId)!.items.push(it);
    }
    return [...locMap.values()]
      .sort((a, b) => a.locationName.localeCompare(b.locationName))
      .map((loc) => {
        const types = [...loc.types.values()]
          .sort((a, b) => a.typeName.localeCompare(b.typeName))
          .map((t) => ({ ...t, done: t.items.filter((i) => i.result !== "pending").length }));
        return {
          ...loc,
          types,
          total: types.reduce((n2, t) => n2 + t.items.length, 0),
          done: types.reduce((n2, t) => n2 + t.done, 0),
        };
      });
  }, [items]);

  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const activeItem = useMemo(
    () => items.find((i) => i.id === selectedItemId) ?? items[0] ?? null,
    [items, selectedItemId],
  );

  const start = useMutation({
    mutationFn: () => sessionService.startSession(orgId, id),
    onSuccess: () => {
      toast.success("Sesión iniciada");
      qc.invalidateQueries({ queryKey: sessionKeys.detail(orgId, id), exact: true });
      qc.invalidateQueries({ queryKey: sessionKeys.lists(orgId) });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [closeOpen, setCloseOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const refreshSession = () => {
    qc.invalidateQueries({ queryKey: sessionKeys.detail(orgId, id), exact: true });
    qc.invalidateQueries({ queryKey: sessionKeys.lists(orgId) });
  };

  if (!session) return <div className="p-6 text-sm text-muted-foreground">Cargando…</div>;

  const pendingCount = items.filter((i) => i.result === "pending").length;
  const status = STATUS_LABELS[session.status] ?? { label: session.status, variant: "outline" as const };
  const isLocked = session.status === "closed" || session.status === "cancelled";
  const editable = canRun && !isLocked;
  const completedCount = items.filter((i) => i.result !== "pending").length;
  const totalCount = items.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/maintenance" })}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                {session.maintenance_plans?.name ?? "Sesión ad-hoc"}
              </h1>
              <Badge variant={status.variant}>{status.label}</Badge>
            </div>
            <p className="font-mono text-xs text-muted-foreground">
              {session.code} · {completedCount}/{totalCount} activos completados
              {session.technician_name ? ` · ${session.technician_name}` : ""}
            </p>
            {session.history_source === "legacy" && (
              <p className="text-xs text-muted-foreground">
                Sesión anterior al registro histórico: se muestran los datos actuales del plan.
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {session.status === "draft" && canRun && !session.is_external && (
            <Button onClick={() => start.mutate()} disabled={start.isPending}>
              <PlayCircle className="mr-2 h-4 w-4" />
              Iniciar
            </Button>
          )}
          {session.status === "in_progress" && canRun && !session.is_external && (
            <Button onClick={() => setCloseOpen(true)}>
              <Lock className="mr-2 h-4 w-4" />
              Cerrar y firmar
            </Button>
          )}
          {(session.status === "draft" || session.status === "in_progress") && canRun && (
            <Button variant="outline" onClick={() => setCancelOpen(true)}>
              <Ban className="mr-2 h-4 w-4" />Cancelar sesión
            </Button>
          )}
          {session.status === "draft" && canRun && (
            <Button variant="ghost" className="text-destructive" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="mr-2 h-4 w-4" />Eliminar borrador
            </Button>
          )}
        </div>
      </div>
      {session.status === "cancelled" && (session.metadata as { cancel?: { reason?: string } } | null)?.cancel?.reason && (
        <p className="rounded-md border p-3 text-sm">Cancelada: {(session.metadata as { cancel: { reason: string } }).cancel.reason}</p>
      )}
      <SessionExecutionPanel
        orgId={orgId}
        sessionId={id}
        status={session.status}
        isExternal={session.is_external}
        items={items.map((i) => ({ id: i.id, result: i.result, code: i.assets?.code ?? "", name: i.assets?.name ?? null }))}
        closeSummary={(session.metadata as { close_summary?: unknown } | null)?.close_summary ?? null}
        onOpenRun={() => navigate({ to: "/run/$id", params: { id } })}
        onChanged={() => qc.invalidateQueries({ queryKey: sessionKeys.items(orgId, id), exact: true })}
      />
      <ReasonDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Cancelar sesión"
        description={<p>La sesión queda cancelada con su motivo y su contenido se conserva. No cambia ninguna próxima fecha.</p>}
        confirmLabel="Cancelar sesión"
        destructive
        onConfirm={async (reason) => { await sessionService.cancelSession(orgId, id, reason); toast.success("Sesión cancelada"); refreshSession(); }}
      />
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este borrador?</AlertDialogTitle>
            <AlertDialogDescription>
              Solo se elimina si está vacío: sin resultados, observaciones, respuestas, documentos, incidencias ni firma. Si tiene algo, cancélalo en su lugar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction onClick={async () => {
              try { await sessionService.deleteDraftSession(orgId, id); toast.success("Borrador eliminado"); qc.invalidateQueries({ queryKey: sessionKeys.lists(orgId) }); navigate({ to: "/maintenance" }); }
              catch (e) { toast.error(e instanceof Error ? e.message : (e as { message?: string }).message ?? "No se pudo eliminar"); }
            }}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {session.is_external ? (
        <ExternalRecordCard
          orgId={orgId}
          sessionId={id}
          session={session}
          items={items}
          editable={editable}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: sessionKeys.detail(orgId, id), exact: true });
            qc.invalidateQueries({ queryKey: sessionKeys.items(orgId, id), exact: true });
            qc.invalidateQueries({ queryKey: sessionKeys.lists(orgId) });
          }}
        />
      ) : (
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Activos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {items.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sin activos.</p>
            ) : (
              itemGroups.map((g) => (
                <div key={g.locationId} className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">
                      {g.locationName}
                    </p>
                    <span className="text-xs text-muted-foreground">
                      {g.done}/{g.total}
                    </span>
                  </div>
                  {g.types.map((t) => (
                    <div key={t.typeId} className="space-y-1">
                      <div className="flex items-center justify-between gap-2 pl-1">
                        <p className="text-xs font-medium">{t.typeName}</p>
                        <span className="text-[11px] text-muted-foreground">
                          {t.done}/{t.items.length}
                        </span>
                      </div>
                      {t.items.map((it) => (
                        <button
                          key={it.id}
                          onClick={() => setSelectedItemId(it.id)}
                          className={`flex w-full items-start gap-2 rounded-md px-3 py-2 text-left text-sm transition ${
                            activeItem?.id === it.id ? "bg-muted" : "hover:bg-muted/50"
                          }`}
                        >
                          <ItemStatusIcon result={it.result} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">
                              {it.assets?.name ?? it.assets?.code ?? "—"}
                            </p>
                            <p className="truncate font-mono text-xs text-muted-foreground">
                              {it.assets?.code}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {activeItem ? (
          <ItemChecklist
            key={activeItem.id}
            item={{ ...activeItem, checklist_template_version_id: activeItem.checklist_template_version_id ?? "" }}
            editable={editable && session.status === "in_progress"}
            companyId={orgId ?? session.company_id}
            sessionId={id}
          />
        ) : (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              Selecciona un activo para ejecutar el checklist.
            </CardContent>
          </Card>
        )}
      </div>
      )}

      {linkedCert && (
        <Card>
          <CardContent className="flex items-center justify-between gap-3 py-3">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>Certificado emitido para esta sesión:</span>
              <span className="font-mono text-xs text-muted-foreground">{linkedCert.code}</span>
            </div>
            <Link to="/certificates/$id" params={{ id: linkedCert.id }}>
              <Button variant="outline" size="sm">Ver certificado</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      <AttachmentsPanel entity="maintenance_session" entityId={id} defaultCategory="maintenance_evidence" />



      {closeOpen && (
        <CloseSessionDialog
          orgId={orgId}
          sessionId={id}
          pendingCount={pendingCount}
          open={closeOpen}
          onOpenChange={setCloseOpen}
          onClosed={() => {
            qc.invalidateQueries({ queryKey: sessionKeys.detail(orgId, id), exact: true });
            qc.invalidateQueries({ queryKey: sessionKeys.items(orgId, id), exact: true });
            qc.invalidateQueries({ queryKey: sessionKeys.certificate(orgId, id), exact: true });
            qc.invalidateQueries({ queryKey: sessionKeys.lists(orgId) });
          }}
        />
      )}
    </div>
  );
}

function ItemStatusIcon({ result }: { result: string }) {
  if (result === "ok") return <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" />;
  if (result === "with_incident" || result === "fail")
    return <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />;
  if (result === "excepted") return <Ban className="mt-0.5 h-4 w-4 text-amber-600" />;
  if (result === "not_applicable" || result === "na" || result === "skipped")
    return <Circle className="mt-0.5 h-4 w-4 text-muted-foreground" />;
  return <Circle className="mt-0.5 h-4 w-4 text-muted-foreground" />;
}

function CloseSessionDialog({
  orgId,
  sessionId,
  pendingCount,
  open,
  onOpenChange,
  onClosed,
}: {
  orgId: string | null;
  sessionId: string;
  pendingCount: number;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onClosed: () => void;
}) {
  const [signerName, setSignerName] = useState("");
  const [signerRole, setSignerRole] = useState("");
  const [dueChoices, setDueChoices] = useState<DueChoices>({});
  const { data: preview = [] } = useQuery({
    queryKey: sessionKeys.duePreview(orgId, sessionId), enabled: open && !!orgId,
    queryFn: () => sessionService.listDuePreview(orgId, sessionId),
  });
  const dueRows: DuePanelRow[] = preview.map((r) => ({ item_id: r.item_id, code: r.asset_code, name: r.asset_name,
    result: r.result === "pending" ? "skipped" : r.result, linked: r.linked, planned_on: r.planned_on, proposed_on: r.proposed_on, calendar_on: r.calendar_on }));
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const hasInk = useRef(false);

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current;
    if (!c) return;
    drawing.current = true;
    const r = c.getBoundingClientRect();
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(e.clientX - r.left, e.clientY - r.top);
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const c = canvasRef.current;
    if (!c) return;
    const r = c.getBoundingClientRect();
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineTo(e.clientX - r.left, e.clientY - r.top);
    ctx.stroke();
    hasInk.current = true;
  };
  const end = () => {
    drawing.current = false;
  };
  const clear = () => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    ctx?.clearRect(0, 0, c.width, c.height);
    hasInk.current = false;
  };

  const close = useMutation({
    mutationFn: async () => {
      if (!signerName.trim()) throw new Error("Indica el nombre del firmante");
      if (!hasInk.current) throw new Error("Firma para continuar");
      const signature = canvasRef.current!.toDataURL("image/png");
      const { decisions, error } = buildDueDecisions(dueRows, dueChoices);
      if (error) throw new Error(error);
      const { cert, pdfFailed } = await sessionService.closeSession(orgId, sessionId, { signerName, signerRole, signature, decisions });
      if (pdfFailed)
        toast.warning("Certificado emitido, pero no se pudo generar el PDF. Podrás regenerarlo desde el detalle.");
      return cert;
    },
    onSuccess: (cert) => {
      toast.success(
        cert
          ? `Sesión cerrada. Certificado ${cert.code} emitido.`
          : "Sesión cerrada. Esta familia no requiere certificado.",
      );
      onClosed();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Cerrar y firmar sesión</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {pendingCount > 0 && (
            <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
              Quedan {pendingCount} equipo(s) pendientes. No se puede cerrar hasta revisarlos o registrar
              una excepción justificada para cada uno (apartado «Ejecución y cierre»).
            </p>
          )}
          {preview.some((r) => r.months_source === "plan") && <p className="text-xs text-muted-foreground">Sesión anterior al registro de periodicidad: la propuesta usa la frecuencia actual del plan.</p>}
          <DueDecisionsPanel rows={dueRows} value={dueChoices} onChange={setDueChoices} disabled={close.isPending} />
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Firmante *</Label>
              <Input value={signerName} onChange={(e) => setSignerName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Cargo</Label>
              <Input value={signerRole} onChange={(e) => setSignerRole(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1.5">
                <PenLine className="h-3.5 w-3.5" />
                Firma
              </Label>
              <Button type="button" variant="ghost" size="sm" onClick={clear}>
                <Eraser className="mr-1.5 h-3.5 w-3.5" />
                Limpiar
              </Button>
            </div>
            <canvas
              ref={canvasRef}
              width={460}
              height={160}
              onPointerDown={start}
              onPointerMove={move}
              onPointerUp={end}
              onPointerLeave={end}
              className="w-full touch-none rounded-md border bg-background"
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => close.mutate()} disabled={close.isPending || pendingCount > 0}>
            {close.isPending ? "Cerrando…" : "Cerrar sesión"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type ExtException = { result: "ok" | "with_incident" | "skipped"; note: string };

function ExternalRecordCard({ orgId, sessionId, session, items, editable, onSaved }: {
  orgId: string | null; sessionId: string; editable: boolean; onSaved: () => void;
  session: { status: string; external_provider: string | null; external_cert_number: string | null; metadata: unknown };
  items: Array<{ id: string; result: string; assets: { code: string; name: string | null } | null }>;
}) {
  const ext = ((session.metadata as Record<string, unknown> | null)?.external ?? {}) as { performed_on?: string; result?: string; description?: string | null };
  const closed = session.status === "closed";
  const [performedOn, setPerformedOn] = useState(ext.performed_on ?? format(new Date(), "yyyy-MM-dd"));
  const [provider, setProvider] = useState(session.external_provider ?? "");
  const [reference, setReference] = useState(session.external_cert_number ?? "");
  const [result, setResult] = useState<"ok" | "with_incidents">((ext.result as "ok" | "with_incidents") ?? "ok");
  const [description, setDescription] = useState(ext.description ?? "");
  const [hasExceptions, setHasExceptions] = useState(false);
  const [exceptions, setExceptions] = useState<Record<string, ExtException>>({});
  const [dueChoices, setDueChoices] = useState<DueChoices>({});

  const { data: preview = [] } = useQuery({
    queryKey: sessionKeys.duePreview(orgId, sessionId), enabled: !closed && !!orgId,
    queryFn: () => sessionService.listDuePreview(orgId, sessionId),
  });
  // La fecha de ejecución externa es performed_on (el servidor aplica la misma regla al cerrar).
  const dueRows: DuePanelRow[] = preview.map((r) => {
    const proposed = r.executed_on ? r.proposed_on
      : performedOn && r.months ? addMonthsClamped(performedOn, r.months) : null;
    const calendar = r.planned_on && r.months ? addMonthsClamped(r.planned_on, r.months) : null;
    return { item_id: r.item_id, code: r.asset_code, name: r.asset_name,
      result: exceptions[r.item_id]?.result ?? (result === "ok" ? "ok" : "with_incident"),
      linked: r.linked, planned_on: r.planned_on, proposed_on: proposed,
      calendar_on: calendar && calendar !== proposed ? calendar : null };
  });
  const setException = (itemId: string, patch: Partial<ExtException>) =>
    setExceptions((p) => {
      const cur = p[itemId] ?? { result: "ok" as const, note: "" };
      return { ...p, [itemId]: { result: patch.result ?? cur.result, note: patch.note ?? cur.note } };
    });

  const save = useMutation({
    mutationFn: () => {
      const { decisions, error } = buildDueDecisions(dueRows, dueChoices);
      if (error) throw new Error(error);
      return sessionService.recordExternal(orgId, sessionId, {
        performedOn, provider, reference: reference || null, result, description: description || null,
        exceptions: Object.entries(exceptions)
          .filter(([, e]) => e.result !== (result === "ok" ? "ok" : "with_incident"))
          .map(([itemId, e]) => ({ itemId, result: e.result, note: e.note.trim() || null })),
        decisions,
      });
    },
    onSuccess: () => { toast.success("Revisión externa registrada"); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const ro = closed || !editable;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Revisión externa · {items.length} equipo(s)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Fecha de realización *</Label>
            <Input type="date" value={performedOn} disabled={ro} onChange={(e) => setPerformedOn(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Empresa que la realizó *</Label>
            <Input value={provider} disabled={ro} onChange={(e) => setProvider(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Nº de informe / certificado</Label>
            <Input value={reference} disabled={ro} onChange={(e) => setReference(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Resultado *</Label>
            <Select value={result} disabled={ro} onValueChange={(v) => setResult(v as "ok" | "with_incidents")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ok">Correcto</SelectItem>
                <SelectItem value="with_incidents">Con incidencias</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label>{result === "with_incidents" ? "Descripción de las incidencias *" : "Observaciones"}</Label>
          <Textarea value={description} disabled={ro} onChange={(e) => setDescription(e.target.value)} rows={3} />
        </div>
        {!ro && items.length > 0 && (
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={hasExceptions} onCheckedChange={(c) => { setHasExceptions(!!c); if (!c) setExceptions({}); }} />
              Algún equipo tiene un resultado distinto del general
            </label>
            {hasExceptions && (
              <div className="max-h-64 space-y-2 overflow-auto rounded-md border p-2">
                {items.map((it) => {
                  const ex = exceptions[it.id];
                  return (
                    <div key={it.id} className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-mono text-xs">{it.assets?.code}</span>
                      <span className="min-w-0 flex-1 truncate">{it.assets?.name ?? "—"}</span>
                      <Select
                        value={ex?.result ?? "__common__"}
                        onValueChange={(v) => v === "__common__"
                          ? setExceptions((p) => { const n = { ...p }; delete n[it.id]; return n; })
                          : setException(it.id, { result: v as ExtException["result"] })}
                      >
                        <SelectTrigger className="h-8 w-[210px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__common__">Como el resultado general</SelectItem>
                          <SelectItem value="ok">Correcto</SelectItem>
                          <SelectItem value="with_incident">Con incidencias</SelectItem>
                          <SelectItem value="skipped">No realizado</SelectItem>
                        </SelectContent>
                      </Select>
                      {ex && (
                        <Input className="h-8 w-[220px]" placeholder="Nota (opcional)" value={ex.note}
                          onChange={(e) => setException(it.id, { note: e.target.value })} />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
        {!ro && preview.some((r) => r.months_source === "plan") && (
          <p className="text-xs text-muted-foreground">Sesión anterior al registro de periodicidad: la propuesta usa la frecuencia actual del plan.</p>
        )}
        {!ro && dueRows.some((r) => r.linked) && (
          <DueDecisionsPanel rows={dueRows} value={dueChoices} onChange={setDueChoices} disabled={save.isPending} />
        )}
        <p className="text-xs text-muted-foreground">Adjunta el informe, certificado o factura en el apartado de documentos de abajo.</p>
        {!ro && (
          <div className="flex justify-end">
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              <Lock className="mr-2 h-4 w-4" />
              Registrar y cerrar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
