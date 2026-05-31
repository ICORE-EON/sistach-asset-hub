import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";

export const Route = createFileRoute("/_authenticated/_app/dashboard")({
  head: () => ({ meta: [{ title: "Panel" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  const { user } = useAuth();
  const { activeMembership } = useCompany();

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Bienvenido, {user?.user_metadata?.full_name ?? user?.email}
        </h1>
        <p className="text-sm text-muted-foreground">
          Empresa activa: <span className="font-medium text-foreground">{activeMembership?.companies.name}</span>
          {" · "}
          Rol: <Badge variant="outline" className="ml-1 capitalize">{activeMembership?.role}</Badge>
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Activos</CardTitle>
            <CardDescription>Total registrados</CardDescription>
          </CardHeader>
          <CardContent><p className="text-3xl font-bold">—</p></CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Sesiones abiertas</CardTitle>
            <CardDescription>Mantenimiento en curso</CardDescription>
          </CardHeader>
          <CardContent><p className="text-3xl font-bold">—</p></CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Incidencias</CardTitle>
            <CardDescription>Sin cerrar</CardDescription>
          </CardHeader>
          <CardContent><p className="text-3xl font-bold">—</p></CardContent>
        </Card>
      </div>
    </div>
  );
}
