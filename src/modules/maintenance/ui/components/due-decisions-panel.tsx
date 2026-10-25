/**
 * Próxima fecha al cerrar una revisión. Sin fricción en lo normal: los equipos realizados avanzan a la
 * propuesta (fecha real + frecuencia) sin preguntar. Solo se muestran para decidir los casos excepcionales:
 * con incidencias, «No aplica», no realizados, o cuando existe la alternativa «Mantener calendario».
 * Cada equipo conserva su propia fecha prevista; nunca se impone una fecha común por estar en la misma sesión.
 */
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { DueDecision } from "../../contracts/repositories";
import { decisionNeedsReason, defaultDecision } from "../../domain/due-date";

export type DuePanelRow = {
  item_id: string; code: string | null; name: string | null; result: string; linked: boolean;
  planned_on: string | null; proposed_on: string | null; calendar_on: string | null;
};
type Choice = "proposed" | "calendar" | "custom" | "keep";
export type DueChoices = Record<string, { choice?: Choice; custom?: string; reason?: string }>;

const fmt = (d: string | null) => (d ? d.split("-").reverse().join("/") : "—");
const RESULT: Record<string, string> = { ok: "Correcto", with_incident: "Con incidencias", not_applicable: "No aplica", skipped: "No realizado", pending: "Sin revisar" };

const isExceptional = (r: DuePanelRow) => r.linked && (r.result !== "ok" || !!r.calendar_on);
const defaultChoice = (r: DuePanelRow): Choice | undefined => {
  const d = defaultDecision(r.result);
  return d === "advance" ? "proposed" : d === "keep" ? "keep" : undefined;
};

/** Decisions to send (only rows that differ from the default) and the first blocking error, if any. */
export function buildDueDecisions(rows: DuePanelRow[], state: DueChoices): { decisions: DueDecision[]; error: string | null } {
  const decisions: DueDecision[] = [];
  for (const r of rows) {
    if (!r.linked) continue;
    const st = state[r.item_id] ?? {};
    const choice = st.choice ?? defaultChoice(r);
    if (!choice) return { decisions, error: `Decide la próxima fecha de ${r.code ?? "un equipo"} («No aplica»)` };
    const action = choice === "keep" ? "keep" : "advance";
    const due = choice === "proposed" ? r.proposed_on : choice === "calendar" ? r.calendar_on : choice === "custom" ? st.custom || null : null;
    if (action === "advance" && !due) return { decisions, error: `Indica la próxima fecha de ${r.code ?? "un equipo"}` };
    const needs = decisionNeedsReason({ result: r.result, action, due, proposed: r.proposed_on, calendar: r.calendar_on });
    if (needs && !st.reason?.trim()) return { decisions, error: `Indica el motivo para ${r.code ?? "un equipo"}` };
    if (st.choice === undefined && defaultChoice(r) && !st.reason) continue; // default → the server applies it
    decisions.push({ itemId: r.item_id, action, due: action === "advance" ? due : null, reason: st.reason?.trim() || null });
  }
  return { decisions, error: null };
}

export function DueDecisionsPanel({ rows, value, onChange, disabled }: {
  rows: DuePanelRow[]; value: DueChoices; onChange: (v: DueChoices) => void; disabled?: boolean;
}) {
  const [showAll, setShowAll] = useState(false);
  const linked = rows.filter((r) => r.linked);
  if (!linked.length) return null;
  const exceptional = linked.filter(isExceptional);
  const normal = linked.length - exceptional.length;
  const visible = showAll ? linked : exceptional;
  const set = (id: string, patch: DueChoices[string]) => onChange({ ...value, [id]: { ...value[id], ...patch } });

  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">Próxima fecha</p>
        <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowAll((x) => !x)}>
          {showAll ? "Ver solo excepciones" : "Ver todos"}
        </Button>
      </div>
      {normal > 0 && !showAll && (
        <p className="text-xs text-muted-foreground">
          {normal} equipo{normal === 1 ? "" : "s"} correcto{normal === 1 ? "" : "s"}: la siguiente fecha será la fecha real + la frecuencia del plan.
        </p>
      )}
      {visible.length > 0 && (
        <div className="max-h-[40vh] space-y-2 overflow-auto">
          {visible.map((r) => {
            const st = value[r.item_id] ?? {};
            const choice = st.choice ?? defaultChoice(r);
            const action = choice === "keep" ? "keep" : "advance";
            const due = choice === "proposed" ? r.proposed_on : choice === "calendar" ? r.calendar_on : choice === "custom" ? st.custom || null : null;
            const needs = !!choice && decisionNeedsReason({ result: r.result, action, due, proposed: r.proposed_on, calendar: r.calendar_on });
            const canAdvance = r.result !== "skipped" && r.result !== "pending";
            const late = r.planned_on && r.proposed_on && r.calendar_on && r.calendar_on < r.proposed_on;
            return (
              <div key={r.item_id} className="space-y-1 rounded border p-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs">{r.code}</span>
                  <span className="truncate">{r.name}</span>
                  <Badge variant={r.result === "ok" ? "outline" : "secondary"} className="text-[10px]">{RESULT[r.result] ?? r.result}</Badge>
                  <span className="ml-auto text-xs text-muted-foreground">Prevista: {fmt(r.planned_on)}{late ? " · realizada con retraso" : ""}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Select value={choice ?? ""} disabled={disabled} onValueChange={(v) => set(r.item_id, { choice: v as Choice })}>
                    <SelectTrigger className="h-8 w-[260px]"><SelectValue placeholder="Elige qué hacer…" /></SelectTrigger>
                    <SelectContent>
                      {canAdvance && r.proposed_on && <SelectItem value="proposed">Siguiente: {fmt(r.proposed_on)} (propuesta)</SelectItem>}
                      {canAdvance && r.calendar_on && <SelectItem value="calendar">Mantener calendario: {fmt(r.calendar_on)}</SelectItem>}
                      {canAdvance && <SelectItem value="custom">Otra fecha…</SelectItem>}
                      <SelectItem value="keep">{canAdvance ? "No avanzar (sigue pendiente)" : "Sigue pendiente"}</SelectItem>
                    </SelectContent>
                  </Select>
                  {choice === "custom" && (
                    <Input type="date" className="h-8 w-[150px]" value={st.custom ?? ""} disabled={disabled}
                      onChange={(e) => set(r.item_id, { custom: e.target.value })} aria-label={`Próxima fecha de ${r.code}`} />
                  )}
                </div>
                {needs && (
                  <Input className="h-8" placeholder="Motivo *" value={st.reason ?? ""} disabled={disabled}
                    onChange={(e) => set(r.item_id, { reason: e.target.value })} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
