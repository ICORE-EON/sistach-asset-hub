import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Boxes, Plus, Search, QrCode } from "lucide-react";
import { assetService, assetKeys } from "@/modules/maintenance/services/assets";
import { useCompany } from "@/contexts/CompanyContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { i18nName } from "@/lib/i18n-name";

export const Route = createFileRoute("/_authenticated/_app/assets/")({
  head: () => ({ meta: [{ title: "Activos" }] }),
  component: AssetsList,
});

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  maintenance: "secondary",
  retired: "outline",
  broken: "destructive",
};

function AssetsList() {
  const { activeCompanyId, activeMembership } = useCompany();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [familyFilter, setFamilyFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [locationFilter, setLocationFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);

  const role = activeMembership?.role;
  const canManage = role === "administrator" || role === "system_manager";

  const { data: types = [] } = useQuery({
    queryKey: assetKeys.types(activeCompanyId),
    enabled: !!activeCompanyId,
    queryFn: () => assetService.listTypes(activeCompanyId),
  });

  const { data: families = [] } = useQuery({
    queryKey: assetKeys.families(activeCompanyId),
    enabled: !!activeCompanyId,
    queryFn: () => assetService.listFamilies(activeCompanyId),
  });

  const { data: locations = [] } = useQuery({
    queryKey: assetKeys.sites(activeCompanyId),
    enabled: !!activeCompanyId,
    queryFn: () => assetService.listActiveSites(activeCompanyId),
  });

  const { data: assets = [], isLoading } = useQuery({
    queryKey: assetKeys.list(activeCompanyId, statusFilter, familyFilter, typeFilter, locationFilter, q),
    enabled: !!activeCompanyId,
    queryFn: () =>
      assetService.listAssets(activeCompanyId, {
        status: statusFilter !== "all" ? statusFilter : undefined,
        typeIds:
          typeFilter !== "all"
            ? [typeFilter]
            : familyFilter !== "all"
              ? types.filter((t) => t.family_id === familyFilter).map((t) => t.id)
              : null,
        siteId: locationFilter !== "all" ? locationFilter : undefined,
        q,
      }),
  });

  const typeMap = useMemo(() => Object.fromEntries(types.map((t) => [t.id, t])), [types]);

  const visibleTypes = useMemo(
    () =>
      familyFilter === "all"
        ? types
        : types.filter((t) => t.family_id === familyFilter),
    [types, familyFilter],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Boxes className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Activos</h1>
            <p className="text-sm text-muted-foreground">
              {assets.length} equipo{assets.length === 1 ? "" : "s"} en el inventario
            </p>
          </div>
        </div>
        {canManage && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nuevo activo
              </Button>
            </DialogTrigger>
            <CreateAssetDialog
              types={types}
              locations={locations}
              onCreated={() => {
                setOpen(false);
                qc.invalidateQueries({ queryKey: ["assets"] });
              }}
            />
          </Dialog>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por código, nombre, nº de serie…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={familyFilter}
          onValueChange={(v) => {
            setFamilyFilter(v);
            // Si el tipo seleccionado deja de pertenecer a la familia, se reinicia
            if (v !== "all") {
              const t = types.find((x) => x.id === typeFilter);
              if (typeFilter !== "all" && t && t.family_id !== v) setTypeFilter("all");
            }
          }}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Familia" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las familias</SelectItem>
            {families.map((f) => (
              <SelectItem key={f.id} value={f.id}>
                {i18nName(f.name_i18n, f.code)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            {visibleTypes.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {i18nName(t.name_i18n, t.code)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={locationFilter} onValueChange={setLocationFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Ubicación" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las ubicaciones</SelectItem>
            {locations.map((l) => (
              <SelectItem key={l.id} value={l.id}>
                {l.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="active">Activo</SelectItem>
            <SelectItem value="maintenance">En mantenimiento</SelectItem>
            <SelectItem value="broken">Averiado</SelectItem>
            <SelectItem value="retired">Retirado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Ubicación</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  Cargando…
                </TableCell>
              </TableRow>
            ) : assets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  No hay activos. {canManage && "Crea el primero con el botón superior."}
                </TableCell>
              </TableRow>
            ) : (
              assets.map((a) => {
                const t = a.asset_type_id ? typeMap[a.asset_type_id] : null;
                return (
                  <TableRow key={a.id} className="cursor-pointer">
                    <TableCell className="font-mono text-xs">
                      <Link to="/assets/$id" params={{ id: a.id }} className="hover:underline">
                        {a.code}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link to="/assets/$id" params={{ id: a.id }} className="font-medium hover:underline">
                        {a.name ?? "—"}
                      </Link>
                      {(a.manufacturer || a.model) && (
                        <div className="text-xs text-muted-foreground">
                          {[a.manufacturer, a.model].filter(Boolean).join(" · ")}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {t ? i18nName(t.name_i18n, t.code) : "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {a.locations ? `${a.locations.name}` : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[a.status] ?? "secondary"}>{a.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <Link to="/assets/$id" params={{ id: a.id }}>
                        <Button variant="ghost" size="icon">
                          <QrCode className="h-4 w-4" />
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function CreateAssetDialog({
  types,
  locations,
  onCreated,
}: {
  types: Array<{ id: string; code: string; name_i18n: unknown; is_system: boolean }>;
  locations: Array<{ id: string; code: string; name: string }>;
  onCreated: () => void;
}) {
  const { activeCompanyId } = useCompany();
  const [name, setName] = useState("");
  const [assetTypeId, setAssetTypeId] = useState<string>("");
  const [locationId, setLocationId] = useState<string>("");
  const [manufacturer, setManufacturer] = useState("");
  const [model, setModel] = useState("");
  const [serial, setSerial] = useState("");
  const [installDate, setInstallDate] = useState("");
  const [notes, setNotes] = useState("");

  const create = useMutation({
    mutationFn: async () => {
      if (!activeCompanyId) throw new Error("No hay empresa activa");
      await assetService.createAsset(activeCompanyId, {
        asset_type_id: assetTypeId,
        location_id: locationId || null,
        name: name || null,
        manufacturer: manufacturer || null,
        model: model || null,
        serial_number: serial || null,
        install_date: installDate || null,
        notes: notes || null,
      });
    },
    onSuccess: () => {
      toast.success("Activo creado");
      onCreated();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>Nuevo activo</DialogTitle>
        <DialogDescription>El código se genera automáticamente (AST-AAAA-####).</DialogDescription>
      </DialogHeader>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label>Nombre</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Desfibrilador planta 1" />
        </div>
        <div className="space-y-2">
          <Label>Tipo *</Label>
          <Select value={assetTypeId} onValueChange={setAssetTypeId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecciona tipo" />
            </SelectTrigger>
            <SelectContent>
              {types.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {i18nName(t.name_i18n, t.code)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Ubicación</Label>
          <Select value={locationId} onValueChange={setLocationId}>
            <SelectTrigger>
              <SelectValue placeholder="Sin asignar" />
            </SelectTrigger>
            <SelectContent>
              {locations.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Fabricante</Label>
          <Input value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Modelo</Label>
          <Input value={model} onChange={(e) => setModel(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Nº de serie</Label>
          <Input value={serial} onChange={(e) => setSerial(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Fecha instalación</Label>
          <Input type="date" value={installDate} onChange={(e) => setInstallDate(e.target.value)} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>Notas</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
        </div>
      </div>
      <DialogFooter>
        <Button onClick={() => create.mutate()} disabled={create.isPending || !assetTypeId}>
          {create.isPending ? "Creando…" : "Crear activo"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
