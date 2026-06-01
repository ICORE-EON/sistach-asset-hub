import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, FileText, Download, Trash2, Loader2, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type EntityKind = "asset" | "incident" | "maintenance_session" | "certificate";

interface Props {
  entity: EntityKind;
  entityId: string;
  /** Optional default category for new uploads */
  defaultCategory?: string;
}

const CATEGORIES = [
  { value: "asset_photo", label: "Foto" },
  { value: "asset_manual", label: "Manual" },
  { value: "asset_invoice", label: "Factura" },
  { value: "asset_warranty", label: "Garantía" },
  { value: "maintenance_pdf", label: "PDF de mantenimiento" },
  { value: "maintenance_evidence", label: "Evidencia de mantenimiento" },
  { value: "incident_evidence", label: "Evidencia de incidencia" },
  { value: "certificate_pdf", label: "Certificado" },
  { value: "vehicle_doc", label: "Documento vehículo" },
  { value: "itv", label: "ITV" },
  { value: "insurance", label: "Seguro" },
  { value: "other", label: "Otro" },
];

function bytesFmt(n: number | null | undefined) {
  if (!n) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

const COLUMN_MAP: Record<EntityKind, string> = {
  asset: "asset_id",
  incident: "incident_id",
  maintenance_session: "maintenance_session_id",
  certificate: "certificate_id",
};

const PATH_PREFIX: Record<EntityKind, string> = {
  asset: "assets",
  incident: "incidents",
  maintenance_session: "sessions",
  certificate: "certificates",
};

export function AttachmentsPanel({ entity, entityId, defaultCategory = "other" }: Props) {
  const { activeCompanyId, activeMembership } = useCompany();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [category, setCategory] = useState(defaultCategory);
  const [title, setTitle] = useState("");
  const [toDelete, setToDelete] = useState<{ id: string; storage_path: string } | null>(null);

  const role = activeMembership?.role;
  const canUpload =
    role === "administrator" || role === "system_manager" || role === "manager" || role === "employee";
  const canDelete = role === "administrator";

  const column = COLUMN_MAP[entity];

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["attachments", entity, entityId],
    enabled: !!entityId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("id, title, category, mime_type, file_size_bytes, storage_path, storage_bucket, created_at, uploaded_by")
        .eq(column, entityId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      if (!activeCompanyId) throw new Error("No active company");
      setUploading(true);
      const ts = Date.now();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${activeCompanyId}/${PATH_PREFIX[entity]}/${entityId}/${ts}-${safeName}`;
      const { error: upErr } = await supabase.storage.from("documents").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || "application/octet-stream",
      });
      if (upErr) throw upErr;

      const { data: { user } } = await supabase.auth.getUser();

      const { error: insErr } = await supabase.from("documents").insert({
        company_id: activeCompanyId,
        title: title.trim() || file.name,
        category,
        storage_bucket: "documents",
        storage_path: path,
        mime_type: file.type || null,
        file_size_bytes: file.size,
        uploaded_by: user?.id ?? null,
        [column]: entityId,
      } as never);
      if (insErr) {
        // Rollback storage
        await supabase.storage.from("documents").remove([path]);
        throw insErr;
      }
    },
    onSuccess: () => {
      toast.success("Archivo subido");
      setTitle("");
      if (fileRef.current) fileRef.current.value = "";
      qc.invalidateQueries({ queryKey: ["attachments", entity, entityId] });
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => setUploading(false),
  });

  const remove = useMutation({
    mutationFn: async (doc: { id: string; storage_path: string }) => {
      const { error } = await supabase
        .from("documents")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", doc.id);
      if (error) throw error;
      // Best-effort storage removal (ignore failures)
      await supabase.storage.from("documents").remove([doc.storage_path]);
    },
    onSuccess: () => {
      toast.success("Archivo eliminado");
      qc.invalidateQueries({ queryKey: ["attachments", entity, entityId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function download(doc: { storage_path: string; storage_bucket: string; title: string }) {
    const { data, error } = await supabase.storage
      .from(doc.storage_bucket)
      .createSignedUrl(doc.storage_path, 60);
    if (error || !data) {
      toast.error(error?.message ?? "Error al generar enlace");
      return;
    }
    window.open(data.signedUrl, "_blank");
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      toast.error("Archivo demasiado grande (máx. 25 MB)");
      return;
    }
    upload.mutate(file);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Paperclip className="h-4 w-4" />
          Adjuntos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {canUpload && (
          <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Título (opcional)</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Nombre descriptivo"
                  disabled={uploading}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Categoría</Label>
                <Select value={category} onValueChange={setCategory} disabled={uploading}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Input
                ref={fileRef}
                type="file"
                onChange={onPick}
                disabled={uploading}
                className="flex-1"
              />
              {uploading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
            <p className="text-xs text-muted-foreground">Máximo 25 MB por archivo.</p>
          </div>
        )}

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : docs.length === 0 ? (
          <div className="rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">
            <Upload className="mx-auto mb-2 h-6 w-6 opacity-50" />
            Sin archivos adjuntos
          </div>
        ) : (
          <ul className="divide-y rounded-lg border">
            {docs.map((d) => (
              <li key={d.id} className="flex items-center gap-3 p-3">
                <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{d.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {CATEGORIES.find((c) => c.value === d.category)?.label ?? d.category} ·{" "}
                    {bytesFmt(d.file_size_bytes)} ·{" "}
                    {new Date(d.created_at).toLocaleDateString()}
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => download(d)} title="Descargar">
                  <Download className="h-4 w-4" />
                </Button>
                {canDelete && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setToDelete({ id: d.id, storage_path: d.storage_path })}
                    title="Eliminar"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}

        <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar archivo?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción no se puede deshacer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (toDelete) remove.mutate(toDelete);
                  setToDelete(null);
                }}
              >
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
