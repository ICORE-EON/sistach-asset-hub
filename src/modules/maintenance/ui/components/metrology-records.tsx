import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { metrologyKeys, metrologyService } from "../../services/metrology";
import type { MtrControlPlan, MtrEquipment, MtrImpactReview, MtrPerson, MtrRecord, MtrRecordDraft, MtrRecordLine } from "../../contracts/metrology";
import { aggregateLines, lineResult, type MtrImpactConclusion, type MtrUnfitDecision } from "../../domain/metrology";
import { DECISION_LABEL, IMPACT_NOTICE, KIND_LABEL, NONE, PersonSelect, today } from "./metrology-common";

const RES: Record<string, string> = { fit: "Apto", unfit: "No apto" };
const REC_STATUS: Record<string, string> = { draft: "Borrador", validated: "Validado", superseded: "Sustituido" };
type Draft = { id: string | null; v: MtrRecordDraft };

const blank = (p: MtrControlPlan): MtrRecordDraft => ({
  controlPlanId: p.id, kind: p.kind, performedOn: today(), performerRef: null, result: null, nextDueOverride: null,
  overrideReason: null, observations: null, documentRef: null, laboratory: null, certificateNumber: null, accreditation: null,
  declaredUncertainty: null, adjustedOrRepaired: null, referenceEquipmentId: null, lines: [],
});

type Props = {
  orgId: string | null; equipment: MtrEquipment; plans: MtrControlPlan[]; people: MtrPerson[];
  impacts: MtrImpactReview[]; canRun: boolean; canClose: boolean; canManage: boolean;
};

export function MetrologyRecordsTab({ orgId, equipment, plans, people, impacts, canRun, canClose, canManage }: Props) {
  const id = equipment.id;
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: metrologyKeys.all(orgId) });
  const err = (e: Error) => toast.error(e.message);
  const { data: records = [] } = useQuery({ queryKey: metrologyKeys.records(orgId, id), enabled: !!orgId, queryFn: () => metrologyService.listRecords(orgId, id) });
  const { data: allEq = [] } = useQuery({ queryKey: metrologyKeys.equipment(orgId), enabled: !!orgId, queryFn: () => metrologyService.listEquipment(orgId) });
  const personName = (pid: string | null) => people.find((p) => p.id === pid)?.name ?? "—";
  const planOf = (pid: string) => plans.find((p) => p.id === pid);

  const [draft, setDraft] = useState<Draft | null>(null);
  const [decision, setDecision] = useState<{ recordId: string; d: MtrUnfitDecision; notes: string; uses: string } | null>(null);
  const [rectify, setRectify] = useState<{ recordId: string; reason: string } | null>(null);
  const [impact, setImpact] = useState<{ id: string; c: MtrImpactConclusion; just: string; actions: string; period: string; on: string; extId: string; extLabel: string } | null>(null);
  const [react, setReact] = useState<string | null>(null);

  const set = (patch: Partial<MtrRecordDraft>) => setDraft((d) => d && { ...d, v: { ...d.v, ...patch } });
  const setLine = (i: number, patch: Partial<MtrRecordLine>) => setDraft((d) => {
    if (!d) return d;
    const lines = d.v.lines.map((l, j) => {
      if (j !== i) return l;
      const n = { ...l, ...patch };
      return { ...n, result: lineResult(n.referenceValue, n.measuredValue, n.tolerance) ?? n.result };
    });
    return { ...d, v: { ...d.v, lines } };
  });
  const num = (s: string) => (s === "" ? null : Number(s));

  const openDraft = async (r: MtrRecord) => {
    try {
      const lines = await metrologyService.getRecordLines(orgId, r.id);
      const { id: rid, equipmentId: _e, status: _s, version: _v, supersedesId: _p, validatedAt: _a, nextDueCalculated: _n, ...v } = r;
      setDraft({ id: rid, v: { ...v, lines } });
    } catch (e) { err(e as Error); }
  };

  const save = useMutation({
    mutationFn: async (validate: boolean) => {
      const rid = await metrologyService.saveDraft(orgId, id, draft!.id, draft!.v);
      if (!validate) return { rid, result: null };
      const r = await metrologyService.validateRecord(orgId, rid);
      return { rid, result: r.result };
    },
    onSuccess: ({ rid, result }, validate) => {
      toast.success(validate ? `Registro validado: ${RES[result ?? ""] ?? "—"}` : "Borrador guardado");
      setDraft(null); refresh();
      if (validate && result === "unfit") setDecision({ recordId: rid, d: "repeat", notes: "", uses: "" });
    },
    onError: err,
  });
  const decide = useMutation({
    mutationFn: () => metrologyService.decideUnfit(orgId, decision!.recordId, decision!.d, decision!.notes || null, decision!.uses || null),
    onSuccess: () => { toast.success("Decisión registrada"); setDecision(null); refresh(); }, onError: err,
  });
  const doRectify = useMutation({
    mutationFn: () => metrologyService.rectifyRecord(orgId, rectify!.recordId, rectify!.reason),
    onSuccess: async (newId) => {
      toast.success("Rectificación creada como borrador"); setRectify(null); refresh();
      const recs = await metrologyService.listRecords(orgId, id);
      const r = recs.find((x) => x.id === newId); if (r) openDraft(r);
    }, onError: err,
  });
  const closeImp = useMutation({
    mutationFn: () => metrologyService.closeImpact(orgId, impact!.id, {
      conclusion: impact!.c, justification: impact!.just, actions: impact!.actions || null, periodReviewed: impact!.period || null,
      reviewedOn: impact!.on, externalRef: impact!.extId || impact!.extLabel ? { type: "nc", id: impact!.extId || null, label: impact!.extLabel || null, url: null } : null,
    }),
    onSuccess: () => { toast.success("Evaluación cerrada"); setImpact(null); refresh(); }, onError: err,
  });
  const reactivate = useMutation({
    mutationFn: () => metrologyService.setStatus(orgId, id, "operational", react ?? ""),
    onSuccess: () => { toast.success("Equipo reactivado"); setReact(null); refresh(); }, onError: err,
  });

  const lastValidated = records.find((r) => r.status === "validated");
  const pendingDecision = equipment.status === "unfit" && lastValidated?.result === "unfit" ? lastValidated : null;
  const activePlans = plans.filter((p) => p.active);
  const refCandidates = allEq.filter((e) => e.id !== id && e.status === "operational" && !e.pendingImpact);
  const dv = draft?.v;
  const dPlan = dv && planOf(dv.controlPlanId);
  const agg = dv?.lines.length ? aggregateLines(dv.lines) : null;
  const pending = impacts.filter((i) => i.status === "pending");

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {canRun && (
          <Select value="" onValueChange={(pid) => { const p = planOf(pid); if (p) setDraft({ id: null, v: blank(p) }); }}>
            <SelectTrigger className="w-64"><SelectValue placeholder={activePlans.length ? "Nuevo registro…" : "Sin controles activos"} /></SelectTrigger>
            <SelectContent>{activePlans.map((p) => <SelectItem key={p.id} value={p.id}>{KIND_LABEL[p.kind]} · {p.method === "external" ? "Externo" : "Interno"}</SelectItem>)}</SelectContent>
          </Select>
        )}
        {canClose && pendingDecision && <Button variant="destructive" onClick={() => setDecision({ recordId: pendingDecision.id, d: "repeat", notes: "", uses: "" })}>Decidir ante No apto</Button>}
        {canManage && equipment.status !== "operational" && equipment.status !== "retired" && lastValidated?.result === "fit" &&
          <Button variant="outline" onClick={() => setReact("")}>Reactivar a operativo</Button>}
      </div>

      {pending.map((i) => (
        <Card key={i.id} className="border-destructive"><CardContent className="flex flex-wrap items-center justify-between gap-2 pt-6 text-sm">
          <span className="text-destructive">{IMPACT_NOTICE}</span>
          {canClose && <Button size="sm" onClick={() => setImpact({ id: i.id, c: "no_impact", just: "", actions: "", period: "", on: today(), extId: "", extLabel: "" })}>Cerrar evaluación</Button>}
        </CardContent></Card>
      ))}
      {impacts.filter((i) => i.status === "evaluated").map((i) => (
        <div key={i.id} className="text-sm text-muted-foreground">Evaluación cerrada {i.reviewedOn}: {i.conclusion === "impact" ? "con impacto" : "sin impacto"} · {i.justification}{i.actions ? ` · Acciones: ${i.actions}` : ""}{i.externalRef?.label || i.externalRef?.id ? ` · Ref: ${i.externalRef.label ?? i.externalRef.id}` : ""}</div>
      ))}

      <Card><CardContent className="space-y-2 pt-6 text-sm">
        {records.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-3 border-b pb-2 last:border-0">
            <span className="w-24">{r.performedOn}</span>
            <span>{KIND_LABEL[r.kind]} v{r.version}</span>
            <Badge variant={r.status === "validated" ? "default" : "outline"}>{REC_STATUS[r.status]}</Badge>
            {r.result && <Badge variant={r.result === "fit" ? "secondary" : "destructive"}>{RES[r.result]}</Badge>}
            <span className="text-muted-foreground">Realizado por: {personName(r.performerRef)}</span>
            {r.nextDueOverride ? <span className="text-muted-foreground">Próximo: {r.nextDueOverride} (ajustado)</span> : r.nextDueCalculated && <span className="text-muted-foreground">Próximo: {r.nextDueCalculated}</span>}
            <span className="ml-auto flex gap-2">
              {r.status === "draft" && canRun && <Button size="sm" variant="ghost" onClick={() => openDraft(r)}>Editar</Button>}
              {r.status === "validated" && canClose && <Button size="sm" variant="ghost" onClick={() => setRectify({ recordId: r.id, reason: "" })}>Rectificar</Button>}
            </span>
          </div>
        ))}
        {!records.length && <p className="text-muted-foreground">Sin registros.</p>}
      </CardContent></Card>

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader><DialogTitle>{draft?.id ? "Editar borrador" : "Nuevo registro"} · {dv && KIND_LABEL[dv.kind]}</DialogTitle></DialogHeader>
          {dv && <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Fecha de realización</Label><Input type="date" value={dv.performedOn} onChange={(e) => set({ performedOn: e.target.value })} /></div>
            <div><Label>Realizado por</Label><PersonSelect people={people} value={dv.performerRef} onChange={(v) => set({ performerRef: v })} /></div>
            {dPlan?.method === "external" ? <>
              <div><Label>Laboratorio</Label><Input value={dv.laboratory ?? ""} onChange={(e) => set({ laboratory: e.target.value || null })} /></div>
              <div><Label>Nº de certificado</Label><Input value={dv.certificateNumber ?? ""} onChange={(e) => set({ certificateNumber: e.target.value || null })} /></div>
              <div><Label>Acreditación</Label><Input value={dv.accreditation ?? ""} onChange={(e) => set({ accreditation: e.target.value || null })} /></div>
              <div><Label>Incertidumbre declarada</Label><Input value={dv.declaredUncertainty ?? ""} onChange={(e) => set({ declaredUncertainty: e.target.value || null })} /></div>
              <div><Label>¿Se ajustó o reparó?</Label><Select value={dv.adjustedOrRepaired == null ? NONE : String(dv.adjustedOrRepaired)} onValueChange={(v) => set({ adjustedOrRepaired: v === NONE ? null : v === "true" })}>
                <SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value={NONE}>—</SelectItem><SelectItem value="true">Sí</SelectItem><SelectItem value="false">No</SelectItem></SelectContent></Select></div>
            </> : <div><Label>Equipo patrón</Label><Select value={dv.referenceEquipmentId ?? NONE} onValueChange={(v) => set({ referenceEquipmentId: v === NONE ? null : v })}>
              <SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value={NONE}>Ninguno</SelectItem>{refCandidates.map((e) => <SelectItem key={e.id} value={e.id}>{e.code} · {e.name}</SelectItem>)}</SelectContent></Select>
              <p className="mt-1 text-xs text-muted-foreground">La base comprueba al validar que el patrón es apto en la fecha.</p></div>}

            <div className="sm:col-span-2 space-y-2">
              <div className="flex items-center justify-between"><Label>Mediciones</Label>
                <Button size="sm" variant="outline" onClick={() => set({ lines: [...dv.lines, { position: dv.lines.length + 1, label: "", referenceValue: null, measuredValue: null, tolerance: null, result: null }] })}><Plus className="mr-1 h-3 w-3" />Punto</Button></div>
              {dv.lines.map((l, i) => (
                <div key={i} className="grid grid-cols-[1fr_5rem_5rem_5rem_7rem_auto] items-center gap-1">
                  <Input placeholder="Punto" value={l.label} onChange={(e) => setLine(i, { label: e.target.value })} />
                  <Input placeholder="Ref." type="number" value={l.referenceValue ?? ""} onChange={(e) => setLine(i, { referenceValue: num(e.target.value) })} />
                  <Input placeholder="Medido" type="number" value={l.measuredValue ?? ""} onChange={(e) => setLine(i, { measuredValue: num(e.target.value) })} />
                  <Input placeholder="±Tol." type="number" value={l.tolerance ?? ""} onChange={(e) => setLine(i, { tolerance: num(e.target.value) })} />
                  <Select value={l.result ?? NONE} onValueChange={(v) => setLine(i, { result: v === NONE ? null : (v as "fit") })}><SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value={NONE}>—</SelectItem><SelectItem value="fit">Apto</SelectItem><SelectItem value="unfit">No apto</SelectItem></SelectContent></Select>
                  <Button size="icon" variant="ghost" aria-label="Quitar punto" onClick={() => set({ lines: dv.lines.filter((_, j) => j !== i).map((x, j) => ({ ...x, position: j + 1 })) })}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
              {agg ? <p className="text-sm">Resultado por mediciones: <b>{agg === "incomplete" ? "incompleto" : RES[agg]}</b></p> :
                <div className="w-48"><Label>Resultado</Label><Select value={dv.result ?? NONE} onValueChange={(v) => set({ result: v === NONE ? null : (v as "fit") })}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value={NONE}>—</SelectItem><SelectItem value="fit">Apto</SelectItem><SelectItem value="unfit">No apto</SelectItem></SelectContent></Select></div>}
            </div>

            <div><Label>Ajuste de próxima fecha</Label><Input type="date" value={dv.nextDueOverride ?? ""} onChange={(e) => set({ nextDueOverride: e.target.value || null })} /></div>
            {dv.nextDueOverride && <div><Label>Motivo del ajuste *</Label><Input value={dv.overrideReason ?? ""} onChange={(e) => set({ overrideReason: e.target.value || null })} /></div>}
            <div className="sm:col-span-2"><Label>Observaciones</Label><Textarea value={dv.observations ?? ""} onChange={(e) => set({ observations: e.target.value || null })} /></div>
            {dPlan?.requiresDocument && <p className="sm:col-span-2 text-xs text-muted-foreground">Este control exige documento; el vínculo documental se resolverá con el control documental de ICORE.</p>}
          </div>}
          <DialogFooter>
            <Button variant="outline" onClick={() => save.mutate(false)} disabled={save.isPending}>Guardar borrador</Button>
            {canClose && <Button onClick={() => save.mutate(true)} disabled={save.isPending}>Validar</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!decision} onOpenChange={(o) => !o && setDecision(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Decisión ante No apto</DialogTitle></DialogHeader>
          {decision && <div className="grid gap-3">
            <p className="text-sm text-destructive">{IMPACT_NOTICE}</p>
            <div><Label>Decisión</Label><Select value={decision.d} onValueChange={(v) => setDecision({ ...decision, d: v as MtrUnfitDecision })}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(DECISION_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent></Select></div>
            {decision.d === "restrict" && <div><Label>Usos permitidos *</Label><Textarea value={decision.uses} onChange={(e) => setDecision({ ...decision, uses: e.target.value })} /></div>}
            <div><Label>Notas</Label><Textarea value={decision.notes} onChange={(e) => setDecision({ ...decision, notes: e.target.value })} /></div>
          </div>}
          <DialogFooter><Button onClick={() => decide.mutate()} disabled={decide.isPending}>Registrar decisión</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!rectify} onOpenChange={(o) => !o && setRectify(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rectificar registro validado</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Se crea una nueva versión en borrador; el registro original se conserva y queda sustituido al validar la nueva.</p>
          {rectify && <div><Label>Motivo *</Label><Textarea value={rectify.reason} onChange={(e) => setRectify({ ...rectify, reason: e.target.value })} /></div>}
          <DialogFooter><Button onClick={() => doRectify.mutate()} disabled={doRectify.isPending}>Crear rectificación</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!impact} onOpenChange={(o) => !o && setImpact(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Cerrar evaluación de impacto</DialogTitle></DialogHeader>
          {impact && <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Conclusión</Label><Select value={impact.c} onValueChange={(v) => setImpact({ ...impact, c: v as MtrImpactConclusion })}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="no_impact">Sin impacto</SelectItem><SelectItem value="impact">Con impacto</SelectItem></SelectContent></Select></div>
            <div><Label>Fecha de evaluación</Label><Input type="date" value={impact.on} onChange={(e) => setImpact({ ...impact, on: e.target.value })} /></div>
            <div className="sm:col-span-2"><Label>Periodo revisado</Label><Input value={impact.period} onChange={(e) => setImpact({ ...impact, period: e.target.value })} /></div>
            <div className="sm:col-span-2"><Label>Justificación *</Label><Textarea value={impact.just} onChange={(e) => setImpact({ ...impact, just: e.target.value })} /></div>
            <div className="sm:col-span-2"><Label>Acciones realizadas o previstas{impact.c === "impact" ? " *" : ""}</Label><Textarea value={impact.actions} onChange={(e) => setImpact({ ...impact, actions: e.target.value })} /></div>
            <div><Label>Ref. NC/acción (opcional)</Label><Input value={impact.extId} onChange={(e) => setImpact({ ...impact, extId: e.target.value })} /></div>
            <div><Label>Descripción de la ref.</Label><Input value={impact.extLabel} onChange={(e) => setImpact({ ...impact, extLabel: e.target.value })} /></div>
          </div>}
          <DialogFooter><Button onClick={() => closeImp.mutate()} disabled={closeImp.isPending}>Cerrar evaluación</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={react !== null} onOpenChange={(o) => !o && setReact(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reactivar a operativo</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Decisión explícita. La evaluación de impacto pendiente, si existe, sigue abierta.</p>
          <div><Label>Motivo *</Label><Textarea value={react ?? ""} onChange={(e) => setReact(e.target.value)} /></div>
          <DialogFooter><Button onClick={() => reactivate.mutate()} disabled={reactivate.isPending}>Reactivar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
