import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";
import type { Database } from "@/integrations/supabase/types";

type Company = Database["public"]["Tables"]["companies"]["Row"];
type Membership = Database["public"]["Tables"]["company_members"]["Row"] & { companies: Company };

type CompanyState = {
  activeCompanyId: string | null;
  setActiveCompanyId: (id: string) => void;
  memberships: Membership[];
  activeMembership: Membership | null;
  loading: boolean;
  refetch: () => void;
};

const STORAGE_KEY = "active_company_id";
const CompanyContext = createContext<CompanyState | undefined>(undefined);

export function CompanyProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [activeCompanyId, setActive] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(STORAGE_KEY);
  });

  const { data: memberships = [], isLoading, refetch } = useQuery({
    queryKey: ["memberships", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_members")
        .select("*, companies(*)")
        .eq("user_id", user!.id)
        .eq("active", true);
      if (error) throw error;
      return (data ?? []) as Membership[];
    },
  });

  useEffect(() => {
    if (!memberships.length) return;
    if (activeCompanyId && memberships.some((m) => m.company_id === activeCompanyId)) return;
    const def = memberships.find((m) => m.is_default) ?? memberships[0];
    setActiveCompanyId(def.company_id);
  }, [memberships, activeCompanyId]);

  const setActiveCompanyId = (id: string) => {
    setActive(id);
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, id);
  };

  const activeMembership = memberships.find((m) => m.company_id === activeCompanyId) ?? null;

  return (
    <CompanyContext.Provider
      value={{ activeCompanyId, setActiveCompanyId, memberships, activeMembership, loading: isLoading, refetch }}
    >
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const ctx = useContext(CompanyContext);
  if (!ctx) throw new Error("useCompany must be used inside CompanyProvider");
  return ctx;
}
