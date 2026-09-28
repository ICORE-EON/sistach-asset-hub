/**
 * Host adapter registry of the maintenance module.
 *
 * It only selects WHICH implementation serves the data contracts (standalone app
 * or ICORE). It never stores organisation, user, permissions or active site:
 * that request context travels explicitly in every call (orgId first argument).
 *
 * Rules: fails loudly when nothing is registered; the first adapter wins and a
 * different adapter id cannot replace it at runtime (re-registering the same id
 * is a no-op, so dev hot reload stays safe).
 */
import type { MaintenanceRepositories } from "./repositories";

export type MaintenanceAdapter = {
  /** Stable host id, e.g. "standalone" or "icore". */
  readonly id: string;
  readonly repositories: MaintenanceRepositories;
};

const REQUIRED: Array<keyof MaintenanceRepositories> = ["assets", "checklists", "plans", "sessions", "incidents", "certificates"];

let active: Readonly<{ id: string; repositories: Readonly<MaintenanceRepositories> }> | null = null;

export function registerMaintenanceAdapter(adapter: MaintenanceAdapter): void {
  if (!adapter?.id) throw new Error("Mantenimiento: el adaptador necesita un id");
  const missing = REQUIRED.filter((k) => !adapter.repositories?.[k]);
  if (missing.length) throw new Error(`Mantenimiento: al adaptador "${adapter.id}" le faltan capacidades: ${missing.join(", ")}`);
  if (active) {
    if (active.id === adapter.id) return;
    throw new Error(`Mantenimiento: ya hay un adaptador registrado ("${active.id}"); no se puede sustituir por "${adapter.id}"`);
  }
  active = Object.freeze({ id: adapter.id, repositories: Object.freeze({ ...adapter.repositories }) });
}

export function getRepositories(): Readonly<MaintenanceRepositories> {
  if (!active) throw new Error("Mantenimiento: no hay ningún adaptador de datos registrado (registerMaintenanceAdapter)");
  return active.repositories;
}

export function registeredAdapterId(): string | null {
  return active?.id ?? null;
}

/** Test-only reset; never call from application code. */
export function __resetMaintenanceAdapterForTests(): void {
  active = null;
}
