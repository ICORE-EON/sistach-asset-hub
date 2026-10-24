/** Standalone host slot: upload/download one evidence document for a metrology record. */
import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Loader2, Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { Button } from "@/components/ui/button";
import type { RecordDocumentSlotProps } from "../../ui/host";

export function StandaloneRecordDocument({ value, onChange, disabled }: RecordDocumentSlotProps) {
  const { activeCompanyId } = useCompany();
  const qc = useQueryClient();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const { data: doc } = useQuery({
    queryKey: ["record-document", activeCompanyId, value],
    enabled: !!value && !!activeCompanyId,
    queryFn: async () => {
      const { data, error } = await supabase.from("documents")
        .select("id, title, storage_bucket, storage_path")
        .eq("company_id", activeCompanyId!).eq("id", value!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (ref.current) ref.current.value = "";
    if (!file || !activeCompanyId) return;
    if (file.size > 25 * 1024 * 1024) return toast.error("Archivo demasiado grande (máx. 25 MB)");
    setBusy(true);
    try {
      const path = `${activeCompanyId}/metrology/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const up = await supabase.storage.from("documents").upload(path, file, { contentType: file.type || "application/octet-stream" });
      if (up.error) throw up.error;
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase.from("documents").insert({
        company_id: activeCompanyId, title: file.name, category: "certificate_pdf", storage_bucket: "documents",
        storage_path: path, mime_type: file.type || null, file_size_bytes: file.size, uploaded_by: user?.id ?? null,
      } as never).select("id").single();
      if (error) { await supabase.storage.from("documents").remove([path]); throw error; }
      onChange((data as { id: string }).id);
      qc.invalidateQueries({ queryKey: ["record-document"] });
      toast.success("Documento adjuntado");
    } catch (err) {
      toast.error((err as Error).message);
    } finally { setBusy(false); }
  }

  async function open() {
    if (!doc) return;
    const { data, error } = await supabase.storage.from(doc.storage_bucket).createSignedUrl(doc.storage_path, 60);
    if (error || !data) return toast.error(error?.message ?? "No se pudo abrir");
    window.open(data.signedUrl, "_blank");
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {value ? <>
        <Button type="button" size="sm" variant="outline" onClick={open} disabled={!doc}>
          <Download className="mr-1 h-3 w-3" />{doc?.title ?? "Documento"}</Button>
        {!disabled && <Button type="button" size="icon" variant="ghost" aria-label="Quitar documento" onClick={() => onChange(null)}><X className="h-4 w-4" /></Button>}
      </> : !disabled && <>
        <input ref={ref} type="file" className="hidden" onChange={pick} />
        <Button type="button" size="sm" variant="outline" onClick={() => ref.current?.click()} disabled={busy}>
          {busy ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Paperclip className="mr-1 h-3 w-3" />}Adjuntar documento</Button>
      </>}
      {!value && disabled && <span className="text-sm text-muted-foreground">Sin documento</span>}
    </div>
  );
}
