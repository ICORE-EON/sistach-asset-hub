import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Plus } from "lucide-react";
import { toast } from "sonner";
import { useMaintenanceRequest } from "../host";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { metrologyKeys, metrologyService } from "../../services/metrology";
import { displayStatus } from "../../domain/metrology";
import { STATUS_LABEL, StatusBadge, TYPE_SUGGESTIONS, daysLeft, today } from "../components/metrology-common";

const EMPTY = { name: "", equipmentType: "", siteId: "", locationDetail: "", magnitude: "", brand: "", model: "", serialNumber: "" };

export function MetrologyEquipmentListPage() {
  const { orgId, role } = useMaintenanceRequest();
  const canManage = role === "administrator" || role === "system_manager";
  const qc = useQueryClient();
  const [site, setSite] = useState("all");
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(EMPTY);

  const { data: sites = [] } = useQuery({ queryKey: metrologyKeys.sites(orgId), enabled: !!orgId, queryFn: () => metrologyService.listSites(orgId) });
  const { data: items = [], isLoading } = useQuery({ queryKey: metrologyKeys.equipment(orgId), enabled: !!orgId, queryFn: () => metrologyService.listEquipment(orgId) });
  const siteName = useMemo(() => new Map(sites.map((s) => [s.id, s.name])), [sites]);

  const rows = items.filter((e) =>
    (site === "all" || e.siteId === site) &&
    (status === "all" || displayStatus(e.status, e.nextDueOn, today()) === status) &&
    (!q || `${e.code} ${e.name} ${e.equipmentType}`.toLowerCase().includes(q.toLowerCase())));

  const create = useMutation({
    mutationFn: () => metrologyService.createEquipment(orgId, {
      name: f.name, equipmentType: f.equipmentType, siteId: f.siteId, locationDetail: f.locationDetail || null,
      magnitude: f.magnitude || null, brand: f.brand || null, model: f.model || null, serialNumber: f.serialNumber || null,
      intendedUse: null, responsibleRef: null, rangeMin: null, rangeMax: null, unit: null, resolution: null,
      declaredAccuracy: null, restrictions: null, allowedUses: null,
    }),
    onSuccess: () => { toast.success("Equipo creado"); setOpen(false); setF(EMPTY); qc.invalidateQueries({ queryKey: metrologyKeys.all(orgId) }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Equipos de medida</h1>
        {canManage && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-1 h-4 w-4" />Nuevo equipo</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nuevo equipo de medida</DialogTitle></DialogHeader>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2"><Label>Nombre *</Label><Input value={f.name} onChange={set("name")} /></div>
                <div><Label>Tipo *</Label><Input list="mtr-types" value={f.equipmentType} onChange={set("equipmentType")} />
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
              </div>
              <DialogFooter><Button onClick={() => create.mutate()} disabled={create.isPending}>Crear</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
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
            <TableHead>Código</TableHead><TableHead>Nombre</TableHead><TableHead>Tipo</TableHead><TableHead>Site</TableHead>
            <TableHead>Próximo control</TableHead><TableHead>Días</TableHead><TableHead>Estado</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.map((e) => (
              <TableRow key={e.id}>
                <TableCell><Link to="/metrology/equipment/$id" params={{ id: e.id }} className="font-medium underline-offset-2 hover:underline">{e.code}</Link></TableCell>
                <TableCell>{e.name}{e.pendingImpact && <AlertTriangle className="ml-1 inline h-4 w-4 text-destructive" aria-label="Impacto pendiente" />}</TableCell>
                <TableCell>{e.equipmentType}</TableCell>
                <TableCell>{siteName.get(e.siteId) ?? "—"}{e.locationDetail ? ` · ${e.locationDetail}` : ""}</TableCell>
                <TableCell>{e.nextDueOn ?? "—"}</TableCell>
                <TableCell>{daysLeft(e.nextDueOn) ?? "—"}</TableCell>
                <TableCell><StatusBadge stored={e.status} nextDue={e.nextDueOn} /></TableCell>
              </TableRow>
            ))}
            {!rows.length && <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">{isLoading ? "Cargando…" : "Sin equipos"}</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}
