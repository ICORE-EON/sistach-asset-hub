import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";
import { displayStatus, daysUntil, type MtrStoredStatus } from "../../domain/metrology";

export const today = () => new Date().toISOString().slice(0, 10);

export const STATUS_LABEL: Record<string, string> = {
  operational: "Operativo", restricted: "Uso restringido", unfit: "No apto", out_of_service: "Fuera de servicio",
  retired: "Retirado", due_soon: "Próximo a vencer", overdue: "Vencido",
};
export const KIND_LABEL: Record<string, string> = { calibration: "Calibración", verification: "Verificación", check: "Comprobación" };
export const METHOD_LABEL: Record<string, string> = { external: "Externo", internal: "Interno" };
export const UNIT_LABEL: Record<string, string> = { days: "días", months: "meses", years: "años", before_use: "Antes de cada uso" };
export const TYPE_SUGGESTIONS = ["Calibre", "Micrómetro", "Manómetro", "Termómetro", "Balanza", "Multímetro", "Cinta métrica", "Torquímetro"];

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
