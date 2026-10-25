/**
 * Effective execution date of a closed intervention, kept apart from the administrative close date.
 * - External: the declared performed_on. Never falls back to closed_at (that is the registration date).
 * - Internal: the latest item completion date. Skipped items have no completion and are ignored.
 * When nothing is recorded the date is null ("No consta"); it is never invented.
 */
export type ExecutionSource = "performed_on" | "items" | null;

export function effectiveExecution(s: {
  is_external: boolean;
  metadata: unknown;
  item_completions: Array<string | null>;
}): { date: string | null; source: ExecutionSource } {
  if (s.is_external) {
    const m = (s.metadata ?? {}) as { external?: { performed_on?: unknown } };
    const p = m.external?.performed_on;
    return typeof p === "string" && p ? { date: p, source: "performed_on" } : { date: null, source: null };
  }
  const dates = s.item_completions.filter((d): d is string => !!d).sort();
  return dates.length ? { date: dates[dates.length - 1], source: "items" } : { date: null, source: null };
}

/** Number of assets covered: frozen close snapshot first, live items otherwise. */
export function interventionScope(metadata: unknown, liveItemCount: number): number {
  const items = (metadata as { close_snapshot?: { items?: unknown[] } } | null)?.close_snapshot?.items;
  return Array.isArray(items) ? items.length : liveItemCount;
}
