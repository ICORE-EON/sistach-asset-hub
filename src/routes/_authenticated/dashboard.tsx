import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { Building2, LogOut, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Panel" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  const { user, signOut } = useAuth();
  const { activeMembership, memberships, setActiveCompanyId } = useCompany();

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold leading-tight">{activeMembership?.companies.name ?? "—"}</p>
              <p className="text-xs text-muted-foreground">Panel de mantenimientos</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {memberships.length > 1 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    Cambiar empresa <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Mis empresas</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {memberships.map((m) => (
                    <DropdownMenuItem key={m.company_id} onClick={() => setActiveCompanyId(m.company_id)}>
                      {m.companies.name}
                      {m.company_id === activeMembership?.company_id && <Badge className="ml-2" variant="secondary">Activa</Badge>}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="mr-2 h-4 w-4" /> Salir
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Bienvenido, {user?.user_metadata?.full_name ?? user?.email}</h1>
          <p className="text-sm text-muted-foreground">
            Rol: <Badge variant="outline">{activeMembership?.role}</Badge>
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader><CardTitle>Activos</CardTitle><CardDescription>Próximamente</CardDescription></CardHeader>
            <CardContent><p className="text-3xl font-bold">—</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Mantenimientos abiertos</CardTitle><CardDescription>Próximamente</CardDescription></CardHeader>
            <CardContent><p className="text-3xl font-bold">—</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Incidencias</CardTitle><CardDescription>Próximamente</CardDescription></CardHeader>
            <CardContent><p className="text-3xl font-bold">—</p></CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
