/**
 * QR → authorized resource → checklist → recorded execution → progress/closing.
 * Neutral contract: the host supplies session/auth, tenant (orgId), permissions, person and evidence.
 * Only resource kind implemented: "maintenance_asset". The server (RPC/RLS) is the authority; the
 * permissions passed in ExecutionContext are only used by the UI to show or hide actions.
 */
export type ScanPermissions = { run: boolean; close: boolean; admin: boolean };

export type ExecutionContext = { orgId: string; personRef: string | null; permissions: ScanPermissions };

export type ScanAsset = { id: string; code: string; name: string | null };

export type ScanResolution =
  | { status: "not_available" }
  | {
      status: "ok"; kind: "maintenance_asset"; asset: ScanAsset; sessionId: string; sessionCode: string;
      itemId: string; itemResult: string; checklistVersionId: string | null;
    }
  | {
      status: "choose"; kind: "maintenance_asset"; asset: ScanAsset;
      sessions: { sessionId: string; sessionCode: string; itemId: string; itemResult: string; planName: string | null }[];
    };

export type RunnableSession = {
  id: string; code: string; scheduledFor: string | null; planName: string | null;
  total: number; done: number; excepted: number;
};

export type ExecutionResult = "ok" | "with_incident" | "not_applicable";

export type ExecutionInput = {
  sessionId: string; itemId: string; result: ExecutionResult;
  observations: string | null; failCount: number;
};

export type ClosureExceptionCode = "not_applicable" | "inaccessible" | "other";

export type SessionPerson = { userId: string; name: string; role: string; assigned: boolean; technician: boolean };

export type SessionItemException = {
  itemId: string; assetId: string; code: ClosureExceptionCode; text: string; byName: string | null; at: string;
};

export interface ScanContract {
  /** Generic: missing, foreign, revoked, unassigned or unauthorized → { status: "not_available" }. */
  resolveScan(ctx: ExecutionContext, token: string, opts?: { sessionId?: string }): Promise<ScanResolution>;
  /** Only the caller's own open, authorized sessions. */
  listMyRunnableSessions(ctx: ExecutionContext): Promise<RunnableSession[]>;
  /** Idempotent by key: a retry with the same key returns the first result and writes nothing. */
  recordExecution(ctx: ExecutionContext, input: ExecutionInput, idempotencyKey: string): Promise<{ replayed: boolean; result: string }>;
  /** close permission; the item becomes "excepted" (never "reviewed"). */
  recordClosureException(ctx: ExecutionContext, itemId: string, reason: { code: ClosureExceptionCode; text: string }): Promise<{ recordedNow: boolean }>;
  listSessionExceptions(ctx: ExecutionContext, sessionId: string): Promise<SessionItemException[]>;
  listSessionPeople(ctx: ExecutionContext, sessionId: string): Promise<SessionPerson[]>;
  /** close permission; replaces the active set of assignees. */
  assignSessionPeople(ctx: ExecutionContext, sessionId: string, personRefs: string[]): Promise<number>;
  /** admin permission; the old token stops working at once, only its hash is kept. */
  regenerateQr(ctx: ExecutionContext, assetId: string): Promise<{ token: string }>;
}

/** Extracts the opaque token from a scanned QR value (full URL or bare token). */
export function extractScanToken(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  const m = v.match(/\/qr\/([A-Za-z0-9_-]+)\/?(?:[?#].*)?$/);
  const t = m ? m[1] : v;
  return /^[A-Za-z0-9_-]{16,128}$/.test(t) ? t : null;
}
