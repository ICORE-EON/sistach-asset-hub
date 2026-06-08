import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, CheckCircle2, AlertCircle, Mail } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/accept-invitation/$token")({
  head: () => ({ meta: [{ title: "Aceptar invitación" }] }),
  component: AcceptInvitationPage,
});

function AcceptInvitationPage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { refetch, setActiveCompanyId } = useCompany();
  const [accepting, setAccepting] = useState(false);

  const { data: invitation, isLoading, error } = useQuery({
    queryKey: ["invitation", token],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_invitation_by_token", { p_token: token });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) throw new Error("Invitación no encontrada");
      return row as {
        id: string; company_id: string; company_name: string;
        email: string; role: string; expires_at: string; accepted_at: string | null;
      };
    },
  });

  const handleAccept = async () => {
    if (!user) {
      navigate({ to: "/login", search: { redirect: window.location.pathname } as never });
      return;
    }
    setAccepting(true);
    try {
      const { data: companyId, error } = await supabase.rpc("accept_company_invitation", { p_token: token });
      if (error) throw error;
      if (companyId) setActiveCompanyId(companyId);
      await refetch();
      toast.success("¡Bienvenido a la empresa!");
      navigate({ to: "/dashboard" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al aceptar");
    } finally {
      setAccepting(false);
    }
  };

  useEffect(() => {
    if (!authLoading && user && invitation && !invitation.accepted_at && new Date(invitation.expires_at) > new Date()) {
      // auto-accept if already logged in with the right account
      if (user.email?.toLowerCase() === invitation.email.toLowerCase()) {
        handleAccept();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, invitation]);

  const expired = invitation && new Date(invitation.expires_at) < new Date();
  const used = invitation?.accepted_at != null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Mail className="h-6 w-6" />
          </div>
          <CardTitle>Invitación a empresa</CardTitle>
          <CardDescription>
            {isLoading ? "Cargando…" : invitation ? `Has sido invitado a ${invitation.company_name}` : "Invitación"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading && <div className="flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>}
          {error && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4" />
              <span>{error instanceof Error ? error.message : "Error"}</span>
            </div>
          )}
          {invitation && (
            <div className="space-y-3">
              <div className="rounded-md border bg-muted/30 p-3 text-sm">
                <p><strong>Email:</strong> {invitation.email}</p>
                <p><strong>Rol:</strong> {invitation.role}</p>
                <p><strong>Caduca:</strong> {new Date(invitation.expires_at).toLocaleDateString()}</p>
              </div>
              {used && (
                <div className="flex items-start gap-2 rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">
                  <CheckCircle2 className="mt-0.5 h-4 w-4" /><span>Esta invitación ya fue aceptada.</span>
                </div>
              )}
              {expired && !used && (
                <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 h-4 w-4" /><span>La invitación ha caducado.</span>
                </div>
              )}
              {!used && !expired && (
                <>
                  {!user ? (
                    <div className="space-y-2 text-sm">
                      <p className="text-muted-foreground">
                        Inicia sesión o crea una cuenta con <strong>{invitation.email}</strong> para aceptar.
                      </p>
                      <div className="flex gap-2">
                        <Button asChild className="flex-1">
                          <Link to="/login" search={{ redirect: window.location.pathname } as never}>Iniciar sesión</Link>
                        </Button>
                        <Button asChild variant="outline" className="flex-1">
                          <Link to="/signup">Crear cuenta</Link>
                        </Button>
                      </div>
                    </div>
                  ) : user.email?.toLowerCase() !== invitation.email.toLowerCase() ? (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        Has iniciado sesión como <strong>{user.email}</strong> pero la invitación es para <strong>{invitation.email}</strong>.
                      </p>
                      <Button onClick={handleAccept} disabled={accepting} className="w-full">
                        {accepting ? "Aceptando…" : "Aceptar de todas formas"}
                      </Button>
                    </div>
                  ) : (
                    <Button onClick={handleAccept} disabled={accepting} className="w-full">
                      {accepting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Aceptar invitación"}
                    </Button>
                  )}
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
