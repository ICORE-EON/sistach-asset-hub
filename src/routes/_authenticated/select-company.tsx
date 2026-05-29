import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCompany } from "@/contexts/CompanyContext";
import { Building2, Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/select-company")({
  head: () => ({ meta: [{ title: "Seleccionar empresa" }] }),
  component: SelectCompanyPage,
});

function SelectCompanyPage() {
  const navigate = useNavigate();
  const { memberships, setActiveCompanyId } = useCompany();

  const handleSelect = (companyId: string) => {
    setActiveCompanyId(companyId);
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-8">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Selecciona empresa</CardTitle>
          <CardDescription>
            Tienes acceso a {memberships.length} empresa{memberships.length === 1 ? "" : "s"}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {memberships.map((m) => (
            <button
              key={m.company_id}
              onClick={() => handleSelect(m.company_id)}
              className="flex w-full items-center gap-4 rounded-lg border bg-card p-4 text-left transition-colors hover:bg-accent"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Building2 className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="font-medium">{m.companies.name}</p>
                <p className="text-xs text-muted-foreground">{m.companies.cif} · {m.role}</p>
              </div>
              {m.is_default && <Badge variant="secondary">Por defecto</Badge>}
            </button>
          ))}
          <Button asChild variant="outline" className="w-full mt-4">
            <Link to="/onboarding/company">
              <Plus className="mr-2 h-4 w-4" /> Crear nueva empresa
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
