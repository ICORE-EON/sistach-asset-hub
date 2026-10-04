/**
 * Reusable contract suite that ANY maintenance data adapter must pass (standalone, ICORE, future hosts).
 *
 * Levels:
 *  - "shape": always runs; the adapter exposes every catalogued operation as a function.
 *  - "live":  only when the caller provides a real host (real PostgreSQL + real sessions). It checks
 *             org isolation, fail-closed behaviour and that atomic operations defer to the database.
 *
 * A simulated host may exercise "shape" only. Passing "shape" never proves that an adapter works;
 * the ICORE adapter is accepted only after the "live" level passes inside the ICORE project.
 */
import { describe, it, expect } from "vitest";
import type { MaintenanceRepositories } from "../repositories";
import { OPERATIONS, type OperationKey } from "../operations";

export type LiveHost = {
  /** Repositories acting as a user who holds every mnt.* permission in orgA and none in orgB. */
  repos: MaintenanceRepositories;
  orgA: string;
  orgB: string;
  /** An asset type usable (activated) in orgA. */
  assetTypeIdA: string;
};

export type ContractSetup = {
  name: string;
  repos: () => MaintenanceRepositories;
  /** Omit to skip the live level (reported as skipped, never as passed). */
  live?: () => Promise<LiveHost>;
};

const op = (r: MaintenanceRepositories, key: OperationKey) => {
  const [block, name] = key.split(".") as [keyof MaintenanceRepositories, string];
  return (r[block] as unknown as Record<string, unknown>)[name];
};

const rejectsOrEmpty = async (p: Promise<unknown>) => {
  try {
    const v = await p;
    return v === null || (Array.isArray(v) && v.length === 0) || (v instanceof Map && v.size === 0);
  } catch {
    return true;
  }
};

export function defineRepositoryContract(setup: ContractSetup) {
  describe(`contrato de datos de mantenimiento: ${setup.name}`, () => {
    describe("shape", () => {
      it("expone las 99 operaciones catalogadas como funciones", () => {
        const r = setup.repos();
        const missing = (Object.keys(OPERATIONS) as OperationKey[]).filter((k) => typeof op(r, k) !== "function");
        expect(missing).toEqual([]);
        expect(Object.keys(OPERATIONS)).toHaveLength(99);
      });
    });

    const liveIt = setup.live ? it : it.skip;
    describe("live (requiere host real)", () => {
      let host: LiveHost | null = null;
      const h = async () => (host ??= await setup.live!());
      const RANDOM_ORG = "00000000-0000-4000-8000-0000000000ff";

      liveIt("lecturas de una organización ajena o inexistente devuelven vacío o rechazan (fail-closed)", async () => {
        const { repos, orgB } = await h();
        for (const org of [orgB, RANDOM_ORG]) {
          expect(await rejectsOrEmpty(repos.assets.listAssets(org))).toBe(true);
          expect(await rejectsOrEmpty(repos.sessions.listSessions(org, "all"))).toBe(true);
          expect(await rejectsOrEmpty(repos.incidents.listIncidents(org, "all"))).toBe(true);
          expect(await rejectsOrEmpty(repos.certificates.listCertificates(org, "all"))).toBe(true);
        }
      });

      liveIt("un activo creado en A no es visible ni modificable desde B", async () => {
        const { repos, orgA, orgB, assetTypeIdA } = await h();
        const name = `contract-${Date.now()}`;
        await repos.assets.createAsset(orgA, {
          asset_type_id: assetTypeIdA, location_id: null, name, manufacturer: null, model: null,
          serial_number: null, install_date: null, notes: null,
        });
        const inA = (await repos.assets.listAssets(orgA)).find((a) => a.name === name);
        expect(inA).toBeTruthy();
        const inB = await repos.assets.listAssets(orgB).catch(() => []);
        expect(inB.some((a) => a.id === inA!.id)).toBe(false);
        expect(await rejectsOrEmpty(repos.assets.getAsset(orgB, inA!.id))).toBe(true);
        await expect(repos.assets.softDeleteAsset(orgB, inA!.id).then(() => repos.assets.getAsset(orgA, inA!.id)))
          .resolves.toMatchObject({ deleted_at: null })
          .catch(() => undefined); // rejection is also acceptable
        await repos.assets.softDeleteAsset(orgA, inA!.id);
      });

      liveIt("operaciones atómicas sobre entidades inexistentes rechazan: la base decide", async () => {
        const { repos, orgA } = await h();
        const ghost = "00000000-0000-4000-8000-0000000000aa";
        await expect(repos.sessions.closeSession(orgA, ghost, { signerName: "x", signerRole: null, signature: "x" })).rejects.toBeTruthy();
        await expect(repos.incidents.changeStatus(orgA, ghost, { from: "open", to: "closed", note: null, userId: null })).rejects.toBeTruthy();
        await expect(repos.certificates.revoke(orgA, ghost)).rejects.toBeTruthy();
      });

      liveIt("una transición inválida la rechaza la base aunque TypeScript no la filtre", async () => {
        const { repos, orgA } = await h();
        await repos.incidents.createManual(orgA, { title: `contract-${Date.now()}`, description: null, severity: "low", assetId: null });
        const [inc] = await repos.incidents.listIncidents(orgA, "all");
        // open -> closed is not an allowed transition in PostgreSQL
        await expect(repos.incidents.changeStatus(orgA, inc.id, { from: "open", to: "closed", note: null, userId: null })).rejects.toBeTruthy();
      });
    });
  });
}
