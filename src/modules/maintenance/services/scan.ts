/** QR execution use-cases (portable). Context is explicit per call; the server decides permissions. */
import { getRepositories } from "../contracts/registry";
import { extractScanToken, type ClosureExceptionCode, type ExecutionContext, type ExecutionInput, type ScanPermissions } from "../contracts/scan";

const repo = () => {
  const r = getRepositories().scan;
  if (!r) throw new Error("Mantenimiento: el adaptador registrado no ofrece ejecución por QR");
  return r;
};

/** Maps the host role to UI hints only (standalone roles). The RPCs re-check everything. */
export function permissionsForRole(role: string | null | undefined): ScanPermissions {
  const run = role === "administrator" || role === "system_manager" || role === "manager" || role === "employee";
  const close = role === "administrator" || role === "system_manager" || role === "manager";
  return { run, close, admin: role === "administrator" };
}

export function makeContext(orgId: string | null | undefined, personRef: string | null, role: string | null | undefined): ExecutionContext {
  if (!orgId) throw new Error("Sin empresa activa");
  return { orgId, personRef, permissions: permissionsForRole(role) };
}

export const scanKeys = {
  runnable: (orgId: string | null) => ["scan", orgId, "runnable"] as const,
  resolve: (orgId: string | null, token: string, sessionId?: string) => ["scan", orgId, "resolve", token, sessionId ?? null] as const,
  people: (orgId: string | null, sessionId: string) => ["scan", orgId, "people", sessionId] as const,
  exceptions: (orgId: string | null, sessionId: string) => ["scan", orgId, "exceptions", sessionId] as const,
};

export const EXCEPTION_LABELS: Record<ClosureExceptionCode, string> = {
  not_applicable: "No aplicable", inaccessible: "Inaccesible", other: "Otra razón",
};

export function newIdempotencyKey(): string {
  const g = globalThis.crypto as Crypto | undefined;
  return g?.randomUUID ? g.randomUUID() : `k${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

export const scanService = {
  available: () => !!getRepositories().scan,
  resolve: (ctx: ExecutionContext, raw: string, sessionId?: string) => {
    const token = extractScanToken(raw);
    if (!token) return Promise.resolve({ status: "not_available" as const });
    return repo().resolveScan(ctx, token, sessionId ? { sessionId } : undefined);
  },
  listMyRunnableSessions: (ctx: ExecutionContext) => repo().listMyRunnableSessions(ctx),
  recordExecution: (ctx: ExecutionContext, v: ExecutionInput, key: string) => repo().recordExecution(ctx, v, key),
  recordClosureException: (ctx: ExecutionContext, itemId: string, code: ClosureExceptionCode, text: string) => {
    if (!ctx.permissions.close) throw new Error("Sin permiso para registrar excepciones de cierre");
    if (text.trim().length < 3) throw new Error("Explica el motivo de la excepción");
    return repo().recordClosureException(ctx, itemId, { code, text: text.trim() });
  },
  listSessionExceptions: (ctx: ExecutionContext, sessionId: string) => repo().listSessionExceptions(ctx, sessionId),
  listSessionPeople: (ctx: ExecutionContext, sessionId: string) => repo().listSessionPeople(ctx, sessionId),
  assignSessionPeople: (ctx: ExecutionContext, sessionId: string, refs: string[]) => repo().assignSessionPeople(ctx, sessionId, refs),
  regenerateQr: (ctx: ExecutionContext, assetId: string) => repo().regenerateQr(ctx, assetId),
};
