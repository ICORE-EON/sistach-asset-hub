# Agent rules
- Maintenance screens live in `src/modules/maintenance/ui/pages`; route files are thin wrappers (path/head/component) — keeps the module portable to ICORE.
- Maintenance services get data only via `getRepositories()` (contracts/registry); the host registers one adapter at startup (`src/router.tsx`) — lets ICORE plug its adapter without touching services/UI.
- Module UI reads org/user/role and the attachments slot from `ui/host.tsx` (`MaintenanceUiProvider`), never from app contexts — keeps request context explicit per tree (SSR-safe).
- `adapters/standalone/` is this app's host and is excluded from the ICORE export; enforced by `ui/__tests__/module-boundary.test.ts`.
- Physical deletes of maintenance assets/plans/links/sessions/items go only through `mnt_sa_delete_*` / `mnt_sa_unlink_plan_asset` RPCs (standalone) and `mnt_delete_*` / `mnt_unlink_plan_asset` (ICORE installer); BEFORE DELETE guards block direct deletes — keeps evidence and the due-date log intact.
