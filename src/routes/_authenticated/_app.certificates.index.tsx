import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileBadge, Search, Plus } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getCertExpiry, CERT_STATUS_LABELS } from "@/lib/cert-status";
import { ExternalCertificateDialog } from "@/components/external-certificate-dialog";

export const Route = createFileRoute("/_authenticated/_app/certificates/")({
  head: () => ({ meta: [{ title: "Certificados" }] }),
  component: CertificatesList,
});

function CertificatesList() {
  const { activeMembership } = useCompany();
  const companyId = activeMembership?.company_id;
  const role = activeMembership?.role;
  const canCreate =
    role === "administrator" || role === "system_manager" || role === "manager" || role === "employee";

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [expiryFilter, setExpiryFilter] = useState("all");
  const [extOpen, setExtOpen] = useState(false);

  const { data: certs = [], isLoading } = useQuery({
    queryKey: ["certificates", companyId, statusFilter],
    enabled: !!companyId,
    queryFn: async () => {
      let q = supabase
        .from("certificates")
        .select("*")
        .eq("company_id", companyId!)
        .is("deleted_at", null)
        .order("issued_on", { ascending: false })
        .limit(500);
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const filtered = certs.filter((c) => {
    if (search) {
      const t = search.toLowerCase();
      const matches =
        c.code.toLowerCase().includes(t) ||
        c.title.toLowerCase().includes(t) ||
        (c.issuer_name?.toLowerCase().includes(t) ?? false) ||
        (c.external_provider?.toLowerCase().includes(t) ?? false);
      if (!matches) return false;
    }
    if (expiryFilter !== "all") {
      const exp = getCertExpiry(c.valid_until);
      if (expiryFilter === "expired" && exp.state !== "expired") return false;
      if (expiryFilter === "expiring" && exp.state !== "expiring") return false;
      if (expiryFilter === "valid" && exp.state !== "valid") return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Certificados</h1>
          <p className="text-sm text-muted-foreground">
            Emisión, registro y archivado de certificados de mantenimiento.
          </p>
        </div>
        {canCreate && companyId && (
          <Button onClick={() => setExtOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Registrar certificado externo
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por código, título o emisor…"
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="issued">Emitido</SelectItem>
            <SelectItem value="superseded">Reemplazado</SelectItem>
            <SelectItem value="revoked">Revocado</SelectItem>
          </SelectContent>
        </Select>
        <Select value={expiryFilter} onValueChange={setExpiryFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Vigencia" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Cualquier vigencia</SelectItem>
            <SelectItem value="valid">Vigentes</SelectItem>
            <SelectItem value="expiring">Por caducar (30d)</SelectItem>
            <SelectItem value="expired">Caducados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">Cargando…</CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            <FileBadge className="mx-auto mb-2 h-8 w-8 opacity-50" />
            No hay certificados.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-2">
          {filtered.map((c) => {
            const status = CERT_STATUS_LABELS[c.status] ?? { label: c.status, variant: "outline" as const };
            const expiry = getCertExpiry(c.valid_until);
            const isExternal = !!c.external_provider;
            return (
              <Link key={c.id} to="/certificates/$id" params={{ id: c.id }} className="block">
                <Card className="transition hover:bg-muted/40">
                  <CardContent className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">{c.code}</span>
                        <Badge variant={status.variant} className="text-xs">{status.label}</Badge>
                        <Badge variant="outline" className={`text-xs ${expiry.className}`}>
                          {expiry.label}
                        </Badge>
                        {isExternal && (
                          <Badge variant="outline" className="text-xs">Externo</Badge>
                        )}
                      </div>
                      <p className="truncate text-sm font-medium">{c.title}</p>
                      <p className="text-xs text-muted-foreground">
                        Emitido {format(new Date(c.issued_on), "dd/MM/yyyy")}
                        {c.valid_until ? ` · vence ${format(new Date(c.valid_until), "dd/MM/yyyy")}` : ""}
                        {c.issuer_name ? ` · ${c.issuer_name}` : ""}
                        {c.external_provider ? ` · ${c.external_provider}` : ""}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      {companyId && (
        <ExternalCertificateDialog
          open={extOpen}
          onOpenChange={setExtOpen}
          companyId={companyId}
        />
      )}
    </div>
  );
}
