import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Plus } from "lucide-react";
import { toast } from "sonner";
import { useMaintenanceRequest } from "../host";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { metrologyKeys, metrologyService } from "../../services/metrology";
import { displayStatus } from "../../domain/metrology";
import { normalizeAssetSearch } from "../../domain/asset-search";
import { PersonSelect, STATUS_LABEL, StatusBadge, TYPE_SUGGESTIONS, daysLeft, today } from "../components/metrology-common";

const LAST: Record<string, string> = { fit: "Apto", unfit: "No apto", restricted: "Apto con restricciones" };
const EMPTY = { name: "", equipmentType: "", siteId: "", locationDetail: "", magnitude: "", brand: "", model: "", serialNumber: "", responsibleRef: null as string | null };

export function MetrologyEquipmentListPage() {
  const { orgId, role } = useMaintenanceRequest();
  const canManage = role === "administrator" || role === "system_manager";
  const qc = useQueryClient();
  const navigate = useNavigate();
  const origin = useSearch({ from: "/_authenticated/_app/metrology/equipment/" });
  const submitting = useRef(false);
  const [site, setSite] = useState("all");
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(EMPTY);
  const [parentFilter, setParentFilter] = useState("all");
  const [instrumentType, setInstrumentType] = useState("all");
  const [assetType, setAssetType] = useState("all");
  const parent = useQuery({ queryKey: [...metrologyKeys.all(orgId), "inventory-asset", origin.parentAssetId], enabled: !!origin.parentAssetId && !!orgId, queryFn: () => metrologyService.getInventoryAsset(orgId, origin.parentAssetId ?? "") });
  useEffect(() => { setF(EMPTY); setOpen(!!origin.newEquipment); }, [orgId, origin.newEquipment, origin.parentAssetId]);
  const closeCreate = (value: boolean) => {
    if (submitting.current) return;
    setOpen(value);
    if (!value && origin.newEquipment) navigate({ to: "/metrology/equipment", search: {} });
  };

  const { data: sites = [] } = useQuery({ queryKey: metrologyKeys.sites(orgId), enabled: !!orgId, queryFn: () => metrologyService.listSites(orgId) });
  const { data: items = [], isLoading } = useQuery({ queryKey: metrologyKeys.equipment(orgId), enabled: !!orgId, queryFn: () => metrologyService.listEquipment(orgId) });
  const { data: people = [] } = useQuery({ queryKey: metrologyKeys.people(orgId), enabled: !!orgId, queryFn: () => metrologyService.listPeople(orgId) });
  const personName = useMemo(() => new Map(people.map((p) => [p.id, p.name])), [people]);
  const siteName = useMemo(() => new Map(sites.map((s) => [s.id, s.name])), [sites]);

  const rows = items.filter((e) =>
    (site === "all" || e.siteId === site) &&
    (parentFilter === "all" || e.parentAssetId === parentFilter) &&
    (instrumentType === "all" || e.equipmentType === instrumentType) &&
    (assetType === "all" || (e.parentAsset?.typeName ?? e.asset?.typeName) === assetType) &&
    (status === "all" || displayStatus(e.status, e.nextDueOn, today()) === status) &&
    (!q || normalizeAssetSearch([e.asset?.code ?? e.code, e.asset?.name ?? e.name, e.equipmentType, siteName.get(e.siteId), e.parentAsset?.code, e.parentAsset?.name].join(" ")).includes(normalizeAssetSearch(q))));

  const create = useMutation({
    mutationFn: async () => {
      if (submitting.current) throw new Error("El alta ya está en curso");
      if (origin.parentAssetId && !parent.data) throw new Error("Activo principal no disponible");
      submitting.current = true;
      try { return await metrologyService.createEquipment(orgId, {
      name: f.name, equipmentType: f.equipmentType, siteId: f.siteId, locationDetail: f.locationDetail || null,
      magnitude: f.magnitude || null, brand: f.brand || null, model: f.model || null, serialNumber: f.serialNumber || null,
      intendedUse: null, responsibleRef: f.responsibleRef, rangeMin: null, rangeMax: null, unit: null, resolution: null,
      declaredAccuracy: null, restrictions: null, allowedUses: null,
      parentAssetId: origin.parentAssetId ?? null,
    }); } finally { submitting.current = false; }
    },
    onSuccess: (id) => { toast.success("Equipo creado"); setOpen(false); setF(EMPTY); qc.invalidateQueries({ queryKey: metrologyKeys.all(orgId) }); navigate({ to: "/metrology/equipment/$id", params: { id }, replace: true }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Equipos de medida</h1>
        {canManage && (
          <Dialog open={open} onOpenChange={closeCreate}>
            <DialogTrigger asChild><Button><Plus className="mr-1 h-4 w-4" />Nuevo equipo</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nuevo equipo de medida</DialogTitle></DialogHeader>
              {origin.parentAssetId && <div className="text-sm">Activo principal asociado: {parent.data ? <Link to="/assets/$id" params={{ id: parent.data.id }} className="font-medium hover:underline">{parent.data.code} · {parent.data.name ?? "—"}</Link> : parent.isError ? <span className="text-destructive">No disponible</span> : "Cargando…"}</div>}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2"><Label>Nombre *</Label><Input value={f.name} onChange={set("name")} /></div>
                <div><Label>Tipo de instrumento *</Label><Input placeholder="Por ejemplo: manómetro" list="mtr-types" value={f.equipmentType} onChange={set("equipmentType")} />
                  <datalist id="mtr-types">{TYPE_SUGGESTIONS.map((t) => <option key={t} value={t} />)}</datalist></div>
                <div><Label>Magnitud</Label><Input value={f.magnitude} onChange={set("magnitude")} /></div>
                <div><Label>Site *</Label>
                  <Select value={f.siteId} onValueChange={(v) => setF({ ...f, siteId: v })}>
                    <SelectTrigger><SelectValue placeholder={sites.length ? "Selecciona site" : "No hay sites"} /></SelectTrigger>
                    <SelectContent>{sites.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                  </Select></div>
                <div><Label>Ubicación dentro del site</Label><Input value={f.locationDetail} onChange={set("locationDetail")} /></div>
                <div><Label>Marca</Label><Input value={f.brand} onChange={set("brand")} /></div>
                <div><Label>Modelo</Label><Input value={f.model} onChange={set("model")} /></div>
                <div><Label>Nº de serie</Label><Input value={f.serialNumber} onChange={set("serialNumber")} /></div>
                <div><Label>Responsable</Label><PersonSelect people={people} value={f.responsibleRef} onChange={(v) => setF({ ...f, responsibleRef: v })} /></div>
              </div>
              <DialogFooter><Button variant="outline" onClick={() => closeCreate(false)} disabled={create.isPending}>Cancelar</Button><Button onClick={() => create.mutate()} disabled={create.isPending || !f.name.trim() || !f.equipmentType.trim() || !f.siteId || (!!origin.parentAssetId && !parent.data)}>Crear</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Select value={parentFilter} onValueChange={setParentFilter}><SelectTrigger className="w-56"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos los activos principales</SelectItem>{Array.from(new Map(items.filter((e) => e.parentAsset).map((e) => [e.parentAssetId, e.parentAsset])).values()).map((a) => a && <SelectItem key={a.id} value={a.id}>{a.code} · {a.name ?? "—"}</SelectItem>)}</SelectContent></Select>
        <Select value={instrumentType} onValueChange={setInstrumentType}><SelectTrigger className="w-48"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos los instrumentos</SelectItem>{[...new Set(items.map((e) => e.equipmentType))].sort().map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select>
        <Select value={assetType} onValueChange={setAssetType}><SelectTrigger className="w-48"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos los tipos de activo</SelectItem>{[...new Set(items.map((e) => e.parentAsset?.typeName ?? e.asset?.typeName).filter((t): t is string => !!t))].sort().map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select>
        <Input placeholder="Buscar código, nombre o tipo" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
        <Select value={site} onValueChange={setSite}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">Todos los sites</SelectItem>{sites.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">Todos los estados</SelectItem>
            {Object.entries(STATUS_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Código</TableHead><TableHead>Nombre</TableHead><TableHead>Tipo</TableHead><TableHead>Activo principal asociado</TableHead><TableHead>Site</TableHead><TableHead>Responsable</TableHead>
            <TableHead>Última verificación</TableHead><TableHead>Próximo control</TableHead><TableHead>Días</TableHead><TableHead>Estado</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.map((e) => (
              <TableRow key={e.id}>
                <TableCell><Link to="/metrology/equipment/$id" params={{ id: e.id }} className="font-medium underline-offset-2 hover:underline">{e.asset?.code ?? e.code}</Link></TableCell>
                <TableCell>{e.asset?.name ?? e.name}{e.asset && <Link to="/assets/$id" params={{ id: e.asset.id }} className="block text-xs text-muted-foreground hover:underline">Activo del inventario (misma identidad)</Link>}{e.pendingImpact && <AlertTriangle className="ml-1 inline h-4 w-4 text-destructive" aria-label="Impacto pendiente" />}</TableCell>
                <TableCell>{e.equipmentType}</TableCell>
                <TableCell>{e.parentAsset ? <Link to="/assets/$id" params={{ id: e.parentAsset.id }} className="hover:underline">{e.parentAsset.code} · {e.parentAsset.name ?? "—"}</Link> : "—"}</TableCell>
                <TableCell>{siteName.get(e.siteId) ?? "—"}{e.asset ? (e.asset.locationName ? ` · ${e.asset.locationName}` : "") : e.locationDetail ? ` · ${e.locationDetail}` : ""}</TableCell>
                <TableCell>{(e.responsibleRef && personName.get(e.responsibleRef)) ?? "—"}</TableCell>
                <TableCell>{e.lastResult ? <Badge variant={e.lastResult === "fit" ? "secondary" : e.lastResult === "restricted" ? "outline" : "destructive"}>{LAST[e.lastResult]}</Badge> : "—"}</TableCell>
                <TableCell>{e.nextDueOn ?? "—"}</TableCell>
                <TableCell>{daysLeft(e.nextDueOn) ?? "—"}</TableCell>
                <TableCell><StatusBadge stored={e.status} nextDue={e.nextDueOn} /></TableCell>
              </TableRow>
            ))}
            {!rows.length && <TableRow><TableCell colSpan={11} className="py-8 text-center text-muted-foreground">{isLoading ? "Cargando…" : "Sin equipos"}</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}
