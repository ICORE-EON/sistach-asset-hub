import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Plus, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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
import { toast } from "sonner";
import { i18nName } from "@/lib/i18n-name";

export const Route = createFileRoute("/_authenticated/_app/maintenance-plans/")({
  head: () => ({ meta: [{ title: "Planes de mantenimiento" }] }),
  component: PlansList,
});

export const FREQUENCIES = [
  { value: "monthly", label: "Mensual", months: 1 },
  { value: "quarterly", label: "Trimestral", months: 3 },
  { value: "biannual", label: "Semestral", months: 6 },
  { value: "annual", label: "Anual", months: 12 },
];

function PlansList() {
  const { activeCompanyId, activeMembership } = useCompany();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const role = activeMembership?.role;
  const canManage = role === "administrator" || role === "system_manager";

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ["maintenance-plans", activeCompanyId],
    enabled: !!activeCompanyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maintenance_plans")
        .select("*, asset_types(code, name_i18n), checklist_templates(code, name)")
        .eq("company_id", activeCompanyId!)
        .is("deleted_at", null)
        .order("code");
      if (error) throw error;
      return data;
    },
  });

  const { data: templates = [] } = useQuery({
    queryKey: ["templates-published", activeCompanyId],
    enabled: !!activeCompanyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklist_templates")
        .select("id, code, name, asset_type_id, current_version")
        .eq("company_id", activeCompanyId!)
        .is("deleted_at", null)
        .gt("current_version", 0)
        .eq("active", true);
      if (error) throw error;
      return data;
    },
  });

  const { data: types = [] } = useQuery({
    queryKey: ["asset-types", activeCompanyId],
    enabled: !!activeCompanyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("asset_types")
        .select("id, code, name_i18n")
        .or(`company_id.eq.${activeCompanyId},is_system.eq.true`)
        .eq("active", true);
      if (error) throw error;
      return data;
    },
  });

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
                qc.invalidateQueries({ queryKey: ["maintenance-plans"] });
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
                <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                  Cargando…
                </TableCell>
              </TableRow>
            ) : plans.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                  Aún no hay planes. {templates.length === 0 && "Necesitas al menos una plantilla publicada."}
                </TableCell>
              </TableRow>
            ) : (
              plans.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs">{p.code}</TableCell>
                  <TableCell className="font-medium">
                    <Link to="/maintenance-plans/$id" params={{ id: p.id }} className="hover:underline">
                      {p.name}
                    </Link>
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
  templates: Array<{ id: string; code: string; name: string; asset_type_id: string }>;
  onCreated: () => void;
}) {
  const { activeCompanyId } = useCompany();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [assetTypeId, setAssetTypeId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [frequency, setFrequency] = useState("quarterly");
  const [notes, setNotes] = useState("");
  const [scopeMode, setScopeMode] = useState<"scoped" | "manual">("scoped");
  const [locationIds, setLocationIds] = useState<string[]>([]);
  const [includeSub, setIncludeSub] = useState(true);
  const [excluded, setExcluded] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [manualPicked, setManualPicked] = useState<string[]>([]);

  const filteredTemplates = assetTypeId
    ? templates.filter((t) => t.asset_type_id === assetTypeId)
    : templates;

  const { data: locations = [] } = useQuery({
    queryKey: ["locations-scope", activeCompanyId],
    enabled: !!activeCompanyId,
    queryFn: () => fetchCompanyLocations(activeCompanyId!),
  });

  const { data: candidates = [], isFetching: loadingCandidates } = useQuery({
    queryKey: ["scope-assets", activeCompanyId, assetTypeId, scopeMode, locationIds, includeSub],
    enabled: !!activeCompanyId,
    queryFn: () =>
      fetchScopeAssets({
        companyId: activeCompanyId!,
        assetTypeId: assetTypeId || null,
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

  const toggleLocation = (id: string) =>
    setLocationIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const toggleAsset = (id: string) => {
    if (scopeMode === "scoped") {
      setExcluded((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    } else {
      setManualPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    }
  };

  const create = useMutation({
    mutationFn: async () => {
      if (!activeCompanyId) throw new Error("Sin empresa activa");
      if (!code || !name || !templateId) throw new Error("Completa los campos obligatorios");
      const freq = FREQUENCIES.find((f) => f.value === frequency);
      const { data: plan, error } = await supabase
        .from("maintenance_plans")
        .insert({
          company_id: activeCompanyId,
          code: code.toUpperCase(),
          name,
          asset_type_id: assetTypeId || null,
          checklist_template_id: templateId,
          frequency,
          interval_months: freq?.months ?? null,
          notes: notes || null,
          scope_mode: scopeMode,
          scope_location_ids: scopeMode === "scoped" ? locationIds : [],
          scope_include_sublocations: includeSub,
        })
        .select("id")
        .single();
      if (error) throw error;

      if (selectedIds.length) {
        const { error: linkErr } = await supabase.from("maintenance_plan_assets").insert(
          selectedIds.map((assetId) => ({ plan_id: plan.id, asset_id: assetId })),
        );
        if (linkErr) throw linkErr;
      }
      return selectedIds.length;
    },
    onSuccess: (n) => {
      toast.success(n ? `Plan creado con ${n} equipo(s)` : "Plan creado");
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
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="PLAN-EXT-TRI" />
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
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Revisión trimestral de extintores" />
        </div>
        <div className="space-y-2">
          <Label>Familia / tipo de activo</Label>
          <Select value={assetTypeId} onValueChange={(v) => { setAssetTypeId(v); setTemplateId(""); setExcluded([]); setManualPicked([]); }}>
            <SelectTrigger>
              <SelectValue placeholder="Selecciona" />
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
          <Label>Plantilla publicada *</Label>
          <Select value={templateId} onValueChange={setTemplateId}>
            <SelectTrigger>
              <SelectValue placeholder={filteredTemplates.length ? "Selecciona plantilla" : "No hay plantillas para este tipo"} />
            </SelectTrigger>
            <SelectContent>
              {filteredTemplates.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.code} — {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
              {loadingCandidates
                ? "Calculando equipos…"
                : `Se añadirán ${selectedIds.length} equipo(s)`}
            </p>
            <div className="max-h-48 space-y-1.5 overflow-y-auto rounded-md border p-2">
              {visible.length === 0 ? (
                <p className="py-2 text-center text-xs text-muted-foreground">
                  No hay equipos que coincidan.
                </p>
              ) : (
                visible.map((a) => (
                  <label key={a.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={selectedIds.includes(a.id)}
                      onCheckedChange={() => toggleAsset(a.id)}
                    />
                    <span className="font-mono text-xs">{a.code}</span>
                    <span className="truncate">{a.name ?? "(sin nombre)"}</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {a.locations?.name ?? "Sin ubicación"}
                    </span>
                  </label>
                ))
              )}
            </div>
          </div>
        </div>

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
