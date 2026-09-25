import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Gestión de Equipos PCI" },
      { name: "description", content: "Plataforma de gestión de mantenimientos contra incendios" },
      { property: "og:title", content: "Gestión de Equipos PCI" },
      { property: "og:description", content: "Plataforma de gestión de mantenimientos contra incendios" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: IndexRedirect,
});

function IndexRedirect() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (loading) return;
    navigate({ to: user ? "/dashboard" : "/login", replace: true });
  }, [user, loading, navigate]);
  return null;
}
