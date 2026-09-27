import { createFileRoute } from "@tanstack/react-router";
import { ChecklistTemplatesListPage } from "@/modules/maintenance/ui/pages/ChecklistTemplatesListPage";

export const Route = createFileRoute("/_authenticated/_app/checklist-templates/")({
  head: () => ({ meta: [{ title: "Plantillas de checklist" }] }),
  component: ChecklistTemplatesListPage,
});
