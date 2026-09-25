import { Fragment } from "react";
import { useRouterState } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Check, ChevronsUpDown, LogOut, User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { NotificationsBell } from "@/components/notifications-bell";

const ROUTE_LABELS: Record<string, string> = {
  dashboard: "Panel",
  assets: "Activos",
  maintenance: "Mantenimientos",
  incidents: "Incidencias",
  certificates: "Certificados",
  documents: "Documentos",
  imports: "Importación",
  settings: "Administración",
};

export function Topbar() {
  const { user, signOut } = useAuth();
  const { memberships, activeMembership, setActiveCompanyId } = useCompany();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const segments = pathname.split("/").filter(Boolean);
  const current = segments[0] ?? "dashboard";

  const initials =
    (user?.user_metadata?.full_name ?? user?.email ?? "?")
      .split(/\s+/)
      .map((p: string) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/80 px-3 backdrop-blur">
      <SidebarTrigger />

      <Breadcrumb className="hidden sm:block">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage>{ROUTE_LABELS[current] ?? current}</BreadcrumbPage>
          </BreadcrumbItem>
          {segments.slice(1).map((seg, i) => (
            <Fragment key={i}>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage className="capitalize">{seg}</BreadcrumbPage>
              </BreadcrumbItem>
            </Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>

      <div className="ml-auto flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="max-w-[220px]">
              <span className="truncate">{activeMembership?.companies.name ?? "Sin empresa"}</span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>Cambiar empresa</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {memberships.map((m) => {
              const active = m.company_id === activeMembership?.company_id;
              return (
                <DropdownMenuItem key={m.company_id} onClick={() => setActiveCompanyId(m.company_id)}>
                  <span className="flex-1 truncate">{m.companies.name}</span>
                  {active && <Check className="ml-2 h-4 w-4" />}
                  {!active && (
                    <Badge variant="outline" className="ml-2 text-[10px] capitalize">
                      {m.role}
                    </Badge>
                  )}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        <NotificationsBell />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full">
              <Avatar className="h-8 w-8">
                <AvatarImage src={user?.user_metadata?.avatar_url} alt="" />
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="flex flex-col gap-0.5">
              <span className="text-sm">{user?.user_metadata?.full_name ?? "Usuario"}</span>
              <span className="text-xs font-normal text-muted-foreground">{user?.email}</span>
              {activeMembership && (
                <Badge variant="secondary" className="mt-1 w-fit text-[10px] capitalize">
                  {activeMembership.role}
                </Badge>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>
              <User className="mr-2 h-4 w-4" /> Mi perfil
            </DropdownMenuItem>
            <DropdownMenuItem onClick={signOut}>
              <LogOut className="mr-2 h-4 w-4" /> Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
