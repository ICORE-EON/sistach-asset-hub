/**
 * Portable "Execution and closing" panel for a session: assigned operators, justified exceptions
 * (close permission only), and the closing summary. No router or host-auth imports.
 */
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, Smartphone, Users } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMaintenanceRequest } from "../host";
import { EXCEPTION_LABELS, makeContext, scanKeys, scanService } from "../../services/scan";
import type { ClosureExceptionCode } from "../../contracts/scan";

type Item = { id: string; result: string; code: string; name: string | null };
type Summary = { executors?: { name: string | null; items: number }[] } | null;

const errMsg = (e: unknown) => (e instanceof Error ? e.message : (e as { message?: string })?.message ?? "No se pudo completar");

export function SessionExecutionPanel({ orgId, sessionId, status, isExternal, items, closeSummary, onOpenRun, onChanged }: {
  orgId: string | null; sessionId: string; status: string; isExternal: boolean; items: Item[];
  closeSummary: unknown; onOpenRun: () => void; onChanged: () => void;
}) {
  const { userId, role } = useMaintenanceRequest();
  const qc = useQueryClient();
  const ctx = orgId ? makeContext(orgId, userId, role) : null;
  const canClose = !!ctx?.permissions.close;
  const open = status === "draft" || status === "in_progress";
  const available = scanService.available() && !!ctx;

  const { data: people = [] } = useQuery({
    queryKey: scanKeys.people(orgId, sessionId), enabled: available,
    queryFn: () => scanService.listSessionPeople(ctx!, sessionId),
  });
  const { data: exceptions = [] } = useQuery({
    queryKey: scanKeys.exceptions(orgId, sessionId), enabled: available,
    queryFn: () => scanService.listSessionExceptions(ctx!, sessionId),
  });
  const [sel, setSel] = useState<Set<string>>(new Set());
  useEffect(() => { setSel(new Set(people.filter((p) => p.assigned).map((p) => p.userId))); }, [people]);
  const assign = useMutation({
    mutationFn: () => scanService.assignSessionPeople(ctx!, sessionId, [...sel]),
    onSuccess: (n) => { toast.success(`${n} operario(s) asignado(s)`); qc.invalidateQueries({ queryKey: scanKeys.people(orgId, sessionId) }); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const [excItem, setExcItem] = useState<Item | null>(null);

  if (!available || isExternal) return null;
  const assigned = people.filter((p) => p.assigned || p.technician);
  const pending = items.filter((i) => i.result === "pending");
  const byItem = new Map(items.map((i) => [i.id, i]));
  const summary = closeSummary as Summary;

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-sm">Ejecución y cierre</CardTitle>
        {status === "in_progress" && (
          <Button size="sm" variant="outline" onClick={onOpenRun}><Smartphone className="mr-2 h-4 w-4" />Ejecutar en móvil</Button>
        )}
      </CardHeader>
      <CardContent className="space-y-5 text-sm">
        <section className="space-y-2">
          <p className="flex items-center gap-1.5 font-medium"><Users className="h-4 w-4" />Operarios autorizados</p>
          {canClose && open ? (
            <div className="space-y-2">
              <div className="grid gap-1.5 sm:grid-cols-2">
                {people.map((p) => (
                  <label key={p.userId} className="flex items-center gap-2">
                    <Checkbox checked={sel.has(p.userId)} onCheckedChange={(v) => {
                      const n = new Set(sel); if (v) n.add(p.userId); else n.delete(p.userId); setSel(n);
                    }} />
                    <span>{p.name}</span>
                    {p.technician && <Badge variant="outline" className="text-[10px]">Técnico</Badge>}
                  </label>
                ))}
              </div>
              <Button size="sm" onClick={() => assign.mutate()} disabled={assign.isPending}>Guardar asignación</Button>
            </div>
          ) : (
            <p className="text-muted-foreground">{assigned.length ? assigned.map((p) => p.name).join(", ") : "Sin operarios asignados"}</p>
          )}
          <p className="text-xs text-muted-foreground">Solo los operarios asignados (o el técnico de la sesión) y los responsables con permiso de cierre pueden ejecutarla.</p>
        </section>

        {canClose && status === "in_progress" && pending.length > 0 && (
          <section className="space-y-2">
            <p className="font-medium">Pendientes ({pending.length})</p>
            <ul className="space-y-1">
              {pending.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-2">
                  <span className="truncate"><span className="font-mono text-xs">{i.code}</span> {i.name}</span>
                  <Button size="sm" variant="ghost" onClick={() => setExcItem(i)}><Ban className="mr-1.5 h-3.5 w-3.5" />Excepción</Button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {exceptions.length > 0 && (
          <section className="space-y-1">
            <p className="font-medium">Excepciones registradas</p>
            <ul className="space-y-1">
              {exceptions.map((x) => (
                <li key={x.itemId} className="rounded-md border p-2">
                  <span className="font-mono text-xs">{byItem.get(x.itemId)?.code ?? "—"}</span> · {EXCEPTION_LABELS[x.code]}: {x.text}
                  <span className="block text-xs text-muted-foreground">{x.byName ?? "—"} · {format(new Date(x.at), "dd/MM/yyyy HH:mm")}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {summary?.executors && summary.executors.length > 0 && (
          <section className="space-y-1">
            <p className="font-medium">Ejecutores</p>
            <p className="text-muted-foreground">{summary.executors.map((e) => `${e.name ?? "—"} (${e.items})`).join(", ")}</p>
          </section>
        )}
      </CardContent>
      {excItem && ctx && (
        <ExceptionDialog item={excItem} onClose={() => setExcItem(null)} onSave={async (code, text) => {
          await scanService.recordClosureException(ctx, excItem.id, code, text);
          toast.success("Excepción registrada");
          qc.invalidateQueries({ queryKey: scanKeys.exceptions(orgId, sessionId) });
          onChanged(); setExcItem(null);
        }} />
      )}
    </Card>
  );
}

function ExceptionDialog({ item, onClose, onSave }: { item: Item; onClose: () => void; onSave: (c: ClosureExceptionCode, t: string) => Promise<void> }) {
  const [code, setCode] = useState<ClosureExceptionCode>("not_applicable");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Excepción de cierre · {item.code}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">El equipo constará como «Excepción», nunca como revisado, con tu nombre, la fecha y el motivo.</p>
          <div className="space-y-1.5">
            <Label>Motivo</Label>
            <Select value={code} onValueChange={(v) => setCode(v as ClosureExceptionCode)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(EXCEPTION_LABELS) as ClosureExceptionCode[]).map((k) => <SelectItem key={k} value={k}>{EXCEPTION_LABELS[k]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Explicación *</Label>
            <Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Volver</Button>
          <Button disabled={busy || text.trim().length < 3} onClick={async () => {
            setBusy(true);
            try { await onSave(code, text); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
          }}>Registrar excepción</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
