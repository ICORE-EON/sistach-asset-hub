import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, CheckCircle2, AlertTriangle, Ban, Pencil, Download, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { certificateKeys, certificateService } from "@/modules/maintenance/services/certificates";
import { useCompany } from "@/contexts/CompanyContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { certificateResultCounts, certificateResultLabel, normalizeCertificateResult } from "@/modules/maintenance/domain/certificate-results";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { AttachmentsPanel } from "@/components/attachments-panel";
import { getCertExpiry, CERT_STATUS_LABELS } from "@/modules/maintenance/domain/cert-status";


export function CertificateDetailPage() {
  const { id } = useParams({ from: "/_authenticated/_app/certificates/$id" });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { activeMembership } = useCompany();
  const role = activeMembership?.role;
  const canManage = role === "administrator" || role === "system_manager";

  const org = activeMembership?.company_id ?? null;

  const { data: cert } = useQuery({
    queryKey: certificateKeys.detail(org, id),
    enabled: !!org,
    queryFn: () => certificateService.getCertificate(org, id),
  });

  const { data: items = [] } = useQuery({
    queryKey: certificateKeys.items(org, id),
    enabled: !!org,
    queryFn: () => certificateService.listItems(org, id),
  });

  const { data: incidents = [] } = useQuery({
    queryKey: certificateKeys.incidents(org, id),
    enabled: !!org && !!cert,
    queryFn: () => certificateService.listIncidents(org, id),
  });

  const linkedSession = items.find((i) => i.maintenance_session_id)?.maintenance_session_id ?? null;
  // Frozen template when the certificate has its snapshot; otherwise the current resolution.
  const { data: resolvedTemplate } = useQuery({
    queryKey: certificateKeys.applied(org, id),
    enabled: !!org && !!cert,
    queryFn: () => certificateService.appliedTemplate(org, id, cert!.metadata, linkedSession),
  });

  const refreshCert = () => qc.invalidateQueries({ queryKey: certificateKeys.detail(org, id) });

  const revoke = useMutation({
    mutationFn: () => certificateService.revoke(org, id),
    onSuccess: () => {
      toast.success("Certificado revocado");
      refreshCert();
      qc.invalidateQueries({ queryKey: certificateKeys.lists(org) });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const regenerate = useMutation({
    mutationFn: async () => {
      return certificateService.generatePdf(org, id);
    },
    onSuccess: (r) => {
      if (r.warning) toast.warning(r.warning);
      else toast.success("PDF generado");
      refreshCert();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const download = useMutation({
    mutationFn: async () => {
      if (!cert?.pdf_url) throw new Error("Sin PDF disponible");
      const url = await certificateService.pdfDownloadUrl(org, id);
      window.open(url, "_blank");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [editNotesOpen, setEditNotesOpen] = useState(false);

  if (!cert) return <div className="p-6 text-sm text-muted-foreground">Cargando…</div>;

  const status = CERT_STATUS_LABELS[cert.status] ?? { label: cert.status, variant: "outline" as const };
  const expiry = getCertExpiry(cert.valid_until);
  const sessionId = items.find((i) => i.maintenance_session_id)?.maintenance_session_id ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/certificates" })}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{cert.title}</h1>
              <Badge variant={status.variant}>{status.label}</Badge>
              <Badge variant="outline" className={expiry.className}>{expiry.label}</Badge>
            </div>
            <p className="font-mono text-xs text-muted-foreground">{cert.code}</p>
          </div>
        </div>
        {canManage && cert.status === "issued" && (
          <div className="flex gap-2">
            {cert.pdf_url && (
              <Button variant="outline" onClick={() => download.mutate()} disabled={download.isPending}>
                <Download className="mr-2 h-4 w-4" />
                Descargar PDF
              </Button>
            )}
            <Button variant="outline" onClick={() => regenerate.mutate()} disabled={regenerate.isPending}>
              <RefreshCw className="mr-2 h-4 w-4" />
              {cert.pdf_url ? "Regenerar PDF" : "Generar PDF"}
            </Button>
            <Button variant="outline" onClick={() => revoke.mutate()} disabled={revoke.isPending}>
              <Ban className="mr-2 h-4 w-4" />
              Revocar
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm">Información</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <Field label="Emitido el" value={format(new Date(cert.issued_on), "dd/MM/yyyy")} />
            <Field
              label="Válido hasta"
              value={cert.valid_until ? format(new Date(cert.valid_until), "dd/MM/yyyy") : "Sin caducidad"}
            />
            <Field label="Emisor" value={cert.issuer_name ?? "—"} />
            <Field label="Cargo" value={cert.issuer_role ?? "—"} />
            {cert.external_provider && (
              <>
                <Field label="Proveedor externo" value={cert.external_provider} />
                <Field label="Nº certificado externo" value={cert.external_cert_number ?? "—"} />
              </>
            )}
            {sessionId && (
              <div className="col-span-2">
                <p className="text-xs text-muted-foreground">Sesión origen</p>
                <Link to="/maintenance/$id" params={{ id: sessionId }} className="text-sm text-primary hover:underline">
                  Ver sesión de mantenimiento
                </Link>
              </div>
            )}
            <div className="col-span-2">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Notas</p>
                {canManage && (
                  <Button variant="ghost" size="sm" onClick={() => setEditNotesOpen(true)}>
                    <Pencil className="mr-1.5 h-3.5 w-3.5" />
                    Editar
                  </Button>
                )}
              </div>
              <p className="whitespace-pre-wrap text-sm">{cert.notes ?? "—"}</p>
            </div>
            {cert.signature_image_url && (
              <div className="col-span-2 space-y-1">
                <p className="text-xs text-muted-foreground">Firma</p>
                <img
                  src={cert.signature_image_url}
                  alt="Firma"
                  className="h-24 w-auto rounded-md border bg-background object-contain"
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Resumen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <SummaryRow label="Activos cubiertos" value={items.length} />
            <SummaryRow
              label="Activos OK"
              value={certificateResultCounts(items.map((i) => i.result)).ok}
              tone="emerald"
            />
            <SummaryRow
              label="Con incidencias"
              value={certificateResultCounts(items.map((i) => i.result)).withIncidents}
              tone="amber"
            />
            <SummaryRow label="N/A" value={certificateResultCounts(items.map((i) => i.result)).na} />
            <SummaryRow label="Sin revisar" value={certificateResultCounts(items.map((i) => i.result)).skipped} />
            <SummaryRow
              label="Completitud"
              value={certificateResultCounts(items.map((i) => i.result)).complete ? "Completo" : "Incompleto"}
            />
            <SummaryRow label="Incidencias abiertas" value={incidents.filter((i) => i.status !== "closed").length} />
            {resolvedTemplate && (
              <div className="border-t pt-2">
                <p className="text-xs text-muted-foreground">Plantilla aplicada</p>
                {resolvedTemplate.id ? (
                  <Link
                    to="/certificate-templates/$id"
                    params={{ id: resolvedTemplate.id }}
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    {resolvedTemplate.name}
                  </Link>
                ) : (
                  <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                    {resolvedTemplate.name}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  {resolvedTemplate.source === "plan"
                    ? "Asignada al plan de mantenimiento"
                    : resolvedTemplate.source === "family"
                    ? "Plantilla de la familia de activos"
                    : resolvedTemplate.source === "default"
                    ? "Plantilla por defecto de la empresa"
                    : "Sin plantilla configurada — ni en el plan ni como predeterminada"}
                </p>
                {!resolvedTemplate.frozen && !cert.external_provider && (
                  <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                    Emitido antes del registro histórico: el PDF usa los datos congelados de la sesión cuando existen y, si no, los datos y la plantilla actuales.
                  </p>
                )}
                {cert && !cert.external_provider && certificateService.logoNotice(org, cert.metadata, linkedSession ?? null) && (
                  <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                    {certificateService.logoNotice(org, cert.metadata, linkedSession ?? null)}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>


      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Activos cubiertos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin activos vinculados.</p>
          ) : (
            items.map((it) => {
              const isOk = normalizeCertificateResult(it.result) === "ok";
              return (
                <div key={it.id} className="flex items-start gap-3 rounded-md border p-3">
                  {isOk ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600" />
                  )}
                  <div className="min-w-0 flex-1">
                    {it.assets ? (
                      <Link
                        to="/assets/$id"
                        params={{ id: it.assets.id }}
                        className="text-sm font-medium hover:underline"
                      >
                        {it.assets.code} · {it.assets.name ?? ""}
                      </Link>
                    ) : (
                      <p className="text-sm font-medium text-muted-foreground">Sin activo</p>
                    )}
                    {it.notes && (
                      <p className="text-xs text-muted-foreground">{it.notes}</p>
                    )}
                  </div>
                  <Badge variant="outline" className="text-xs">{certificateResultLabel(it.result)}</Badge>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {incidents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Incidencias relacionadas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {incidents.map((i) => (
              <Link
                key={i.id}
                to="/incidents/$id"
                params={{ id: i.id }}
                className="flex items-center justify-between rounded-md border p-2 text-sm hover:bg-muted/40"
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground">{i.code}</span>
                  <span>{i.title}</span>
                </div>
                <Badge variant="outline" className="text-xs">{i.status}</Badge>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      <AttachmentsPanel entity="certificate" entityId={id} defaultCategory="certificate_pdf" />

      {canManage && (
        <EditNotesDialog
          open={editNotesOpen}
          onOpenChange={setEditNotesOpen}
          certId={id}
          orgId={org}
          initial={cert.notes ?? ""}
        />
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm">{value}</p>
    </div>
  );
}

function SummaryRow({ label, value, tone }: { label: string; value: number | string; tone?: "emerald" | "amber" }) {
  const cls =
    tone === "emerald"
      ? "text-emerald-600"
      : tone === "amber"
      ? "text-amber-600"
      : "text-foreground";
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-medium ${cls}`}>{value}</span>
    </div>
  );
}

function EditNotesDialog({
  open,
  onOpenChange,
  certId,
  orgId,
  initial,
}: {
  orgId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  certId: string;
  initial: string;
}) {
  const qc = useQueryClient();
  const [notes, setNotes] = useState(initial);

  const save = useMutation({
    mutationFn: () => certificateService.updateNotes(orgId, certId, notes),
    onSuccess: () => {
      toast.success("Notas guardadas");
      qc.invalidateQueries({ queryKey: certificateKeys.detail(orgId, certId) });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar notas</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Notas</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={6} />
        </div>
        <DialogFooter>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
