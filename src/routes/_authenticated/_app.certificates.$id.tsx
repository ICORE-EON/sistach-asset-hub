import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, CheckCircle2, AlertTriangle, Ban, Pencil, Download, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { getCertExpiry, CERT_STATUS_LABELS } from "@/lib/cert-status";
import { generateCertificatePdf, getCertificatePdfDownloadUrl } from "@/lib/certificate-generator";

export const Route = createFileRoute("/_authenticated/_app/certificates/$id")({
  head: () => ({ meta: [{ title: "Certificado" }] }),
  component: CertificateDetail,
});

function CertificateDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { activeMembership } = useCompany();
  const role = activeMembership?.role;
  const canManage = role === "administrator" || role === "system_manager";

  const { data: cert } = useQuery({
    queryKey: ["certificate", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("certificates")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: items = [] } = useQuery({
    queryKey: ["certificate-items", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("certificate_items")
        .select("*, assets(id, code, name), maintenance_sessions(id, code)")
        .eq("certificate_id", id);
      if (error) throw error;
      return data;
    },
  });

  const { data: incidents = [] } = useQuery({
    queryKey: ["certificate-incidents", id, cert?.id],
    enabled: !!cert,
    queryFn: async () => {
      // Find incidents created from any of the maintenance items linked to this certificate
      const itemIds = items.map((i) => i.maintenance_item_id).filter(Boolean) as string[];
      if (itemIds.length === 0) return [];
      const { data, error } = await supabase
        .from("incidents")
        .select("id, code, title, status, severity")
        .in("source_maintenance_item_id", itemIds);
      if (error) throw error;
      return data;
    },
  });

  // Resolve which certificate template will be applied (mirrors generator logic)
  const { data: resolvedTemplate } = useQuery({
    queryKey: ["certificate-resolved-template", id, cert?.id],
    enabled: !!cert,
    queryFn: async () => {
      const sid = items.find((i) => i.maintenance_session_id)?.maintenance_session_id ?? null;
      let planTplId: string | null = null;
      if (sid) {
        const { data: s } = await supabase
          .from("maintenance_sessions")
          .select("plan_id")
          .eq("id", sid)
          .maybeSingle();
        if (s?.plan_id) {
          const { data: p } = await supabase
            .from("maintenance_plans")
            .select("certificate_template_id")
            .eq("id", s.plan_id)
            .maybeSingle();
          planTplId = p?.certificate_template_id ?? null;
        }
      }
      if (planTplId) {
        const { data: tpl } = await supabase
          .from("certificate_templates")
          .select("id, name")
          .eq("id", planTplId)
          .maybeSingle();
        if (tpl) return { source: "plan" as const, id: tpl.id, name: tpl.name };
      }
      const { data: def } = await supabase
        .from("certificate_templates")
        .select("id, name")
        .eq("company_id", cert!.company_id)
        .eq("is_default", true)
        .is("deleted_at", null)
        .maybeSingle();
      if (def) return { source: "default" as const, id: def.id, name: def.name };
      return { source: "builtin" as const, id: null, name: "Plantilla genérica integrada" };
    },
  });


  const revoke = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("certificates")
        .update({ status: "revoked" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Certificado revocado");
      qc.invalidateQueries({ queryKey: ["certificate", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const regenerate = useMutation({
    mutationFn: async () => {
      await generateCertificatePdf(id);
    },
    onSuccess: () => {
      toast.success("PDF generado");
      qc.invalidateQueries({ queryKey: ["certificate", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const download = useMutation({
    mutationFn: async () => {
      if (!cert?.pdf_url) throw new Error("Sin PDF disponible");
      const url = await getCertificatePdfDownloadUrl(cert.pdf_url);
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
              value={items.filter((i) => i.result === "ok").length}
              tone="emerald"
            />
            <SummaryRow
              label="Con incidencias"
              value={items.filter((i) => i.result === "with_incident" || i.result === "fail").length}
              tone="amber"
            />
            <SummaryRow label="Incidencias abiertas" value={incidents.filter((i) => i.status !== "closed").length} />
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
              const isOk = it.result === "ok";
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
                  <Badge variant="outline" className="text-xs">{it.result}</Badge>
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

function SummaryRow({ label, value, tone }: { label: string; value: number; tone?: "emerald" | "amber" }) {
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
  initial,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  certId: string;
  initial: string;
}) {
  const qc = useQueryClient();
  const [notes, setNotes] = useState(initial);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("certificates")
        .update({ notes: notes.trim() || null })
        .eq("id", certId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Notas guardadas");
      qc.invalidateQueries({ queryKey: ["certificate", certId] });
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
