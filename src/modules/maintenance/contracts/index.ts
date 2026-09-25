/**
 * Host contract for the maintenance module (v1).
 * Ports are UX/data helpers only: real authority lives in RLS and RPCs (host_has_perm).
 */
export const CONTRACT_VERSION = "1.0.0";

export type MntPermission =
  | "mnt.view" | "mnt.manage_assets" | "mnt.run" | "mnt.close"
  | "mnt.reopen" | "mnt.certify" | "mnt.admin";

export type PersonRef = { id: string; displayName: string; role?: string | null; external?: boolean; provider?: string | null };
/** Immutable snapshot stored alongside person_ref in sessions, responses, reopenings, signatures and certificates. */
export type ActorSnapshot = { name: string; role: string | null; external: boolean; provider: string | null; providerTaxId?: string | null };
export type SiteNode = { id: string; name: string; code: string; parentId: string | null };
export type AssetRef = { id: string; code: string; name: string | null; assetTypeId: string; siteId: string | null; status: string };
export type DocumentVersionRef = { documentId: string; versionId: string; sha256: string };
/** Browser-independent: bytes are referenced (uploaded blob key or stream), the server computes the hash. */
export type DocumentVersionInput = {
  orgId: string; kind: string; subject: { type: string; id: string };
  bytesRef: string; mime: string; meta?: Record<string, unknown>;
};

export interface TenantPort { currentOrgId(): string | null }
export interface AuthzPort { can(perm: MntPermission, orgId: string): Promise<boolean> }
export interface PeoplePort { current(): Promise<PersonRef | null>; search(q: string): Promise<PersonRef[]>; get(ids: string[]): Promise<PersonRef[]> }
export interface SitePort { tree(orgId: string): Promise<SiteNode[]>; expand(ids: string[], withChildren: boolean): Promise<string[]> }
export interface AssetPort { get(id: string): Promise<AssetRef | null>; list(orgId: string, f?: { typeIds?: string[]; siteIds?: string[] }): Promise<AssetRef[]>; byQr(token: string): Promise<AssetRef | null> }
export interface DocumentPort { registerVersion(input: DocumentVersionInput): Promise<DocumentVersionRef>; signedUrl(ref: DocumentVersionRef): Promise<string> }
export type PreflightResult = { ok: boolean; contractVersion: string; missing: string[] };

export interface MaintenanceHost {
  tenant: TenantPort; authz: AuthzPort; people: PeoplePort; sites: SitePort;
  assets: AssetPort; docs: DocumentPort;
  manifest: { contractVersion: string; preflight(): Promise<PreflightResult> };
}

/** Domain events written to the transactional outbox in the same transaction as the mutation. */
export type MntDomainEvent =
  | { type: "mnt.session.closed" | "mnt.session.reopened"; eventId: string; orgId: string; sessionId: string; outcome?: string }
  | { type: "mnt.incident.opened" | "mnt.incident.status_changed" | "mnt.incident.closed"; eventId: string; orgId: string; incidentId: string; assetId: string | null }
  | { type: "mnt.certificate.issued"; eventId: string; orgId: string; certificateId: string; document: DocumentVersionRef };
