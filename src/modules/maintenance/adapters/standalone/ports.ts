/**
 * Standalone implementations of the host ports over the current app.
 * UX/data helpers only: RLS and RPCs remain the authority on the server.
 */
import type {
  AssetPort, AssetRef, AuthzPort, DocumentPort, DocumentVersionInput, DocumentVersionRef,
  MntPermission, PeoplePort, PersonRef, SiteNode, SitePort, TenantPort,
} from "../../contracts";
import { expandLocationIds } from "../../domain/scope";
import type { StandaloneClient } from "./client";

// ---------- Tenant ----------
export function createTenantPort(getActiveCompanyId: () => string | null): TenantPort {
  return { currentOrgId: () => getActiveCompanyId() || null };
}

// ---------- Authz ----------
type CanRpc = "can_view" | "can_manage_assets" | "can_run_maintenance" | "can_close_session" | "can_reopen_session" | "can_manage_company";
/** Maps module permissions to the existing SECURITY DEFINER can_* functions. */
export const PERMISSION_RPC: Record<MntPermission, CanRpc> = {
  "mnt.view": "can_view",
  "mnt.manage_assets": "can_manage_assets",
  "mnt.run": "can_run_maintenance",
  "mnt.close": "can_close_session",
  "mnt.reopen": "can_reopen_session",
  "mnt.certify": "can_close_session",
  "mnt.admin": "can_manage_company",
};

/** Fail-closed: unknown permission, missing org, RPC error or non-true result => false. */
export function createAuthzPort(client: StandaloneClient): AuthzPort {
  return {
    async can(perm, orgId) {
      const fn = (PERMISSION_RPC as Record<string, CanRpc | undefined>)[perm];
      if (!fn || !orgId) return false;
      try {
        const { data, error } = await client.rpc(fn, { p_company_id: orgId });
        return !error && data === true;
      } catch {
        return false;
      }
    },
  };
}

// ---------- People (person_ref = profiles.id; no new FK to auth.users) ----------
type ProfileRow = { id: string; full_name: string | null; email: string };
const toPerson = (p: ProfileRow): PersonRef => ({ id: p.id, displayName: p.full_name?.trim() || p.email, external: false });

export function createPeoplePort(client: StandaloneClient): PeoplePort {
  const get = async (ids: string[]) => {
    const unique = [...new Set(ids.filter(Boolean))];
    if (!unique.length) return [];
    const { data, error } = await client.from("profiles").select("id, full_name, email").in("id", unique);
    if (error) throw error;
    return (data ?? []).map(toPerson);
  };
  return {
    async current() {
      const { data } = await client.auth.getSession();
      const id = data.session?.user.id;
      if (!id) return null;
      return (await get([id]))[0] ?? null;
    },
    async search(q) {
      const term = q.trim().replace(/[%,()]/g, "");
      if (!term) return [];
      const { data, error } = await client
        .from("profiles").select("id, full_name, email")
        .or(`full_name.ilike.%${term}%,email.ilike.%${term}%`)
        .is("deleted_at", null).limit(20);
      if (error) throw error;
      return (data ?? []).map(toPerson);
    },
    get,
  };
}

// ---------- Sites (locations) ----------
export function createSitePort(client: StandaloneClient): SitePort {
  const load = async (orgId?: string) => {
    let q = client.from("locations").select("id, name, code, parent_location_id").is("deleted_at", null);
    if (orgId) q = q.eq("company_id", orgId);
    const { data, error } = await q.order("name");
    if (error) throw error;
    return data ?? [];
  };
  return {
    async tree(orgId) {
      if (!orgId) return [];
      return (await load(orgId)).map<SiteNode>((l) => ({ id: l.id, name: l.name, code: l.code, parentId: l.parent_location_id }));
    },
    async expand(ids, withChildren) {
      if (!withChildren || !ids.length) return [...new Set(ids)];
      return expandLocationIds(await load(), ids, true);
    },
  };
}

// ---------- Assets (MVP: module-owned table behind the port) ----------
type AssetRow = { id: string; code: string; name: string | null; asset_type_id: string; location_id: string | null; status: string };
const ASSET_COLS = "id, code, name, asset_type_id, location_id, status";
const toAsset = (a: AssetRow): AssetRef => ({ id: a.id, code: a.code, name: a.name, assetTypeId: a.asset_type_id, siteId: a.location_id, status: a.status });

export function createAssetPort(client: StandaloneClient): AssetPort {
  return {
    async get(id) {
      const { data, error } = await client.from("assets").select(ASSET_COLS).eq("id", id).is("deleted_at", null).maybeSingle();
      if (error) throw error;
      return data ? toAsset(data) : null;
    },
    async list(orgId, f) {
      if (!orgId) return [];
      let q = client.from("assets").select(ASSET_COLS).eq("company_id", orgId).is("deleted_at", null);
      if (f?.typeIds?.length) q = q.in("asset_type_id", f.typeIds);
      if (f?.siteIds?.length) q = q.in("location_id", f.siteIds);
      const { data, error } = await q.order("code");
      if (error) throw error;
      return (data ?? []).map(toAsset);
    },
    async byQr(token) {
      if (!token) return null;
      const { data, error } = await client.from("assets").select(ASSET_COLS).eq("qr_token", token).is("deleted_at", null).maybeSingle();
      if (error) throw error;
      return data ? toAsset(data) : null;
    },
  };
}

// ---------- Documents (documents + storage) ----------
/** Server-side registration (hash computed on the server). Injected so the port stays browser-independent. */
export type RegisterVersionFn = (input: DocumentVersionInput) => Promise<DocumentVersionRef>;

export function createDocumentPort(client: StandaloneClient, register: RegisterVersionFn): DocumentPort {
  return {
    registerVersion: (input) => register(input),
    async signedUrl(ref) {
      const { data: doc, error } = await client
        .from("documents").select("storage_bucket, storage_path, file_hash_sha256")
        .eq("id", ref.documentId).is("deleted_at", null).maybeSingle();
      if (error) throw error;
      if (!doc) throw new Error("Documento no encontrado");
      if (ref.sha256 && doc.file_hash_sha256 && doc.file_hash_sha256 !== ref.sha256) {
        throw new Error("La huella del documento no coincide");
      }
      const { data, error: sErr } = await client.storage.from(doc.storage_bucket).createSignedUrl(doc.storage_path, 60);
      if (sErr || !data) throw sErr ?? new Error("No se pudo firmar el enlace");
      return data.signedUrl;
    },
  };
}
