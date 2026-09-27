/**
 * Historical representation of closed maintenance sessions. Pure: no Supabase, React, File or Blob.
 *
 * Precedence for a CLOSED or CANCELLED session (open sessions always show live data):
 *  1. Values frozen in the snapshots written at opening/close (session.metadata.snapshot.plan,
 *     item.metadata.snapshot.asset/checklist, session.metadata.close_snapshot.items[].result).
 *  2. A field the snapshot does not contain is shown EMPTY (null), never taken from the current
 *     master data; the row is flagged history_source = "partial".
 *  3. LEGACY: a session/item without a usable snapshot (missing, not an object, or whose ids do not
 *     match the row they belong to) keeps the current joined data exactly as before, flagged
 *     history_source = "legacy". Snapshots are never reconstructed retroactively.
 *
 * Snapshots are display data only: their ids are validated against the owning row (plan_id,
 * asset_id, item id) and are never used to fetch anything, so they cannot reach another org.
 */
export type HistorySource = "live" | "snapshot" | "partial" | "legacy";
type Obj = Record<string, unknown>;

const obj = (v: unknown): Obj | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : null);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
export const isHistorical = (status: string | null | undefined) => status === "closed" || status === "cancelled";

type SessionLike = { status: string; plan_id?: string | null; metadata?: unknown; maintenance_plans?: Obj | null };

/** Replaces the joined plan with the frozen plan of a closed session. */
export function historicalSession<S extends SessionLike>(s: S): S & { history_source: HistorySource } {
  if (!isHistorical(s.status)) return { ...s, history_source: "live" };
  const plan = obj(obj(obj(s.metadata)?.snapshot)?.plan);
  const name = str(plan?.name);
  if (!plan || !name || (s.plan_id && plan.id !== s.plan_id)) return { ...s, history_source: "legacy" };
  const frozen = {
    id: plan.id, name, code: str(plan.code), frequency: str(plan.frequency), interval_months: num(plan.interval_months),
    scope_mode: str(plan.scope_mode),
    scope_location_ids: Array.isArray(plan.scope_location_ids) ? plan.scope_location_ids.filter((x) => typeof x === "string") : null,
    scope_include_sublocations: typeof plan.scope_include_sublocations === "boolean" ? plan.scope_include_sublocations : null,
  };
  const partial = frozen.code === null || frozen.scope_mode === null;
  return { ...s, maintenance_plans: frozen, history_source: partial ? "partial" : "snapshot" };
}

/** Frozen per-item results of a closed session, keyed by item id. */
export function closeResults(sessionMetadata: unknown): Map<string, string> {
  const out = new Map<string, string>();
  const items = obj(obj(sessionMetadata)?.close_snapshot)?.items;
  if (!Array.isArray(items)) return out;
  for (const e of items) {
    const id = str(obj(e)?.item_id), r = str(obj(e)?.result);
    if (id && r) out.set(id, r);
  }
  return out;
}

type ItemLike = { id: string; asset_id: string; result: string; checklist_template_version_id?: string; metadata?: unknown; assets?: Obj | null };

/** Replaces joined asset/type/location with the frozen ones; result from close_snapshot. */
export function historicalItem<I extends ItemLike>(
  it: I, sessionStatus: string, frozenResults: Map<string, string>,
): I & { history_source: HistorySource } {
  if (!isHistorical(sessionStatus)) return { ...it, history_source: "live" };
  const snap = obj(obj(it.metadata)?.snapshot);
  const a = obj(snap?.asset);
  const code = str(a?.code);
  const frozenResult = frozenResults.get(it.id);
  if (!a || !code || a.id !== it.asset_id) {
    return { ...it, ...(frozenResult ? { result: frozenResult } : {}), history_source: "legacy" };
  }
  const typeId = str(a.asset_type_id), locId = str(a.location_id);
  const typeName = str(a.type_name), typeCode = str(a.type_code), locName = str(a.location_name);
  const assets = {
    id: it.asset_id, code, name: str(a.name),
    manufacturer: str(a.manufacturer), model: str(a.model),
    asset_type_id: typeId, location_id: locId,
    locations: locName ? { name: locName } : null,
    asset_types: typeCode || typeName ? { code: typeCode ?? "", name_i18n: typeName ? { es: typeName } : null } : null,
  };
  const chk = obj(snap?.checklist);
  const versionOk = !it.checklist_template_version_id || chk?.version_id === it.checklist_template_version_id;
  const partial = !typeName || !("manufacturer" in a) || !frozenResult || !versionOk || (!!locId && !locName);
  return {
    ...it, assets, result: frozenResult ?? it.result,
    history_source: partial ? "partial" : "snapshot",
  };
}
