import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { Building2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/onboarding/company")({
  head: () => ({ meta: [{ title: "Crear empresa" }] }),
  component: OnboardingCompanyPage,
});

function OnboardingCompanyPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { refetch, setActiveCompanyId } = useCompany();
  const [name, setName] = useState("");
  const [cif, setCif] = useState("");
  const [address, setAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    try {
      const { data: company, error } = await supabase.rpc("create_company_with_owner", {
        p_name: name,
        p_cif: cif,
        p_address: address || null,
      });
      if (error) throw error;
      if (!company) throw new Error("No se pudo crear la empresa");

      setActiveCompanyId(company.id);
      await refetch();
      toast.success("Empresa creada");
      navigate({ to: "/dashboard" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al crear empresa";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-8">
      <Card className="w-full max-w-lg">
        <CardHeader className="space-y-2 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Building2 className="h-6 w-6" />
          </div>
          <CardTitle>Crea tu empresa</CardTitle>
          <CardDescription>Necesitas una empresa para empezar a gestionar mantenimientos</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre comercial</Label>
              <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cif">CIF / NIF</Label>
              <Input id="cif" required value={cif} onChange={(e) => setCif(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Dirección (opcional)</Label>
              <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Creando..." : "Crear empresa"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
