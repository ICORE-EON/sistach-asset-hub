/** Standalone UI host: maps this app's company/auth contexts and document panel onto the module UI contract. */
import { useMemo, type ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { AttachmentsPanel } from "@/components/attachments-panel";
import { MaintenanceUiProvider, type MaintenanceUiHost } from "../../ui/host";

export function StandaloneMaintenanceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { activeCompanyId, activeMembership } = useCompany();
  const userId = user?.id ?? null;
  const role = activeMembership?.role ?? null;
  const value = useMemo<MaintenanceUiHost>(
    () => ({ request: { orgId: activeCompanyId ?? null, userId, role }, Attachments: AttachmentsPanel }),
    [activeCompanyId, userId, role],
  );
  return <MaintenanceUiProvider value={value}>{children}</MaintenanceUiProvider>;
}
