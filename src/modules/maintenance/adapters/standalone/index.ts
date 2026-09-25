/** Standalone host wiring over the current app. Only this folder may import app infrastructure. */
import { useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import type { MaintenanceHost } from "../../contracts";
import { createStandaloneHost } from "./host";
import { registerDocumentVersion } from "./documents.functions";

export { createStandaloneHost, standaloneChecks } from "./host";
export * from "./ports";

/** React bridge: a stable host whose tenant always reflects the active company. */
export function useStandaloneHost(): MaintenanceHost {
  const { activeCompanyId } = useCompany();
  const ref = useRef(activeCompanyId);
  ref.current = activeCompanyId;
  return useMemo(
    () => createStandaloneHost({
      client: supabase,
      getActiveCompanyId: () => ref.current,
      registerVersion: (input) => registerDocumentVersion({ data: input as never }),
    }),
    [],
  );
}
