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
                  planId={id}
                  candidates={availableAssets}
                  onDone={() => {
                    setOpen(false);
                    qc.invalidateQueries({ queryKey: ["plan-assets", id] });
                  }}
                />
              </Dialog>
            )}
          </CardHeader>
          <CardContent>
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
  planId,
  candidates,
  onDone,
}: {
  planId: string;
  candidates: Array<{ id: string; code: string; name: string | null }>;
  onDone: () => void;
}) {
  const [selected, setSelected] = useState<string>("");

  const add = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("Selecciona un activo");
      const { error } = await supabase.from("maintenance_plan_assets").insert({
        plan_id: planId,
        asset_id: selected,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Activo añadido");
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Añadir activo al plan</DialogTitle>
      </DialogHeader>
      <div className="space-y-2">
        <Label>Activo</Label>
        <Select value={selected} onValueChange={setSelected}>
          <SelectTrigger>
            <SelectValue placeholder={candidates.length ? "Selecciona" : "No hay activos disponibles"} />
          </SelectTrigger>
          <SelectContent>
            {candidates.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.code} — {a.name ?? "(sin nombre)"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <DialogFooter>
        <Button onClick={() => add.mutate()} disabled={add.isPending || !selected}>
          {add.isPending ? "Añadiendo…" : "Añadir"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
