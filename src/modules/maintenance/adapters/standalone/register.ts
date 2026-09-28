/**
 * Standalone host: binds the module data contracts to this app's database.
 * Lives in adapters/standalone (excluded from the ICORE export package).
 */
import { supabase } from "@/integrations/supabase/client";
import { registerMaintenanceAdapter } from "../../contracts/registry";
import type { MaintenanceRepositories } from "../../contracts/repositories";
import { createAssetsRepo } from "./repos/assets.repo";
import { createChecklistsRepo } from "./repos/checklists.repo";
import { createPlansRepo } from "./repos/plans.repo";
import { createSessionsRepo } from "./repos/sessions.repo";
import { createIncidentsRepo } from "./repos/incidents.repo";
import { createCertificatesRepo } from "./repos/certificates.repo";
import type { StandaloneClient } from "./client";

/** Compile-time conformance: the standalone implementation must satisfy the module contracts. */
export function createStandaloneRepositories(client: StandaloneClient): MaintenanceRepositories {
  return {
    assets: createAssetsRepo(client),
    checklists: createChecklistsRepo(client),
    plans: createPlansRepo(client),
    sessions: createSessionsRepo(client),
    incidents: createIncidentsRepo(client),
    certificates: createCertificatesRepo(client),
  } satisfies MaintenanceRepositories;
}

export const STANDALONE_ADAPTER_ID = "standalone";

/** Called once at app start (router creation, SSR and browser). Idempotent. */
export function registerStandaloneMaintenance(): void {
  registerMaintenanceAdapter({ id: STANDALONE_ADAPTER_ID, repositories: createStandaloneRepositories(supabase) });
}
