/**
 * Closing traceability (executors and justified exceptions) read from the append-only closure summary
 * written by the close RPC of each host. Pure: tolerant parser shared by the certificate PDF and screens.
 * Accepts both the standalone shape (user_id/name, by_name, asset snapshot) and the installer shape
 * (ref/snapshot, by_ref/by).
 */
export type TraceExecutor = { name: string; items: number };
export type TraceException = { assetCode: string; assetName: string; reason: string; text: string; by: string; at: string | null };
export type SessionTrace = { executors: TraceExecutor[]; exceptions: TraceException[] };

export const EXCEPTION_REASON_LABELS: Record<string, string> = {
  not_applicable: "No aplica",
  inaccessible: "Inaccesible",
  other: "Otro motivo",
};

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const str = (v: unknown): string => (typeof v === "string" ? v : "");
const personName = (v: unknown): string => {
  const o = obj(v);
  return str(o.full_name) || str(o.name) || str(o.display_name) || str(o.email);
};

export function parseClosureSummary(
  summary: unknown,
  assetsById: Map<string, { code?: string | null; name?: string | null }> = new Map(),
): SessionTrace {
  const s = obj(summary);
  const executors = (Array.isArray(s.executors) ? s.executors : []).map((e) => {
    const o = obj(e);
    return { name: str(o.name) || personName(o.snapshot) || "—", items: Number(o.items) || 0 };
  });
  const exceptions = (Array.isArray(s.exceptions) ? s.exceptions : []).map((x) => {
    const o = obj(x);
    const snap = obj(o.asset);
    const live = assetsById.get(str(o.asset_id));
    const code = str(o.code);
    return {
      assetCode: str(snap.code) || live?.code || "—",
      assetName: str(snap.name) || live?.name || "",
      reason: EXCEPTION_REASON_LABELS[code] ?? (code || "—"),
      text: str(o.text),
      by: str(o.by_name) || personName(o.by) || "—",
      at: str(o.at) || null,
    };
  });
  return { executors, exceptions };
}

export function formatTraceDate(at: string | null): string {
  if (!at) return "—";
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return at;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())} UTC`;
}
