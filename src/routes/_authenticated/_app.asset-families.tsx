import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layers, Plus, Trash2, Lock } from "lucide-react";
import { assetService, assetKeys } from "@/modules/maintenance/services/assets";
import { useCompany } from "@/contexts/CompanyContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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

export const Route = createFileRoute("/_authenticated/_app/asset-families")({
  head: () => ({
    meta: [
      { title: "Familias de activos" },
      {
        name: "description",
        content: "Agrupa los tipos de activo en familias para planificar mantenimientos.",
      },
    ],
  }),
  component: AssetFamiliesPage,
});

function AssetFamiliesPage() {
  const { activeCompanyId, activeMembership } = useCompany();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const role = activeMembership?.role;
  const canManage = role === "administrator" || role === "system_manager";

  const { data: families = [], isLoading } = useQuery({
    queryKey: assetKeys.families(activeCompanyId),
    enabled: !!activeCompanyId,
    queryFn: () => assetService.listFamilies(activeCompanyId),
  });

  const { data: types = [] } = useQuery({
    queryKey: assetKeys.typesForFamilies(activeCompanyId),
    enabled: !!activeCompanyId,
    queryFn: () => assetService.listTypes(activeCompanyId),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: assetKeys.families(activeCompanyId) });
    qc.invalidateQueries({ queryKey: assetKeys.typesForFamilies(activeCompanyId) });
    qc.invalidateQueries({ queryKey: assetKeys.typesAdmin(activeCompanyId) });
  };

  const assign = useMutation({
    mutationFn: async ({ typeId, familyId }: { typeId: string; familyId: string | null }) => {
      await assetService.setTypeFamily(activeCompanyId, typeId, familyId);
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleCert = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: boolean }) => {
      await assetService.setFamilyRequiresCertificate(activeCompanyId, id, value);
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await assetService.deleteFamily(activeCompanyId, id);
    },
    onSuccess: () => {
      toast.success("Familia eliminada");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const unassigned = types.filter((t) => !t.family_id);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Familias de activos</h1>
            <p className="text-sm text-muted-foreground">
              Agrupan los tipos de activo (Equipos PCI, Botiquines, Vehículos…)
            </p>
          </div>
        </div>
        {canManage && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nueva familia
              </Button>
            </DialogTrigger>
            <CreateFamilyDialog
              onCreated={() => {
                setOpen(false);
                invalidate();
              }}
            />
          </Dialog>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {families.map((f) => {
            const members = types.filter((t) => t.family_id === f.id);
            return (
              <Card key={f.id}>
                <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: f.color ?? "var(--muted-foreground)" }}
                    />
                    <CardTitle className="text-base">{i18nName(f.name_i18n, f.code)}</CardTitle>
                    {f.is_system ? (
                      <Badge variant="secondary">
                        <Lock className="mr-1 h-3 w-3" />
                        Sistema
                      </Badge>
                    ) : (
                      <Badge variant="outline">Empresa</Badge>
                    )}
                  </div>
                  {canManage && !f.is_system && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (confirm(`¿Eliminar la familia ${i18nName(f.name_i18n, f.code)}?`))
                          remove.mutate(f.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="space-y-3">
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={f.requires_certificate}
                      disabled={!canManage || f.is_system}
                      onCheckedChange={(c) =>
                        toggleCert.mutate({ id: f.id, value: !!c })
                      }
                    />
                    Requiere certificado de mantenimiento
                  </label>
                  <div>
                    <p className="mb-1 text-xs uppercase text-muted-foreground">
                      Tipos incluidos ({members.length})
                    </p>
                    {members.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Sin tipos asignados</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {members.map((t) => (
                          <Badge key={t.id} variant="outline" className="font-normal">
                            {i18nName(t.name_i18n, t.code)}
                            {canManage && (
                              <button
                                type="button"
                                className="ml-1 text-muted-foreground hover:text-destructive"
                                onClick={() => assign.mutate({ typeId: t.id, familyId: null })}
                                aria-label="Quitar de la familia"
                              >
                                ×
                              </button>
                            )}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tipos sin familia ({unassigned.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {unassigned.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todos los tipos tienen familia.</p>
          ) : (
            unassigned.map((t) => (
              <div key={t.id} className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{i18nName(t.name_i18n, t.code)}</span>
                <span className="font-mono text-xs text-muted-foreground">{t.code}</span>
                {canManage && (
                  <Select
                    onValueChange={(v) => assign.mutate({ typeId: t.id, familyId: v })}
                  >
                    <SelectTrigger className="ml-auto w-[220px]">
                      <SelectValue placeholder="Asignar a familia…" />
                    </SelectTrigger>
                    <SelectContent>
                      {families.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {i18nName(f.name_i18n, f.code)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CreateFamilyDialog({ onCreated }: { onCreated: () => void }) {
  const { activeCompanyId } = useCompany();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [color, setColor] = useState("#6366f1");
  const [requiresCert, setRequiresCert] = useState(true);

  const create = useMutation({
    mutationFn: async () => {
      await assetService.createFamily(activeCompanyId, { code, name, color, requiresCertificate: requiresCert });
    },
    onSuccess: () => {
      toast.success("Familia creada");
      onCreated();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Nueva familia de activos</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Código *</Label>
          <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="pci" />
        </div>
        <div className="space-y-2">
          <Label>Nombre *</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Equipos PCI" />
        </div>
        <div className="space-y-2">
          <Label>Color</Label>
          <Input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-20 p-1" />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={requiresCert} onCheckedChange={(c) => setRequiresCert(!!c)} />
          Requiere certificado de mantenimiento
        </label>
      </div>
      <DialogFooter>
        <Button onClick={() => create.mutate()} disabled={create.isPending}>
          {create.isPending ? "Creando…" : "Crear"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
