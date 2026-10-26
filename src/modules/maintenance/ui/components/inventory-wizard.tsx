import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { INVENTORY_GROUPS, planImport } from "../../domain/inventory-catalog";
import { getProfile } from "../../domain/technical-profiles";
import { assetService } from "../../services/assets";

type Fam = { id: string; code: string };
type Typ = { code: string };

export function InventoryWizard({ open, onOpenChange, orgId, families, types }: {
  open: boolean; onOpenChange: (v: boolean) => void; orgId: string | null; families: Fam[]; types: Typ[];
}) {
  const qc = useQueryClient();
  const [step, setStep] = useState<1 | 2>(1);
  const [groups, setGroups] = useState<string[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const existingTypes = useMemo(() => new Set(types.map((t) => t.code.toUpperCase())), [types]);
  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const goStep2 = () => {
    const sug = INVENTORY_GROUPS.filter((g) => groups.includes(g.code)).flatMap((g) => g.types.filter((t) => !t.optional).map((t) => t.code));
    setPicked(sug.filter((c) => !existingTypes.has(c)));
    setStep(2);
  };

  const run = useMutation({
    mutationFn: async () => {
      const plan = planImport(picked, { familyCodes: families.map((f) => f.code), typeCodes: [...existingTypes] });
      for (const g of plan.families) await assetService.createFamily(orgId, { code: g.code, name: g.name, color: g.color, requiresCertificate: false });
      const fams = (await assetService.listFamilies(orgId)) as Fam[];
      const famId = (code: string) => fams.find((f) => f.code === code)?.id ?? "";
      for (const t of plan.types)
        await assetService.createType(orgId, { code: t.code, name: t.name, category: t.group, familyId: famId(t.group), technicalProfile: t.profile });
      return plan.types.length;
    },
    onSuccess: (n) => {
      toast.success(n ? `${n} tipo${n === 1 ? "" : "s"} añadido${n === 1 ? "" : "s"}` : "No había nada nuevo que añadir");
      qc.invalidateQueries();
      onOpenChange(false); setStep(1); setGroups([]); setPicked([]);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setStep(1); }}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Configurar inventario</DialogTitle>
          <DialogDescription>
            {step === 1 ? "Elige qué tipos de instalaciones tiene tu empresa." : "Marca los tipos que quieres añadir. No se crea ningún equipo."}
          </DialogDescription>
        </DialogHeader>
        {step === 1 ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {INVENTORY_GROUPS.map((g) => (
              <label key={g.code} className="flex cursor-pointer items-center gap-3 rounded-md border border-border p-3 hover:bg-muted/50">
                <Checkbox checked={groups.includes(g.code)} onCheckedChange={() => setGroups(toggle(groups, g.code))} />
                <span className="text-sm font-medium">{g.name}</span>
              </label>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {INVENTORY_GROUPS.filter((g) => groups.includes(g.code)).map((g) => (
              <div key={g.code} className="space-y-1.5">
                <p className="text-sm font-semibold">{g.name}</p>
                {g.types.map((t) => {
                  const exists = existingTypes.has(t.code);
                  return (
                    <label key={t.code} className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50">
                      <Checkbox disabled={exists} checked={!exists && picked.includes(t.code)} onCheckedChange={() => setPicked(toggle(picked, t.code))} />
                      <span className="flex-1 text-sm">{t.name}{t.optional && <span className="ml-1 text-xs text-muted-foreground">(opcional)</span>}</span>
                      {exists ? <Badge variant="secondary">Ya existe</Badge>
                        : <Badge variant="outline">{t.profile ? `Ficha: ${getProfile(t.profile)?.label}` : "Datos generales"}</Badge>}
                    </label>
                  );
                })}
              </div>
            ))}
          </div>
        )}
        <DialogFooter>
          {step === 1 ? (
            <Button disabled={!groups.length} onClick={goStep2}>Ver tipos sugeridos</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep(1)}>Atrás</Button>
              <Button disabled={!picked.length || run.isPending} onClick={() => run.mutate()}>
                Añadir {picked.length} tipo{picked.length === 1 ? "" : "s"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
