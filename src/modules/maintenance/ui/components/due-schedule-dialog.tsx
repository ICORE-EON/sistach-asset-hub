/**
 * Programar / reprogramar próximas fechas de varios equipos de un plan en un solo formulario:
 * una fecha común (directa o calculada desde la última revisión) y excepciones por equipo.
 * El motivo es obligatorio si cambia una fecha ya establecida. La base de datos valida permiso,
 * identidad y deja el cambio en la bitácora.
 */
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { planService } from "../../services/plans";
import { sessionKeys } from "../../services/sessions";

export type DueScheduleRow = { planAssetId: string; code: string; name: string | null; current: string | null };

const fmt = (d: string | null) => (d ? d.split("-").reverse().join("/") : "Sin programar");

export function DueScheduleDialog({ orgId, title, months, rows, open, onOpenChange, onSaved }: {
  orgId: string; title: string; months: number | null; rows: DueScheduleRow[];
  open: boolean; onOpenChange: (o: boolean) => void; onSaved?: () => void;
}) {
  const qc = useQueryClient();
  const [dates, setDates] = useState<Record<string, string>>({});
  const [common, setCommon] = useState("");
  const [lastReview, setLastReview] = useState("");
  const [reason, setReason] = useState("");
  useEffect(() => {
    if (!open) return;
    setDates(Object.fromEntries(rows.map((r) => [r.planAssetId, r.current ?? ""])));
    setCommon(""); setLastReview(""); setReason("");
  }, [open, rows]);

  const changed = useMemo(() => rows.filter((r) => (dates[r.planAssetId] || null) !== (r.current || null)), [rows, dates]);
  const needsReason = changed.some((r) => r.current);
  const applyCommon = (d: string) => setDates(Object.fromEntries(rows.map((r) => [r.planAssetId, d])));

  const save = useMutation({
    mutationFn: () => planService.setDue(orgId, rows.map((r) => ({ planAssetId: r.planAssetId, current: r.current, due: dates[r.planAssetId] || null })), reason),
    onSuccess: (n) => {
      toast.success(n === 1 ? "Fecha guardada" : `${n} fechas guardadas`);
      qc.invalidateQueries({ queryKey: sessionKeys.upcoming(orgId) });
      qc.invalidateQueries({ queryKey: ["plan-assets", orgId] });
      onSaved?.(); onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Programar fechas · {title}</DialogTitle>
          <DialogDescription>Pon una fecha para todos y cambia solo los equipos que sean distintos.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="due-common">Fecha para todos</Label>
            <div className="flex gap-2">
              <Input id="due-common" type="date" value={common} onChange={(e) => setCommon(e.target.value)} />
              <Button type="button" variant="outline" disabled={!common} onClick={() => applyCommon(common)}>Aplicar</Button>
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="due-last">O desde la última revisión</Label>
            <div className="flex gap-2">
              <Input id="due-last" type="date" value={lastReview} onChange={(e) => setLastReview(e.target.value)} />
              <Button type="button" variant="outline" disabled={!lastReview || !months}
                onClick={() => { const d = planService.dueFromLastReview(lastReview, months); if (d) { setCommon(d); applyCommon(d); } }}>
                Calcular
              </Button>
            </div>
          </div>
        </div>
        <div className="max-h-[45vh] overflow-auto rounded-md border">
          <Table>
            <TableHeader><TableRow><TableHead>Equipo</TableHead><TableHead>Fecha actual</TableHead><TableHead>Nueva fecha</TableHead></TableRow></TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.planAssetId}>
                  <TableCell><div className="font-medium">{r.name ?? r.code}</div><div className="font-mono text-xs text-muted-foreground">{r.code}</div></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{fmt(r.current)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Input type="date" className="h-8 w-[150px]" value={dates[r.planAssetId] ?? ""}
                        onChange={(e) => setDates((d) => ({ ...d, [r.planAssetId]: e.target.value }))} aria-label={`Nueva fecha de ${r.code}`} />
                      {dates[r.planAssetId] && (
                        <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs"
                          onClick={() => setDates((d) => ({ ...d, [r.planAssetId]: "" }))}>Sin programar</Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {needsReason && (
          <div className="space-y-1">
            <Label htmlFor="due-reason">Motivo del cambio *</Label>
            <Textarea id="due-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder="Ej.: coordinación con el proveedor" />
            <p className="text-xs text-muted-foreground">Cambiar la fecha no modifica las revisiones ya hechas ni oculta retrasos.</p>
          </div>
        )}
        <DialogFooter>
          <span className="mr-auto self-center text-sm text-muted-foreground">{changed.length} cambio{changed.length === 1 ? "" : "s"}</span>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={!changed.length || (needsReason && !reason.trim()) || save.isPending}>
            {save.isPending ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
