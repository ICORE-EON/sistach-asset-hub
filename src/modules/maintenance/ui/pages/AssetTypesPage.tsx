
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Tag, Plus, Trash2, Lock, Pencil } from "lucide-react";
import { assetService, assetKeys } from "../../services/assets";
import { useMaintenanceRequest } from "../host";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { i18nName } from "../../domain/i18n-name";

type Cat = { code: string; name: string; saved: boolean };
type TypeRow = { id: string; code: string; name_i18n: unknown; category: string; family_id: string | null; is_system: boolean };

const prettify = (c: string) => c.replace(/_/g, " ").replace(/^\w/, (x) => x.toUpperCase());

/** Org catalog plus any category code already used by visible types (so legacy ones can be renamed). */
function useCategories(orgId: string | null, types: { category: string }[]) {
  const { data: saved = [] } = useQuery({
    queryKey: assetKeys.categories(orgId),
    enabled: !!orgId,
    queryFn: () => assetService.listCategories(orgId),
  });
  const map = new Map<string, Cat>();
  for (const c of saved) map.set(c.code, { code: c.code, name: c.name, saved: true });
  for (const t of types) if (t.category && !map.has(t.category)) map.set(t.category, { code: t.category, name: prettify(t.category), saved: false });
  const list = [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  return { list, label: (code: string) => map.get(code)?.name ?? prettify(code) };
}

export function AssetTypesPage() {
  const { orgId: activeCompanyId, role } = useMaintenanceRequest();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<TypeRow | "new" | null>(null);
  const [catEdit, setCatEdit] = useState<Cat | "new" | null>(null);
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
  const cats = useCategories(activeCompanyId, types);

  const invalidateTypes = () => {
    qc.invalidateQueries({ queryKey: assetKeys.typesAdmin(activeCompanyId) });
    qc.invalidateQueries({ queryKey: assetKeys.types(activeCompanyId) });
    qc.invalidateQueries({ queryKey: assetKeys.typesForFamilies(activeCompanyId) });
  };

  const setFamily = useMutation({
    mutationFn: ({ typeId, familyId }: { typeId: string; familyId: string }) =>
      assetService.setTypeFamily(activeCompanyId, typeId, familyId),
    onSuccess: () => { toast.success("Familia actualizada"); invalidateTypes(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => assetService.deleteType(activeCompanyId, id),
    onSuccess: () => { toast.success("Tipo eliminado"); invalidateTypes(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const removeCat = useMutation({
    mutationFn: (code: string) => assetService.deleteCategory(activeCompanyId, code),
    onSuccess: () => { toast.success("Categoría eliminada"); qc.invalidateQueries({ queryKey: assetKeys.categories(activeCompanyId) }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Tag className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tipos de activo</h1>
          <p className="text-sm text-muted-foreground">Plantillas reutilizables para clasificar tu inventario</p>
        </div>
      </div>

      <Tabs defaultValue="types">
        <TabsList>
          <TabsTrigger value="types">Tipos de activo</TabsTrigger>
          <TabsTrigger value="categories">Categorías</TabsTrigger>
        </TabsList>

        <TabsContent value="types" className="space-y-3">
          {canManage && (
            <div className="flex justify-end">
              <Button onClick={() => setEditing("new")}><Plus className="mr-2 h-4 w-4" />Nuevo tipo</Button>
            </div>
          )}
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Familia</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Origen</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">Cargando…</TableCell></TableRow>
                ) : (
                  types.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-mono text-xs">{t.code}</TableCell>
                      <TableCell className="font-medium">{i18nName(t.name_i18n, t.code)}</TableCell>
                      <TableCell>
                        {canManage ? (
                          <Select value={t.family_id ?? ""} onValueChange={(v) => setFamily.mutate({ typeId: t.id, familyId: v })}>
                            <SelectTrigger className="h-8 w-[190px]"><SelectValue placeholder="Sin familia" /></SelectTrigger>
                            <SelectContent>
                              {families.map((f) => <SelectItem key={f.id} value={f.id}>{i18nName(f.name_i18n, f.code)}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="text-sm">
                            {i18nName(families.find((f) => f.id === t.family_id)?.name_i18n, families.find((f) => f.id === t.family_id)?.code ?? "—")}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{cats.label(t.category)}</TableCell>
                      <TableCell>
                        {t.is_system ? (
                          <Badge variant="secondary"><Lock className="mr-1 h-3 w-3" />Sistema</Badge>
                        ) : (
                          <Badge variant="outline">Empresa</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {canManage && !t.is_system && (
                          <div className="flex">
                            <Button variant="ghost" size="icon" aria-label="Editar tipo" onClick={() => setEditing(t)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" aria-label="Eliminar tipo"
                              onClick={() => { if (confirm(`¿Eliminar tipo ${t.code}?`)) remove.mutate(t.id); }}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <p className="text-xs text-muted-foreground">Los tipos de Sistema no se editan; su nombre de categoría sí se puede cambiar en la pestaña Categorías.</p>
        </TabsContent>

        <TabsContent value="categories" className="space-y-3">
          {canManage && (
            <div className="flex justify-end">
              <Button onClick={() => setCatEdit("new")}><Plus className="mr-2 h-4 w-4" />Nueva categoría</Button>
            </div>
          )}
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Tipos que la usan</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cats.list.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">Sin categorías</TableCell></TableRow>
                ) : cats.list.map((c) => {
                  const used = types.filter((t) => t.category === c.code).length;
                  return (
                    <TableRow key={c.code}>
                      <TableCell className="font-mono text-xs">{c.code}</TableCell>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="text-sm">{used}</TableCell>
                      <TableCell>
                        {canManage && (
                          <div className="flex">
                            <Button variant="ghost" size="icon" aria-label="Editar categoría" onClick={() => setCatEdit(c)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            {c.saved && used === 0 && (
                              <Button variant="ghost" size="icon" aria-label="Eliminar categoría"
                                onClick={() => { if (confirm(`¿Eliminar la categoría ${c.name}?`)) removeCat.mutate(c.code); }}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <p className="text-xs text-muted-foreground">El código de una categoría no cambia una vez creada (lo usan los tipos); el nombre se puede editar siempre. Solo se pueden eliminar categorías sin tipos asociados.</p>
        </TabsContent>
      </Tabs>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        {editing && (
          <TypeDialog
            key={editing === "new" ? "new" : editing.id}
            initial={editing === "new" ? null : editing}
            categories={cats.list}
            onDone={() => { setEditing(null); invalidateTypes(); }}
          />
        )}
      </Dialog>
      <Dialog open={!!catEdit} onOpenChange={(o) => !o && setCatEdit(null)}>
        {catEdit && (
          <CategoryDialog
            key={catEdit === "new" ? "new" : catEdit.code}
            initial={catEdit === "new" ? null : catEdit}
            onDone={() => { setCatEdit(null); qc.invalidateQueries({ queryKey: assetKeys.categories(activeCompanyId) }); }}
          />
        )}
      </Dialog>
    </div>
  );
}

function TypeDialog({ initial, categories, onDone }: { initial: TypeRow | null; categories: Cat[]; onDone: () => void }) {
  const { orgId: activeCompanyId } = useMaintenanceRequest();
  const [code, setCode] = useState(initial?.code ?? "");
  const [name, setName] = useState(initial ? i18nName(initial.name_i18n, initial.code) : "");
  const [category, setCategory] = useState(initial?.category ?? categories[0]?.code ?? "other");
  const [familyId, setFamilyId] = useState(initial?.family_id ?? "");

  const { data: families = [] } = useQuery({
    queryKey: assetKeys.families(activeCompanyId),
    enabled: !!activeCompanyId,
    queryFn: () => assetService.listFamilies(activeCompanyId),
  });

  const save = useMutation({
    mutationFn: async () => {
      const v = { code, name, category, familyId };
      if (initial) await assetService.updateType(activeCompanyId, initial.id, v);
      else await assetService.createType(activeCompanyId, v);
    },
    onSuccess: () => { toast.success(initial ? "Tipo actualizado" : "Tipo creado"); onDone(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>{initial ? "Editar tipo de activo" : "Nuevo tipo de activo"}</DialogTitle></DialogHeader>
      <div className="space-y-4">
        <div className="space-y-2"><Label>Código *</Label><Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="EXT-PORT-6KG" /></div>
        <div className="space-y-2"><Label>Nombre *</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Extintor portátil 6kg" /></div>
        <div className="space-y-2">
          <Label>Familia</Label>
          <Select value={familyId} onValueChange={setFamilyId}>
            <SelectTrigger><SelectValue placeholder="Selecciona familia" /></SelectTrigger>
            <SelectContent>{families.map((f) => <SelectItem key={f.id} value={f.id}>{i18nName(f.name_i18n, f.code)}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Categoría</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{categories.map((c) => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter>
        <Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? "Guardando…" : initial ? "Guardar" : "Crear"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}

function CategoryDialog({ initial, onDone }: { initial: Cat | null; onDone: () => void }) {
  const { orgId: activeCompanyId } = useMaintenanceRequest();
  const [code, setCode] = useState(initial?.code ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const save = useMutation({
    mutationFn: () => assetService.saveCategory(activeCompanyId, { code, name }),
    onSuccess: () => { toast.success(initial ? "Categoría actualizada" : "Categoría creada"); onDone(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>{initial ? "Editar categoría" : "Nueva categoría"}</DialogTitle></DialogHeader>
      <div className="space-y-4">
        <div className="space-y-2"><Label>Código *</Label><Input value={code} disabled={!!initial} onChange={(e) => setCode(e.target.value)} placeholder="senalizacion" /></div>
        <div className="space-y-2"><Label>Nombre *</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Señalización" /></div>
      </div>
      <DialogFooter>
        <Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? "Guardando…" : "Guardar"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}
