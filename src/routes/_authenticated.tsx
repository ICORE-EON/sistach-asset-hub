import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user, loading: authLoading } = useAuth();
  const { memberships, activeCompanyId, loading: cLoading } = useCompany();
  const navigate = useNavigate();

  useEffect(() => {
    if (authLoading || cLoading) return;
    if (!user) { navigate({ to: "/login", replace: true }); return; }
    if (memberships.length === 0) {
      navigate({ to: "/onboarding/company", replace: true });
      return;
    }
    if (!activeCompanyId && memberships.length > 1) {
      navigate({ to: "/select-company", replace: true });
    }
  }, [user, memberships, activeCompanyId, authLoading, cLoading, navigate]);

  if (authLoading || cLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <Outlet />;
}
