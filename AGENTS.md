# Agent rules
- Maintenance screens live in `src/modules/maintenance/ui/pages`; route files are thin wrappers (path/head/component) — keeps the module portable to ICORE.
- Maintenance services get data only via `getRepositories()` (contracts/registry); the host registers one adapter at startup (`src/router.tsx`) — lets ICORE plug its adapter without touching services/UI.
- Module UI reads org/user/role and the attachments slot from `ui/host.tsx` (`MaintenanceUiProvider`), never from app contexts — keeps request context explicit per tree (SSR-safe).
- `adapters/standalone/` is this app's host and is excluded from the ICORE export; enforced by `ui/__tests__/module-boundary.test.ts`.
