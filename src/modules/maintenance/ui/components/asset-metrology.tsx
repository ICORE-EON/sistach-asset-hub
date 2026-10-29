/**
 * Optional metrology for an inventory asset: one physical identity (the asset), metrology control on demand.
 * Linking is set-once and same-org; the database enforces it (guard trigger + unique index).
 */
import { Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Gauge, Link2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { metrologyKeys, metrologyService } from "../../services/metrology";
import { normalizeAssetSearch } from "../../domain/asset-search";
import { StatusBadge } from "./metrology-common";

type AssetLite = { id: string; code: string; name: string | null; location_id: string | null; serial_number: string | null; manufacturer: string | null; model: string | null };

export function AssetMetrologyCard({ orgId, asset, typeName, canManage }: { orgId: string; asset: AssetLite; typeName: string | null; canManage: boolean }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const link = useQuery({ queryKey: [...metrologyKeys.all(orgId), "by-asset", asset.id], enabled: !!orgId, queryFn: () => metrologyService.findByAsset(orgId, asset.id) });
  const eqId = link.data ?? null;
  const eq = useQuery({ queryKey: metrologyKeys.detail(orgId, eqId ?? "-"), enabled: !!eqId, queryFn: () => metrologyService.getEquipment(orgId, eqId!) });
  const plans = useQuery({ queryKey: metrologyKeys.plans(orgId, eqId ?? "-"), enabled: !!eqId, queryFn: () => metrologyService.listPlans(orgId, eqId!) });
  const [open, setOpen] = useState(false);
  const { data: sites = [] } = useQuery({ queryKey: metrologyKeys.sites(orgId), enabled: open, queryFn: () => metrologyService.listSites(orgId) });
  const [siteId, setSiteId] = useState("");
  const [eqType, setEqType] = useState(typeName ?? "");
  const create = useMutation({
    mutationFn: () => metrologyService.createEquipment(orgId, {
      name: asset.name ?? asset.code, equipmentType: eqType, siteId: siteId || (sites.some((s) => s.id === asset.location_id) ? asset.location_id! : ""),
      locationDetail: null, magnitude: null, intendedUse: null, responsibleRef: null, brand: asset.manufacturer, model: asset.model,
      serialNumber: asset.serial_number, rangeMin: null, rangeMax: null, unit: null, resolution: null, declaredAccuracy: null,
      restrictions: null, allowedUses: null, assetId: asset.id,
    }),
    onSuccess: (id) => { toast.success("Metrología activada"); setOpen(false); qc.invalidateQueries({ queryKey: metrologyKeys.all(orgId) }); navigate({ to: "/metrology/equipment/$id", params: { id } }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const nextDue = (plans.data ?? []).filter((p) => p.active && p.nextDueOn).map((p) => p.nextDueOn!).sort()[0] ?? null;
  const defaultSite = sites.some((s) => s.id === asset.location_id) ? asset.location_id! : "";

  return (
    <Card className="lg:col-span-3">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base"><Gauge className="h-4 w-4" />Metrología</CardTitle>
        {eqId ? (
          <Button asChild size="sm" variant="outline"><Link to="/metrology/equipment/$id" params={{ id: eqId }}>Gestionar metrología</Link></Button>
        ) : canManage && !link.isLoading ? (
          <Button size="sm" variant="outline" onClick={() => { setSiteId(""); setOpen(true); }}>Activar metrología</Button>
        ) : null}
      </CardHeader>
      <CardContent className="text-sm">
        {link.isLoading ? <span className="text-muted-foreground">Cargando…</span> : eqId && eq.data ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-xs">{eq.data.code}</span>
            <StatusBadge stored={eq.data.status} nextDue={nextDue} />
            <span className="text-muted-foreground">Próximo control: {nextDue ?? "sin programar"}</span>
          </div>
        ) : (
          <span className="text-muted-foreground">Sin control metrológico. Actívalo solo si este equipo necesita calibración o verificación.</span>
        )}
      </CardContent>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Activar metrología · {asset.code}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Se usará este mismo equipo del inventario; no se crea otro equipo físico. Código, nombre y ubicación se leen siempre de Activos.</p>
          <div className="space-y-3">
            <div><Label>Tipo de instrumento</Label><Input value={eqType} onChange={(e) => setEqType(e.target.value)} /></div>
            <div><Label>Site (centro) de control</Label>
              <Select value={siteId || defaultSite} onValueChange={setSiteId}>
                <SelectTrigger><SelectValue placeholder="Selecciona un site" /></SelectTrigger>
                <SelectContent>{sites.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button disabled={create.isPending || !eqType.trim() || !(siteId || defaultSite)} onClick={() => create.mutate()}>Activar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/** Links an existing unlinked metrology equipment to an inventory asset (search by code/name/type/location). */
export function LinkAssetDialog({ orgId, equipmentId, open, onOpenChange }: { orgId: string; equipmentId: string; open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string | null>(null);
  const { data: assets = [], isLoading } = useQuery({ queryKey: [...metrologyKeys.all(orgId), "linkable"], enabled: open, queryFn: () => metrologyService.listLinkableAssets(orgId) });
  const shown = useMemo(() => {
    const n = normalizeAssetSearch(q);
    const list = n ? assets.filter((a) => normalizeAssetSearch([a.code, a.name, a.typeName, a.locationName].filter(Boolean).join(" ")).includes(n)) : assets;
    return list.slice(0, 50);
  }, [assets, q]);
  const save = useMutation({
    mutationFn: () => metrologyService.linkAsset(orgId, equipmentId, sel!),
    onSuccess: () => { toast.success("Equipo vinculado al activo"); onOpenChange(false); qc.invalidateQueries({ queryKey: metrologyKeys.all(orgId) }); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Link2 className="h-4 w-4" />Vincular a activo del inventario</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">El vínculo es definitivo. Solo aparecen activos sin metrología asignada.</p>
        <Input placeholder="Buscar por código, nombre, tipo o ubicación" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar activo" />
        <div className="max-h-72 space-y-1 overflow-y-auto" role="listbox" aria-label="Activos">
          {isLoading ? <p className="text-sm text-muted-foreground">Cargando…</p> : shown.length === 0 ? <p className="text-sm text-muted-foreground">Sin resultados</p> : shown.map((a) => (
            <button key={a.id} type="button" role="option" aria-selected={sel === a.id} onClick={() => setSel(a.id)}
              className={`w-full rounded-md border px-3 py-2 text-left text-sm ${sel === a.id ? "border-primary bg-accent" : "border-border hover:bg-muted"}`}>
              <span className="font-mono text-xs">{a.code}</span> · {a.name ?? "—"}
              <span className="block text-xs text-muted-foreground">{[a.typeName, a.locationName].filter(Boolean).join(" · ") || "—"}</span>
            </button>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={!sel || save.isPending} onClick={() => save.mutate()}>Vincular</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
