import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FREQUENCIES } from "../../services/plans";

type Values = { name: string; frequency: string; customYears: number | null; notes: string | null };

export function PlanEditDialog(props: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  plan: { name: string; frequency: string; interval_months: number | null; notes: string | null };
  onSave: (v: Values) => Promise<void>;
}) {
  const { plan, open } = props;
  const [v, setV] = useState<Values>({ name: "", frequency: "annual", customYears: null, notes: null });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    setError(null);
    setV({ name: plan.name, frequency: plan.frequency, notes: plan.notes,
      customYears: plan.frequency === "custom" ? Math.max(1, Math.round((plan.interval_months ?? 12) / 12)) : null });
  }, [open, plan]);
  const freqChanged = v.frequency !== plan.frequency
    || (v.frequency === "custom" && (v.customYears ?? 0) * 12 !== plan.interval_months);
  const save = async () => {
    setBusy(true); setError(null);
    try { await props.onSave(v); props.onOpenChange(false); }
    catch (e) { setError(e instanceof Error ? e.message : (e as { message?: string })?.message ?? String(e)); }
    finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={props.onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar plan</DialogTitle>
          <DialogDescription>Los cambios no modifican las próximas fechas ya programadas.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="plan-edit-name">Nombre *</Label>
            <Input id="plan-edit-name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>Frecuencia</Label>
            <Select value={v.frequency} onValueChange={(f) => setV({ ...v, frequency: f, customYears: f === "custom" ? v.customYears ?? 2 : null })}>
              <SelectTrigger aria-label="Frecuencia"><SelectValue /></SelectTrigger>
              <SelectContent>
                {FREQUENCIES.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
              </SelectContent>
            </Select>
            {v.frequency === "custom" && (
              <Input type="number" min={1} aria-label="Años" value={v.customYears ?? ""}
                onChange={(e) => setV({ ...v, customYears: e.target.value ? Number(e.target.value) : null })} />
            )}
            {freqChanged && (
              <p className="text-xs text-muted-foreground">
                La nueva frecuencia se aplicará a las revisiones que se creen a partir de ahora. Las revisiones ya abiertas mantienen la frecuencia con la que se crearon y las fechas programadas no cambian.
              </p>
            )}
          </div>
          <div className="space-y-1">
            <Label htmlFor="plan-edit-notes">Notas</Label>
            <Textarea id="plan-edit-notes" rows={3} value={v.notes ?? ""} onChange={(e) => setV({ ...v, notes: e.target.value })} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => props.onOpenChange(false)}>Volver</Button>
          <Button disabled={busy} onClick={save}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
