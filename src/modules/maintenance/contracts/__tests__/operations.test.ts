/** Keeps the operation catalogue, the ICORE skeleton and the adapter spec in sync with the contract. */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { OPERATIONS } from "../operations";
import { createIcoreRepositoriesSkeleton, createIcoreAdapterSkeleton, IcoreNotConfiguredError } from "../../adapters/icore/repositories";
import { defineRepositoryContract } from "./contract-suite";
import { registeredAdapterId } from "../registry";

const src = readFileSync("src/modules/maintenance/contracts/repositories.ts", "utf8");
const declared: string[] = [];
let block: string | null = null;
for (const l of src.split("\n")) {
  const m = /^export interface (\w+)Repository/.exec(l);
  if (m) { block = m[1].toLowerCase(); continue; }
  if (l.startsWith("}")) block = null;
  const o = /^ {2}(\w+)\(/.exec(l);
  if (block && o) declared.push(`${block}.${o[1]}`);
}

describe("catálogo de operaciones", () => {
  it("coincide exactamente con las operaciones declaradas en el contrato", () => {
    expect(Object.keys(OPERATIONS).sort()).toEqual([...declared].sort());
    expect(declared).toHaveLength(100);
  });
  it("cada operación atómica nombra una RPC o transacción de la base como autoridad", () => {
    const sql = readFileSync("src/modules/maintenance/sql/install_v1.sql", "utf8");
    for (const [k, v] of Object.entries(OPERATIONS)) {
      for (const rpc of v.authority.match(/mnt_[a-z_]+/g) ?? []) {
        if (v.authority.includes(`RPC ${rpc}`)) expect(sql, `${k} → ${rpc}`).toContain(`public.${rpc}(`);
      }
      if (v.kind === "atomic") expect(v.authority, k).toMatch(/RPC|Transacción/);
    }
  });
  it("la especificación del adaptador documenta todas las operaciones", () => {
    const spec = readFileSync("src/modules/maintenance/spec/ICORE_ADAPTER_SPEC.md", "utf8");
    for (const k of declared) expect(spec, k).toContain(`| \`${k.split(".")[1]}\` |`);
  });
});

describe("esqueleto del adaptador ICORE", () => {
  it("todas las operaciones fallan explícitamente como no configuradas", async () => {
    const r = createIcoreRepositoriesSkeleton() as unknown as Record<string, Record<string, (...a: unknown[]) => Promise<unknown>>>;
    for (const k of declared) {
      const [b, n] = k.split(".");
      const err = await r[b][n]("org").catch((e: unknown) => e);
      expect(err, k).toBeInstanceOf(IcoreNotConfiguredError);
      expect((err as IcoreNotConfiguredError).operation).toBe(k);
    }
  });
  it("no se registra en esta aplicación", () => {
    expect(createIcoreAdapterSkeleton().id).toBe("icore");
    expect(registeredAdapterId()).not.toBe("icore");
    const router = readFileSync("src/router.tsx", "utf8");
    expect(router).not.toMatch(/adapters\/icore/);
  });
});

// Reusable suite: shape level only. The live level is NOT run here (no real ICORE host exists in this project).
defineRepositoryContract({ name: "esqueleto ICORE (solo forma)", repos: createIcoreRepositoriesSkeleton });
