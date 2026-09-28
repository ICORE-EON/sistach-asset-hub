/**
 * Every service operation hands the caller's orgId explicitly to the adapter
 * (first argument) and never reaches the adapter without one.
 * Adapters are recording proxies: no database, no app code.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { useTestRepositories } from "./test-adapter";

vi.mock("../../render/certificate-pdf", () => ({ buildCertificatePdf: async () => new Uint8Array([1]) }));

type Call = { repo: string; method: string; args: unknown[] };
const calls: Call[] = [];
const recorder = (repo: string) =>
  new Proxy({}, { get: (_t, method) => (...args: unknown[]) => { calls.push({ repo, method: String(method), args }); return Promise.resolve([]); } });
useTestRepositories({
  assets: recorder("assets"), checklists: recorder("checklists"), plans: recorder("plans"),
  sessions: recorder("sessions"), incidents: recorder("incidents"), certificates: recorder("certificates"),
});

const { assetService } = await import("../assets");
const { checklistService } = await import("../checklists");
const { planService } = await import("../plans");
const { sessionService } = await import("../sessions");
const { incidentService } = await import("../incidents");
const { certificateService } = await import("../certificates");

const SERVICES: Record<string, Record<string, unknown>> = {
  assetService, checklistService, planService, sessionService, incidentService, certificateService,
};
/** Adapter methods that intentionally take no org: they act on an already org-scoped path/token. */
const ORG_FREE = new Set(["certificates.signedLogoUrl", "certificates.sha256Hex"]);

const ORG_A = "00000000-0000-0000-0000-00000000000a";
const ORG_B = "00000000-0000-0000-0000-00000000000b";
const dummy: unknown = new Proxy(function () {}, {
  get: (_t, k) => (k === Symbol.toPrimitive ? () => "x" : k === "then" ? undefined : k === "length" ? 1 : "x"),
});

async function callAll(orgId: string | null) {
  for (const [svc, fns] of Object.entries(SERVICES)) {
    for (const [name, fn] of Object.entries(fns)) {
      if (typeof fn !== "function") continue;
      try { await (fn as (...a: unknown[]) => unknown)(orgId, dummy, dummy, dummy, dummy); } catch { /* validation errors are fine */ }
      void svc; void name;
    }
  }
}

beforeEach(() => { calls.length = 0; });

describe("explicit orgId propagation", () => {
  it("each adapter call made on behalf of org A carries org A as its first argument", async () => {
    await callAll(ORG_A);
    const scoped = calls.filter((c) => !ORG_FREE.has(`${c.repo}.${c.method}`));
    expect(scoped.length).toBeGreaterThan(60);
    for (const c of scoped) expect(c.args[0], `${c.repo}.${c.method}`).toBe(ORG_A);
    // all six capability blocks were exercised
    expect(new Set(scoped.map((c) => c.repo)).size).toBe(6);
  });
  it("switching org changes what reaches the adapter: no call for B carries A", async () => {
    await callAll(ORG_B);
    const scoped = calls.filter((c) => !ORG_FREE.has(`${c.repo}.${c.method}`));
    expect(scoped.every((c) => c.args[0] === ORG_B)).toBe(true);
  });
  it("without an organisation no org-scoped adapter call is made (fail-closed)", async () => {
    await callAll(null);
    const scoped = calls.filter((c) => !ORG_FREE.has(`${c.repo}.${c.method}`));
    expect(scoped).toEqual([]);
  });
  it("interleaved concurrent requests for two orgs never mix", async () => {
    await Promise.all([callAll(ORG_A), callAll(ORG_B), callAll(ORG_A)]);
    const scoped = calls.filter((c) => !ORG_FREE.has(`${c.repo}.${c.method}`));
    const a = scoped.filter((c) => c.args[0] === ORG_A).length, b = scoped.filter((c) => c.args[0] === ORG_B).length;
    expect(a + b).toBe(scoped.length);
    expect(a).toBe(b * 2);
  });
});
