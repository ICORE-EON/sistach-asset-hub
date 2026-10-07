import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROUTES = "src/routes/_authenticated";
const UI = "src/modules/maintenance/ui";
const MNT_ROUTES = [
  "_app.assets.index.tsx", "_app.assets.$id.tsx", "_app.asset-families.tsx", "_app.asset-types.tsx",
  "_app.checklist-templates.index.tsx", "_app.checklist-templates.$id.tsx",
  "_app.maintenance-plans.$id.tsx",
  "_app.maintenance.index.tsx", "_app.maintenance.$id.tsx",
  "_app.incidents.index.tsx", "_app.incidents.$id.tsx",
  "_app.certificates.index.tsx", "_app.certificates.$id.tsx",
  "_app.certificate-templates.index.tsx", "_app.certificate-templates.$id.tsx",
];
const uiFiles = ["pages", "components"].flatMap((d) => readdirSync(join(UI, d)).map((f) => join(UI, d, f)));

describe("phase 4 UI boundary", () => {
  it.each(MNT_ROUTES)("route %s is a thin wrapper over a module page", (f) => {
    const s = readFileSync(join(ROUTES, f), "utf8");
    expect(s).toMatch(/from "@\/modules\/maintenance\/ui\/pages\/\w+"/);
    expect(s).not.toMatch(/useQuery|useMutation|supabase|useState/);
    expect(s.split("\n").length).toBeLessThan(25);
  });
  it("module UI never imports the database client nor route files", () => {
    for (const f of uiFiles) {
      const s = readFileSync(f, "utf8");
      expect(s, f).not.toMatch(/integrations\/supabase|supabase\./);
      expect(s, f).not.toMatch(/from "@\/routes\/|createFileRoute/);
      expect(s, f).not.toMatch(/Route\.use/);
    }
  });
  it("module UI does not reach data repos directly (ui -> services only)", () => {
    for (const f of uiFiles) expect(readFileSync(f, "utf8"), f).not.toMatch(/maintenance\/data\/|adapters\/standalone\/repos/);
  });
});
