import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Tag, Plus, Trash2, Lock } from "lucide-react";
import { assetService, assetKeys } from "@/modules/maintenance/services/assets";
import { useCompany } from "@/contexts/CompanyContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { i18nName } from "@/lib/i18n-name";

export const Route = createFileRoute("/_authenticated/_app/asset-types")({
  head: () => ({ meta: [{ title: "Tipos de activo" }] }),
  component: AssetTypesPage,
});

const CATEGORIES = [
  { value: "extinguisher", label: "Extintor" },
  { value: "aed", label: "Desfibrilador (DEA)" },
  { value: "first_aid_kit", label: "Botiquín" },
  { value: "vehicle", label: "Vehículo" },
  { value: "elevator", label: "Ascensor" },
  { value: "other", label: "Otro" },
];

function AssetTypesPage() {
  const { activeCompanyId, activeMembership } = useCompany();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const role = activeMembership?.role;
  const canManage = role === "administrator" || role === "system_manager";

  const { data: types = [], isLoading } = useQuery({
    queryKey: assetKeys.typesAdmin(activeCompanyId),
    enabled: !!activeCompanyId,
    queryFn: () => assetService.listTypesAdmin(activeCompanyId),
  });

  const { data: families = [] } = useQuery({
    queryKey: assetKeys.families(activeCompanyId),
    enabled: !!activeCompanyId,
    queryFn: () => assetService.listFamilies(activeCompanyId),
  });

  const setFamily = useMutation({
    mutationFn: async ({ typeId, familyId }: { typeId: string; familyId: string }) => {
      await assetService.setTypeFamily(activeCompanyId, typeId, familyId);
    },
    onSuccess: () => {
      toast.success("Familia actualizada");
      qc.invalidateQueries({ queryKey: assetKeys.typesAdmin(activeCompanyId) });
      qc.invalidateQueries({ queryKey: assetKeys.typesForFamilies(activeCompanyId) });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await assetService.deleteType(activeCompanyId, id);
    },
    onSuccess: () => {
      toast.success("Tipo eliminado");
      qc.invalidateQueries({ queryKey: assetKeys.typesAdmin(activeCompanyId) });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Tag className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Tipos de activo</h1>
            <p className="text-sm text-muted-foreground">
              Plantillas reutilizables para clasificar tu inventario
            </p>
          </div>
        </div>
        {canManage && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nuevo tipo
              </Button>
            </DialogTrigger>
            <CreateTypeDialog
              onCreated={() => {
                setOpen(false);
                qc.invalidateQueries({ queryKey: assetKeys.typesAdmin(activeCompanyId) });
                qc.invalidateQueries({ queryKey: assetKeys.types(activeCompanyId) });
              }}
            />
          </Dialog>
        )}
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Familia</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Origen</TableHead>
              <TableHead className="w-[60px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  Cargando…
                </TableCell>
              </TableRow>
            ) : (
              types.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-mono text-xs">{t.code}</TableCell>
                  <TableCell className="font-medium">{i18nName(t.name_i18n, t.code)}</TableCell>
                  <TableCell>
                    {canManage ? (
                      <Select
                        value={t.family_id ?? ""}
                        onValueChange={(v) => setFamily.mutate({ typeId: t.id, familyId: v })}
                      >
                        <SelectTrigger className="h-8 w-[190px]">
                          <SelectValue placeholder="Sin familia" />
                        </SelectTrigger>
                        <SelectContent>
                          {families.map((f) => (
                            <SelectItem key={f.id} value={f.id}>
                              {i18nName(f.name_i18n, f.code)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="text-sm">
                        {i18nName(
                          families.find((f) => f.id === t.family_id)?.name_i18n,
                          families.find((f) => f.id === t.family_id)?.code ?? "—",
                        )}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm capitalize">{t.category}</TableCell>
                  <TableCell>
                    {t.is_system ? (
                      <Badge variant="secondary">
                        <Lock className="mr-1 h-3 w-3" />
                        Sistema
                      </Badge>
                    ) : (
                      <Badge variant="outline">Empresa</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {canManage && !t.is_system && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm(`¿Eliminar tipo ${t.code}?`)) remove.mutate(t.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function CreateTypeDialog({ onCreated }: { onCreated: () => void }) {
  const { activeCompanyId } = useCompany();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("other");
  const [familyId, setFamilyId] = useState("");

  const { data: families = [] } = useQuery({
    queryKey: assetKeys.families(activeCompanyId),
    enabled: !!activeCompanyId,
    queryFn: () => assetService.listFamilies(activeCompanyId),
  });

  const create = useMutation({
    mutationFn: async () => {
      await assetService.createType(activeCompanyId, { code, name, category, familyId });
    },
    onSuccess: () => {
      toast.success("Tipo creado");
      onCreated();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Nuevo tipo de activo</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Código *</Label>
          <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="EXT-PORT-6KG" />
        </div>
        <div className="space-y-2">
          <Label>Nombre *</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Extintor portátil 6kg" />
        </div>
        <div className="space-y-2">
          <Label>Familia</Label>
          <Select value={familyId} onValueChange={setFamilyId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecciona familia" />
            </SelectTrigger>
            <SelectContent>
              {families.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {i18nName(f.name_i18n, f.code)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Categoría</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter>
        <Button onClick={() => create.mutate()} disabled={create.isPending}>
          {create.isPending ? "Creando…" : "Crear"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
