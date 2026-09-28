/**
 * UI-side host contract of the maintenance module.
 *
 * The host (standalone app or ICORE) mounts <MaintenanceUiProvider> once around
 * the module screens and supplies, per request/render tree:
 *  - the request context (organisation, acting user, role) — never a global;
 *  - UI slots for shared host capabilities (documents/attachments).
 * Screens read it with useMaintenanceRequest()/useMaintenanceUi(); missing
 * provider fails loudly instead of silently rendering without an organisation.
 */
import { createContext, useContext, type ComponentType, type ReactNode } from "react";

export type MntRequestContext = {
  /** Organisation the user is acting on; null = none (screens stay fail-closed). */
  orgId: string | null;
  /** Acting person reference (host identity). */
  userId: string | null;
  /** Host role inside the organisation, for UX only (authority is RLS/RPC). */
  role: string | null;
};

export type AttachmentEntity = "asset" | "incident" | "maintenance_session" | "certificate";
export type AttachmentsSlotProps = { entity: AttachmentEntity; entityId: string; defaultCategory?: string };

export type MaintenanceUiHost = {
  request: MntRequestContext;
  /** Host document system panel (kept outside the module). */
  Attachments: ComponentType<AttachmentsSlotProps>;
};

const Ctx = createContext<MaintenanceUiHost | null>(null);

export function MaintenanceUiProvider({ value, children }: { value: MaintenanceUiHost; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useMaintenanceUi(): MaintenanceUiHost {
  const v = useContext(Ctx);
  if (!v) throw new Error("Mantenimiento: falta MaintenanceUiProvider (contexto de host no montado)");
  return v;
}

export function useMaintenanceRequest(): MntRequestContext {
  return useMaintenanceUi().request;
}
