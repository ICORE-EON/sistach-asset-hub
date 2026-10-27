import { createFileRoute } from "@tanstack/react-router";
import { MaintenanceHubPage, type HubTab } from "@/modules/maintenance/ui/pages/MaintenanceHubPage";

const TABS: HubTab[] = ["upcoming", "repairs", "history", "plans"];

export const Route = createFileRoute("/_authenticated/_app/maintenance/")({
  validateSearch: (s: Record<string, unknown>): { tab?: HubTab } =>
    TABS.includes(s.tab as HubTab) ? { tab: s.tab as HubTab } : {},
  head: () => ({ meta: [
    { title: "Mantenimientos y reparaciones | Sistach Asset Guardian" },
    { name: "description", content: "Próximos mantenimientos, reparaciones correctivas, histórico y planes de Sistach Asset Guardian." },
    { property: "og:title", content: "Mantenimientos y reparaciones | Sistach Asset Guardian" },
    { property: "og:description", content: "Gestión de mantenimientos, reparaciones y planes por organización." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: MaintenanceRoute,
});

function MaintenanceRoute() {
  const { tab = "upcoming" } = Route.useSearch();
  const navigate = Route.useNavigate();
  return <MaintenanceHubPage tab={tab} onTabChange={(t) => navigate({ search: { tab: t }, replace: true })} />;
}
