import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, Download, Search, FolderOpen } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/_app/documents")({
  head: () => ({ meta: [{ title: "Documentos" }] }),
  component: DocumentsPage,
});

const CATEGORY_LABELS: Record<string, string> = {
  manual: "Manual",
  datasheet: "Ficha técnica",
  invoice: "Factura",
  certificate: "Certificado",
  photo: "Foto",
  report: "Informe",
  other: "Otro",
};

function bytesFmt(n: number | null) {
  if (!n) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function DocumentsPage() {
  const { activeCompanyId } = useCompany();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["documents-all", activeCompanyId],
    enabled: !!activeCompanyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select(
          "id, title, category, mime_type, file_size_bytes, storage_path, storage_bucket, created_at, asset_id, incident_id, maintenance_session_id, asset:assets!documents_asset_id_fkey(name, code), incident:incidents!documents_incident_id_fkey(code), session:maintenance_sessions!documents_maintenance_session_id_fkey(code)",
        )
        .eq("company_id", activeCompanyId!)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
  });

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return docs.filter((d) => {
      if (category !== "all" && d.category !== category) return false;
      if (!s) return true;
      return d.title?.toLowerCase().includes(s);
    });
  }, [docs, search, category]);

  async function download(d: { storage_path: string; storage_bucket: string }) {
    const { data, error } = await supabase.storage
      .from(d.storage_bucket)
      .createSignedUrl(d.storage_path, 60);
    if (error || !data) {
      toast.error(error?.message ?? "Error al generar enlace");
      return;
    }
    window.open(data.signedUrl, "_blank");
  }

  function linkFor(d: {
    asset_id: string | null;
    incident_id: string | null;
    maintenance_session_id: string | null;
  }) {
    if (d.asset_id) return { to: "/assets/$id", params: { id: d.asset_id }, label: "Activo" };
    if (d.incident_id)
      return { to: "/incidents/$id", params: { id: d.incident_id }, label: "Incidencia" };
    if (d.maintenance_session_id)
      return {
        to: "/maintenance/$id",
        params: { id: d.maintenance_session_id },
        label: "Sesión",
      };
    return null;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Documentos</h1>
        <p className="text-sm text-muted-foreground">
          Todos los archivos adjuntos de tu empresa.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por título…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las categorías</SelectItem>
            {Object.entries(CATEGORY_LABELS).map(([v, l]) => (
              <SelectItem key={v} value={v}>
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <FolderOpen className="mb-3 h-12 w-12 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              {docs.length === 0
                ? "Aún no hay documentos. Sube archivos desde un activo, incidencia o sesión de mantenimiento."
                : "Sin resultados con esos filtros."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y">
              {filtered.map((d) => {
                const target = linkFor(d);
                return (
                  <li key={d.id} className="flex items-center gap-3 p-4">
                    <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{d.title}</p>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline" className="text-[10px]">
                          {CATEGORY_LABELS[d.category] ?? d.category}
                        </Badge>
                        <span>{bytesFmt(d.file_size_bytes)}</span>
                        <span>{format(new Date(d.created_at), "dd MMM yyyy")}</span>
                        {target && (
                          <Link
                            to={target.to}
                            params={target.params as never}
                            className="text-primary hover:underline"
                          >
                            {target.label}
                            {d.assets?.code && ` · ${d.assets.code}`}
                            {d.incidents?.code && ` · ${d.incidents.code}`}
                            {d.maintenance_sessions?.code &&
                              ` · ${d.maintenance_sessions.code}`}
                          </Link>
                        )}
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => download(d)}>
                      <Download className="h-4 w-4" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
