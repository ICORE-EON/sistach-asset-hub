import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, AlertTriangle, Search, LayoutGrid, List as ListIcon } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/_app/incidents/")({
  head: () => ({ meta: [{ title: "Incidencias" }] }),
  component: IncidentsList,
});

export const INCIDENT_STATUSES = [
  { key: "open", label: "Abierta", variant: "destructive" as const },
  { key: "in_progress", label: "En curso", variant: "secondary" as const },
  { key: "resolved", label: "Resuelta", variant: "default" as const },
  { key: "closed", label: "Cerrada", variant: "outline" as const },
];

export const SEVERITY_LABELS: Record<string, { label: string; className: string }> = {
  low: { label: "Baja", className: "bg-muted text-muted-foreground" },
  medium: { label: "Media", className: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400" },
  high: { label: "Alta", className: "bg-orange-500/15 text-orange-700 dark:text-orange-400" },
  critical: { label: "Crítica", className: "bg-destructive/15 text-destructive" },
};

function IncidentsList() {
  const { activeMembership } = useCompany();
  const companyId = activeMembership?.company_id;
  const role = activeMembership?.role;
  const canCreate =
    role === "administrator" || role === "system_manager" || role === "manager" || role === "technician";
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [view, setView] = useState<"kanban" | "list">("kanban");

  const { data: incidents = [] } = useQuery({
    queryKey: ["incidents", companyId, severityFilter],
    enabled: !!companyId,
    queryFn: async () => {
      let q = supabase
        .from("incidents")
        .select("*, assets(code, name)")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false })
        .limit(500);
      if (severityFilter !== "all") q = q.eq("severity", severityFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const filtered = incidents.filter((i) => {
    if (!search) return true;
    const t = search.toLowerCase();
    return (
      i.code.toLowerCase().includes(t) ||
      i.title.toLowerCase().includes(t) ||
      i.assets?.code?.toLowerCase().includes(t)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Incidencias</h1>
          <p className="text-sm text-muted-foreground">
            Detección, asignación y resolución de incidencias sobre activos.
          </p>
        </div>
        {canCreate && companyId && <CreateIncidentDialog companyId={companyId} />}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por código, título o activo…"
            className="pl-9"
          />
        </div>
        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="low">Baja</SelectItem>
            <SelectItem value="medium">Media</SelectItem>
            <SelectItem value="high">Alta</SelectItem>
            <SelectItem value="critical">Crítica</SelectItem>
          </SelectContent>
        </Select>
        <Tabs value={view} onValueChange={(v) => setView(v as "kanban" | "list")}>
          <TabsList>
            <TabsTrigger value="kanban" className="gap-1.5">
              <LayoutGrid className="h-4 w-4" />
              Kanban
            </TabsTrigger>
            <TabsTrigger value="list" className="gap-1.5">
              <ListIcon className="h-4 w-4" />
              Lista
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            <AlertTriangle className="mx-auto mb-2 h-8 w-8 opacity-50" />
            No hay incidencias.
          </CardContent>
        </Card>
      ) : view === "kanban" ? (
        <KanbanView incidents={filtered} />
      ) : (
        <ListView incidents={filtered} />
      )}
    </div>
  );
}

function KanbanView({ incidents }: { incidents: any[] }) {
  return (
    <div className="grid gap-3 lg:grid-cols-4 sm:grid-cols-2">
      {INCIDENT_STATUSES.map((col) => {
        const items = incidents.filter((i) => i.status === col.key);
        return (
          <div key={col.key} className="rounded-lg border bg-muted/30">
            <div className="flex items-center justify-between border-b px-3 py-2">
              <div className="flex items-center gap-2">
                <Badge variant={col.variant} className="text-xs">{col.label}</Badge>
              </div>
              <span className="text-xs text-muted-foreground">{items.length}</span>
            </div>
            <div className="space-y-2 p-2 min-h-[120px]">
              {items.map((i) => (
                <Link
                  key={i.id}
                  to="/incidents/$id"
                  params={{ id: i.id }}
                  className="block"
                >
                  <Card className="transition hover:bg-muted/40">
                    <CardContent className="space-y-1.5 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[10px] text-muted-foreground">{i.code}</span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${SEVERITY_LABELS[i.severity]?.className ?? ""}`}
                        >
                          {SEVERITY_LABELS[i.severity]?.label ?? i.severity}
                        </Badge>
                      </div>
                      <p className="line-clamp-2 text-sm font-medium leading-snug">{i.title}</p>
                      {i.assets && (
                        <p className="truncate text-xs text-muted-foreground">
                          {i.assets.code} · {i.assets.name ?? ""}
                        </p>
                      )}
                      <p className="text-[10px] text-muted-foreground">
                        {format(new Date(i.created_at), "dd/MM/yyyy")}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
              {items.length === 0 && (
                <p className="px-2 py-6 text-center text-xs text-muted-foreground">—</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ListView({ incidents }: { incidents: any[] }) {
  return (
    <div className="grid gap-2">
      {incidents.map((i) => {
        const status = INCIDENT_STATUSES.find((s) => s.key === i.status);
        return (
          <Link key={i.id} to="/incidents/$id" params={{ id: i.id }} className="block">
            <Card className="transition hover:bg-muted/40">
              <CardContent className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">{i.code}</span>
                    {status && (
                      <Badge variant={status.variant} className="text-xs">{status.label}</Badge>
                    )}
                    <Badge
                      variant="outline"
                      className={`text-xs ${SEVERITY_LABELS[i.severity]?.className ?? ""}`}
                    >
                      {SEVERITY_LABELS[i.severity]?.label ?? i.severity}
                    </Badge>
                  </div>
                  <p className="truncate text-sm font-medium">{i.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {i.assets?.code ? `${i.assets.code} · ` : ""}
                    {format(new Date(i.created_at), "dd/MM/yyyy")}
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}

function CreateIncidentDialog({ companyId }: { companyId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState("medium");
  const [assetId, setAssetId] = useState<string>("none");

  const { data: assets = [] } = useQuery({
    queryKey: ["assets-for-incident", companyId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assets")
        .select("id, code, name")
        .eq("company_id", companyId)
        .is("deleted_at", null)
        .order("code")
        .limit(500);
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error("El título es obligatorio");
      const { data: code, error: codeErr } = await supabase.rpc("next_code", {
        p_company_id: companyId,
        p_scope: "incidents",
        p_prefix: "INC",
      });
      if (codeErr) throw codeErr;
      const { data, error } = await supabase
        .from("incidents")
        .insert({
          company_id: companyId,
          code,
          title: title.trim(),
          description: description.trim() || null,
          severity,
          status: "open",
          source: "manual",
          asset_id: assetId !== "none" ? assetId : null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Incidencia creada");
      qc.invalidateQueries({ queryKey: ["incidents"] });
      setOpen(false);
      setTitle("");
      setDescription("");
      setSeverity("medium");
      setAssetId("none");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Nueva incidencia
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva incidencia</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Título *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Descripción</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Severidad</Label>
              <Select value={severity} onValueChange={setSeverity}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baja</SelectItem>
                  <SelectItem value="medium">Media</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="critical">Crítica</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Activo</Label>
              <Select value={assetId} onValueChange={setAssetId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin asignar</SelectItem>
                  {assets.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.code} · {a.name ?? ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
