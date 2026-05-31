import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Save, History, UserPlus, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { INCIDENT_STATUSES, SEVERITY_LABELS } from "./_app.incidents.index";
import { AttachmentsPanel } from "@/components/attachments-panel";

export const Route = createFileRoute("/_authenticated/_app/incidents/$id")({
  head: () => ({ meta: [{ title: "Incidencia" }] }),
  component: IncidentDetail,
});

function IncidentDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const { activeMembership } = useCompany();
  const role = activeMembership?.role;
  const canEdit = role !== undefined && role !== "auditor";

  const { data: incident, isLoading } = useQuery({
    queryKey: ["incident", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("incidents")
        .select("*, assets(id, code, name), locations(id, name)")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: history = [] } = useQuery({
    queryKey: ["incident-history", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("incident_status_history")
        .select("*")
        .eq("incident_id", id)
        .order("changed_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: members = [] } = useQuery({
    queryKey: ["company-members", activeMembership?.company_id],
    enabled: !!activeMembership?.company_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_members")
        .select("user_id, role")
        .eq("company_id", activeMembership!.company_id)
        .eq("active", true);
      if (error) throw error;
      return data;
    },
  });

  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState("medium");
  const [assignedTo, setAssignedTo] = useState<string>("none");
  const [dueDate, setDueDate] = useState("");

  function startEdit() {
    if (!incident) return;
    setTitle(incident.title);
    setDescription(incident.description ?? "");
    setSeverity(incident.severity);
    setAssignedTo(incident.assigned_to ?? "none");
    setDueDate(incident.due_date ?? "");
    setEditing(true);
  }

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("incidents")
        .update({
          title: title.trim(),
          description: description.trim() || null,
          severity,
          assigned_to: assignedTo !== "none" ? assignedTo : null,
          due_date: dueDate || null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cambios guardados");
      qc.invalidateQueries({ queryKey: ["incident", id] });
      setEditing(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const changeStatus = useMutation({
    mutationFn: async ({ to, note }: { to: string; note?: string }) => {
      if (!incident) return;
      const patch: {
        status: string;
        resolved_at?: string | null;
        closed_at?: string | null;
      } = { status: to };
      if (to === "resolved") patch.resolved_at = new Date().toISOString();
      if (to === "closed") patch.closed_at = new Date().toISOString();
      const { error } = await supabase.from("incidents").update(patch).eq("id", id);
      if (error) throw error;
      const { error: hErr } = await supabase.from("incident_status_history").insert({
        incident_id: id,
        from_status: incident.status,
        to_status: to,
        note: note || null,
        changed_by: user?.id ?? null,
      });
      if (hErr) throw hErr;
    },
    onSuccess: () => {
      toast.success("Estado actualizado");
      qc.invalidateQueries({ queryKey: ["incident", id] });
      qc.invalidateQueries({ queryKey: ["incident-history", id] });
      qc.invalidateQueries({ queryKey: ["incidents"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("incidents").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Incidencia eliminada");
      qc.invalidateQueries({ queryKey: ["incidents"] });
      navigate({ to: "/incidents" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !incident) {
    return <div className="text-sm text-muted-foreground">Cargando…</div>;
  }

  const status = INCIDENT_STATUSES.find((s) => s.key === incident.status);
  const canManage = role === "administrator" || role === "system_manager";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link to="/incidents">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Volver
          </Link>
        </Button>
        <span className="font-mono text-xs text-muted-foreground">{incident.code}</span>
        {status && <Badge variant={status.variant}>{status.label}</Badge>}
        <Badge variant="outline" className={SEVERITY_LABELS[incident.severity]?.className}>
          {SEVERITY_LABELS[incident.severity]?.label ?? incident.severity}
        </Badge>
        {incident.source !== "manual" && (
          <Badge variant="outline" className="text-xs">{incident.source}</Badge>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Detalles</CardTitle>
              {canEdit && !editing && (
                <Button size="sm" variant="outline" onClick={startEdit}>Editar</Button>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {editing ? (
                <>
                  <div className="space-y-2">
                    <Label>Título</Label>
                    <Input value={title} onChange={(e) => setTitle(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Descripción</Label>
                    <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-2">
                      <Label>Severidad</Label>
                      <Select value={severity} onValueChange={setSeverity}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Baja</SelectItem>
                          <SelectItem value="medium">Media</SelectItem>
                          <SelectItem value="high">Alta</SelectItem>
                          <SelectItem value="critical">Crítica</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Asignar a</Label>
                      <Select value={assignedTo} onValueChange={setAssignedTo}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Sin asignar</SelectItem>
                          {members.map((m) => (
                            <SelectItem key={m.user_id} value={m.user_id}>
                              {m.user_id.slice(0, 8)} · {m.role}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Fecha límite</Label>
                      <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => save.mutate()} disabled={save.isPending}>
                      <Save className="mr-2 h-4 w-4" />
                      Guardar
                    </Button>
                    <Button variant="ghost" onClick={() => setEditing(false)}>Cancelar</Button>
                  </div>
                </>
              ) : (
                <>
                  <h2 className="text-lg font-semibold">{incident.title}</h2>
                  {incident.description && (
                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">{incident.description}</p>
                  )}
                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="text-xs text-muted-foreground">Activo</dt>
                      <dd>
                        {incident.assets ? (
                          <Link to="/assets/$id" params={{ id: incident.assets.id }} className="hover:underline">
                            {incident.assets.code} · {incident.assets.name ?? ""}
                          </Link>
                        ) : "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Ubicación</dt>
                      <dd>{incident.locations?.name ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Asignado a</dt>
                      <dd className="font-mono text-xs">{incident.assigned_to ? incident.assigned_to.slice(0, 8) : "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Fecha límite</dt>
                      <dd>{incident.due_date ? format(new Date(incident.due_date), "dd/MM/yyyy") : "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Creada</dt>
                      <dd>{format(new Date(incident.created_at), "dd/MM/yyyy HH:mm")}</dd>
                    </div>
                    {incident.resolved_at && (
                      <div>
                        <dt className="text-xs text-muted-foreground">Resuelta</dt>
                        <dd>{format(new Date(incident.resolved_at), "dd/MM/yyyy HH:mm")}</dd>
                      </div>
                    )}
                  </dl>
                </>
              )}
            </CardContent>
          </Card>

          {incident.status === "resolved" || incident.status === "closed" ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Resolución</CardTitle>
              </CardHeader>
              <CardContent>
                {incident.resolution_notes ? (
                  <p className="whitespace-pre-wrap text-sm">{incident.resolution_notes}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">Sin notas de resolución.</p>
                )}
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="space-y-4">
          {canEdit && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Cambiar estado</CardTitle>
              </CardHeader>
              <CardContent>
                <StatusActions
                  current={incident.status}
                  onChange={(to, note) => changeStatus.mutate({ to, note })}
                  pending={changeStatus.isPending}
                  onResolve={async (notes) => {
                    await supabase.from("incidents").update({ resolution_notes: notes }).eq("id", id);
                    changeStatus.mutate({ to: "resolved", note: notes });
                  }}
                />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <History className="h-4 w-4" />
                Historial
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {history.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin cambios todavía.</p>
              ) : (
                history.map((h) => {
                  const from = INCIDENT_STATUSES.find((s) => s.key === h.from_status);
                  const to = INCIDENT_STATUSES.find((s) => s.key === h.to_status);
                  return (
                    <div key={h.id} className="border-l-2 pl-3 text-sm">
                      <div className="flex flex-wrap items-center gap-1.5 text-xs">
                        {from && <Badge variant="outline" className="text-[10px]">{from.label}</Badge>}
                        <span className="text-muted-foreground">→</span>
                        {to && <Badge variant={to.variant} className="text-[10px]">{to.label}</Badge>}
                      </div>
                      {h.note && <p className="mt-1 text-xs text-muted-foreground">{h.note}</p>}
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {format(new Date(h.changed_at), "dd/MM/yyyy HH:mm")}
                      </p>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          {canManage && (
            <Card>
              <CardContent className="py-4">
                <Button
                  variant="destructive"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    if (confirm("¿Eliminar definitivamente esta incidencia?")) remove.mutate();
                  }}
                >
                  Eliminar incidencia
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusActions({
  current,
  onChange,
  onResolve,
  pending,
}: {
  current: string;
  onChange: (to: string, note?: string) => void;
  onResolve: (notes: string) => void;
  pending: boolean;
}) {
  const [note, setNote] = useState("");
  const transitions: Record<string, { key: string; label: string }[]> = {
    open: [{ key: "in_progress", label: "Empezar" }],
    in_progress: [
      { key: "open", label: "Reabrir a abierta" },
    ],
    resolved: [{ key: "closed", label: "Cerrar" }, { key: "in_progress", label: "Reabrir" }],
    closed: [{ key: "in_progress", label: "Reabrir" }],
  };
  const opts = transitions[current] ?? [];

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label className="text-xs">Nota (opcional)</Label>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
      </div>
      <div className="flex flex-wrap gap-2">
        {opts.map((o) => (
          <Button
            key={o.key}
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => {
              onChange(o.key, note);
              setNote("");
            }}
          >
            {o.label}
          </Button>
        ))}
        {(current === "open" || current === "in_progress") && (
          <Button
            size="sm"
            disabled={pending}
            onClick={() => {
              onResolve(note);
              setNote("");
            }}
          >
            <CheckCircle2 className="mr-1 h-4 w-4" />
            Resolver
          </Button>
        )}
      </div>
    </div>
  );
}
