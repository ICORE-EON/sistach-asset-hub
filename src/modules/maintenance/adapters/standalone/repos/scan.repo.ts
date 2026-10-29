/** Standalone ScanContract over the mnt_sa_* RPCs (authority) and read-only RLS tables. */
import type { StandaloneClient } from "../client";
import type { ScanContract, ScanResolution, SessionItemException } from "../../../contracts/scan";

const ok = <T>(r: { data: T; error: unknown }): T => { if (r.error) throw r.error; return r.data; };
type Raw = Record<string, unknown>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (c: StandaloneClient, fn: string, args: Record<string, unknown>) => (c.rpc as any)(fn, args) as Promise<{ data: unknown; error: unknown }>;

export function mapResolution(raw: Raw | null): ScanResolution {
  if (!raw || (raw.status !== "ok" && raw.status !== "choose")) return { status: "not_available" };
  const asset = raw.asset as { id: string; code: string; name: string | null };
  if (raw.status === "ok") {
    return { status: "ok", kind: "maintenance_asset", asset, sessionId: String(raw.session_id), sessionCode: String(raw.session_code),
      itemId: String(raw.item_id), itemResult: String(raw.item_result), checklistVersionId: (raw.checklist_version_id as string | null) ?? null };
  }
  return { status: "choose", kind: "maintenance_asset", asset,
    sessions: ((raw.sessions as Raw[]) ?? []).map((s) => ({ sessionId: String(s.session_id), sessionCode: String(s.session_code),
      itemId: String(s.item_id), itemResult: String(s.item_result), planName: (s.plan_name as string | null) ?? null })) };
}

export function createScanRepo(c: StandaloneClient): ScanContract {
  return {
    async resolveScan(_ctx, token, opts) {
      const r = await rpc(c, "mnt_sa_resolve_scan", { p_token: token, p_session: opts?.sessionId ?? null });
      if (r.error) return { status: "not_available" };
      return mapResolution(r.data as Raw | null);
    },
    async listMyRunnableSessions(ctx) {
      const rows = ok(await rpc(c, "mnt_sa_list_my_runnable_sessions", { p_company: ctx.orgId })) as Raw[] | null;
      return (rows ?? []).map((x) => ({ id: String(x.id), code: String(x.code), scheduledFor: (x.scheduled_for as string | null) ?? null,
        planName: (x.plan_name as string | null) ?? null, total: Number(x.total), done: Number(x.done), excepted: Number(x.excepted) }));
    },
    async recordExecution(ctx, v, key) {
      const r = ok(await rpc(c, "mnt_sa_record_item_execution", { p_company: ctx.orgId, p_session: v.sessionId, p_item: v.itemId,
        p_result: v.result, p_observations: v.observations, p_fail_count: v.failCount, p_key: key })) as { replayed: boolean; result: string };
      return { replayed: !!r.replayed, result: r.result };
    },
    async recordClosureException(ctx, itemId, reason) {
      const r = ok(await rpc(c, "mnt_sa_record_closure_exception", { p_company: ctx.orgId, p_item: itemId, p_code: reason.code, p_text: reason.text })) as { recorded_now: boolean };
      return { recordedNow: !!r.recorded_now };
    },
    async listSessionExceptions(ctx, sessionId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows = ok(await (c as any).from("mnt_session_item_exceptions")
        .select("item_id, asset_id, reason_code, reason_text, recorded_by_name, recorded_at")
        .eq("company_id", ctx.orgId).eq("session_id", sessionId).order("recorded_at")) as Raw[];
      return rows.map((x): SessionItemException => ({ itemId: String(x.item_id), assetId: String(x.asset_id),
        code: x.reason_code as SessionItemException["code"], text: String(x.reason_text), byName: (x.recorded_by_name as string | null) ?? null, at: String(x.recorded_at) }));
    },
    async listSessionPeople(ctx, sessionId) {
      const rows = ok(await rpc(c, "mnt_sa_list_session_people", { p_company: ctx.orgId, p_session: sessionId })) as Raw[] | null;
      return (rows ?? []).map((x) => ({ userId: String(x.user_id), name: String(x.name), role: String(x.role), assigned: !!x.assigned, technician: !!x.technician }));
    },
    async assignSessionPeople(ctx, sessionId, refs) {
      return Number(ok(await rpc(c, "mnt_sa_assign_session_people", { p_company: ctx.orgId, p_session: sessionId, p_users: refs })));
    },
    async regenerateQr(ctx, assetId) {
      return { token: String(ok(await rpc(c, "mnt_sa_regenerate_asset_qr", { p_company: ctx.orgId, p_asset: assetId }))) };
    },
  };
}
