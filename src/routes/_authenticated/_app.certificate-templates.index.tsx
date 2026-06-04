import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FileBadge, Plus, ChevronRight, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { DEFAULT_CERTIFICATE_TEMPLATE } from "@/lib/certificate-templates/default";

export const Route = createFileRoute("/_authenticated/_app/certificate-templates/")({
  head: () => ({ meta: [{ title: "Plantillas de certificado" }] }),
  component: TemplatesList,
});

function TemplatesList() {
  const { activeCompanyId, activeMembership } = useCompany();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const role = activeMembership?.role;
  const canManage = role === "administrator" || role === "system_manager";

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["certificate-templates", activeCompanyId],
    enabled: !!activeCompanyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("certificate_templates")
        .select("id, code, name, language, is_default, updated_at")
        .eq("company_id", activeCompanyId!)
        .is("deleted_at", null)
        .order("code");
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <FileBadge className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Plantillas de certificado</h1>
            <p className="text-sm text-muted-foreground">
              Modelos que se aplican al cerrar una sesión de mantenimiento
            </p>
          </div>
        </div>
        {canManage && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nueva plantilla
              </Button>
            </DialogTrigger>
            <CreateTemplateDialog
              onCreated={(id) => {
                setOpen(false);
                qc.invalidateQueries({ queryKey: ["certificate-templates"] });
                navigate({ to: "/certificate-templates/$id", params: { id } });
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
              <TableHead>Idioma</TableHead>
              <TableHead>Predeterminada</TableHead>
              <TableHead className="w-[60px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                  Cargando…
                </TableCell>
              </TableRow>
            ) : templates.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                  Aún no hay plantillas. Si no creas ninguna, se usará una plantilla genérica integrada.
                </TableCell>
              </TableRow>
            ) : (
              templates.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-mono text-xs">{t.code}</TableCell>
                  <TableCell className="font-medium">
                    <Link to="/certificate-templates/$id" params={{ id: t.id }} className="hover:underline">
                      {t.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm uppercase">{t.language}</TableCell>
                  <TableCell>
                    {t.is_default ? (
                      <Badge className="gap-1">
                        <Star className="h-3 w-3" />
                        Predeterminada
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Link to="/certificate-templates/$id" params={{ id: t.id }}>
                      <Button variant="ghost" size="icon">
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function CreateTemplateDialog({ onCreated }: { onCreated: (id: string) => void }) {
  const { activeCompanyId } = useCompany();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");

  const create = useMutation({
    mutationFn: async () => {
      if (!activeCompanyId) throw new Error("Sin empresa activa");
      if (!code.trim() || !name.trim()) throw new Error("Completa código y nombre");
      const { data, error } = await supabase
        .from("certificate_templates")
        .insert({
          company_id: activeCompanyId,
          code: code.trim().toUpperCase(),
          name: name.trim(),
          language: DEFAULT_CERTIFICATE_TEMPLATE.language,
          title: DEFAULT_CERTIFICATE_TEMPLATE.title,
          intro_text: DEFAULT_CERTIFICATE_TEMPLATE.intro_text,
          regulation_text: DEFAULT_CERTIFICATE_TEMPLATE.regulation_text,
          footer_text: DEFAULT_CERTIFICATE_TEMPLATE.footer_text,
          columns: DEFAULT_CERTIFICATE_TEMPLATE.columns,
          show_logo: DEFAULT_CERTIFICATE_TEMPLATE.show_logo,
          show_signature: DEFAULT_CERTIFICATE_TEMPLATE.show_signature,
          show_company_stamp: DEFAULT_CERTIFICATE_TEMPLATE.show_company_stamp,
          paper_size: DEFAULT_CERTIFICATE_TEMPLATE.paper_size,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (id) => {
      toast.success("Plantilla creada");
      onCreated(id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Nueva plantilla de certificado</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div className="space-y-2">
          <Label>Código *</Label>
          <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="EXT-TRI" />
        </div>
        <div className="space-y-2">
          <Label>Nombre *</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Certificado revisión trimestral extintores"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Se crea con valores por defecto que podrás editar en la siguiente pantalla.
        </p>
      </div>
      <DialogFooter>
        <Button onClick={() => create.mutate()} disabled={create.isPending}>
          {create.isPending ? "Creando…" : "Crear"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
