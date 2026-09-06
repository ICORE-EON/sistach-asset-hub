import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, Trash2, Power, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { FREQUENCIES } from "./_app.maintenance-plans.index";
import {
  describeScopeLocations,
  fetchCompanyLocations,
  fetchScopeAssets,
  type ScopeAsset,
} from "@/lib/maintenance-scope";

export const Route = createFileRoute("/_authenticated/_app/maintenance-plans/$id")({
  head: () => ({ meta: [{ title: "Detalle plan" }] }),
  component: PlanDetail,
});

function PlanDetail() {
  const { id } = Route.useParams();
  const { activeCompanyId, activeMembership } = useCompany();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const role = activeMembership?.role;
  const canManage = role === "administrator" || role === "system_manager";

  const { data: plan } = useQuery({
    queryKey: ["plan", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maintenance_plans")
        .select("*, asset_types(code, name_i18n), checklist_templates(code, name, current_version), certificate_templates(id, code, name)")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: certTemplates = [] } = useQuery({
    queryKey: ["certificate-templates-pick", activeCompanyId],
    enabled: !!activeCompanyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("certificate_templates")
        .select("id, code, name, is_default")
        .eq("company_id", activeCompanyId!)
        .is("deleted_at", null)
        .order("code");
      if (error) throw error;
      return data;
    },
  });

  const setCertTemplate = useMutation({
    mutationFn: async (templateId: string | null) => {
      const { error } = await supabase
        .from("maintenance_plans")
        .update({ certificate_template_id: templateId })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Plantilla de certificado actualizada");
      qc.invalidateQueries({ queryKey: ["plan", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { data: planAssets = [] } = useQuery({
    queryKey: ["plan-assets", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maintenance_plan_assets")
        .select("*, assets(id, code, name, status, locations(name))")
        .eq("plan_id", id);
      if (error) throw error;
      return data;
    },
  });

  const { data: locations = [] } = useQuery({
    queryKey: ["locations-scope", activeCompanyId],
    enabled: !!activeCompanyId,
    queryFn: () => fetchCompanyLocations(activeCompanyId!),
  });

  // Todos los activos de la familia (para el diálogo de añadir manualmente)
  const { data: familyAssets = [] } = useQuery({
    queryKey: ["family-assets", activeCompanyId, plan?.asset_type_id],
    enabled: !!activeCompanyId && !!plan,
    queryFn: () =>
      fetchScopeAssets({
        companyId: activeCompanyId!,
        assetTypeId: plan?.asset_type_id ?? null,
        locationIds: [],
        includeSublocations: true,
        locations,
      }),
  });

  // Activos que encajan con el alcance guardado del plan
  const { data: scopedAssets = [] } = useQuery({
    queryKey: [
      "scoped-assets",
      activeCompanyId,
      plan?.asset_type_id,
      plan?.scope_location_ids,
      plan?.scope_include_sublocations,
    ],
    enabled: !!activeCompanyId && plan?.scope_mode === "scoped",
    queryFn: () =>
      fetchScopeAssets({
        companyId: activeCompanyId!,
        assetTypeId: plan?.asset_type_id ?? null,
        locationIds: (plan?.scope_location_ids as string[] | null) ?? [],
        includeSublocations: plan?.scope_include_sublocations ?? true,
        locations,
      }),
  });

  const linkedIds = useMemo(() => new Set(planAssets.map((pa) => pa.asset_id)), [planAssets]);
  const missingAssets = useMemo(
    () => scopedAssets.filter((a) => !linkedIds.has(a.id)),
    [scopedAssets, linkedIds],
  );
  const availableAssets = useMemo(
    () => familyAssets.filter((a) => !linkedIds.has(a.id)),
    [familyAssets, linkedIds],
  );

  const addAssets = useMutation({
    mutationFn: async (assetIds: string[]) => {
      if (!assetIds.length) throw new Error("Selecciona al menos un equipo");
      const { error } = await supabase
        .from("maintenance_plan_assets")
        .insert(assetIds.map((assetId) => ({ plan_id: id, asset_id: assetId })));
      if (error) throw error;
      return assetIds.length;
    },
    onSuccess: (n) => {
      toast.success(`${n} equipo(s) añadidos`);
      qc.invalidateQueries({ queryKey: ["plan-assets", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("maintenance_plans")
        .update({ active: !plan?.active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Estado actualizado");
      qc.invalidateQueries({ queryKey: ["plan", id] });
      qc.invalidateQueries({ queryKey: ["maintenance-plans"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeAsset = useMutation({
    mutationFn: async (assignmentId: string) => {
      const { error } = await supabase
        .from("maintenance_plan_assets")
        .delete()
        .eq("id", assignmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Activo desvinculado");
      qc.invalidateQueries({ queryKey: ["plan-assets", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!plan) return <div className="p-6 text-sm text-muted-foreground">Cargando…</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link to="/maintenance-plans">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{plan.name}</h1>
              <Badge variant={plan.active ? "default" : "secondary"}>
                {plan.active ? "Activo" : "Pausado"}
              </Badge>
            </div>
            <p className="font-mono text-xs text-muted-foreground">{plan.code}</p>
          </div>
        </div>
        {canManage && (
          <Button variant="outline" onClick={() => toggleActive.mutate()}>
            <Power className="mr-2 h-4 w-4" />
            {plan.active ? "Pausar" : "Reactivar"}
          </Button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Configuración</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="Frecuencia">
              {FREQUENCIES.find((f) => f.value === plan.frequency)?.label ?? plan.frequency}
            </Row>
            <Row label="Plantilla">{plan.checklist_templates?.name ?? "—"}</Row>
            <Row label="Tipo activo">
              {plan.asset_types ? (plan.asset_types.name_i18n as { es?: string })?.es ?? plan.asset_types.code : "—"}
            </Row>
            <Row label="Alcance">
              {plan.scope_mode === "scoped"
                ? describeScopeLocations(
                    locations,
                    (plan.scope_location_ids as string[] | null) ?? [],
                    plan.scope_include_sublocations ?? true,
                  )
                : "Equipos concretos"}
            </Row>
            <div className="space-y-1.5 border-b py-1.5 last:border-0">
              <Label className="text-xs uppercase text-muted-foreground">Modelo de certificado</Label>
              {canManage ? (
                <Select
                  value={plan.certificate_template_id ?? "__default__"}
                  onValueChange={(v) => setCertTemplate.mutate(v === "__default__" ? null : v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__default__">Usar plantilla por defecto</SelectItem>
                    {certTemplates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.code} — {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm">
                  {plan.certificate_templates?.name ?? "Plantilla por defecto"}
                </p>
              )}
            </div>
            {plan.notes && (
              <div>
                <Label className="text-xs uppercase text-muted-foreground">Notas</Label>
                <p className="mt-1 text-sm">{plan.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Activos cubiertos ({planAssets.length})</CardTitle>
              <p className="text-xs text-muted-foreground">Equipos sobre los que se ejecutará este plan</p>
            </div>
            {canManage && (
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Añadir activos
                  </Button>
                </DialogTrigger>
                <AssignAssetsDialog
                  candidates={availableAssets}
                  onAdd={async (ids) => {
                    await addAssets.mutateAsync(ids);
                    setOpen(false);
                  }}
                />
              </Dialog>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {canManage && missingAssets.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
                <div className="flex items-start gap-2 text-sm">
                  <Sparkles className="mt-0.5 h-4 w-4 text-primary" />
                  <div>
                    <p className="font-medium">
                      {missingAssets.length} equipo(s) encajan con este plan y no están incluidos
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {missingAssets.slice(0, 5).map((a) => a.code).join(", ")}
                      {missingAssets.length > 5 ? "…" : ""}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  disabled={addAssets.isPending}
                  onClick={() => addAssets.mutate(missingAssets.map((a) => a.id))}
                >
                  Añadir los {missingAssets.length}
                </Button>
              </div>
            )}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Activo</TableHead>
                  <TableHead>Ubicación</TableHead>
                  <TableHead>Inicio</TableHead>
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {planAssets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                      Aún no hay activos vinculados.
                    </TableCell>
                  </TableRow>
                ) : (
                  planAssets.map((pa) => (
                    <TableRow key={pa.id}>
                      <TableCell className="font-mono text-xs">{pa.assets?.code}</TableCell>
                      <TableCell className="font-medium">{pa.assets?.name ?? "—"}</TableCell>
                      <TableCell className="text-sm">{pa.assets?.locations?.name ?? "—"}</TableCell>
                      <TableCell className="text-sm">{pa.start_on}</TableCell>
                      <TableCell>
                        {canManage && (
                          <Button variant="ghost" size="icon" onClick={() => removeAsset.mutate(pa.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b py-1.5 last:border-0">
      <span className="text-xs uppercase text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{children}</span>
    </div>
  );
}

function AssignAssetsDialog({
  candidates,
  onAdd,
}: {
  candidates: ScopeAsset[];
  onAdd: (ids: string[]) => Promise<unknown>;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [locationFilter, setLocationFilter] = useState("__all__");
  const [saving, setSaving] = useState(false);

  const locationOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of candidates) {
      if (a.location_id) map.set(a.location_id, a.locations?.name ?? a.location_id);
    }
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [candidates]);

  const visible = candidates.filter((a) => {
    if (locationFilter !== "__all__" && a.location_id !== locationFilter) return false;
    if (!search) return true;
    return `${a.code} ${a.name ?? ""}`.toLowerCase().includes(search.toLowerCase());
  });

  const allVisibleSelected = visible.length > 0 && visible.every((a) => selected.includes(a.id));

  return (
    <DialogContent className="max-h-[85vh] max-w-xl overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Añadir equipos al plan</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por código o nombre…"
            className="min-w-[180px] flex-1"
          />
          <Select value={locationFilter} onValueChange={setLocationFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todas las ubicaciones</SelectItem>
              {locationOptions.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={allVisibleSelected}
            onCheckedChange={(c) =>
              setSelected((prev) =>
                c
                  ? [...new Set([...prev, ...visible.map((a) => a.id)])]
                  : prev.filter((id) => !visible.some((a) => a.id === id)),
              )
            }
          />
          Seleccionar todos los visibles ({visible.length})
        </label>

        <div className="max-h-72 space-y-1.5 overflow-y-auto rounded-md border p-2">
          {visible.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No hay equipos disponibles.
            </p>
          ) : (
            visible.map((a) => (
              <label key={a.id} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={selected.includes(a.id)}
                  onCheckedChange={() =>
                    setSelected((prev) =>
                      prev.includes(a.id) ? prev.filter((x) => x !== a.id) : [...prev, a.id],
                    )
                  }
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
      <DialogFooter>
        <Button
          disabled={saving || selected.length === 0}
          onClick={async () => {
            setSaving(true);
            try {
              await onAdd(selected);
              setSelected([]);
            } finally {
              setSaving(false);
            }
          }}
        >
          {saving ? "Añadiendo…" : `Añadir ${selected.length || ""}`.trim()}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
