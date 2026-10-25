import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { ArrowLeft, Archive, Printer, RotateCcw, Trash2, Save } from "lucide-react";
import { assetService, assetKeys } from "../../services/assets";
import { useMaintenanceRequest, useMaintenanceUi } from "../host";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { i18nName } from "../../domain/i18n-name";
import { FirstAidKitPanel } from "../components/first-aid-kit-panel";
import { AssetHistoryPanel } from "../components/asset-history-panel";
import { SafeDeleteDialog } from "../components/safe-actions";


export function AssetDetailPage() {
  const { id } = useParams({ from: "/_authenticated/_app/assets/$id" });
  const { orgId: activeCompanyId, role } = useMaintenanceRequest();
  const { Attachments: AttachmentsPanel } = useMaintenanceUi();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const canManage = role === "administrator" || role === "system_manager";
  const canDelete = role === "administrator";

  const { data: asset, isLoading } = useQuery({
    queryKey: assetKeys.detail(activeCompanyId, id),
    enabled: !!activeCompanyId,
    queryFn: () => assetService.getAsset(activeCompanyId, id),
  });

  const { data: types = [] } = useQuery({
    queryKey: assetKeys.types(activeCompanyId),
    enabled: !!activeCompanyId,
    queryFn: () => assetService.listTypes(activeCompanyId),
  });

  const { data: locations = [] } = useQuery({
    queryKey: [...assetKeys.sites(activeCompanyId), "all"],
    enabled: !!activeCompanyId,
    queryFn: () => assetService.listSites(activeCompanyId),
  });

  const [form, setForm] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!asset) return;
    setForm({
      name: asset.name ?? "",
      asset_type_id: asset.asset_type_id ?? "",
      location_id: asset.location_id ?? "",
      manufacturer: asset.manufacturer ?? "",
      model: asset.model ?? "",
      serial_number: asset.serial_number ?? "",
      install_date: asset.install_date ?? "",
      warranty_until: asset.warranty_until ?? "",
      status: asset.status,
      notes: asset.notes ?? "",
    });
  }, [asset]);

  const update = useMutation({
    mutationFn: async () => {
      await assetService.updateAsset(activeCompanyId, id, {
          name: form.name || null,
          asset_type_id: form.asset_type_id,
          location_id: form.location_id || null,
          manufacturer: form.manufacturer || null,
          model: form.model || null,
          serial_number: form.serial_number || null,
          install_date: form.install_date || null,
          warranty_until: form.warranty_until || null,
          status: form.status,
          notes: form.notes || null,
        });
    },
    onSuccess: () => {
      toast.success("Activo actualizado");
      qc.invalidateQueries({ queryKey: assetKeys.detail(activeCompanyId, id) });
      qc.invalidateQueries({ queryKey: assetKeys.list(activeCompanyId) });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setStatus = useMutation({
    mutationFn: (status: string) => assetService.updateAsset(activeCompanyId, id, { status }),
    onSuccess: (_d, status) => {
      toast.success(status === "retired" ? "Activo retirado: deja de aparecer en Próximos y conserva su historial" : "Activo reactivado");
      setForm((f) => (f ? { ...f, status } : f));
      qc.invalidateQueries({ queryKey: assetKeys.detail(activeCompanyId, id) });
      qc.invalidateQueries({ queryKey: assetKeys.list(activeCompanyId) });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const [deleteOpen, setDeleteOpen] = useState(false);
  const checkDelete = useCallback(() => assetService.deleteAssetPermanently(activeCompanyId, id, false), [activeCompanyId, id]);

  if (isLoading || !asset) {
    return <div className="p-6 text-sm text-muted-foreground">Cargando…</div>;
  }

  const qrUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/qr/${asset.qr_token}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link to="/assets">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{asset.name ?? asset.code}</h1>
              <Badge variant="outline">{asset.status}</Badge>
            </div>
            <p className="font-mono text-xs text-muted-foreground">{asset.code}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {canManage && (asset.status === "retired" ? (
            <Button variant="outline" size="sm" disabled={setStatus.isPending} onClick={() => setStatus.mutate("active")}>
              <RotateCcw className="mr-2 h-4 w-4" />Reactivar
            </Button>
          ) : (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm"><Archive className="mr-2 h-4 w-4" />Retirar</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Retirar este activo?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Dejará de aparecer en Próximos y en nuevas revisiones. Su historial, documentos y certificados se conservan y podrás reactivarlo.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Volver</AlertDialogCancel>
                  <AlertDialogAction onClick={() => setStatus.mutate("retired")}>Retirar</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ))}
          {canDelete && (
            <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="mr-2 h-4 w-4" />Eliminar
            </Button>
          )}
        </div>
        <SafeDeleteDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          title={`Eliminar ${asset.code}`}
          check={checkDelete}
          confirm={() => assetService.deleteAssetPermanently(activeCompanyId, id, true)}
          blockedHint="Si ya no se usa, retíralo: saldrá de Próximos y conservará su historial."
          impact={(c) => (
            <>
              <p>Es un alta sin actividad: se puede eliminar.</p>
              {!!c.remove?.plan_links && <p>Se quitará de {c.remove.plan_links} plan(es) (queda constancia en el registro de fechas).</p>}
              {!!c.remove?.kit_items && <p>Se borrará su contenido de botiquín ({c.remove.kit_items}).</p>}
            </>
          )}
          onDeleted={() => {
            toast.success("Activo eliminado");
            qc.invalidateQueries({ queryKey: assetKeys.list(activeCompanyId) });
            navigate({ to: "/assets" });
          }}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Información del equipo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Nombre">
                <Input
                  value={form.name ?? ""}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  disabled={!canManage}
                />
              </Field>
              <Field label="Estado">
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm({ ...form, status: v })}
                  disabled={!canManage}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Activo</SelectItem>
                    <SelectItem value="maintenance">En mantenimiento</SelectItem>
                    <SelectItem value="broken">Averiado</SelectItem>
                    <SelectItem value="retired">Retirado</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Tipo">
                <Select
                  value={form.asset_type_id ?? ""}
                  onValueChange={(v) => setForm({ ...form, asset_type_id: v })}
                  disabled={!canManage}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {types.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {i18nName(t.name_i18n, t.code)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Ubicación">
                <Select
                  value={form.location_id ?? ""}
                  onValueChange={(v) => setForm({ ...form, location_id: v })}
                  disabled={!canManage}
                >
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
              </Field>
              <Field label="Fabricante">
                <Input
                  value={form.manufacturer ?? ""}
                  onChange={(e) => setForm({ ...form, manufacturer: e.target.value })}
                  disabled={!canManage}
                />
              </Field>
              <Field label="Modelo">
                <Input
                  value={form.model ?? ""}
                  onChange={(e) => setForm({ ...form, model: e.target.value })}
                  disabled={!canManage}
                />
              </Field>
              <Field label="Nº de serie">
                <Input
                  value={form.serial_number ?? ""}
                  onChange={(e) => setForm({ ...form, serial_number: e.target.value })}
                  disabled={!canManage}
                />
              </Field>
              <Field label="Fecha instalación">
                <Input
                  type="date"
                  value={form.install_date ?? ""}
                  onChange={(e) => setForm({ ...form, install_date: e.target.value })}
                  disabled={!canManage}
                />
              </Field>
              <Field label="Garantía hasta">
                <Input
                  type="date"
                  value={form.warranty_until ?? ""}
                  onChange={(e) => setForm({ ...form, warranty_until: e.target.value })}
                  disabled={!canManage}
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Notas">
                  <Textarea
                    value={form.notes ?? ""}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    rows={3}
                    disabled={!canManage}
                  />
                </Field>
              </div>
            </div>
            {canManage && (
              <div className="mt-6 flex justify-end">
                <Button onClick={() => update.mutate()} disabled={update.isPending}>
                  <Save className="mr-2 h-4 w-4" />
                  {update.isPending ? "Guardando…" : "Guardar cambios"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Etiqueta QR</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <div className="rounded-lg border bg-white p-4 print:border-0">
              <QRCodeSVG value={qrUrl} size={180} level="M" />
            </div>
            <div className="text-center">
              <p className="font-mono text-xs text-muted-foreground">{asset.code}</p>
              <p className="text-sm font-medium">{asset.name ?? "—"}</p>
            </div>
            <Button variant="outline" size="sm" className="w-full" onClick={() => window.print()}>
              <Printer className="mr-2 h-4 w-4" />
              Imprimir etiqueta
            </Button>
            <p className="text-center text-xs text-muted-foreground break-all">{qrUrl}</p>
          </CardContent>
        </Card>

        {asset.asset_types?.category === "first_aid_kit" && (
          <div className="lg:col-span-3">
            <FirstAidKitPanel assetId={id} canManage={canManage} />
          </div>
        )}

        <div className="lg:col-span-3">
          <AssetHistoryPanel assetId={id} />

      <AttachmentsPanel entity="asset" entityId={id} defaultCategory="asset_manual" />
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
