import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PLAN_NATURES, REQUIREMENT_ORIGINS } from "../../domain/plan-classification";

/** Naturaleza + origen del requisito (selección explícita, nunca inferida). */
export function PlanClassificationFields(props: {
  nature: string; origin: string; reference: string;
  onChange: (v: { nature?: string; origin?: string; reference?: string }) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1">
        <Label>Naturaleza *</Label>
        <Select value={props.nature} onValueChange={(nature) => props.onChange({ nature })}>
          <SelectTrigger aria-label="Naturaleza"><SelectValue /></SelectTrigger>
          <SelectContent>
            {PLAN_NATURES.map((n) => <SelectItem key={n.value} value={n.value}>{n.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label>Origen del requisito</Label>
        <Select value={props.origin} onValueChange={(origin) => props.onChange({ origin })}>
          <SelectTrigger aria-label="Origen del requisito"><SelectValue /></SelectTrigger>
          <SelectContent>
            {REQUIREMENT_ORIGINS.map((n) => <SelectItem key={n.value} value={n.value}>{n.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="col-span-2 space-y-1">
        <Label htmlFor="plan-req-ref">Referencia del requisito</Label>
        <Input id="plan-req-ref" maxLength={500} value={props.reference}
          onChange={(e) => props.onChange({ reference: e.target.value })}
          placeholder="Norma, instrucción del fabricante o contrato (opcional)" />
        <p className="text-xs text-muted-foreground">
          Las reparaciones no son planes: se registran como intervenciones correctivas.
        </p>
      </div>
    </div>
  );
}
