import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Settings as SettingsIcon, Trash2, Building2, Users, Bell, Hash,
  Copy, Mail, UserPlus, AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import type { Database } from "@/integrations/supabase/types";

type Role = Database["public"]["Enums"]["app_role"];

const ROLES: { value: Role; label: string }[] = [
  { value: "administrator", label: "Administrador" },
  { value: "system_manager", label: "Responsable" },
  { value: "manager", label: "Gestor" },
  { value: "employee", label: "Operario" },
  { value: "auditor", label: "Auditor" },
];

const SCOPES = [
  { value: "assets", label: "Activos" },
  { value: "maintenance_sessions", label: "Mantenimientos" },
  { value: "incidents", label: "Incidencias" },
  { value: "certificate", label: "Certificados" },
];

export const Route = createFileRoute("/_authenticated/_app/settings")({
  head: () => ({ meta: [{ title: "Administración" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { activeCompanyId, activeMembership } = useCompany();
  const role = activeMembership?.role;
  const canManage = role === "administrator" || role === "system_manager";
  const isAdmin = role === "administrator";

  if (!activeCompanyId) return null;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <SettingsIcon className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Administración</h1>
          <p className="text-sm text-muted-foreground">
            Configuración de la empresa, miembros y preferencias.
          </p>
        </div>
      </div>

      <Tabs defaultValue="company" className="space-y-4">
        <TabsList>
          <TabsTrigger value="company"><Building2 className="mr-2 h-4 w-4" />Empresa</TabsTrigger>
          <TabsTrigger value="members"><Users className="mr-2 h-4 w-4" />Miembros</TabsTrigger>
          <TabsTrigger value="notifications"><Bell className="mr-2 h-4 w-4" />Notificaciones</TabsTrigger>
          <TabsTrigger value="numbering"><Hash className="mr-2 h-4 w-4" />Numeración</TabsTrigger>
        </TabsList>

        <TabsContent value="company" className="space-y-4">
          <CompanyDataCard companyId={activeCompanyId} canManage={canManage} />
          <CompanyLogoCard companyId={activeCompanyId} canManage={canManage} />
        </TabsContent>

        <TabsContent value="members" className="space-y-4">
          <MembersCard companyId={activeCompanyId} isAdmin={isAdmin} />
          <InvitationsCard companyId={activeCompanyId} isAdmin={isAdmin} />
        </TabsContent>

        <TabsContent value="notifications">
          <NotificationsCard companyId={activeCompanyId} canManage={canManage} />
        </TabsContent>

        <TabsContent value="numbering">
          <CountersCard companyId={activeCompanyId} isAdmin={isAdmin} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ============ Datos de la empresa ============ */
function CompanyDataCard({ companyId, canManage }: { companyId: string; canManage: boolean }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["company-data", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies").select("*").eq("id", companyId).single();
      if (error) throw error;
      return data;
    },
  });

  const [form, setForm] = useState({
    name: "", cif: "", address: "", timezone: "Europe/Madrid",
    locale: "es", primary_color: "",
  });

  useEffect(() => {
    if (data) {
      setForm({
        name: data.name ?? "",
        cif: data.cif ?? "",
        address: data.address ?? "",
        timezone: data.timezone ?? "Europe/Madrid",
        locale: data.locale ?? "es",
        primary_color: data.primary_color ?? "",
      });
    }
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("companies").update({
        name: form.name, cif: form.cif, address: form.address || null,
        timezone: form.timezone, locale: form.locale,
        primary_color: form.primary_color || null,
      }).eq("id", companyId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Datos guardados");
      qc.invalidateQueries({ queryKey: ["company-data", companyId] });
      qc.invalidateQueries({ queryKey: ["memberships"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Datos de la empresa</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Nombre comercial</Label>
              <Input value={form.name} disabled={!canManage}
                onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>CIF / NIF</Label>
              <Input value={form.cif} disabled={!canManage}
                onChange={(e) => setForm({ ...form, cif: e.target.value })} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Dirección</Label>
              <Textarea rows={2} value={form.address} disabled={!canManage}
                onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Zona horaria</Label>
              <Input value={form.timezone} disabled={!canManage}
                onChange={(e) => setForm({ ...form, timezone: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Idioma</Label>
              <Select value={form.locale} onValueChange={(v) => setForm({ ...form, locale: v })} disabled={!canManage}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="es">Español</SelectItem>
                  <SelectItem value="ca">Català</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Color principal (hex)</Label>
              <div className="flex items-center gap-2">
                <Input placeholder="#0ea5e9" value={form.primary_color} disabled={!canManage}
                  onChange={(e) => setForm({ ...form, primary_color: e.target.value })} />
                {form.primary_color && (
                  <div className="h-9 w-9 rounded border" style={{ background: form.primary_color }} />
                )}
              </div>
            </div>
          </div>
        )}
        {canManage && (
          <div className="flex justify-end">
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              Guardar cambios
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ============ Logo ============ */
function CompanyLogoCard({ companyId, canManage }: { companyId: string; canManage: boolean }) {
  const qc = useQueryClient();
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data: company } = useQuery({
    queryKey: ["company-logo", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies").select("logo_url").eq("id", companyId).single();
      if (error) throw error;
      return data;
    },
  });

  const logoUrl = company?.logo_url ?? null;

  useEffect(() => {
    let cancelled = false;
    if (!logoUrl) { setSignedUrl(null); return; }
    supabase.storage.from("company-logos").createSignedUrl(logoUrl, 300)
      .then(({ data }) => { if (!cancelled) setSignedUrl(data?.signedUrl ?? null); });
    return () => { cancelled = true; };
  }, [logoUrl]);

  const update = useMutation({
    mutationFn: async (path: string | null) => {
      const { error } = await supabase.from("companies").update({ logo_url: path }).eq("id", companyId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["company-logo", companyId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const handleFile = async (file: File) => {
    if (file.size > 2 * 1024 * 1024) { toast.error("Máximo 2 MB"); return; }
    const ext = (file.name.split(".").pop() || "png").toLowerCase();
    const path = `${companyId}/company-logo.${ext}`;
    setUploading(true);
    const { error } = await supabase.storage.from("company-logos")
      .upload(path, file, { upsert: true, contentType: file.type });
    setUploading(false);
    if (error) { toast.error(error.message); return; }
    await update.mutateAsync(path);
    toast.success("Logo actualizado");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Logo de la empresa</CardTitle>
        <CardDescription>Se usa en los certificados PDF. PNG/JPG, máx. 2 MB.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {signedUrl ? (
          <div className="flex items-center gap-4">
            <img src={signedUrl} alt="Logo" className="h-20 rounded border bg-white object-contain p-2" />
            {canManage && (
              <Button variant="outline" size="sm" onClick={() => update.mutate(null)} disabled={update.isPending}>
                <Trash2 className="mr-2 h-4 w-4" />Quitar
              </Button>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Sin logo configurado.</p>
        )}
        {canManage && (
          <div>
            <input type="file" accept="image/png,image/jpeg" disabled={uploading}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
              className="text-sm" />
            {uploading && <p className="mt-1 text-xs text-muted-foreground">Subiendo…</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ============ Miembros ============ */
function MembersCard({ companyId, isAdmin }: { companyId: string; isAdmin: boolean }) {
  const qc = useQueryClient();
  const { data: members = [], isLoading } = useQuery({
    queryKey: ["company-members", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_members")
        .select("id, user_id, role, active, joined_at, profiles:user_id(full_name, email)")
        .eq("company_id", companyId)
        .order("joined_at", { ascending: true });
      if (error) throw error;
      return data as Array<{
        id: string; user_id: string; role: Role; active: boolean; joined_at: string;
        profiles: { full_name: string | null; email: string } | null;
      }>;
    },
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: { role?: Role; active?: boolean } }) => {
      const { error } = await supabase.from("company_members").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["company-members", companyId] }); toast.success("Actualizado"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Miembros del equipo</CardTitle>
        <CardDescription>Personas con acceso a esta empresa.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? <p className="text-sm text-muted-foreground">Cargando…</p> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuario</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-[100px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>
                    <div className="font-medium">{m.profiles?.full_name || "—"}</div>
                    <div className="text-xs text-muted-foreground">{m.profiles?.email}</div>
                  </TableCell>
                  <TableCell>
                    {isAdmin ? (
                      <Select value={m.role} onValueChange={(v) => update.mutate({ id: m.id, patch: { role: v as Role } })}>
                        <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="outline">{ROLES.find((r) => r.value === m.role)?.label ?? m.role}</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {isAdmin ? (
                      <Switch checked={m.active} onCheckedChange={(v) => update.mutate({ id: m.id, patch: { active: v } })} />
                    ) : (
                      <Badge variant={m.active ? "default" : "secondary"}>{m.active ? "Activo" : "Inactivo"}</Badge>
                    )}
                  </TableCell>
                  <TableCell />
                </TableRow>
              ))}
              {members.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground">Sin miembros</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

/* ============ Invitaciones ============ */
function InvitationsCard({ companyId, isAdmin }: { companyId: string; isAdmin: boolean }) {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("employee");

  const { data: invites = [] } = useQuery({
    queryKey: ["company-invitations", companyId],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_invitations")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const invite = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("invite_company_member", {
        p_company_id: companyId, p_email: email, p_role: role,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Invitación creada");
      setEmail("");
      qc.invalidateQueries({ queryKey: ["company-invitations", companyId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revoke = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("company_invitations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["company-invitations", companyId] }); toast.success("Invitación eliminada"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/accept-invitation/${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Enlace copiado");
  };

  if (!isAdmin) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Invitaciones</CardTitle>
        <CardDescription>Invita a nuevos miembros por email. Comparte el enlace generado.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-end">
          <div className="flex-1 space-y-2">
            <Label>Email</Label>
            <Input type="email" value={email} placeholder="usuario@ejemplo.com"
              onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2 md:w-[180px]">
            <Label>Rol</Label>
            <Select value={role} onValueChange={(v) => setRole(v as Role)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => invite.mutate()} disabled={!email || invite.isPending}>
            <UserPlus className="mr-2 h-4 w-4" />Invitar
          </Button>
        </div>

        {invites.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-[180px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {invites.map((i) => {
                const expired = new Date(i.expires_at) < new Date();
                const status = i.accepted_at ? "accepted" : expired ? "expired" : "pending";
                return (
                  <TableRow key={i.id}>
                    <TableCell><Mail className="mr-1 inline h-3 w-3" />{i.email}</TableCell>
                    <TableCell>{ROLES.find((r) => r.value === i.role)?.label ?? i.role}</TableCell>
                    <TableCell>
                      {status === "accepted" && <Badge variant="default">Aceptada</Badge>}
                      {status === "expired" && <Badge variant="secondary">Caducada</Badge>}
                      {status === "pending" && <Badge variant="outline">Pendiente</Badge>}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        {status === "pending" && (
                          <Button size="sm" variant="ghost" onClick={() => copyLink(i.token)}>
                            <Copy className="mr-1 h-3 w-3" />Enlace
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => revoke.mutate(i.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

/* ============ Notificaciones ============ */
function NotificationsCard({ companyId, canManage }: { companyId: string; canManage: boolean }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["notifications-config", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("company_features")
        .select("*").eq("company_id", companyId).eq("feature_key", "notifications").maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const cfg = (data?.config ?? {}) as {
    warning_days?: number;
    critical_days?: number;
    email_recipients?: string[];
    notify_incidents?: boolean;
    notify_maintenance_closed?: boolean;
  };
  const [form, setForm] = useState({
    warning_days: 30, critical_days: 7,
    email_recipients: "", notify_incidents: true, notify_maintenance_closed: true,
  });

  useEffect(() => {
    setForm({
      warning_days: cfg.warning_days ?? 30,
      critical_days: cfg.critical_days ?? 7,
      email_recipients: (cfg.email_recipients ?? []).join(", "),
      notify_incidents: cfg.notify_incidents ?? true,
      notify_maintenance_closed: cfg.notify_maintenance_closed ?? true,
    });
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      const emails = form.email_recipients.split(",").map((s) => s.trim()).filter(Boolean);
      const { error } = await supabase.from("company_features").upsert({
        company_id: companyId,
        feature_key: "notifications",
        enabled: true,
        config: {
          warning_days: Number(form.warning_days),
          critical_days: Number(form.critical_days),
          email_recipients: emails,
          notify_incidents: form.notify_incidents,
          notify_maintenance_closed: form.notify_maintenance_closed,
        },
      }, { onConflict: "company_id,feature_key" });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Preferencias guardadas"); qc.invalidateQueries({ queryKey: ["notifications-config", companyId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Preferencias de notificaciones</CardTitle>
        <CardDescription>Umbrales de caducidad y destinatarios de avisos por email.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? <p className="text-sm text-muted-foreground">Cargando…</p> : (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Aviso (días antes de caducidad)</Label>
                <Input type="number" min={1} max={365} disabled={!canManage}
                  value={form.warning_days}
                  onChange={(e) => setForm({ ...form, warning_days: Number(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label>Crítico (días antes de caducidad)</Label>
                <Input type="number" min={1} max={90} disabled={!canManage}
                  value={form.critical_days}
                  onChange={(e) => setForm({ ...form, critical_days: Number(e.target.value) })} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Destinatarios email (separados por coma)</Label>
                <Input type="text" placeholder="aviso@empresa.com, jefe@empresa.com" disabled={!canManage}
                  value={form.email_recipients}
                  onChange={(e) => setForm({ ...form, email_recipients: e.target.value })} />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label>Nuevas incidencias</Label>
                  <p className="text-xs text-muted-foreground">Notificar al equipo cuando se abra una incidencia</p>
                </div>
                <Switch checked={form.notify_incidents} disabled={!canManage}
                  onCheckedChange={(v) => setForm({ ...form, notify_incidents: v })} />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label>Cierre de mantenimientos</Label>
                  <p className="text-xs text-muted-foreground">Notificar cuando una sesión se firma y cierra</p>
                </div>
                <Switch checked={form.notify_maintenance_closed} disabled={!canManage}
                  onCheckedChange={(v) => setForm({ ...form, notify_maintenance_closed: v })} />
              </div>
            </div>
            {canManage && (
              <div className="flex justify-end">
                <Button onClick={() => save.mutate()} disabled={save.isPending}>Guardar</Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

/* ============ Numeración ============ */
function CountersCard({ companyId, isAdmin }: { companyId: string; isAdmin: boolean }) {
  const qc = useQueryClient();
  const year = new Date().getFullYear();
  const { data: counters = [] } = useQuery({
    queryKey: ["company-counters", companyId, year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("counters").select("*").eq("company_id", companyId).eq("year", year);
      if (error) throw error;
      return data;
    },
  });

  const setCounter = useMutation({
    mutationFn: async ({ scope, value }: { scope: string; value: number }) => {
      const { error } = await supabase.rpc("set_company_counter", {
        p_company_id: companyId, p_scope: scope, p_year: year, p_value: value,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Contador actualizado"); qc.invalidateQueries({ queryKey: ["company-counters", companyId, year] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const [edits, setEdits] = useState<Record<string, string>>({});

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Numeración {year}</CardTitle>
        <CardDescription>
          Último número usado en cada tipo de código. Editar solo en casos excepcionales —
          puede causar códigos duplicados.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>El siguiente código emitido será <strong>valor actual + 1</strong>.</span>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo</TableHead>
              <TableHead>Año</TableHead>
              <TableHead>Último valor</TableHead>
              {isAdmin && <TableHead className="w-[260px]">Reiniciar / fijar</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {SCOPES.map((s) => {
              const row = counters.find((c) => c.scope === s.value);
              const value = row?.value ?? 0;
              return (
                <TableRow key={s.value}>
                  <TableCell>{s.label}</TableCell>
                  <TableCell>{year}</TableCell>
                  <TableCell><Badge variant="outline">{String(value).padStart(4, "0")}</Badge></TableCell>
                  {isAdmin && (
                    <TableCell>
                      <div className="flex gap-2">
                        <Input type="number" min={0} className="h-8 w-24"
                          placeholder={String(value)}
                          value={edits[s.value] ?? ""}
                          onChange={(e) => setEdits({ ...edits, [s.value]: e.target.value })} />
                        <Button size="sm" variant="outline" disabled={!edits[s.value]}
                          onClick={() => { setCounter.mutate({ scope: s.value, value: Number(edits[s.value]) }); setEdits({ ...edits, [s.value]: "" }); }}>
                          Fijar
                        </Button>
                        <Button size="sm" variant="ghost"
                          onClick={() => setCounter.mutate({ scope: s.value, value: 0 })}>
                          A 0
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
