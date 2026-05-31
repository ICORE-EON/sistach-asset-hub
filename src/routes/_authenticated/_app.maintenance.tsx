import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";
import { Wrench } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_app/maintenance")({
  head: () => ({ meta: [{ title: "Mantenimientos" }] }),
  component: () => (
    <ModulePlaceholder
      icon={Wrench}
      title="Mantenimientos"
      description="Planes, sesiones, checklists y firmas digitales."
    />
  ),
});
