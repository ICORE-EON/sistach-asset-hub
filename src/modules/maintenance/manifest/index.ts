/** Host prerequisites (mirror of host-manifest.json) and a fail-closed preflight runner. Pure: no I/O. */
import { CONTRACT_VERSION, type MntPermission, type PreflightResult } from "../contracts";

export const REQUIRED_PERMISSIONS: readonly MntPermission[] = [
  "mnt.view", "mnt.manage_assets", "mnt.run", "mnt.close", "mnt.reopen", "mnt.certify", "mnt.admin",
];

export type PreflightCheck = { name: string; run: () => Promise<boolean> };

/** Checks that throw, reject or return anything other than `true` are reported as missing. */
export async function runPreflight(
  checks: PreflightCheck[],
  hostContractVersion: string,
): Promise<PreflightResult> {
  const missing: string[] = [];
  if (!isCompatible(hostContractVersion, CONTRACT_VERSION)) {
    missing.push(`contractVersion ${hostContractVersion} incompatible con ${CONTRACT_VERSION}`);
  }
  if (!checks.length) missing.push("sin comprobaciones de prerrequisitos");
  const results = await Promise.all(
    checks.map(async (c) => {
      try { return (await c.run()) === true; } catch { return false; }
    }),
  );
  results.forEach((ok, i) => { if (!ok) missing.push(checks[i].name); });
  return { ok: missing.length === 0, contractVersion: CONTRACT_VERSION, missing };
}

/** Same major version, host minor >= module minor. */
export function isCompatible(host: string, module: string): boolean {
  const p = (v: string) => v.split(".").map((n) => Number.parseInt(n, 10));
  const [hM, hm] = p(host), [mM, mm] = p(module);
  if ([hM, hm, mM, mm].some((n) => !Number.isFinite(n))) return false;
  return hM === mM && hm >= mm;
}
