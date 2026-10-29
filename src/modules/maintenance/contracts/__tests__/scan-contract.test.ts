import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { extractScanToken } from "../scan";
import { SCAN_OPERATIONS } from "../export-operations";
import { permissionsForRole } from "../../services/scan";
import { mapResolution } from "../../adapters/standalone/repos/scan.repo";
import { createIcoreRepositoriesSkeleton } from "../../adapters/icore/repositories";

const root = resolve(__dirname, "../../../../..");

describe("QR scan contract", () => {
  it("extracts the opaque token from a URL or a bare value", () => {
    expect(extractScanToken("https://x.app/qr/abcdef0123456789abcd")).toBe("abcdef0123456789abcd");
    expect(extractScanToken("abcdef0123456789abcd")).toBe("abcdef0123456789abcd");
    expect(extractScanToken("short")).toBeNull();
    expect(extractScanToken("https://x.app/qr/abc'; drop")).toBeNull();
  });

  it("separates run, close and admin", () => {
    expect(permissionsForRole("employee")).toEqual({ run: true, close: false, admin: false });
    expect(permissionsForRole("manager")).toEqual({ run: true, close: true, admin: false });
    expect(permissionsForRole("administrator")).toEqual({ run: true, close: true, admin: true });
    expect(permissionsForRole("auditor")).toEqual({ run: false, close: false, admin: false });
  });

  it("maps any non-ok server answer to a generic not_available", () => {
    expect(mapResolution(null)).toEqual({ status: "not_available" });
    expect(mapResolution({ status: "not_available" })).toEqual({ status: "not_available" });
    expect(mapResolution({ status: "weird", asset: { id: "1" } })).toEqual({ status: "not_available" });
  });

  it("declares permissions per operation", () => {
    expect(SCAN_OPERATIONS["scan.recordExecution"].perm).toBe("mnt.run");
    expect(SCAN_OPERATIONS["scan.recordClosureException"].perm).toBe("mnt.close");
    expect(SCAN_OPERATIONS["scan.assignSessionPeople"].perm).toBe("mnt.close");
    expect(SCAN_OPERATIONS["scan.regenerateQr"].perm).toBe("mnt.admin");
  });

  it("iCore stub stays fail-closed for every scan operation", async () => {
    const scan = createIcoreRepositoriesSkeleton().scan!;
    for (const k of Object.keys(SCAN_OPERATIONS)) {
      const fn = (scan as unknown as Record<string, () => Promise<unknown>>)[k.slice(5)];
      await expect(fn()).rejects.toThrow();
    }
  });

  it("no public QR endpoint and portable QR UI free of router/host auth", () => {
    expect(existsSync(resolve(root, "src/routes/api/public/qr.$token.ts"))).toBe(false);
    for (const f of ["ui/pages/SessionRunPage.tsx", "ui/components/qr-scanner.tsx", "ui/components/session-execution.tsx",
      "ui/components/item-checklist.tsx", "services/scan.ts", "contracts/scan.ts"]) {
      const src = readFileSync(resolve(root, "src/modules/maintenance", f), "utf8");
      expect(src, f).not.toMatch(/@tanstack\/react-router|supabaseAdmin|client\.server|@\/integrations\/supabase|adapters\/standalone|@\/contexts/);
    }
  });

  it("portable installer ships the scan RPCs", () => {
    const sql = readFileSync(resolve(root, "src/modules/maintenance/sql/install_v1.sql"), "utf8");
    for (const fn of ["mnt_resolve_scan", "mnt_can_execute_session", "mnt_record_item_execution", "mnt_record_closure_exception",
      "mnt_assign_session_people", "mnt_regenerate_asset_qr", "mnt_list_my_runnable_sessions"]) expect(sql).toContain(`FUNCTION public.${fn}`);
  });
});
