/**
 * Primera fecha de un lote de equipos al crear un plan o añadir equipos: sin programar (por defecto),
 * fecha prevista directa, o calculada desde la última revisión. Un solo gesto para todo el lote;
 * las excepciones se cambian después con «Programar fechas». La fecha de inicio del vínculo no es
 * el vencimiento.
 */
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { planService } from "../../services/plans";

type Mode = "none" | "date" | "last";
const fmt = (d: string) => d.split("-").reverse().join("/");

export function InitialDuePicker({ months, onChange }: {
  /** Intervalo del plan en meses (null = aún no se puede sugerir desde la última revisión). */
  months: number | null;
  /** Fecha común resultante, o null = sin programar. */
  onChange: (due: string | null) => void;
}) {
  const [mode, setMode] = useState<Mode>("none");
  const [date, setDate] = useState("");
  const [lastReview, setLastReview] = useState("");

  const suggested = mode === "last" && lastReview ? planService.dueFromLastReview(lastReview, months) : null;
  useEffect(() => {
    onChange(mode === "date" ? date || null : mode === "last" ? suggested : null);
    // onChange es estable en los padres (setState)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, date, suggested]);

  return (
    <div className="space-y-2 rounded-lg border p-3">
      <Label className="text-xs uppercase text-muted-foreground">Primera fecha de los equipos</Label>
      <RadioGroup value={mode} onValueChange={(v) => setMode(v as Mode)} className="gap-2">
        <div className="flex items-center gap-2">
          <RadioGroupItem value="none" id="due-none" />
          <Label htmlFor="due-none" className="font-normal">Sin programar (se decide después)</Label>
        </div>
        <div className="flex items-center gap-2">
          <RadioGroupItem value="date" id="due-date" />
          <Label htmlFor="due-date" className="font-normal">Fecha prevista</Label>
          {mode === "date" && (
            <Input type="date" className="h-8 w-[160px]" value={date} onChange={(e) => setDate(e.target.value)}
              aria-label="Primera fecha prevista" />
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <RadioGroupItem value="last" id="due-last" disabled={!months} />
          <Label htmlFor="due-last" className="font-normal">Última revisión ya hecha</Label>
          {mode === "last" && (
            <>
              <Input type="date" className="h-8 w-[160px]" value={lastReview} onChange={(e) => setLastReview(e.target.value)}
                aria-label="Fecha de la última revisión" />
              {suggested && <span className="text-xs text-muted-foreground">→ próxima sugerida: {fmt(suggested)}</span>}
            </>
          )}
        </div>
      </RadioGroup>
      {mode !== "none" && (
        <p className="text-xs text-muted-foreground">
          Se aplicará a todos los equipos; podrás cambiar excepciones desde «Programar fechas».
        </p>
      )}
    </div>
  );
}
