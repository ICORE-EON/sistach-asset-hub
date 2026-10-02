import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

export const Route = createFileRoute("/_authenticated/_app/locations")({
  head: () => ({ meta: [{ title: "Ubicaciones" }] }),
  component: LocationsPage,
});

const KINDS = [
  { value: "site", label: "Sede / Centro" },
  { value: "building", label: "Edificio" },
  { value: "floor", label: "Planta" },
  { value: "area", label: "Área" },
  { value: "room", label: "Sala" },
  { value: "vehicle", label: "Vehículo" },
  { value: "outdoor", label: "Exterior" },
];

function LocationsPage() {
  const { activeCompanyId, activeMembership } = useCompany();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const role = activeMembership?.role;
  const canManage = role === "administrator" || role === "system_manager";

  const { data: locations = [], isLoading } = useQuery({
    queryKey: ["locations-admin", activeCompanyId],
    enabled: !!activeCompanyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("locations")
        .select("*, parent:locations!parent_location_id(name, code)")
        .eq("company_id", activeCompanyId!)
        .is("deleted_at", null)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("locations")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ubicación eliminada");
      qc.invalidateQueries({ queryKey: ["locations-admin"] });
      qc.invalidateQueries({ queryKey: ["locations"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <MapPin className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Ubicaciones</h1>
            <p className="text-sm text-muted-foreground">
              Estructura jerárquica de edificios, plantas, áreas y salas
            </p>
          </div>
        </div>
        {canManage && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nueva ubicación
              </Button>
            </DialogTrigger>
            <CreateLocationDialog
              locations={locations}
              onCreated={() => {
                setOpen(false);
                qc.invalidateQueries({ queryKey: ["locations-admin"] });
                qc.invalidateQueries({ queryKey: ["locations"] });
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
              <TableHead>Padre</TableHead>
              <TableHead>Dirección</TableHead>
              <TableHead className="w-[100px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  Cargando…
                </TableCell>
              </TableRow>
            ) : locations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  Aún no hay ubicaciones.
                </TableCell>
              </TableRow>
            ) : (
              locations.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-mono text-xs">{l.code}</TableCell>
                  <TableCell className="font-medium">{l.name}</TableCell>
                  <TableCell className="text-sm">
                    {KINDS.find((k) => k.value === l.kind)?.label ?? l.kind}
                  </TableCell>
                  <TableCell className="text-sm">{l.parent?.name ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{l.address ?? "—"}</TableCell>
                  <TableCell>
                    {canManage && (
                      <div className="flex">
                      <Button variant="ghost" size="icon" aria-label="Editar" onClick={() => setEditing(l)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm(`¿Eliminar ubicación ${l.name}?`)) remove.mutate(l.id);
                        }}
                      >
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
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        {editing && (
          <CreateLocationDialog
            key={editing.id}
            initial={editing}
            locations={locations.filter((x) => x.id !== editing.id)}
            onCreated={() => {
              setEditing(null);
              qc.invalidateQueries({ queryKey: ["locations-admin"] });
              qc.invalidateQueries({ queryKey: ["locations"] });
            }}
          />
        )}
      </Dialog>
    </div>
  );
}

function CreateLocationDialog({
  locations,
  onCreated,
  initial,
}: {
  initial?: { id: string; code: string; name: string; kind: string; parent_location_id: string | null; address: string | null; notes: string | null };
  locations: Array<{ id: string; name: string; code: string }>;
  onCreated: () => void;
}) {
  const { activeCompanyId } = useCompany();
  const [code, setCode] = useState(initial?.code ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [kind, setKind] = useState(initial?.kind ?? "area");
  const [parent, setParent] = useState<string>(initial?.parent_location_id ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  const create = useMutation({
    mutationFn: async () => {
      if (!activeCompanyId) throw new Error("Sin empresa activa");
      if (!code || !name) throw new Error("Código y nombre son obligatorios");
      const payload = {
        code: code.toUpperCase(),
        name,
        kind,
        parent_location_id: parent || null,
        address: address || null,
        notes: notes || null,
      };
      const { error } = initial
        ? await supabase.from("locations").update(payload).eq("id", initial.id).eq("company_id", activeCompanyId)
        : await supabase.from("locations").insert({ ...payload, company_id: activeCompanyId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(initial ? "Ubicación actualizada" : "Ubicación creada");
      onCreated();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{initial ? "Editar ubicación" : "Nueva ubicación"}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Código *</Label>
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="EDIF-A" />
          </div>
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={kind} onValueChange={setKind}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {KINDS.map((k) => (
                  <SelectItem key={k.value} value={k.value}>
                    {k.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Nombre *</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Edificio A" />
        </div>
        <div className="space-y-2">
          <Label>Ubicación padre</Label>
          <Select value={parent} onValueChange={setParent}>
            <SelectTrigger>
              <SelectValue placeholder="Sin padre" />
            </SelectTrigger>
            <SelectContent>
              {locations.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Dirección</Label>
          <Input value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Notas</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </div>
      </div>
      <DialogFooter>
        <Button onClick={() => create.mutate()} disabled={create.isPending}>
          {create.isPending ? "Guardando…" : initial ? "Guardar" : "Crear"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
