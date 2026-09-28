import { describe, it, expect, beforeEach } from "vitest";
import { __resetMaintenanceAdapterForTests, getRepositories, registerMaintenanceAdapter, registeredAdapterId } from "../registry";
import type { MaintenanceRepositories } from "../repositories";

const repos = (tag: string) =>
  ({ assets: { tag }, checklists: {}, plans: {}, sessions: {}, incidents: {}, certificates: {} }) as unknown as MaintenanceRepositories;

beforeEach(() => __resetMaintenanceAdapterForTests());

describe("adapter registry", () => {
  it("fails clearly when no adapter is registered", () => {
    expect(() => getRepositories()).toThrow(/no hay ningún adaptador/);
    expect(registeredAdapterId()).toBeNull();
  });
  it("rejects adapters missing capabilities or id", () => {
    expect(() => registerMaintenanceAdapter({ id: "x", repositories: { assets: {} } as never })).toThrow(/faltan capacidades/);
    expect(() => registerMaintenanceAdapter({ id: "", repositories: repos("a") })).toThrow(/id/);
    expect(registeredAdapterId()).toBeNull();
  });
  it("first adapter wins; a different adapter cannot replace it at runtime", () => {
    registerMaintenanceAdapter({ id: "standalone", repositories: repos("first") });
    expect(() => registerMaintenanceAdapter({ id: "icore", repositories: repos("second") })).toThrow(/no se puede sustituir/);
    expect((getRepositories().assets as unknown as { tag: string }).tag).toBe("first");
  });
  it("re-registering the same id is a no-op (hot reload) and keeps the original", () => {
    registerMaintenanceAdapter({ id: "standalone", repositories: repos("first") });
    registerMaintenanceAdapter({ id: "standalone", repositories: repos("again") });
    expect((getRepositories().assets as unknown as { tag: string }).tag).toBe("first");
  });
  it("registered set is frozen and holds no request state (org/user/site)", () => {
    const r = repos("a");
    registerMaintenanceAdapter({ id: "standalone", repositories: r });
    const got = getRepositories();
    expect(Object.isFrozen(got)).toBe(true);
    expect(() => { (got as { assets: unknown }).assets = {}; }).toThrow();
    expect(Object.keys(got).sort()).toEqual(["assets", "certificates", "checklists", "incidents", "plans", "sessions"]);
  });
});
