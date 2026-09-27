import { createFileRoute } from "@tanstack/react-router";
import { ChecklistTemplateEditorPage } from "@/modules/maintenance/ui/pages/ChecklistTemplateEditorPage";

export const Route = createFileRoute("/_authenticated/_app/checklist-templates/$id")({
  head: () => ({ meta: [{ title: "Editor de plantilla" }] }),
  component: ChecklistTemplateEditorPage,
});
