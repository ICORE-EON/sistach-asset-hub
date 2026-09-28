/** Test helper: registers a fresh adapter built from the given repositories (others are empty stubs). */
import { __resetMaintenanceAdapterForTests, registerMaintenanceAdapter } from "../../contracts/registry";
import type { MaintenanceRepositories } from "../../contracts/repositories";

export function useTestRepositories(partial: Partial<Record<keyof MaintenanceRepositories, unknown>>) {
  __resetMaintenanceAdapterForTests();
  const empty = { assets: {}, checklists: {}, plans: {}, sessions: {}, incidents: {}, certificates: {} };
  registerMaintenanceAdapter({ id: "test", repositories: { ...empty, ...partial } as unknown as MaintenanceRepositories });
}
