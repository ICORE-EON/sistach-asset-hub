import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FileBadge, Plus, ChevronRight, Star, AlertTriangle } from "lucide-react";
import { certificateKeys, certificateService } from "@/modules/maintenance/services/certificates";
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
    queryKey: certificateKeys.templates(activeCompanyId),
    enabled: !!activeCompanyId,
    queryFn: () => certificateService.listTemplates(activeCompanyId),
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

      {!isLoading && templates.length > 0 && !templates.some((t) => t.is_default) && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <div>
            <p className="font-medium">Ninguna plantilla está marcada como predeterminada.</p>
            <p className="text-xs">
              Los certificados de planes que no tengan una plantilla asignada usarán una plantilla genérica integrada
              (sin normativa ni logo). Marca una como predeterminada o asígnala al plan de mantenimiento correspondiente.
            </p>
          </div>
        </div>
      )}


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
    mutationFn: () => certificateService.createTemplate(activeCompanyId, { code, name }),
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
