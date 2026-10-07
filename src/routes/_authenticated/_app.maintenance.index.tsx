import { createFileRoute } from "@tanstack/react-router";
import { MaintenanceHubPage, type HubTab } from "@/modules/maintenance/ui/pages/MaintenanceHubPage";

const TABS: HubTab[] = ["upcoming", "history", "plans"];

export const Route = createFileRoute("/_authenticated/_app/maintenance/")({
  validateSearch: (s: Record<string, unknown>): { tab?: HubTab } =>
    TABS.includes(s.tab as HubTab) ? { tab: s.tab as HubTab } : {},
  head: () => ({ meta: [{ title: "Mantenimientos" }] }),
  component: MaintenanceRoute,
});

function MaintenanceRoute() {
  const { tab = "upcoming" } = Route.useSearch();
  const navigate = Route.useNavigate();
  return <MaintenanceHubPage tab={tab} onTabChange={(t) => navigate({ search: { tab: t }, replace: true })} />;
}
