/**
 * ICORE host adapter — contract stub only. ICORE must supply these ports
 * (host_has_perm, host_current_person, host_site_tree, host_register_document_version).
 * Until then every port fails closed and preflight reports the missing prerequisites.
 */
import { CONTRACT_VERSION, type MaintenanceHost } from "../../contracts";

const notAvailable = () => Promise.reject(new Error("ICORE adapter no implementado"));

export const ICORE_REQUIRED = [
  "host_has_perm(org_id uuid, perm text)",
  "host_current_person()",
  "host_site_tree(org_id uuid)",
  "host_register_document_version(...)",
  "host asset registry (AssetPort)",
];

export function createIcoreHostStub(): MaintenanceHost {
  return {
    tenant: { currentOrgId: () => null },
    authz: { can: async () => false },
    people: { current: notAvailable, search: notAvailable, get: notAvailable },
    sites: { tree: notAvailable, expand: notAvailable },
    assets: { get: notAvailable, list: notAvailable, byQr: notAvailable },
    docs: { registerVersion: notAvailable, signedUrl: notAvailable },
    manifest: {
      contractVersion: CONTRACT_VERSION,
      preflight: async () => ({ ok: false, contractVersion: CONTRACT_VERSION, missing: [...ICORE_REQUIRED] }),
    },
  };
}
