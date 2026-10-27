import { describe, expect, it, vi } from "vitest";
import { useTestRepositories } from "./test-adapter";
import { correctiveKeys, correctiveService } from "../corrective";

describe("edición correctiva portable", () => {
  const v = { expectedUpdatedAt: "2026-10-27T06:00:00Z", description: "Fuga", priority: "normal" as const, external: false, provider: null, technicianName: null };
  it("propaga org y token sin campos de fechas ni actuaciones", async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    useTestRepositories({ corrective: { update } });
    await correctiveService.update("org-A", "repair-1", v);
    expect(update).toHaveBeenCalledWith("org-A", "repair-1", v);
    expect(correctiveKeys.detail("org-A", "repair-1")).not.toEqual(correctiveKeys.detail("org-B", "repair-1"));
  });
  it("sin org no escribe", () => {
    const update = vi.fn(); useTestRepositories({ corrective: { update } });
    expect(() => correctiveService.update(null, "repair-1", v)).toThrow();
    expect(update).not.toHaveBeenCalled();
  });
  it("rechazo de conflicto preservado sin reintento", async () => {
    const update = vi.fn().mockRejectedValue(new Error("La reparación ha cambiado"));
    useTestRepositories({ corrective: { update } });
    await expect(correctiveService.update("org-A", "repair-1", v)).rejects.toThrow("ha cambiado");
    expect(update).toHaveBeenCalledTimes(1);
  });
});