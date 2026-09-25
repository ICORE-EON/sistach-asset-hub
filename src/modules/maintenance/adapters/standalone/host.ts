import { CONTRACT_VERSION, type MaintenanceHost } from "../../contracts";
import { runPreflight, type PreflightCheck } from "../../manifest";
import type { StandaloneClient } from "./client";
import {
  createAssetPort, createAuthzPort, createDocumentPort, createPeoplePort, createSitePort, createTenantPort,
  type RegisterVersionFn,
} from "./ports";

export type StandaloneHostDeps = {
  client: StandaloneClient;
  getActiveCompanyId: () => string | null;
  registerVersion: RegisterVersionFn;
  hostContractVersion?: string;
};

const tableReadable = (client: StandaloneClient, table: "companies" | "locations" | "profiles" | "assets" | "documents") =>
  async () => (await client.from(table).select("id").limit(1)).error == null;

/** Prerequisite checks for the standalone host (fail-closed). */
export function standaloneChecks(client: StandaloneClient, getOrgId: () => string | null): PreflightCheck[] {
  return [
    { name: "organización activa", run: async () => !!getOrgId() },
    { name: "tabla de organizaciones (companies)", run: tableReadable(client, "companies") },
    { name: "centros (locations)", run: tableReadable(client, "locations") },
    { name: "personas (profiles)", run: tableReadable(client, "profiles") },
    { name: "activos (assets)", run: tableReadable(client, "assets") },
    { name: "documentos (documents)", run: tableReadable(client, "documents") },
    {
      name: "función de permisos (can_view)",
      run: async () => {
        const org = getOrgId();
        if (!org) return false;
        const { error } = await client.rpc("can_view", { p_company_id: org });
        return error == null;
      },
    },
  ];
}

export function createStandaloneHost(deps: StandaloneHostDeps): MaintenanceHost {
  const { client, getActiveCompanyId, registerVersion } = deps;
  const hostVersion = deps.hostContractVersion ?? CONTRACT_VERSION;
  return {
    tenant: createTenantPort(getActiveCompanyId),
    authz: createAuthzPort(client),
    people: createPeoplePort(client),
    sites: createSitePort(client),
    assets: createAssetPort(client),
    docs: createDocumentPort(client, registerVersion),
    manifest: {
      contractVersion: hostVersion,
      preflight: () => runPreflight(standaloneChecks(client, getActiveCompanyId), hostVersion),
    },
  };
}
