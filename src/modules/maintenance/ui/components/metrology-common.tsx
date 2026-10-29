import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { AlertTriangle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { displayStatus, daysUntil, type MtrStoredStatus } from "../../domain/metrology";
import { classifyInstrumentType, INSTRUMENT_TYPE_CATALOG } from "../../domain/metrology-instrument-types";

export const today = () => new Date().toISOString().slice(0, 10);

export const STATUS_LABEL: Record<string, string> = {
  operational: "Operativo", restricted: "Uso restringido", unfit: "No apto", out_of_service: "Fuera de servicio",
  retired: "Retirado", due_soon: "Próximo a vencer", overdue: "Vencido",
};
export const KIND_LABEL: Record<string, string> = { calibration: "Calibración", verification: "Verificación", check: "Comprobación" };
export const METHOD_LABEL: Record<string, string> = { external: "Externo", internal: "Interno" };
export const UNIT_LABEL: Record<string, string> = { days: "días", months: "meses", years: "años", before_use: "Antes de cada uso" };
/** Mismos nombres que los tipos de «Instrumentos de medida y control» del catálogo de inventario. */
export { MEASURING_TYPE_NAMES as TYPE_SUGGESTIONS } from "../../domain/inventory-catalog";

export function StatusBadge({ stored, nextDue }: { stored: MtrStoredStatus; nextDue: string | null }) {
  const s = displayStatus(stored, nextDue, today());
  const variant = s === "operational" ? "default" : s === "due_soon" || s === "restricted" ? "secondary" : "destructive";
  return <Badge variant={variant}>{STATUS_LABEL[s] ?? s}</Badge>;
}

export function daysLeft(nextDue: string | null) {
  return nextDue ? daysUntil(nextDue, today()) : null;
}

export const IMPACT_NOTICE =
  "Evaluación de impacto pendiente: debe revisarse la validez de las mediciones realizadas con este equipo desde el último control conforme.";

export function ImpactBanner() {
  return (
    <div role="alert" className="flex items-start gap-2 rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{IMPACT_NOTICE}</span>
    </div>
  );
}

export const NONE = "__none__";
export function PersonSelect({ people, value, onChange }: { people: { id: string; name: string }[]; value: string | null; onChange: (v: string | null) => void }) {
  return (
    <Select value={value ?? NONE} onValueChange={(v) => onChange(v === NONE ? null : v)}>
      <SelectTrigger><SelectValue /></SelectTrigger>
      <SelectContent><SelectItem value={NONE}>Sin asignar</SelectItem>{people.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
    </Select>
  );
}
const OTHER = "__other__";
/** Structured instrument type: catalog choice or «Otro» with free text; legacy free values are kept and editable. */
export function InstrumentTypeField({ value, onChange, id }: { value: string; onChange: (v: string) => void; id?: string }) {
  const [other, setOther] = useState(false);
  const kind = classifyInstrumentType(value);
  const sel = kind === "catalog" ? value : kind === "other" || other ? OTHER : "";
  return (
    <div className="space-y-2">
      <Select value={sel} onValueChange={(v) => { if (v === OTHER) { setOther(true); if (kind === "catalog") onChange(""); } else { setOther(false); onChange(v); } }}>
        <SelectTrigger id={id} aria-label="Tipo de instrumento"><SelectValue placeholder="Selecciona un tipo" /></SelectTrigger>
        <SelectContent>{INSTRUMENT_TYPE_CATALOG.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}<SelectItem value={OTHER}>Otro…</SelectItem></SelectContent>
      </Select>
      {sel === OTHER && <Input aria-label="Descripción del tipo" placeholder="Describe el tipo de instrumento" value={value} onChange={(e) => onChange(e.target.value)} />}
      {kind === "other" && !other && <p className="text-xs text-muted-foreground">Valor actual fuera del catálogo; se conserva. Puedes elegir un tipo de la lista para corregirlo.</p>}
    </div>
  );
}

export const DECISION_LABEL: Record<string, string> = {
  restrict: "Restringir uso", repair: "Reparar / ajustar", retire: "Retirar", repeat: "Repetir control",
};
