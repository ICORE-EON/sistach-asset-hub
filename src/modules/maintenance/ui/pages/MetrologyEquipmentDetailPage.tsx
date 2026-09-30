import { Link, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus } from "lucide-react";
import { toast } from "sonner";
import { useMaintenanceRequest } from "../host";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { metrologyKeys, metrologyService } from "../../services/metrology";
import type { MtrControlPlan, MtrControlPlanInput, MtrEquipmentInput } from "../../contracts/metrology";
import { MetrologyRecordsTab } from "../components/metrology-records";
import { PersonSelect, ImpactBanner, KIND_LABEL, METHOD_LABEL, STATUS_LABEL, StatusBadge, UNIT_LABEL } from "../components/metrology-common";

const NEW_PLAN: MtrControlPlanInput = {
  kind: "calibration", method: "external", procedure: null, frequencyUnit: "years", frequencyValue: 1, acceptanceCriteria: null,
  responsibleRef: null, nextDueOn: null, requiresDocument: false, qualifiesAsReference: false, active: true,
};

export function MetrologyEquipmentDetailPage() {
  const { id } = useParams({ from: "/_authenticated/_app/metrology/equipment/$id" });
  const { orgId, role } = useMaintenanceRequest();
  const canManage = role === "administrator" || role === "system_manager";
  const canClose = canManage || role === "manager";
  const canRun = !!role && role !== "auditor";
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: metrologyKeys.all(orgId) });

  const eq = useQuery({ queryKey: metrologyKeys.detail(orgId, id), enabled: !!orgId, queryFn: () => metrologyService.getEquipment(orgId, id) });
  const { data: sites = [] } = useQuery({ queryKey: metrologyKeys.sites(orgId), enabled: !!orgId, queryFn: () => metrologyService.listSites(orgId) });
  const { data: plans = [] } = useQuery({ queryKey: metrologyKeys.plans(orgId, id), enabled: !!orgId, queryFn: () => metrologyService.listPlans(orgId, id) });
  const { data: impacts = [] } = useQuery({ queryKey: metrologyKeys.impacts(orgId, id), enabled: !!orgId, queryFn: () => metrologyService.listImpactReviews(orgId, id) });
  const { data: history = [] } = useQuery({ queryKey: metrologyKeys.history(orgId, id), enabled: !!orgId, queryFn: () => metrologyService.listHistory(orgId, id) });

  const { data: people = [] } = useQuery({ queryKey: metrologyKeys.people(orgId), enabled: !!orgId, queryFn: () => metrologyService.listPeople(orgId) });
  const [edit, setEdit] = useState<Partial<MtrEquipmentInput> | null>(null);
  const saveEdit = useMutation({
    mutationFn: () => metrologyService.updateEquipment(orgId, id, edit!),
    onSuccess: () => { toast.success("Equipo actualizado"); setEdit(null); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const [plan, setPlan] = useState<{ id: string | null; v: MtrControlPlanInput } | null>(null);
  const savePlan = useMutation({
    mutationFn: () => metrologyService.savePlan(orgId, id, plan!.id, plan!.v),
    onSuccess: () => { toast.success("Control guardado"); setPlan(null); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const [move, setMove] = useState<{ siteId: string; detail: string } | null>(null);
  const doMove = useMutation({
    mutationFn: () => metrologyService.moveSite(orgId, id, move!.siteId, move!.detail || null, null),
    onSuccess: () => { toast.success("Traslado registrado"); setMove(null); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (eq.isError) return <div className="p-6 text-destructive">{(eq.error as Error).message}</div>;
  const e = eq.data;
  if (!e) return <div className="p-6 text-muted-foreground">Cargando…</div>;
  const siteName = (sid: string | null) => sites.find((s) => s.id === sid)?.name ?? "—";
  const nextDue = plans.filter((p) => p.active && p.nextDueOn).map((p) => p.nextDueOn!).sort()[0] ?? null;
  const pending = impacts.some((i) => i.status === "pending");
  const personName = (pid: string | null) => people.find((p) => p.id === pid)?.name ?? null;
  const pv = plan?.v;
  const setPv = (patch: Partial<MtrControlPlanInput>) => setPlan((p) => p && { ...p, v: { ...p.v, ...patch } });
  const field = (label: string, value: unknown) => (
    <div><div className="text-xs text-muted-foreground">{label}</div><div>{value == null || value === "" ? "—" : String(value)}</div></div>
  );

  return (
    <div className="space-y-4 p-6">
      <Link to="/metrology/equipment" className="inline-flex items-center text-sm text-muted-foreground hover:underline"><ArrowLeft className="mr-1 h-4 w-4" />Equipos de medida</Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">{e.code} · {e.name}</h1>
        <StatusBadge stored={e.status} nextDue={nextDue} />
      </div>
      {pending && <ImpactBanner />}

      <Tabs defaultValue="summary">
        <TabsList>
          <TabsTrigger value="summary">Resumen</TabsTrigger>
          <TabsTrigger value="plans">Plan de control</TabsTrigger>
          <TabsTrigger value="records">Calibraciones / verificaciones</TabsTrigger>
          <TabsTrigger value="docs">Documentos</TabsTrigger>
          <TabsTrigger value="history">Historial</TabsTrigger>
        </TabsList>

        <TabsContent value="summary">
          <Card><CardContent className="grid gap-4 pt-6 sm:grid-cols-3">
            {field("Tipo", e.equipmentType)}{field("Magnitud", e.magnitude)}{field("Uso previsto", e.intendedUse)}
            {field("Site", siteName(e.siteId))}{field("Ubicación", e.locationDetail)}{field("Alta", e.registeredOn)}
            {field("Marca", e.brand)}{field("Modelo", e.model)}{field("Nº de serie", e.serialNumber)}
            {field("Rango", e.rangeMin != null || e.rangeMax != null ? `${e.rangeMin ?? ""} – ${e.rangeMax ?? ""} ${e.unit ?? ""}` : null)}
            {field("Resolución", e.resolution)}{field("Exactitud declarada", e.declaredAccuracy)}
            {e.status === "restricted" && field("Usos permitidos", e.allowedUses)}
            {field("Restricciones", e.restrictions)}{field("Próximo control", nextDue)}{field("Responsable", personName(e.responsibleRef))}
            {canManage && <div className="flex gap-2 sm:col-span-3"><Button variant="outline" onClick={() => setEdit({ name: e.name, equipmentType: e.equipmentType, magnitude: e.magnitude, locationDetail: e.locationDetail, brand: e.brand, model: e.model, serialNumber: e.serialNumber, responsibleRef: e.responsibleRef })}>Editar</Button><Button variant="outline" onClick={() => setMove({ siteId: e.siteId, detail: e.locationDetail ?? "" })}>Trasladar de site</Button></div>}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="plans" className="space-y-3">
          {canManage && <Button onClick={() => setPlan({ id: null, v: NEW_PLAN })}><Plus className="mr-1 h-4 w-4" />Nuevo control</Button>}
          {plans.map((p: MtrControlPlan) => (
            <Card key={p.id}><CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base">{KIND_LABEL[p.kind]} · {METHOD_LABEL[p.method]}
                {!p.active && <Badge variant="outline" className="ml-2">Inactivo</Badge>}
                {p.qualifiesAsReference && <Badge variant="secondary" className="ml-2">Habilita como patrón</Badge>}</CardTitle>
              {canManage && <Button size="sm" variant="ghost" onClick={() => { const { id: pid, equipmentId: _e, ...v } = p; setPlan({ id: pid, v }); }}>Editar</Button>}
            </CardHeader><CardContent className="grid gap-2 text-sm sm:grid-cols-3">
              {field("Frecuencia", p.frequencyUnit === "before_use" ? UNIT_LABEL.before_use : `${p.frequencyValue} ${UNIT_LABEL[p.frequencyUnit]}`)}
              {field("Próximo", p.nextDueOn)}{field("Documento obligatorio", p.requiresDocument ? "Sí" : "No")}
              {field("Procedimiento", p.procedure)}{field("Criterio de aceptación", p.acceptanceCriteria)}
            </CardContent></Card>
          ))}
          {!plans.length && <p className="text-sm text-muted-foreground">Sin controles planificados.</p>}
        </TabsContent>

        <TabsContent value="records">
          <MetrologyRecordsTab orgId={orgId} equipment={e} plans={plans} people={people} impacts={impacts} canRun={canRun} canClose={canClose} canManage={canManage} />
        </TabsContent>

        <TabsContent value="docs">
          <Card><CardContent className="pt-6 text-sm text-muted-foreground">
            Los documentos de equipos de medida se vincularán al integrar con el control documental común de ICORE.
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="history">
          <Card><CardContent className="space-y-2 pt-6 text-sm">
            {history.map((h, i) => (
              <div key={i} className="flex gap-3 border-b pb-2 last:border-0">
                <span className="w-40 shrink-0 text-muted-foreground">{new Date(h.at).toLocaleString("es-ES")}</span>
                {h.kind === "status" && <span>Estado: {STATUS_LABEL[h.from ?? ""] ?? "—"} → {STATUS_LABEL[h.to] ?? h.to} ({h.cause}){h.note ? ` · ${h.note}` : ""}</span>}
                {h.kind === "site_move" && <span>Traslado: {siteName(h.fromSiteId)} → {siteName(h.toSiteId)}{h.note ? ` · ${h.note}` : ""}</span>}
                {h.kind === "decision" && <span>Decisión no apto: {h.decision}{h.notes ? ` · ${h.notes}` : ""}</span>}
              </div>
            ))}
            {!history.length && <p className="text-muted-foreground">Sin movimientos.</p>}
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!plan} onOpenChange={(o) => !o && setPlan(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{plan?.id ? "Editar control" : "Nuevo control"}</DialogTitle></DialogHeader>
          {pv && <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Tipo</Label><Select value={pv.kind} onValueChange={(v) => setPv({ kind: v as never })}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(KIND_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Método</Label><Select value={pv.method} onValueChange={(v) => setPv({ method: v as never })}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(METHOD_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Frecuencia</Label><Select value={pv.frequencyUnit} onValueChange={(v) => setPv({ frequencyUnit: v as never })}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(UNIT_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent></Select></div>
            {pv.frequencyUnit !== "before_use" && <div><Label>Cada</Label><Input type="number" min={1} value={pv.frequencyValue ?? ""} onChange={(ev) => setPv({ frequencyValue: ev.target.value ? Number(ev.target.value) : null })} /></div>}
            <div><Label>Próximo control</Label><Input type="date" value={pv.nextDueOn ?? ""} onChange={(ev) => setPv({ nextDueOn: ev.target.value || null })} /></div>
            <div className="sm:col-span-2"><Label>Procedimiento</Label><Input value={pv.procedure ?? ""} onChange={(ev) => setPv({ procedure: ev.target.value || null })} /></div>
            <div className="sm:col-span-2"><Label>Criterio de aceptación</Label><Input value={pv.acceptanceCriteria ?? ""} onChange={(ev) => setPv({ acceptanceCriteria: ev.target.value || null })} /></div>
            <label className="flex items-center gap-2 text-sm"><Switch checked={pv.requiresDocument} onCheckedChange={(c) => setPv({ requiresDocument: c })} />Documento obligatorio</label>
            <label className="flex items-center gap-2 text-sm"><Switch checked={pv.qualifiesAsReference} onCheckedChange={(c) => setPv({ qualifiesAsReference: c })} />Habilita como patrón</label>
            <label className="flex items-center gap-2 text-sm"><Switch checked={pv.active} onCheckedChange={(c) => setPv({ active: c })} />Activo</label>
          </div>}
          <DialogFooter><Button onClick={() => savePlan.mutate()} disabled={savePlan.isPending}>Guardar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar equipo</DialogTitle></DialogHeader>
          {edit && <div className="grid gap-3 sm:grid-cols-2">
            {([["name", "Nombre"], ["equipmentType", "Tipo"], ["magnitude", "Magnitud"], ["locationDetail", "Ubicación dentro del site"], ["brand", "Marca"], ["model", "Modelo"], ["serialNumber", "Nº de serie"]] as const).map(([k, l]) => (
              <div key={k}><Label>{l}</Label><Input value={(edit[k] as string | null) ?? ""} onChange={(ev) => setEdit({ ...edit, [k]: ev.target.value || null })} /></div>
            ))}
            <div><Label>Responsable</Label><PersonSelect people={people} value={edit.responsibleRef ?? null} onChange={(v) => setEdit({ ...edit, responsibleRef: v })} /></div>
          </div>}
          <DialogFooter><Button onClick={() => saveEdit.mutate()} disabled={saveEdit.isPending}>Guardar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!move} onOpenChange={(o) => !o && setMove(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Trasladar de site</DialogTitle></DialogHeader>
          {move && <div className="grid gap-3">
            <div><Label>Site</Label><Select value={move.siteId} onValueChange={(v) => setMove({ ...move, siteId: v })}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{sites.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Ubicación dentro del site</Label><Input value={move.detail} onChange={(ev) => setMove({ ...move, detail: ev.target.value })} /></div>
          </div>}
          <DialogFooter><Button onClick={() => doMove.mutate()} disabled={doMove.isPending}>Trasladar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
