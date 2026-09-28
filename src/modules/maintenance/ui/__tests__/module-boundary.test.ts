/**
 * Export boundary of the maintenance module: domain/contracts/services/render/ui/manifest
 * must not depend on this app (database client, contexts, routes, app components/utilities)
 * nor on the standalone adapter. Only adapters/standalone may import app infrastructure.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = "src/modules/maintenance";
const walk = (d: string): string[] =>
  readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(f) ? [p] : []; });
const PORTABLE = ["domain", "contracts", "services", "render", "ui", "manifest"].flatMap((d) => walk(join(ROOT, d)))
  .filter((f) => !/__tests__/.test(f));
const imports = (f: string) => [...readFileSync(f, "utf8").matchAll(/(?:import|export)[^"']*?from\s+["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g)].map((m) => m[1] ?? m[2]);

/** Host-provided, framework-level UI kit is the only allowed "@/" dependency (declared in the host manifest). */
const ALLOWED_ALIAS = [/^@\/components\/ui\//, /^@\/lib\/utils$/];

describe("maintenance module export boundary", () => {
  it("portable layers import no app infrastructure", () => {
    const bad: string[] = [];
    for (const f of PORTABLE) for (const i of imports(f)) {
      if (/^@supabase\//.test(i) || /integrations\/supabase/.test(i)) bad.push(`${f} -> ${i}`);
      if (i.startsWith("@/") && !ALLOWED_ALIAS.some((r) => r.test(i))) bad.push(`${f} -> ${i}`);
      if (/adapters\//.test(i)) bad.push(`${f} -> ${i}`);
      if (/@tanstack\/react-router|@tanstack\/react-start/.test(i) && !/\/ui\//.test(f)) bad.push(`${f} -> ${i}`);
    }
    expect(bad).toEqual([]);
  });
  it("UI never imports route files, app contexts or the attachments panel directly", () => {
    for (const f of PORTABLE.filter((x) => x.includes("/ui/"))) {
      const s = readFileSync(f, "utf8");
      expect(s, f).not.toMatch(/@\/routes\/|createFileRoute|@\/contexts\/|attachments-panel|useCompany\(|useAuth\(/);
    }
  });
  it("domain, contracts and services stay framework-free (no React, no browser File/Blob)", () => {
    for (const f of PORTABLE.filter((x) => /\/(domain|contracts|services)\//.test(x))) {
      const s = readFileSync(f, "utf8");
      expect(imports(f).filter((i) => /^react/.test(i)), f).toEqual([]);
      expect(s.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, ""), f).not.toMatch(/\bBlob\b|\bFile\b(?!Like)|localStorage|window\./);
    }
  });
  it("services reach data only through the registry contracts", () => {
    for (const f of PORTABLE.filter((x) => x.includes("/services/"))) {
      const s = readFileSync(f, "utf8");
      expect(s, f).not.toMatch(/\.repo"|createClient|\.from\("/);
    }
  });
  it("only adapters/standalone imports app infrastructure, and nothing outside it imports it except app wiring", () => {
    const appFiles = walk("src").filter((f) => !f.startsWith(ROOT) && !/routeTree\.gen/.test(f));
    const users = appFiles.filter((f) => /modules\/maintenance\/adapters\/standalone/.test(readFileSync(f, "utf8")));
    expect(users.sort()).toEqual(["src/router.tsx", "src/routes/_authenticated/_app.tsx"]);
  });
});
