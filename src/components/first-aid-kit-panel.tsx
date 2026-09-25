import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Pencil, BriefcaseMedical, Save, X } from "lucide-react";
import { toast } from "sonner";
import { assetService, assetKeys } from "@/modules/maintenance/services/assets";
import { useCompany } from "@/contexts/CompanyContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FIRST_AID_PRODUCTS, slugProductCode } from "@/lib/import/entities";

interface KitItem {
  id: string;
  product_code: string | null;
  product_name: string;
  quantity: number;
  unit: string | null;
  batch_code: string | null;
  expires_on: string | null;
  notes: string | null;
}

const EMPTY = {
  id: "",
  product_code: "",
  product_name: "",
  quantity: "1",
  unit: "ud",
  batch_code: "",
  expires_on: "",
  notes: "",
};

function expiryTone(expires: string | null): { label: string; cls: string } | null {
  if (!expires) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(`${expires}T00:00:00`);
  const days = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (days < 0) return { label: "Caducado", cls: "bg-destructive/10 text-destructive border-destructive/30" };
  if (days <= 60)
    return {
      label: `Caduca en ${days} d`,
      cls: "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
    };
  return {
    label: "Correcto",
    cls: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
  };
}

export function FirstAidKitPanel({ assetId, canManage }: { assetId: string; canManage: boolean }) {
  const qc = useQueryClient();
  const { activeCompanyId } = useCompany();
  const kitKey = assetKeys.kit(activeCompanyId, assetId);
  const [editing, setEditing] = useState<typeof EMPTY | null>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: kitKey,
    enabled: !!activeCompanyId,
    queryFn: async () => (await assetService.listKitItems(activeCompanyId, assetId)) as KitItem[],
  });

  const summary = useMemo(() => {
    let expired = 0;
    let soon = 0;
    for (const i of items) {
      const t = expiryTone(i.expires_on);
      if (t?.label === "Caducado") expired++;
      else if (t?.label.startsWith("Caduca")) soon++;
    }
    return { expired, soon };
  }, [items]);

  const save = useMutation({
    mutationFn: async (v: typeof EMPTY) => {
      const name = v.product_name.trim();
      if (!name) throw new Error("El nombre del producto es obligatorio");
      const payload = {
        product_code: slugProductCode(v.product_code.trim() || name),
        product_name: name,
        quantity: Math.max(0, Math.round(Number(v.quantity.replace(",", ".")) || 0)),
        unit: v.unit.trim() || null,
        batch_code: v.batch_code.trim() || null,
        expires_on: v.expires_on || null,
        notes: v.notes.trim() || null,
      };
      await assetService.saveKitItem(activeCompanyId, assetId, v.id || null, payload);
    },
    onSuccess: () => {
      toast.success("Producto guardado");
      setEditing(null);
      qc.invalidateQueries({ queryKey: kitKey });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await assetService.deleteKitItem(activeCompanyId, assetId, id);
    },
    onSuccess: () => {
      toast.success("Producto eliminado");
      qc.invalidateQueries({ queryKey: kitKey });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const fillStandard = useMutation({
    mutationFn: async () => {
      const existing = new Set(items.map((i) => (i.product_code ?? "").toUpperCase()));
      const missing = FIRST_AID_PRODUCTS.filter((p) => !existing.has(p.code)).map((p) => ({
        product_code: p.code,
        product_name: p.name,
        quantity: Number(p.quantity),
        unit: p.unit,
      }));
      if (!missing.length) throw new Error("El botiquín ya tiene los 12 productos estándar");
      await assetService.insertKitItems(activeCompanyId, assetId, missing);
      return missing.length;
    },
    onSuccess: (n) => {
      toast.success(`${n} productos añadidos`);
      qc.invalidateQueries({ queryKey: kitKey });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <BriefcaseMedical className="h-4 w-4" />
          </div>
          <div>
            <CardTitle className="text-base">Contenido del botiquín</CardTitle>
            <CardDescription>
              {items.length} producto{items.length === 1 ? "" : "s"}
              {summary.expired > 0 && ` · ${summary.expired} caducado(s)`}
              {summary.soon > 0 && ` · ${summary.soon} próximo(s) a caducar`}
            </CardDescription>
          </div>
        </div>
        {canManage && (
          <div className="flex gap-2">
            {items.length === 0 && (
              <Button variant="outline" size="sm" onClick={() => fillStandard.mutate()} disabled={fillStandard.isPending}>
                Añadir 12 productos estándar
              </Button>
            )}
            <Button size="sm" onClick={() => setEditing({ ...EMPTY })}>
              <Plus className="mr-2 h-4 w-4" />
              Añadir producto
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead className="text-right">Cant.</TableHead>
              <TableHead>Lote</TableHead>
              <TableHead>Caducidad</TableHead>
              <TableHead>Estado</TableHead>
              {canManage && <TableHead className="w-24" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                  Cargando…
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                  Sin productos registrados
                </TableCell>
              </TableRow>
            ) : (
              items.map((it) => {
                const tone = expiryTone(it.expires_on);
                return (
                  <TableRow key={it.id}>
                    <TableCell>
                      <div className="font-medium">{it.product_name}</div>
                      <div className="font-mono text-xs text-muted-foreground">{it.product_code}</div>
                    </TableCell>
                    <TableCell className="text-right">
                      {it.quantity} {it.unit ?? ""}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{it.batch_code ?? "—"}</TableCell>
                    <TableCell className="text-sm">{it.expires_on ?? "—"}</TableCell>
                    <TableCell>
                      {tone ? (
                        <Badge variant="outline" className={tone.cls}>
                          {tone.label}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">Sin caducidad</span>
                      )}
                    </TableCell>
                    {canManage && (
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              setEditing({
                                id: it.id,
                                product_code: it.product_code ?? "",
                                product_name: it.product_name,
                                quantity: String(it.quantity),
                                unit: it.unit ?? "",
                                batch_code: it.batch_code ?? "",
                                expires_on: it.expires_on ?? "",
                                notes: it.notes ?? "",
                              })
                            }
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => remove.mutate(it.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </CardContent>

      {editing && (
        <Dialog open onOpenChange={(v) => !v && setEditing(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing.id ? "Editar producto" : "Añadir producto"}</DialogTitle>
              <DialogDescription>Datos del producto contenido en el botiquín</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label>Producto</Label>
                <Input
                  list="kit-standard-products"
                  value={editing.product_name}
                  onChange={(e) => setEditing({ ...editing, product_name: e.target.value })}
                  placeholder="Alcohol"
                />
                <datalist id="kit-standard-products">
                  {FIRST_AID_PRODUCTS.map((p) => (
                    <option key={p.code} value={p.name} />
                  ))}
                </datalist>
              </div>
              <div className="space-y-2">
                <Label>Cantidad</Label>
                <Input
                  type="number"
                  min={0}
                  value={editing.quantity}
                  onChange={(e) => setEditing({ ...editing, quantity: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Unidad</Label>
                <Input value={editing.unit} onChange={(e) => setEditing({ ...editing, unit: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Lote</Label>
                <Input
                  value={editing.batch_code}
                  onChange={(e) => setEditing({ ...editing, batch_code: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Caducidad</Label>
                <Input
                  type="date"
                  value={editing.expires_on}
                  onChange={(e) => setEditing({ ...editing, expires_on: e.target.value })}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Notas</Label>
                <Input value={editing.notes} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setEditing(null)}>
                <X className="mr-2 h-4 w-4" />
                Cancelar
              </Button>
              <Button onClick={() => save.mutate(editing)} disabled={save.isPending}>
                <Save className="mr-2 h-4 w-4" />
                {save.isPending ? "Guardando…" : "Guardar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
}
