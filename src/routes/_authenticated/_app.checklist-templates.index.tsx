import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ClipboardList, Plus, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import { fetchAssetFamilies, fetchAssetTypes } from "@/lib/asset-families";
import { fetchCompanyLocations } from "@/lib/maintenance-scope";
import { describeTemplateScope, type ScopedTemplate } from "@/lib/checklist-scope";

export const Route = createFileRoute("/_authenticated/_app/checklist-templates/")({
  head: () => ({ meta: [{ title: "Plantillas de checklist" }] }),
  component: ListPage,
});

const TEMPLATE_FIELDS =
  "id, code, name, active, current_version, asset_type_id, asset_family_id, asset_type_ids, location_ids, include_sublocations";

function ListPage() {
  const { activeCompanyId, activeMembership } = useCompany();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [familyFilter, setFamilyFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const role = activeMembership?.role;
  const canManage = role === "administrator" || role === "system_manager";

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["checklist-templates", activeCompanyId],
    enabled: !!activeCompanyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklist_templates")
        .select(TEMPLATE_FIELDS)
        .eq("company_id", activeCompanyId!)
        .is("deleted_at", null)
        .order("code");
      if (error) throw error;
      return (data ?? []) as unknown as ScopedTemplate[];
    },
  });

  const { data: families = [] } = useQuery({
    queryKey: ["asset-families", activeCompanyId],
    enabled: !!activeCompanyId,
    queryFn: () => fetchAssetFamilies(activeCompanyId!),
  });

  const { data: types = [] } = useQuery({
    queryKey: ["asset-types-family", activeCompanyId],
    enabled: !!activeCompanyId,
    queryFn: () => fetchAssetTypes(activeCompanyId!),
  });

  const { data: locations = [] } = useQuery({
    queryKey: ["locations-scope", activeCompanyId],
    enabled: !!activeCompanyId,
    queryFn: () => fetchCompanyLocations(activeCompanyId!),
  });

  const typeName = (id: string) => {
    const t = types.find((x) => x.id === id);
    return t ? i18nName(t.name_i18n, t.code) : "—";
  };
  const familyName = (id: string | null) => {
    const f = families.find((x) => x.id === id);
    return f ? i18nName(f.name_i18n, f.code) : null;
  };
  const locationName = (id: string) => locations.find((l) => l.id === id)?.name ?? "—";

  const filtered = useMemo(
    () =>
      templates.filter((t) => {
        if (familyFilter !== "all" && t.asset_family_id !== familyFilter) return false;
        if (locationFilter !== "all") {
          const ids = t.location_ids ?? [];
          if (ids.length && !ids.includes(locationFilter)) return false;
        }
        return true;
      }),
    [templates, familyFilter, locationFilter],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ClipboardList className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Plantillas de checklist</h1>
            <p className="text-sm text-muted-foreground">
              Cuestionarios reutilizables por familia, tipos y centros (con versionado)
            </p>
          </div>
        </div>
        {canManage && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nueva plantilla
              </Button>
            </DialogTrigger>
            <CreateTemplateDialog
              families={families}
              types={types}
              locations={locations}
              onCreated={() => {
                setOpen(false);
                qc.invalidateQueries({ queryKey: ["checklist-templates"] });
              }}
            />
          </Dialog>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Select value={familyFilter} onValueChange={setFamilyFilter}>
          <SelectTrigger className="w-[220px]">
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
        <Select value={locationFilter} onValueChange={setLocationFilter}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Centro" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los centros</SelectItem>
            {locations.map((l) => (
              <SelectItem key={l.id} value={l.id}>
                {l.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Ámbito</TableHead>
              <TableHead>Versión</TableHead>
              <TableHead>Estado</TableHead>
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
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  Aún no hay plantillas.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((t) => {
                const scope = describeTemplateScope(t, {
                  familyName: familyName(t.asset_family_id),
                  typeNames: (ids) => ids.map(typeName),
                  locationNames: (ids) => ids.map(locationName),
                });
                return (
                  <TableRow key={t.id}>
                    <TableCell className="font-mono text-xs">{t.code}</TableCell>
                    <TableCell className="font-medium">
                      <Link to="/checklist-templates/$id" params={{ id: t.id }} className="hover:underline">
                        {t.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="font-medium">{scope.family}</div>
                      <div className="text-xs text-muted-foreground">
                        {scope.types} · {scope.locations}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">v{t.current_version ?? 0}</TableCell>
                    <TableCell>
                      {t.active ? (
                        <Badge variant="default">Activa</Badge>
                      ) : (
                        <Badge variant="secondary">Inactiva</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Link to="/checklist-templates/$id" params={{ id: t.id }}>
                        <Button variant="ghost" size="icon">
                          <ChevronRight className="h-4 w-4" />
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

function CreateTemplateDialog({
  families,
  types,
  locations,
  onCreated,
}: {
  families: Array<{ id: string; code: string; name_i18n: unknown }>;
  types: Array<{ id: string; code: string; name_i18n: unknown; family_id: string | null }>;
  locations: Array<{ id: string; name: string }>;
  onCreated: () => void;
}) {
  const { activeCompanyId } = useCompany();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [familyId, setFamilyId] = useState("");
  const [allTypes, setAllTypes] = useState(true);
  const [typeIds, setTypeIds] = useState<string[]>([]);
  const [allLocations, setAllLocations] = useState(true);
  const [locationIds, setLocationIds] = useState<string[]>([]);
  const [includeSub, setIncludeSub] = useState(true);
  const [description, setDescription] = useState("");

  const familyTypes = types.filter((t) => t.family_id === familyId);

  const toggle = (list: string[], setList: (v: string[]) => void, id: string) =>
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  const create = useMutation({
    mutationFn: async () => {
      if (!activeCompanyId) throw new Error("Sin empresa activa");
      if (!code || !name || !familyId) throw new Error("Completa los campos obligatorios");
      const finalTypes = allTypes ? [] : typeIds;
      if (!allTypes && !finalTypes.length) throw new Error("Selecciona al menos un tipo de activo");
      const finalLocations = allLocations ? [] : locationIds;
      if (!allLocations && !finalLocations.length) throw new Error("Selecciona al menos un centro");

      const { data: tpl, error: tplErr } = await supabase
        .from("checklist_templates")
        .insert({
          company_id: activeCompanyId,
          code: code.toUpperCase(),
          name,
          asset_family_id: familyId,
          asset_type_ids: finalTypes,
          asset_type_id: finalTypes.length === 1 ? finalTypes[0] : null,
          location_ids: finalLocations,
          include_sublocations: includeSub,
          description: description || null,
          current_version: 0,
        })
        .select()
        .single();
      if (tplErr) throw tplErr;

      const { error: verErr } = await supabase.from("checklist_template_versions").insert({
        template_id: tpl.id,
        version: 1,
        is_published: false,
      });
      if (verErr) throw verErr;
    },
    onSuccess: () => {
      toast.success("Plantilla creada");
      onCreated();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Nueva plantilla de checklist</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Código *</Label>
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="CHK-PCI-TRI" />
          </div>
          <div className="space-y-2">
            <Label>Familia de activos *</Label>
            <Select
              value={familyId}
              onValueChange={(v) => {
                setFamilyId(v);
                setTypeIds([]);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona" />
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
        </div>

        <div className="space-y-2">
          <Label>Nombre *</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Revisión trimestral de equipos PCI"
          />
        </div>

        <div className="space-y-2 rounded-lg border p-3">
          <Label className="text-xs uppercase text-muted-foreground">Tipos de activo</Label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={allTypes} onCheckedChange={(c) => setAllTypes(!!c)} />
            Todos los tipos de la familia
          </label>
          {!allTypes && (
            <div className="max-h-40 space-y-1 overflow-y-auto pt-1">
              {familyTypes.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Elige primero una familia con tipos asignados.
                </p>
              ) : (
                familyTypes.map((t) => (
                  <label key={t.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={typeIds.includes(t.id)}
                      onCheckedChange={() => toggle(typeIds, setTypeIds, t.id)}
                    />
                    {i18nName(t.name_i18n, t.code)}
                  </label>
                ))
              )}
            </div>
          )}
        </div>

        <div className="space-y-2 rounded-lg border p-3">
          <Label className="text-xs uppercase text-muted-foreground">Centros</Label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={allLocations} onCheckedChange={(c) => setAllLocations(!!c)} />
            Todos los centros
          </label>
          {!allLocations && (
            <>
              <div className="max-h-40 space-y-1 overflow-y-auto pt-1">
                {locations.map((l) => (
                  <label key={l.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={locationIds.includes(l.id)}
                      onCheckedChange={() => toggle(locationIds, setLocationIds, l.id)}
                    />
                    {l.name}
                  </label>
                ))}
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={includeSub} onCheckedChange={(c) => setIncludeSub(!!c)} />
                Incluir sububicaciones
              </label>
            </>
          )}
        </div>

        <div className="space-y-2">
          <Label>Descripción</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
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
