# Agent rules
- Maintenance screens live in `src/modules/maintenance/ui/pages`; route files are thin wrappers (path/head/component) — keeps the module portable to ICORE.
- Maintenance services get data only via `getRepositories()` (contracts/registry); the host registers one adapter at startup (`src/router.tsx`) — lets ICORE plug its adapter without touching services/UI.
- Module UI reads org/user/role and the attachments slot from `ui/host.tsx` (`MaintenanceUiProvider`), never from app contexts — keeps request context explicit per tree (SSR-safe).
- `adapters/standalone/` is this app's host and is excluded from the ICORE export; enforced by `ui/__tests__/module-boundary.test.ts`.
- Physical deletes of maintenance assets/plans/links/sessions/items go only through `mnt_sa_delete_*` / `mnt_sa_unlink_plan_asset` RPCs (standalone) and `mnt_delete_*` / `mnt_unlink_plan_asset` (ICORE installer); BEFORE DELETE guards block direct deletes — keeps evidence and the due-date log intact.
- Safe-delete trigger authority must include the effective database role, never a client-set custom GUC alone — prevents bypassing the approved RPC checks.
- Technical sheets: profiles are declared in `src/modules/maintenance/domain/technical-profiles.ts` (system catalog), enabled per org type via `asset_types.metadata.technical_profile`, values stored typed in `assets.metadata.technical` and shape-checked by trigger `mnt_tg_technical_sheet_guard` — no per-device columns, reusable by other ICORE modules.
- Plan classification uses stable codes `maintenance_plans.plan_nature` / `requirement_origin` (domain/plan-classification.ts); origin is never inferred and defaults to `unspecified` — keeps regulatory filters trustworthy and ICORE-portable.
