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
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { metrologyKeys, metrologyService } from "../../services/metrology";
import { normalizeAssetSearch } from "../../domain/asset-search";
import { InstrumentTypeField, StatusBadge } from "./metrology-common";
import { mergeLinkedInstruments } from "../../domain/metrology-instrument-types";

type AssetLite = { id: string; code: string; name: string | null; location_id: string | null; serial_number: string | null; manufacturer: string | null; model: string | null };

export function AssetMetrologyCard({ orgId, asset, typeName, canManage }: { orgId: string; asset: AssetLite; typeName: string | null; canManage: boolean }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const link = useQuery({ queryKey: [...metrologyKeys.all(orgId), "by-asset", asset.id], enabled: !!orgId, queryFn: () => metrologyService.findByAsset(orgId, asset.id) });
  const eqId = link.data ?? null;
  const [open, setOpen] = useState(false);
  const [associateOpen, setAssociateOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const instruments = useQuery({ queryKey: metrologyKeys.equipment(orgId), queryFn: () => metrologyService.listEquipment(orgId) });
  const linked = mergeLinkedInstruments(instruments.data ?? [], asset.id);
  const available = (instruments.data ?? []).filter((e) => !e.parentAssetId && normalizeAssetSearch([e.asset?.code ?? e.code, e.asset?.name ?? e.name, e.equipmentType, e.asset?.locationName, e.locationDetail].join(" ")).includes(normalizeAssetSearch(search)));
  const associate = useMutation({
    mutationFn: () => metrologyService.associateEquipment(orgId, asset.id, selected),
    onSuccess: () => { toast.success("Instrumentos asociados"); setAssociateOpen(false); setSelected([]); qc.invalidateQueries({ queryKey: metrologyKeys.all(orgId) }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const { data: sites = [] } = useQuery({ queryKey: metrologyKeys.sites(orgId), enabled: open, queryFn: () => metrologyService.listSites(orgId) });
  const [siteId, setSiteId] = useState("");
  const [eqType, setEqType] = useState("");
  const create = useMutation({
    mutationFn: () => metrologyService.createEquipment(orgId, {
      name: asset.name ?? asset.code, equipmentType: eqType, siteId: siteId || (sites.some((s) => s.id === asset.location_id) ? (asset.location_id ?? "") : ""),
      locationDetail: null, magnitude: null, intendedUse: null, responsibleRef: null, brand: asset.manufacturer, model: asset.model,
      serialNumber: asset.serial_number, rangeMin: null, rangeMax: null, unit: null, resolution: null, declaredAccuracy: null,
      restrictions: null, allowedUses: null, assetId: asset.id,
    }),
    onSuccess: (id) => { toast.success("Metrología activada"); setOpen(false); qc.invalidateQueries({ queryKey: metrologyKeys.all(orgId) }); navigate({ to: "/metrology/equipment/$id", params: { id } }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const defaultSite = sites.some((s) => s.id === asset.location_id) ? (asset.location_id ?? "") : "";

  return (
    <Card className="lg:col-span-3">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base"><Gauge className="h-4 w-4" />Metrología</CardTitle>

      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="space-y-2">
          <h3 className="font-medium">Equipos de medida asociados</h3>
          <p className="text-muted-foreground">Instrumentos instalados o asociados a este activo, con sus propios controles de calibración y verificación.</p>
          {instruments.isError ? <p className="text-destructive">No se pudieron cargar los equipos.</p> : linked.length ? <ul className="divide-y rounded-md border">{linked.map((e) => (
            <li key={e.id}><Link to="/metrology/equipment/$id" params={{ id: e.id }} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 hover:bg-muted">
              <span className="font-medium">{e.asset?.name ?? e.name}</span>
              <span className="font-mono text-xs text-muted-foreground">{e.code}</span>
              <span className="text-xs text-muted-foreground">{e.relation === "identity" ? "Equipo del inventario" : "Instrumento asociado"}</span>
              <span className="ml-auto flex items-center gap-2"><StatusBadge stored={e.status} nextDue={e.nextDueOn} /><span className="text-muted-foreground">Próximo control: {e.nextDueOn ?? "sin programar"}</span></span>
            </Link></li>
          ))}</ul> : <p className="text-muted-foreground">{instruments.isLoading || link.isLoading ? "Cargando…" : "Sin equipos de medida vinculados"}</p>}
          {canManage && <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => { setSelected([]); setSearch(""); setAssociateOpen(true); }}>Vincular equipo existente</Button>
            <Button asChild size="sm"><Link to="/metrology/equipment" search={{ newEquipment: true, parentAssetId: asset.id }}>Nuevo equipo de medida</Link></Button>
          </div>}
        </div>
        <div className="border-t pt-3" />
        <div className="space-y-2">
          <h3 className="font-medium">Control metrológico del propio activo</h3>
          <p className="text-muted-foreground">Utiliza esta opción si el propio activo es un instrumento de medida que necesita calibraciones o verificaciones. Se gestionará desde Activos y Metrología, sin crear otro equipo físico. Así podrás asociarlo tanto a planes de mantenimiento como a planes de calibración o verificación.</p>
          {eqId ? (
            <Button asChild size="sm" variant="outline"><Link to="/metrology/equipment/$id" params={{ id: eqId }}>Ver controles metrológicos</Link></Button>
          ) : (
            <p className="text-muted-foreground">{link.isLoading ? "Cargando…" : "Este activo todavía no tiene control metrológico propio."}</p>
          )}
          {canManage && !eqId && !link.isLoading && <Button size="sm" variant="outline" onClick={() => { setSiteId(""); setOpen(true); }}>Añadir control metrológico al activo</Button>}
        </div>
      </CardContent>
      <Dialog open={associateOpen} onOpenChange={setAssociateOpen}>
        <DialogContent><DialogHeader><DialogTitle>Vincular equipos existentes · {asset.code}</DialogTitle></DialogHeader>
          <Input aria-label="Buscar instrumentos" placeholder="Buscar código, nombre, tipo o ubicación" value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="max-h-72 space-y-2 overflow-y-auto">
            {available.slice(0, 100).map((e) => <label key={e.id} className="flex items-start gap-2 rounded-md border p-2 text-sm">
              <Checkbox checked={selected.includes(e.id)} onCheckedChange={(v) => setSelected((s) => v ? [...s, e.id] : s.filter((x) => x !== e.id))} />
              <span>{e.asset?.code ?? e.code} · {e.asset?.name ?? e.name}<span className="block text-muted-foreground">{e.equipmentType}</span></span>
            </label>)}
            {!available.length && <p className="text-sm text-muted-foreground">Sin instrumentos disponibles</p>}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setAssociateOpen(false)}>Cancelar</Button><Button disabled={!selected.length || associate.isPending} onClick={() => associate.mutate()}>Vincular ({selected.length})</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Activar metrología · {asset.code}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Control metrológico opcional para este equipo ya registrado. Su nombre y ubicación se gestionan en Activos.</p>
          <div className="space-y-3">
            <div><Label>Tipo de instrumento</Label><InstrumentTypeField value={eqType} onChange={setEqType} /></div>
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
    mutationFn: () => metrologyService.linkAsset(orgId, equipmentId, sel ?? ""),
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
