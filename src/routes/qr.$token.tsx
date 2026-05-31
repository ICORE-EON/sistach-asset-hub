import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  MapPin,
  Package,
  QrCode,
  Wrench,
} from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/qr/$token")({
  head: () => ({
    meta: [
      { title: "Activo · QR" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: QrLanding,
});

type QrPayload = {
  asset: {
    id: string;
    code: string;
    name: string | null;
    manufacturer: string | null;
    model: string | null;
    serial_number: string | null;
    status: string;
    install_date: string | null;
    warranty_until: string | null;
  };
  company: { name: string; logo_url: string | null; primary_color: string | null } | null;
  location: { name: string; code: string } | null;
  asset_type: { code: string; name_i18n: Record<string, string>; category: string } | null;
  last_maintenance: {
    completed_at: string;
    result: string;
    maintenance_sessions: { code: string; status: string; closed_at: string | null };
  } | null;
  open_incidents_count: number;
};

function QrLanding() {
  const { token } = Route.useParams();
  const { user } = useAuth();

  const { data, isLoading, error } = useQuery<QrPayload>({
    queryKey: ["qr", token],
    queryFn: async () => {
      const r = await fetch(`/api/public/qr/${token}`);
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error ?? `Error ${r.status}`);
      }
      return r.json();
    },
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
        <Card className="max-w-md">
          <CardContent className="space-y-3 py-8 text-center">
            <QrCode className="mx-auto h-10 w-10 text-muted-foreground" />
            <h1 className="text-lg font-semibold">Código QR no válido</h1>
            <p className="text-sm text-muted-foreground">
              No se ha encontrado ningún activo asociado a este código.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { asset, company, location, asset_type, last_maintenance, open_incidents_count } = data;
  const typeName =
    asset_type?.name_i18n?.es ?? asset_type?.name_i18n?.en ?? asset_type?.code ?? "—";

  return (
    <div className="min-h-screen bg-muted/30 px-4 py-6">
      <div className="mx-auto max-w-md space-y-4">
        {company && (
          <div className="flex items-center gap-3 px-1">
            {company.logo_url ? (
              <img src={company.logo_url} alt={company.name} className="h-8 w-8 rounded object-contain" />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded bg-primary text-xs font-bold text-primary-foreground">
                {company.name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <p className="text-sm font-medium">{company.name}</p>
          </div>
        )}

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <CardTitle className="text-lg">
                  {asset.name ?? asset.code}
                </CardTitle>
                <p className="font-mono text-xs text-muted-foreground">{asset.code}</p>
              </div>
              <Badge variant={asset.status === "active" ? "default" : "outline"}>
                {asset.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row icon={<Package className="h-4 w-4" />} label="Tipo" value={typeName} />
            {location && (
              <Row icon={<MapPin className="h-4 w-4" />} label="Ubicación" value={`${location.name} (${location.code})`} />
            )}
            {(asset.manufacturer || asset.model) && (
              <Row
                icon={<Wrench className="h-4 w-4" />}
                label="Equipo"
                value={`${asset.manufacturer ?? ""} ${asset.model ?? ""}`.trim()}
              />
            )}
            {asset.serial_number && (
              <Row icon={null} label="Nº serie" value={asset.serial_number} />
            )}
            {asset.install_date && (
              <Row icon={null} label="Instalación" value={format(new Date(asset.install_date), "dd/MM/yyyy")} />
            )}
            {asset.warranty_until && (
              <Row icon={null} label="Garantía hasta" value={format(new Date(asset.warranty_until), "dd/MM/yyyy")} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 py-4 text-sm">
            <div className="flex items-center gap-2">
              {last_maintenance ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <span>
                    Último mantenimiento:{" "}
                    <span className="font-medium">
                      {format(new Date(last_maintenance.completed_at), "dd/MM/yyyy")}
                    </span>
                  </span>
                </>
              ) : (
                <span className="text-muted-foreground">Sin mantenimientos registrados</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <AlertTriangle
                className={`h-4 w-4 ${open_incidents_count > 0 ? "text-destructive" : "text-muted-foreground"}`}
              />
              <span>
                {open_incidents_count > 0
                  ? `${open_incidents_count} incidencia(s) abiertas`
                  : "Sin incidencias abiertas"}
              </span>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-2">
          {user ? (
            <>
              <Button asChild className="w-full">
                <Link to="/assets/$id" params={{ id: asset.id }}>
                  Ver ficha completa
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link to="/incidents">Reportar incidencia</Link>
              </Button>
            </>
          ) : (
            <>
              <Button asChild className="w-full">
                <Link to="/login" search={{ redirect: `/assets/${asset.id}` } as never}>
                  Inicia sesión para gestionar
                </Link>
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Esta vista pública sólo muestra información básica del activo.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      {icon && <span className="mt-0.5 text-muted-foreground">{icon}</span>}
      <div className="flex-1">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="font-medium">{value}</p>
      </div>
    </div>
  );
}
