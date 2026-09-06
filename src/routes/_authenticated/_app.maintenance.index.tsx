import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Wrench, Search, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/_app/maintenance/")({
  head: () => ({ meta: [{ title: "Mantenimientos" }] }),
  component: MaintenanceList,
});

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  draft: { label: "Borrador", variant: "outline" },
  in_progress: { label: "En curso", variant: "secondary" },
  closed: { label: "Cerrada", variant: "default" },
  cancelled: { label: "Cancelada", variant: "destructive" },
};

function MaintenanceList() {
  const { activeMembership } = useCompany();
  const companyId = activeMembership?.company_id;
  const role = activeMembership?.role;
  const canRun =
    role === "administrator" || role === "system_manager" || role === "manager";
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: sessions = [] } = useQuery({
    queryKey: ["maintenance-sessions", companyId, statusFilter],
    enabled: !!companyId,
    queryFn: async () => {
      let q = supabase
        .from("maintenance_sessions")
        .select("*, maintenance_plans(name, code)")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false })
        .limit(100);
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const filtered = sessions.filter((s) => {
    if (!search) return true;
    const t = search.toLowerCase();
    return (
      s.code.toLowerCase().includes(t) ||
      s.technician_name?.toLowerCase().includes(t) ||
      s.maintenance_plans?.name?.toLowerCase().includes(t)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Mantenimientos</h1>
          <p className="text-sm text-muted-foreground">
            Sesiones de inspección y mantenimiento sobre activos.
          </p>
        </div>
        {canRun && companyId && <CreateSessionDialog companyId={companyId} />}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por código, técnico o plan…"
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="draft">Borrador</SelectItem>
            <SelectItem value="in_progress">En curso</SelectItem>
            <SelectItem value="closed">Cerradas</SelectItem>
            <SelectItem value="cancelled">Canceladas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            <Wrench className="mx-auto mb-2 h-8 w-8 opacity-50" />
            No hay sesiones que coincidan.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-2">
          {filtered.map((s) => {
            const status = STATUS_LABELS[s.status] ?? { label: s.status, variant: "outline" as const };
            return (
              <Link
                key={s.id}
                to="/maintenance/$id"
                params={{ id: s.id }}
                className="block"
              >
                <Card className="transition hover:bg-muted/40">
                  <CardContent className="flex items-center justify-between gap-3 py-4">
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">{s.code}</span>
                        <Badge variant={status.variant} className="text-xs">
                          {status.label}
                        </Badge>
                        {s.is_external && (
                          <Badge variant="outline" className="text-xs">Externa</Badge>
                        )}
                      </div>
                      <p className="truncate text-sm font-medium">
                        {s.maintenance_plans?.name ?? "Sesión ad-hoc"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {s.scheduled_for
                          ? `Programada ${format(new Date(s.scheduled_for), "dd/MM/yyyy")}`
                          : `Creada ${format(new Date(s.created_at), "dd/MM/yyyy")}`}
                        {s.technician_name ? ` · ${s.technician_name}` : ""}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CreateSessionDialog({ companyId }: { companyId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [planId, setPlanId] = useState<string>("");
  const [scheduledFor, setScheduledFor] = useState("");
  const [technicianName, setTechnicianName] = useState("");
  const [locationId, setLocationId] = useState("");

  const { data: plans = [] } = useQuery({
    queryKey: ["plans-for-session", companyId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maintenance_plans")
        .select("id, code, name, checklist_template_id, asset_family_id, asset_families(code, name_i18n), checklist_templates(name, current_version)")
        .eq("company_id", companyId)
        .eq("active", true)
        .is("deleted_at", null)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: planLocations = [] } = useQuery({
    queryKey: ["plan-locations", planId],
    enabled: !!planId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maintenance_plan_assets")
        .select("assets(location_id, locations(name))")
        .eq("plan_id", planId);
      if (error) throw error;
      const map = new Map<string, string>();
      for (const row of data ?? []) {
        const loc = row.assets?.location_id;
        if (loc) map.set(loc, row.assets?.locations?.name ?? "Ubicación");
      }
      return [...map.entries()].map(([id, name]) => ({ id, name }));
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!planId) throw new Error("Selecciona un plan");
      const plan = plans.find((p) => p.id === planId);
      if (!plan) throw new Error("Plan no encontrado");

      // Activos asignados al plan (con su tipo y ubicación)
      const { data: planAssets, error: paErr } = await supabase
        .from("maintenance_plan_assets")
        .select("asset_id, assets(id, asset_type_id, location_id)")
        .eq("plan_id", planId);
      if (paErr) throw paErr;
      let rows = (planAssets ?? []).filter((pa) => pa.assets);
      if (locationId) rows = rows.filter((pa) => pa.assets?.location_id === locationId);
      if (rows.length === 0) throw new Error("El plan no tiene equipos para esta selección");

      // Plantilla de checklist por tipo de activo
      const { data: typeMap, error: tmErr } = await supabase
        .from("maintenance_plan_type_templates")
        .select("asset_type_id, checklist_template_id")
        .eq("plan_id", planId);
      if (tmErr) throw tmErr;
      const templateByType = new Map<string, string>(
        (typeMap ?? []).map((t) => [t.asset_type_id, t.checklist_template_id]),
      );
      const templateIds = [
        ...new Set(
          rows.map(
            (pa) => templateByType.get(pa.assets!.asset_type_id) ?? plan.checklist_template_id,
          ),
        ),
      ];

      const { data: vers, error: verErr } = await supabase
        .from("checklist_template_versions")
        .select("id, version, template_id")
        .in("template_id", templateIds)
        .eq("is_published", true)
        .order("version", { ascending: false });
      if (verErr) throw verErr;
      const versionByTemplate = new Map<string, string>();
      for (const v of vers ?? []) {
        if (!versionByTemplate.has(v.template_id)) versionByTemplate.set(v.template_id, v.id);
      }
      if (templateIds.some((t) => !versionByTemplate.has(t)))
        throw new Error("Hay tipos de activo cuya plantilla no tiene versión publicada");

      // Código
      const { data: code, error: codeErr } = await supabase.rpc("next_code", {
        p_company_id: companyId,
        p_scope: "maintenance_sessions",
        p_prefix: "MTS",
      });
      if (codeErr) throw codeErr;

      const { data: session, error: sessErr } = await supabase
        .from("maintenance_sessions")
        .insert({
          company_id: companyId,
          code,
          plan_id: planId,
          location_id: locationId || null,
          scheduled_for: scheduledFor || null,
          technician_name: technicianName || null,
          status: "draft",
        })
        .select()
        .single();
      if (sessErr) throw sessErr;

      const items = rows.map((pa) => {
        const templateId =
          templateByType.get(pa.assets!.asset_type_id) ?? plan.checklist_template_id;
        return {
          session_id: session.id,
          asset_id: pa.asset_id,
          checklist_template_version_id: versionByTemplate.get(templateId)!,
          result: "pending",
        };
      });
      const { error: itemsErr } = await supabase.from("maintenance_items").insert(items);
      if (itemsErr) throw itemsErr;

      return session.id;
    },
    onSuccess: (id) => {
      toast.success("Sesión creada");
      qc.invalidateQueries({ queryKey: ["maintenance-sessions"] });
      setOpen(false);
      setPlanId("");
      setLocationId("");
      setScheduledFor("");
      setTechnicianName("");
      window.location.assign(`/maintenance/${id}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Nueva sesión
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva sesión de mantenimiento</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Plan *</Label>
            <Select value={planId} onValueChange={setPlanId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un plan" />
              </SelectTrigger>
              <SelectContent>
                {plans.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} ({p.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {planLocations.length > 1 && (
            <div className="space-y-2">
              <Label>Ubicación</Label>
              <Select value={locationId || "__all__"} onValueChange={(v) => setLocationId(v === "__all__" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todas las ubicaciones del plan</SelectItem>
                  {planLocations.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Fecha programada</Label>
              <Input type="date" value={scheduledFor} onChange={(e) => setScheduledFor(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Técnico</Label>
              <Input value={technicianName} onChange={(e) => setTechnicianName(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => create.mutate()} disabled={create.isPending}>
            {create.isPending ? "Creando…" : "Crear"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
