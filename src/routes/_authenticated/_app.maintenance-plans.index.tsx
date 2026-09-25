import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Plus, ChevronRight } from "lucide-react";
import { useCompany } from "@/contexts/CompanyContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { i18nName } from "@/lib/i18n-name";
import { groupAssets } from "@/modules/maintenance/domain/scope";
import { resolveTemplatesForType, type ScopedTemplate } from "@/modules/maintenance/domain/checklist-scope";
import { assetKeys, assetService } from "@/modules/maintenance/services/assets";
import { checklistKeys, checklistService } from "@/modules/maintenance/services/checklists";
import { FREQUENCIES, planKeys, planService } from "@/modules/maintenance/services/plans";

export { FREQUENCIES };

export const Route = createFileRoute("/_authenticated/_app/maintenance-plans/")({
  head: () => ({ meta: [{ title: "Planes de mantenimiento" }] }),
  component: PlansList,
});

function PlansList() {
  const { activeCompanyId, activeMembership } = useCompany();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [familyFilter, setFamilyFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [frequencyFilter, setFrequencyFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const role = activeMembership?.role;
  const canManage = role === "administrator" || role === "system_manager";

  const { data: plans = [], isLoading } = useQuery({
    queryKey: planKeys.list(activeCompanyId),
    enabled: !!activeCompanyId,
    queryFn: () => planService.listPlans(activeCompanyId),
  });

  const { data: templates = [] } = useQuery({
    queryKey: checklistKeys.published(activeCompanyId),
    enabled: !!activeCompanyId,
    queryFn: async () =>
      (await checklistService.listPublishedTemplates(activeCompanyId)) as unknown as Array<
        ScopedTemplate & { code: string; name: string }
      >,
  });

  const { data: types = [] } = useQuery({
    queryKey: assetKeys.types(activeCompanyId),
    enabled: !!activeCompanyId,
    queryFn: () => assetService.listTypes(activeCompanyId),
  });

  // Opciones de familia y tipo a partir de los planes existentes
  const familyOptions = [
    ...new Map(
      plans
        .flatMap((p) =>
          p.asset_families && p.asset_family_id
            ? [[p.asset_family_id, i18nName(p.asset_families.name_i18n, p.asset_families.code)] as const]
            : [],
        ),
    ).entries(),
  ].sort((a, b) => a[1].localeCompare(b[1]));

  const typeOptions = [
    ...new Map(
      plans
        .flatMap((p) =>
          p.asset_types && p.asset_type_id &&
          (familyFilter === "all" || p.asset_family_id === familyFilter)
            ? [[p.asset_type_id, i18nName(p.asset_types.name_i18n, p.asset_types.code)] as const]
            : [],
        ),
    ).entries(),
  ].sort((a, b) => a[1].localeCompare(b[1]));

  const filtered = plans.filter((p) => {
    if (search) {
      const t = search.toLowerCase();
      if (
        !p.name.toLowerCase().includes(t) &&
        !p.code.toLowerCase().includes(t)
      )
        return false;
    }
    if (familyFilter !== "all" && p.asset_family_id !== familyFilter) return false;
    if (typeFilter !== "all" && p.asset_type_id !== typeFilter) return false;
    if (frequencyFilter !== "all" && p.frequency !== frequencyFilter) return false;
    if (statusFilter !== "all" && p.active !== (statusFilter === "active")) return false;
    return true;
  });

  const hasFilters =
    search !== "" ||
    familyFilter !== "all" ||
    typeFilter !== "all" ||
    frequencyFilter !== "all" ||
    statusFilter !== "all";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <CalendarClock className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Planes de mantenimiento</h1>
            <p className="text-sm text-muted-foreground">
              Programación recurrente de revisiones por activo y plantilla
            </p>
          </div>
        </div>
        {canManage && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nuevo plan
              </Button>
            </DialogTrigger>
            <CreatePlanDialog
              types={types}
              templates={templates}
              onCreated={() => {
                setOpen(false);
                qc.invalidateQueries({ queryKey: planKeys.list(activeCompanyId), exact: true });
              }}
            />
          </Dialog>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre o código…"
          className="min-w-[200px] flex-1 sm:max-w-xs"
        />
        <Select
          value={familyFilter}
          onValueChange={(v) => {
            setFamilyFilter(v);
            setTypeFilter("all");
          }}
        >
          <SelectTrigger className="w-[170px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las familias</SelectItem>
            {familyOptions.map(([id, name]) => (
              <SelectItem key={id} value={id}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[170px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            {typeOptions.map(([id, name]) => (
              <SelectItem key={id} value={id}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={frequencyFilter} onValueChange={setFrequencyFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las frecuencias</SelectItem>
            {FREQUENCIES.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="active">Activos</SelectItem>
            <SelectItem value="paused">Pausados</SelectItem>
          </SelectContent>
        </Select>
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch("");
              setFamilyFilter("all");
              setTypeFilter("all");
              setFrequencyFilter("all");
              setStatusFilter("all");
            }}
          >
            Limpiar
          </Button>
        )}
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Familia</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Plantilla</TableHead>
              <TableHead>Frecuencia</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-[60px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                  Cargando…
                </TableCell>
              </TableRow>
            ) : plans.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                  Aún no hay planes. {templates.length === 0 && "Necesitas al menos una plantilla publicada."}
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                  Ningún plan coincide con los filtros.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs">{p.code}</TableCell>
                  <TableCell className="font-medium">
                    <Link to="/maintenance-plans/$id" params={{ id: p.id }} className="hover:underline">
                      {p.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm">
                    {p.asset_families
                      ? i18nName(p.asset_families.name_i18n, p.asset_families.code)
                      : "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {p.asset_types ? i18nName(p.asset_types.name_i18n, p.asset_types.code) : "—"}
                  </TableCell>
                  <TableCell className="text-sm">{p.checklist_templates?.name ?? "—"}</TableCell>
                  <TableCell className="text-sm">
                    {FREQUENCIES.find((f) => f.value === p.frequency)?.label ?? p.frequency}
                  </TableCell>
                  <TableCell>
                    {p.active ? <Badge>Activo</Badge> : <Badge variant="secondary">Pausado</Badge>}
                  </TableCell>
                  <TableCell>
                    <Link to="/maintenance-plans/$id" params={{ id: p.id }}>
                      <Button variant="ghost" size="icon">
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </Link>
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

function CreatePlanDialog({
  types,
  templates,
  onCreated,
}: {
  types: Array<{ id: string; code: string; name_i18n: unknown }>;
  templates: Array<ScopedTemplate & { code: string; name: string }>;
  onCreated: () => void;
}) {
  const { activeCompanyId } = useCompany();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [familyId, setFamilyId] = useState("");
  const [frequency, setFrequency] = useState("quarterly");
  const [notes, setNotes] = useState("");
  const [scopeMode, setScopeMode] = useState<"scoped" | "manual">("scoped");
  const [locationIds, setLocationIds] = useState<string[]>([]);
  const [includeSub, setIncludeSub] = useState(true);
  const [excluded, setExcluded] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [manualPicked, setManualPicked] = useState<string[]>([]);
  const [typeTemplates, setTypeTemplates] = useState<Record<string, string>>({});
  const [certTemplateId, setCertTemplateId] = useState("");

  const { data: families = [] } = useQuery({
    queryKey: assetKeys.families(activeCompanyId),
    enabled: !!activeCompanyId,
    queryFn: () => assetService.listFamilies(activeCompanyId),
  });

  const { data: allTypes = [] } = useQuery({
    queryKey: assetKeys.typesForFamilies(activeCompanyId),
    enabled: !!activeCompanyId,
    queryFn: () => assetService.listTypes(activeCompanyId),
  });

  const { data: certTemplates = [] } = useQuery({
    queryKey: planKeys.certTemplatesByName(activeCompanyId),
    enabled: !!activeCompanyId,
    queryFn: () => planService.listCertificateTemplates(activeCompanyId, "name"),
  });

  const family = families.find((f) => f.id === familyId);
  const familyTypeIds = allTypes.filter((t) => t.family_id === familyId).map((t) => t.id);

  const { data: locations = [] } = useQuery({
    queryKey: assetKeys.scopeSites(activeCompanyId),
    enabled: !!activeCompanyId,
    queryFn: () => assetService.listScopeSites(activeCompanyId),
  });

  const { data: candidates = [], isFetching: loadingCandidates } = useQuery({
    queryKey: planKeys.scopeAssets(activeCompanyId, familyTypeIds, scopeMode, locationIds, includeSub),
    enabled: !!activeCompanyId && !!familyId,
    queryFn: () =>
      planService.listScopeAssets(activeCompanyId, {
        assetTypeIds: familyTypeIds,
        locationIds: scopeMode === "scoped" ? locationIds : [],
        includeSublocations: includeSub,
        locations,
      }),
  });

  const visible =
    scopeMode === "manual" && search
      ? candidates.filter((a) =>
          `${a.code} ${a.name ?? ""}`.toLowerCase().includes(search.toLowerCase()),
        )
      : candidates;

  const selectedIds =
    scopeMode === "scoped"
      ? candidates.filter((a) => !excluded.includes(a.id)).map((a) => a.id)
      : manualPicked;

  const groups = groupAssets(visible);
  const selectedAssets = candidates.filter((a) => selectedIds.includes(a.id));
  const usedTypeIds = [...new Set(selectedAssets.map((a) => a.asset_type_id))];

  const toggleLocation = (id: string) =>
    setLocationIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const toggleAsset = (id: string) => {
    if (scopeMode === "scoped") {
      setExcluded((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    } else {
      setManualPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    }
  };

  const toggleGroup = (ids: string[], allSelected: boolean) => {
    if (scopeMode === "scoped") {
      setExcluded((prev) =>
        allSelected ? [...new Set([...prev, ...ids])] : prev.filter((x) => !ids.includes(x)),
      );
    } else {
      setManualPicked((prev) =>
        allSelected ? prev.filter((x) => !ids.includes(x)) : [...new Set([...prev, ...ids])],
      );
    }
  };

  const templatesForType = (typeId: string) =>
    resolveTemplatesForType(templates, {
      assetTypeId: typeId,
      familyId,
      locationIds: scopeMode === "scoped" ? locationIds : [],
      locations,
    });

  const templateFor = (typeId: string) =>
    typeTemplates[typeId] ?? templatesForType(typeId)[0]?.id ?? "";


  const missingTemplates = usedTypeIds.filter((id) => !templateFor(id));

  const create = useMutation({
    mutationFn: () =>
      planService.createPlan(activeCompanyId, {
        code, name, familyId, frequency, notes, scopeMode, locationIds, includeSub,
        selectedIds, usedTypeIds, templateFor, certTemplateId,
      }),
    onSuccess: (n) => {
      toast.success(`Plan creado con ${n} equipo(s)`);
      onCreated();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Nuevo plan de mantenimiento</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Código *</Label>
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="PLAN-PCI-TRI" />
          </div>
          <div className="space-y-2">
            <Label>Frecuencia *</Label>
            <Select value={frequency} onValueChange={setFrequency}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FREQUENCIES.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Nombre *</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Revisión trimestral de equipos PCI" />
        </div>
        <div className="space-y-2">
          <Label>Familia de activos *</Label>
          <Select
            value={familyId}
            onValueChange={(v) => {
              setFamilyId(v);
              setExcluded([]);
              setManualPicked([]);
              setTypeTemplates({});
              const f = families.find((x) => x.id === v);
              const def = certTemplates.find((c) => c.asset_family_id === v);
              setCertTemplateId(f?.requires_certificate && def ? def.id : "");
            }}
          >
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
          {family && !family.requires_certificate && (
            <p className="text-xs text-muted-foreground">
              Esta familia no requiere certificado de mantenimiento.
            </p>
          )}
        </div>

        <div className="space-y-3 rounded-lg border p-3">
          <Label className="text-xs uppercase text-muted-foreground">Alcance</Label>
          <RadioGroup
            value={scopeMode}
            onValueChange={(v) => { setScopeMode(v as "scoped" | "manual"); setExcluded([]); setManualPicked([]); }}
            className="gap-2"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="scoped" id="scope-scoped" />
              <Label htmlFor="scope-scoped" className="font-normal">
                Por familia y ubicación (todos los equipos de esa familia)
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="manual" id="scope-manual" />
              <Label htmlFor="scope-manual" className="font-normal">
                Equipos concretos
              </Label>
            </div>
          </RadioGroup>

          {scopeMode === "scoped" ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Ubicaciones ({locationIds.length ? `${locationIds.length} seleccionadas` : "todas"})
              </p>
              <div className="max-h-40 space-y-1.5 overflow-y-auto rounded-md border p-2">
                {locations.length === 0 ? (
                  <p className="py-2 text-center text-xs text-muted-foreground">No hay ubicaciones</p>
                ) : (
                  locations.map((l) => (
                    <label key={l.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={locationIds.includes(l.id)}
                        onCheckedChange={() => toggleLocation(l.id)}
                      />
                      <span>{l.name}</span>
                      <span className="font-mono text-xs text-muted-foreground">{l.code}</span>
                    </label>
                  ))
                )}
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={includeSub} onCheckedChange={(c) => setIncludeSub(!!c)} />
                Incluir sububicaciones
              </label>
            </div>
          ) : (
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar equipo por código o nombre…"
            />
          )}

          <div className="space-y-1">
            <p className="text-sm font-medium">
              {!familyId
                ? "Selecciona una familia para ver los equipos"
                : loadingCandidates
                  ? "Calculando equipos…"
                  : `Se añadirán ${selectedIds.length} equipo(s)`}
            </p>
            <div className="max-h-64 space-y-3 overflow-y-auto rounded-md border p-2">
              {groups.length === 0 ? (
                <p className="py-2 text-center text-xs text-muted-foreground">
                  No hay equipos que coincidan.
                </p>
              ) : (
                groups.map((g) => (
                  <div key={g.locationId} className="space-y-2">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">
                      {g.locationName}
                    </p>
                    {g.types.map((t) => {
                      const ids = t.assets.map((a) => a.id);
                      const allSelected = ids.every((id) => selectedIds.includes(id));
                      return (
                        <div key={t.typeId} className="rounded-md border p-2">
                          <label className="flex items-center gap-2 text-sm font-medium">
                            <Checkbox
                              checked={allSelected}
                              onCheckedChange={() => toggleGroup(ids, allSelected)}
                            />
                            {t.typeName}
                            <span className="ml-auto text-xs text-muted-foreground">
                              {ids.filter((id) => selectedIds.includes(id)).length}/{ids.length}
                            </span>
                          </label>
                          <div className="mt-1.5 space-y-1 pl-6">
                            {t.assets.map((a) => (
                              <label key={a.id} className="flex items-center gap-2 text-sm">
                                <Checkbox
                                  checked={selectedIds.includes(a.id)}
                                  onCheckedChange={() => toggleAsset(a.id)}
                                />
                                <span className="font-mono text-xs">{a.code}</span>
                                <span className="truncate">{a.name ?? "(sin nombre)"}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {usedTypeIds.length > 0 && (
          <div className="space-y-2 rounded-lg border p-3">
            <Label className="text-xs uppercase text-muted-foreground">
              Plantilla de checklist por tipo
            </Label>
            {usedTypeIds.map((typeId) => {
              const opts = templatesForType(typeId);
              const typeName = i18nName(
                types.find((t) => t.id === typeId)?.name_i18n,
                types.find((t) => t.id === typeId)?.code ?? "—",
              );
              return (
                <div key={typeId} className="flex flex-wrap items-center gap-2">
                  <span className="min-w-[140px] text-sm">{typeName}</span>
                  <Select
                    value={templateFor(typeId)}
                    onValueChange={(v) => setTypeTemplates((p) => ({ ...p, [typeId]: v }))}
                  >
                    <SelectTrigger className="ml-auto w-[280px]">
                      <SelectValue
                        placeholder={opts.length ? "Selecciona plantilla" : "Sin plantilla publicada"}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {opts.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.code} — {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              );
            })}
            {missingTemplates.length > 0 && (
              <p className="text-xs text-destructive">
                Faltan plantillas publicadas para {missingTemplates.length} tipo(s).
              </p>
            )}
          </div>
        )}

        {family?.requires_certificate && (
          <div className="space-y-2">
            <Label>Plantilla de certificado</Label>
            <Select value={certTemplateId} onValueChange={setCertTemplateId}>
              <SelectTrigger>
                <SelectValue placeholder="Sin certificado" />
              </SelectTrigger>
              <SelectContent>
                {certTemplates.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-2">
          <Label>Notas</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </div>
      </div>
      <DialogFooter>
        <Button onClick={() => create.mutate()} disabled={create.isPending}>
          {create.isPending ? "Creando…" : "Crear plan"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

