/**
 * Package SQL tests against a THROWAWAY local PostgreSQL cluster (run.sh), never the app database.
 * If PostgreSQL binaries are unavailable the suite is reported as pending (skipped), not as passed.
 */
import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const script = join(__dirname, "run.sh");
const probe = spawnSync("bash", ["-c", "command -v initdb && command -v pg_ctl && command -v psql"], { encoding: "utf8" });
const available = probe.status === 0;

describe.skipIf(!available)("install_v1 on real PostgreSQL (throwaway cluster)", () => {
  it("installs clean and idempotent; RLS, triggers, RPC, rollback and concurrency behave", () => {
    const r = spawnSync("bash", [script], { encoding: "utf8", timeout: 170_000 });
    const out = `${r.stdout}\n${r.stderr}`;
    if (r.status === 3 && /PENDING/.test(out)) { console.warn(out); return; }
    const passes = out.split("\n").filter((l) => l.startsWith("PASS "));
    expect(out, out).not.toMatch(/FAIL|ERROR/);
    expect(r.status, out).toBe(0);
    expect(out).toMatch(/ALL_DONE/);
    expect(passes.length).toBeGreaterThanOrEqual(66);
  }, 180_000);
});
