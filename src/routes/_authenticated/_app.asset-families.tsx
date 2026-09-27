import { createFileRoute } from "@tanstack/react-router";
import { AssetFamiliesPage } from "@/modules/maintenance/ui/pages/AssetFamiliesPage";

export const Route = createFileRoute("/_authenticated/_app/asset-families")({
  head: () => ({
    meta: [
      { title: "Familias de activos" },
      {
        name: "description",
        content: "Agrupa los tipos de activo en familias para planificar mantenimientos.",
      },
    ],
  }),
  component: AssetFamiliesPage,
});
