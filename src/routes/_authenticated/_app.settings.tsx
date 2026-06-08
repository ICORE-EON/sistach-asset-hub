import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Settings as SettingsIcon, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/_app/settings")({
  head: () => ({ meta: [{ title: "Administración" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { activeCompanyId, activeMembership } = useCompany();
  const role = activeMembership?.role;
  const canManage = role === "administrator" || role === "system_manager";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <SettingsIcon className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Administración</h1>
          <p className="text-sm text-muted-foreground">
            Ajustes de empresa, branding y plantillas.
          </p>
        </div>
      </div>

      {activeCompanyId && (
        <CompanyLogoCard companyId={activeCompanyId} canManage={canManage} />
      )}
    </div>
  );
}

function CompanyLogoCard({ companyId, canManage }: { companyId: string; canManage: boolean }) {
  const qc = useQueryClient();
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data: company } = useQuery({
    queryKey: ["company-logo", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("logo_url")
        .eq("id", companyId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const logoUrl = company?.logo_url ?? null;

  useEffect(() => {
    let cancelled = false;
    if (!logoUrl) {
      setSignedUrl(null);
      return;
    }
    supabase.storage
      .from("company-logos")
      .createSignedUrl(logoUrl, 300)
      .then(({ data }) => {
        if (!cancelled) setSignedUrl(data?.signedUrl ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [logoUrl]);

  const update = useMutation({
    mutationFn: async (path: string | null) => {
      const { error } = await supabase
        .from("companies")
        .update({ logo_url: path })
        .eq("id", companyId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["company-logo", companyId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleFile = async (file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      toast.error("La imagen no puede superar 2 MB");
      return;
    }
    const ext = (file.name.split(".").pop() || "png").toLowerCase();
    const path = `${companyId}/company-logo.${ext}`;
    setUploading(true);
    const { error } = await supabase.storage
      .from("company-logos")
      .upload(path, file, { upsert: true, contentType: file.type });
    setUploading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await update.mutateAsync(path);
    toast.success("Logo de empresa actualizado");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Logo de la empresa</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Se usará en los certificados PDF cuando la plantilla no tenga un logo propio.
          Formato PNG o JPG, máximo 2 MB.
        </p>
        {signedUrl ? (
          <div className="flex items-center gap-4">
            <img
              src={signedUrl}
              alt="Logo de la empresa"
              className="h-20 rounded border bg-white object-contain p-2"
            />
            {canManage && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => update.mutate(null)}
                disabled={update.isPending}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Quitar logo
              </Button>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Sin logo configurado.</p>
        )}
        {canManage && (
          <div>
            <input
              type="file"
              accept="image/png,image/jpeg"
              disabled={uploading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = "";
              }}
              className="text-sm"
            />
            {uploading && <p className="mt-1 text-xs text-muted-foreground">Subiendo…</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
