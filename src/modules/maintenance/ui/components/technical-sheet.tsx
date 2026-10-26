import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { co2eTonnes, formatValue, gwpFor, type TechnicalProfile, type TechnicalValues } from "../../domain/technical-profiles";

/** Formulario genérico a partir de la definición declarativa del perfil. */
export function TechnicalSheetFields({ profile, value, onChange, errors = {}, disabled }: {
  profile: TechnicalProfile; value: Record<string, string>; onChange: (v: Record<string, string>) => void;
  errors?: Record<string, string>; disabled?: boolean;
}) {
  const set = (k: string, v: string) => {
    const next = { ...value, [k]: v };
    if (k === "refrigerant") {
      // Propone el factor documentado; si no hay (p. ej. «Otro»), el usuario lo introduce a mano.
      const ref = gwpFor(v);
      if (ref) { next.gwp = String(ref.gwp); next.gwp_source = ref.source; }
      else if (value.gwp_source && gwpFor(value.refrigerant)) { next.gwp = ""; next.gwp_source = ""; }
    }
    if (k === "gwp" && value.gwp_source && gwpFor(value.refrigerant)?.gwp !== Number(v.replace(",", "."))) next.gwp_source = "Manual";
    onChange(next);
  };
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {profile.attributes.map((a) => (
        <div key={a.key} className="space-y-1.5">
          <Label htmlFor={`tech-${a.key}`}>{a.label}{a.type === "number" && a.unit ? ` (${a.unit})` : ""}</Label>
          {a.type === "enum" ? (
            <Select value={value[a.key] ?? ""} onValueChange={(v) => set(a.key, v === "__none" ? "" : v)} disabled={disabled}>
              <SelectTrigger id={`tech-${a.key}`}><SelectValue placeholder="Sin indicar" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">Sin indicar</SelectItem>
                {a.options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          ) : (
            <Input id={`tech-${a.key}`} inputMode={a.type === "number" ? "decimal" : undefined}
              value={value[a.key] ?? ""} onChange={(e) => set(a.key, e.target.value)} disabled={disabled} />
          )}
          {errors[a.key] ? <p className="text-xs text-destructive">{errors[a.key]}</p>
            : a.help ? <p className="text-xs text-muted-foreground">{a.help}</p> : null}
        </div>
      ))}
    </div>
  );
}

/** Vista de solo lectura. */
export function TechnicalSheetView({ profile, values }: { profile: TechnicalProfile; values: TechnicalValues }) {
  const co2 = profile.attributes.some((a) => a.key === "charge_kg") ? co2eTonnes(values) : null;
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
      {profile.attributes.map((a) => (
        <div key={a.key} className="flex justify-between gap-2 border-b border-border py-1">
          <dt className="text-muted-foreground">{a.label}</dt><dd className="font-medium">{formatValue(a, values[a.key])}</dd>
        </div>
      ))}
      {co2 != null && (
        <div className="flex justify-between gap-2 border-b border-border py-1">
          <dt className="text-muted-foreground">CO₂ equivalente (calculado)</dt><dd className="font-medium">{co2.toLocaleString("es-ES")} t</dd>
        </div>
      )}
    </dl>
  );
}
