/**
 * Bloque 2B — reparaciones (correctivo sencillo): alta, lista y detalle con actuaciones y cierre.
 * The server decides permissions and dates; closing never touches preventive due dates or
 * linked incidents.
 */
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { Hammer, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useMaintenanceRequest, useMaintenanceUi } from "../host";
import { correctiveKeys, correctiveService } from "../../services/corrective";
import { incidentKeys, incidentService } from "../../services/incidents";
import { assetKeys } from "../../services/assets";
import { sessionKeys, sessionService } from "../../services/sessions";
import type { CorrectiveOutcome, CorrectivePriority, CorrectiveRow } from "../../contracts/corrective";
import { DEFAULT_REACTIVATE, OUTCOME_LABEL, PRIORITY_LABEL, correctiveStatusLabel, isCorrectiveOpen, shouldReactivate } from "../../domain/corrective-rules";

const todayStr = () => format(new Date(), "yyyy-MM-dd");
const fdate = (d: string | null | undefined) => (d ? format(new Date(/^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d}T00:00:00` : d), "dd/MM/yyyy") : "—");
const errMsg = (e: unknown) => (e instanceof Error ? e.message : (e as { message?: string })?.message ?? "Error");

function useRoles() {
  const { role } = useMaintenanceRequest();
  return {
    canRun: role === "administrator" || role === "system_manager" || role === "manager",
    canManageAssets: role === "administrator" || role === "system_manager",
  };
}

function statusVariant(s: string): "default" | "secondary" | "outline" | "destructive" {
  return s === "in_progress" ? "default" : s === "closed" ? "secondary" : "outline";
}
function PriorityBadge({ p }: { p: CorrectivePriority }) {
  return <Badge variant={p === "high" ? "destructive" : "outline"}>{PRIORITY_LABEL[p]}</Badge>;
}

/** «Nueva reparación»: from an asset (fixed), from an incident (asset preselected) or free. */
export function NewRepairButton({ assetId, incidentId, size = "sm" }: { assetId?: string | null; incidentId?: string | null; size?: "sm" | "default" }) {
  const { orgId } = useMaintenanceRequest();
  const { canRun, canManageAssets } = useRoles();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [asset, setAsset] = useState(assetId ?? "");
  const [detectedOn, setDetectedOn] = useState(todayStr());
  const [priority, setPriority] = useState<CorrectivePriority>("normal");
  const [description, setDescription] = useState("");
  const [external, setExternal] = useState(false);
  const [provider, setProvider] = useState("");
  const [technician, setTechnician] = useState("");
  const [markOut, setMarkOut] = useState(false);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const { data: assets = [] } = useQuery({
    queryKey: incidentKeys.assetOptions(orgId), enabled: open && !!orgId && !assetId, queryFn: () => incidentService.listAssetOptions(orgId),
  });
  const reset = () => {
    setAsset(assetId ?? ""); setDetectedOn(todayStr()); setPriority("normal"); setDescription(""); setExternal(false);
    setProvider(""); setTechnician(""); setMarkOut(false); setRequestId(crypto.randomUUID());
  };
  const create = useMutation({
    mutationFn: () => correctiveService.create(orgId, {
      assetId: asset, detectedOn, priority, description: description.trim(), incidentId: incidentId ?? null, external,
      provider: external ? provider.trim() || null : null, technicianName: technician.trim() || null, markOutOfService: markOut, requestId,
    }, todayStr()),
    onSuccess: (r) => {
      toast.success(`Reparación ${r.code} creada`);
      qc.invalidateQueries({ queryKey: correctiveKeys.all(orgId) });
      qc.invalidateQueries({ queryKey: assetKeys.list(orgId) });
      if (asset) qc.invalidateQueries({ queryKey: assetKeys.detail(orgId, asset) });
      setOpen(false); reset();
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  if (!canRun || !correctiveService.available()) return null;
  return (
    <>
      <Button size={size} variant="outline" onClick={() => setOpen(true)}><Hammer className="mr-2 h-4 w-4" />Nueva reparación</Button>
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nueva reparación</DialogTitle>
            <DialogDescription>Avería o fallo no programado. No cambia las fechas del mantenimiento preventivo.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {!assetId && (
              <div className="space-y-1.5">
                <Label>Equipo *</Label>
                <Select value={asset} onValueChange={setAsset}>
                  <SelectTrigger><SelectValue placeholder="Selecciona el equipo" /></SelectTrigger>
                  <SelectContent>{assets.map((a) => <SelectItem key={a.id} value={a.id}>{a.code} · {a.name ?? ""}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Detectada el *</Label><Input type="date" max={todayStr()} value={detectedOn} onChange={(e) => setDetectedOn(e.target.value)} /></div>
              <div className="space-y-1.5">
                <Label>Prioridad</Label>
                <Select value={priority} onValueChange={(v) => setPriority(v as CorrectivePriority)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{(["low", "normal", "high"] as const).map((p) => <SelectItem key={p} value={p}>{PRIORITY_LABEL[p]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5"><Label>Qué le pasa *</Label><Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ej.: el manómetro marca fuera de zona verde" /></div>
            <div className="flex items-center gap-2"><Switch id="rep-ext" checked={external} onCheckedChange={setExternal} /><Label htmlFor="rep-ext">La hace una empresa externa</Label></div>
            {external
              ? <div className="space-y-1.5"><Label>Empresa *</Label><Input value={provider} onChange={(e) => setProvider(e.target.value)} /></div>
              : <div className="space-y-1.5"><Label>Responsable (opcional)</Label><Input value={technician} onChange={(e) => setTechnician(e.target.value)} /></div>}
            {canManageAssets && (
              <label className="flex items-start gap-2 text-sm">
                <Checkbox checked={markOut} onCheckedChange={(v) => setMarkOut(v === true)} className="mt-0.5" />
                <span>Marcar el equipo como fuera de servicio<span className="block text-xs text-muted-foreground">Opcional. Sigue apareciendo en Próximos mantenimientos.</span></span>
              </label>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => create.mutate()} disabled={create.isPending || !asset || !description.trim()}>{create.isPending ? "Creando…" : "Crear reparación"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Repairs table; `assetId` limits to one asset, `openOnly` to pending/in progress. */
export function RepairsList({ assetId, openOnly = false, showAsset = true }: { assetId?: string; openOnly?: boolean; showAsset?: boolean }) {
  const { orgId } = useMaintenanceRequest();
  const [selected, setSelected] = useState<string | null>(null);
  const [onlyOpen, setOnlyOpen] = useState(openOnly);
  const { data = [], isLoading } = useQuery({
    queryKey: correctiveKeys.list(orgId, onlyOpen, assetId), enabled: !!orgId && correctiveService.available(),
    queryFn: () => correctiveService.list(orgId, { open: onlyOpen, assetId }),
  });
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Switch id={`rep-open-${assetId ?? "all"}`} checked={onlyOpen} onCheckedChange={setOnlyOpen} />
        <Label htmlFor={`rep-open-${assetId ?? "all"}`} className="text-sm">Solo abiertas</Label>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Estado</TableHead><TableHead>Código</TableHead>{showAsset && <TableHead>Equipo</TableHead>}
              <TableHead>Avería</TableHead><TableHead>Prioridad</TableHead><TableHead>Detectada</TableHead><TableHead>Resultado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Cargando…</TableCell></TableRow>
              : data.length === 0 ? <TableRow><TableCell colSpan={7} className="py-6 text-center text-muted-foreground">{onlyOpen ? "No hay reparaciones abiertas" : "Sin reparaciones"}</TableCell></TableRow>
              : data.map((r) => (
                <TableRow key={r.id} className="cursor-pointer" onClick={() => setSelected(r.id)}>
                  <TableCell><Badge variant={statusVariant(r.status)}>{correctiveStatusLabel(r.status)}</Badge></TableCell>
                  <TableCell className="font-mono text-xs"><Button variant="link" size="sm" onClick={() => setSelected(r.id)}>{r.code}</Button></TableCell>
                  {showAsset && <TableCell>{r.asset ? `${r.asset.code} · ${r.asset.name ?? ""}` : "—"}</TableCell>}
                  <TableCell className="max-w-[260px] truncate">{r.fault_description}</TableCell>
                  <TableCell><PriorityBadge p={r.priority} /></TableCell>
                  <TableCell>{fdate(r.detected_on)}</TableCell>
                  <TableCell>{r.outcome ? OUTCOME_LABEL[r.outcome as CorrectiveOutcome] ?? r.outcome : "—"}</TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>
      <RepairSheet id={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function RepairSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { orgId } = useMaintenanceRequest();
  const { data: r } = useQuery({ queryKey: correctiveKeys.detail(orgId, id ?? ""), enabled: !!orgId && !!id, queryFn: () => id ? correctiveService.get(orgId, id) : Promise.resolve(null) });
  return (
    <Sheet open={!!id} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        {r ? <RepairDetail key={`${orgId}:${r.id}`} r={r} onClose={onClose} /> : <p className="p-4 text-sm text-muted-foreground">Cargando…</p>}
      </SheetContent>
    </Sheet>
  );
}

function RepairDetail({ r, onClose }: { r: CorrectiveRow; onClose: () => void }) {
  const { orgId } = useMaintenanceRequest();
  const { Attachments } = useMaintenanceUi();
  const { canRun, canManageAssets } = useRoles();
  const qc = useQueryClient();
  const open = isCorrectiveOpen(r.status);
  const refresh = () => {
    qc.invalidateQueries({ queryKey: correctiveKeys.all(orgId) });
    qc.invalidateQueries({ queryKey: assetKeys.list(orgId) });
    qc.invalidateQueries({ queryKey: sessionKeys.lists(orgId) });
    if (r.asset) qc.invalidateQueries({ queryKey: assetKeys.detail(orgId, r.asset.id) });
  };
  const { data: entries = [] } = useQuery({ queryKey: correctiveKeys.entries(orgId, r.id), enabled: !!orgId, queryFn: () => correctiveService.listEntries(orgId, r.id) });
  const { data: incidents = [] } = useQuery({
    queryKey: incidentKeys.byAsset(orgId, r.asset?.id ?? ""), enabled: !!orgId && !!r.asset && open && canRun,
     queryFn: () => r.asset ? incidentService.listAssetIncidents(orgId, r.asset.id) : Promise.resolve([]),
  });

  const [entryDate, setEntryDate] = useState(todayStr());
  const [entryText, setEntryText] = useState("");
  const addEntry = useMutation({
    mutationFn: () => correctiveService.addEntry(orgId, r.id, entryDate, entryText),
    onSuccess: () => { setEntryText(""); qc.invalidateQueries({ queryKey: correctiveKeys.entries(orgId, r.id) }); toast.success("Actuación añadida"); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const link = useMutation({
    mutationFn: (incidentId: string | null) => correctiveService.linkIncident(orgId, r.id, incidentId),
    onSuccess: () => { refresh(); toast.success("Vínculo actualizado"); },
    onError: (e) => toast.error(errMsg(e)),
  });

  return (
    <div className="space-y-5">
      <SheetHeader>
        <SheetTitle className="flex items-center gap-2"><span className="font-mono">{r.code}</span><Badge variant={statusVariant(r.status)}>{correctiveStatusLabel(r.status)}</Badge></SheetTitle>
        <SheetDescription>Reparación · no modifica el mantenimiento preventivo ni la incidencia vinculada</SheetDescription>
      </SheetHeader>
      {open && canRun && <EditRepairButton r={r} onDone={refresh} />}
      {r.status === "cancelled" && <p className="border-l-2 border-destructive pl-3 text-sm">Motivo de cancelación: {r.cancellation_reason ?? "No disponible"}</p>}
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div className="col-span-2"><dt className="text-xs text-muted-foreground">Equipo</dt><dd>{r.asset ? <Link to="/assets/$id" params={{ id: r.asset.id }} className="hover:underline">{r.asset.code} · {r.asset.name ?? ""}</Link> : "—"}{r.asset?.status === "out_of_service" && <Badge variant="destructive" className="ml-2">Fuera de servicio</Badge>}</dd></div>
        <div className="col-span-2"><dt className="text-xs text-muted-foreground">Avería</dt><dd className="whitespace-pre-wrap">{r.fault_description}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Detectada</dt><dd>{fdate(r.detected_on)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Prioridad</dt><dd><PriorityBadge p={r.priority} /></dd></div>
        <div><dt className="text-xs text-muted-foreground">{r.is_external ? "Empresa externa" : "Responsable"}</dt><dd>{(r.is_external ? r.external_provider : r.technician_name) ?? "—"}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Incidencia</dt><dd>{r.incident ? <Link to="/incidents/$id" params={{ id: r.incident.id }} className="hover:underline">{r.incident.code} · {r.incident.title}</Link> : "—"}</dd></div>
        {r.status === "closed" && (<>
          <div><dt className="text-xs text-muted-foreground">Resultado</dt><dd>{OUTCOME_LABEL[r.outcome as CorrectiveOutcome] ?? r.outcome}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Trabajo finalizado</dt><dd>{fdate(r.completed_at)}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Cerrada</dt><dd>{fdate(r.closed_at)}{r.closed_by_name ? ` · ${r.closed_by_name}` : ""}</dd></div>
          {r.observations && <div className="col-span-2"><dt className="text-xs text-muted-foreground">Observaciones</dt><dd className="whitespace-pre-wrap">{r.observations}</dd></div>}
        </>)}
      </dl>

      {open && canRun && (
        <div className="space-y-1.5">
          <Label>Vincular a incidencia (opcional)</Label>
          <Select value={r.incident_id ?? "none"} onValueChange={(v) => link.mutate(v === "none" ? null : v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sin incidencia</SelectItem>
              {r.incident && !incidents.some((i) => i.id === r.incident?.id) && <SelectItem value={r.incident.id}>{r.incident.code} · {r.incident.title}</SelectItem>}
              {incidents.map((i) => <SelectItem key={i.id} value={i.id}>{i.code} · {i.title}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Actuaciones</h3>
        {entries.length === 0 ? <p className="text-sm text-muted-foreground">Sin actuaciones registradas.</p> : (
          <ul className="space-y-2">
            {entries.map((e) => (
              <li key={e.id} className="rounded-md border p-2 text-sm">
                <div className="text-xs text-muted-foreground">{fdate(e.performed_on)}{e.author_name ? ` · ${e.author_name}` : ""}</div>
                <p className="whitespace-pre-wrap">{e.body}</p>
              </li>
            ))}
          </ul>
        )}
        {open && canRun && (
          <div className="space-y-2 rounded-md border p-3">
            <div className="flex gap-2">
              <Input type="date" className="w-40" min={r.detected_on} max={todayStr()} value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
              <Input placeholder="Qué se ha hecho" value={entryText} onChange={(e) => setEntryText(e.target.value)} />
            </div>
            <div className="flex justify-end"><Button size="sm" variant="outline" onClick={() => addEntry.mutate()} disabled={!entryText.trim() || addEntry.isPending}><Plus className="mr-1 h-4 w-4" />Añadir actuación</Button></div>
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Documentos</h3>
        <Attachments entity="maintenance_session" entityId={r.id} defaultCategory="maintenance_evidence" />
      </section>

      {open && canRun && (
        <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
          {r.status === "draft" && <DeleteRepairDraftButton r={r} onDone={() => { refresh(); onClose(); }} />}
          <CancelRepairButton r={r} onDone={refresh} />
          <CloseRepairButton r={r} canManageAssets={canManageAssets} onDone={refresh} />
        </div>
      )}
    </div>
  );
}

function EditRepairButton({ r, onDone }: { r: CorrectiveRow; onDone: () => void }) {
  const { orgId } = useMaintenanceRequest();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<CorrectivePriority>("normal");
  const [external, setExternal] = useState(false);
  const [provider, setProvider] = useState("");
  const [technician, setTechnician] = useState("");
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const m = useMutation({
    mutationFn: () => correctiveService.update(orgId, r.id, { expectedUpdatedAt: token, description, priority, external,
      provider: external ? provider.trim() || null : null, technicianName: technician.trim() || null }),
    onSuccess: () => { setOpen(false); onDone(); toast.success("Reparación actualizada"); },
    onError: (e) => { setError(errMsg(e)); qc.invalidateQueries({ queryKey: correctiveKeys.detail(orgId, r.id) }); },
  });
  const begin = () => {
    setDescription(r.fault_description); setPriority(r.priority); setExternal(r.is_external);
    setProvider(r.external_provider ?? ""); setTechnician(r.technician_name ?? ""); setToken(r.updated_at); setError(null); setOpen(true);
  };
  return <>
    <Button variant="outline" size="sm" onClick={begin}><Pencil className="mr-2 h-4 w-4" />Editar reparación</Button>
    <Dialog open={open} onOpenChange={(v) => { if (!m.isPending) setOpen(v); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Editar {r.code}</DialogTitle><DialogDescription>{r.asset?.code} · {r.asset?.name ?? "Reparación abierta"}</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label htmlFor="repair-edit-description">Qué le pasa *</Label><Textarea id="repair-edit-description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="repair-edit-priority">Prioridad</Label><Select value={priority} onValueChange={(v) => setPriority(v as CorrectivePriority)}><SelectTrigger id="repair-edit-priority"><SelectValue /></SelectTrigger><SelectContent>{(["low", "normal", "high"] as const).map((p) => <SelectItem key={p} value={p}>{PRIORITY_LABEL[p]}</SelectItem>)}</SelectContent></Select></div>
          <div className="flex items-center gap-2"><Switch id="repair-edit-external" checked={external} onCheckedChange={setExternal} /><Label htmlFor="repair-edit-external">La hace una empresa externa</Label></div>
          {external && <div className="space-y-1.5"><Label htmlFor="repair-edit-provider">Empresa *</Label><Input id="repair-edit-provider" value={provider} onChange={(e) => setProvider(e.target.value)} /></div>}
          <div className="space-y-1.5"><Label htmlFor="repair-edit-technician">Responsable (opcional)</Label><Input id="repair-edit-technician" value={technician} onChange={(e) => setTechnician(e.target.value)} /></div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter><Button variant="outline" disabled={m.isPending} onClick={() => setOpen(false)}>Volver</Button><Button disabled={m.isPending || !description.trim() || (external && !provider.trim())} onClick={() => { setError(null); m.mutate(); }}>{m.isPending ? "Guardando…" : "Guardar cambios"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}

function DeleteRepairDraftButton({ r, onDone }: { r: CorrectiveRow; onDone: () => void }) {
  const { orgId } = useMaintenanceRequest();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const m = useMutation({ mutationFn: () => sessionService.deleteDraftSession(orgId, r.id),
    onSuccess: () => { setOpen(false); toast.success("Borrador eliminado"); onDone(); }, onError: (e) => setError(errMsg(e)) });
  return <>
    <Button variant="outline" onClick={() => { setError(null); setOpen(true); }}><Trash2 className="mr-2 h-4 w-4" />Eliminar borrador</Button>
    <Dialog open={open} onOpenChange={(v) => { if (!m.isPending) setOpen(v); }}><DialogContent>
      <DialogHeader><DialogTitle>Eliminar borrador {r.code}</DialogTitle><DialogDescription>Solo se permite si nunca se ha iniciado y no tiene actuaciones, resultados, documentos ni otra evidencia. Si tiene actividad, conserva el registro y cancela la reparación.</DialogDescription></DialogHeader>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <DialogFooter><Button variant="outline" disabled={m.isPending} onClick={() => setOpen(false)}>Volver</Button><Button variant="destructive" disabled={m.isPending} onClick={() => m.mutate()}>Eliminar borrador vacío</Button></DialogFooter>
    </DialogContent></Dialog>
  </>;
}

function CancelRepairButton({ r, onDone }: { r: CorrectiveRow; onDone: () => void }) {
  const { orgId } = useMaintenanceRequest();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const m = useMutation({
    mutationFn: () => sessionService.cancelSession(orgId, r.id, reason.trim()),
    onSuccess: () => { toast.success("Reparación cancelada"); setOpen(false); onDone(); },
    onError: (e) => toast.error(errMsg(e)),
  });
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>Cancelar reparación</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Cancelar {r.code}</DialogTitle><DialogDescription>Se conserva el registro y sus actuaciones. La incidencia vinculada no cambia.</DialogDescription></DialogHeader>
          <div className="space-y-1.5"><Label htmlFor="repair-cancel-reason">Motivo *</Label><Textarea id="repair-cancel-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} /></div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Volver</Button><Button variant="destructive" onClick={() => m.mutate()} disabled={!reason.trim() || m.isPending}>Cancelar reparación</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function CloseRepairButton({ r, canManageAssets, onDone }: { r: CorrectiveRow; canManageAssets: boolean; onDone: () => void }) {
  const { orgId } = useMaintenanceRequest();
  const [open, setOpen] = useState(false);
  const [performedOn, setPerformedOn] = useState(todayStr());
  const [outcome, setOutcome] = useState<CorrectiveOutcome>("repaired");
  const [obs, setObs] = useState("");
  const [reference, setReference] = useState("");
  const outOfService = r.asset?.status === "out_of_service";
  const [reactivate, setReactivate] = useState(DEFAULT_REACTIVATE);
  const willReactivate = shouldReactivate(reactivate, outcome, r.asset?.status, canManageAssets);
  const m = useMutation({
    mutationFn: () => correctiveService.close(orgId, r.id, {
      performedOn, outcome, observations: obs.trim() || null, provider: null, reference: reference.trim() || null, reactivate: willReactivate,
    }, r.detected_on, todayStr()),
    onSuccess: (res) => {
      toast.success(res.closedNow ? `Reparación finalizada${res.reactivated ? " · equipo de nuevo activo" : ""}` : "La reparación ya estaba finalizada");
      setOpen(false); onDone();
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  const hint = useMemo(() => {
    if (outcome === "not_repaired") return outOfService ? "El equipo seguirá fuera de servicio." : "El estado del equipo no cambia.";
    if (outcome === "replaced") return "No se da de alta ni de baja ningún equipo. Si procede, retira este equipo y da de alta el nuevo desde Activos.";
    return null;
  }, [outcome, outOfService]);
  return (
    <>
      <Button onClick={() => { setReactivate(DEFAULT_REACTIVATE); setOpen(true); }}>Finalizar reparación</Button>
      <Dialog open={open} onOpenChange={(v) => { setReactivate(DEFAULT_REACTIVATE); setOpen(v); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Finalizar {r.code}</DialogTitle><DialogDescription>No cambia las fechas del mantenimiento preventivo ni la incidencia vinculada.</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Trabajo terminado el *</Label><Input type="date" min={r.detected_on} max={todayStr()} value={performedOn} onChange={(e) => setPerformedOn(e.target.value)} /></div>
              <div className="space-y-1.5">
                <Label>Resultado *</Label>
                <Select value={outcome} onValueChange={(v) => { setOutcome(v as CorrectiveOutcome); setReactivate(DEFAULT_REACTIVATE); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{(["repaired", "not_repaired", "replaced"] as const).map((o) => <SelectItem key={o} value={o}>{OUTCOME_LABEL[o]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            {r.is_external && <div className="space-y-1.5"><Label>Nº de parte o informe (opcional)</Label><Input value={reference} onChange={(e) => setReference(e.target.value)} /></div>}
            <div className="space-y-1.5"><Label>Observaciones{outcome === "not_repaired" ? " *" : ""}</Label><Textarea rows={3} value={obs} onChange={(e) => setObs(e.target.value)} /></div>
            {outcome === "repaired" && outOfService && (canManageAssets ? (
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={reactivate} onCheckedChange={(v) => setReactivate(v === true)} />Volver a poner el equipo en servicio</label>
            ) : <p className="text-xs text-muted-foreground">El equipo seguirá fuera de servicio hasta que un responsable de activos lo reactive.</p>)}
            {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Volver</Button><Button onClick={() => m.mutate()} disabled={m.isPending || (outcome === "not_repaired" && !obs.trim())}>Finalizar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
