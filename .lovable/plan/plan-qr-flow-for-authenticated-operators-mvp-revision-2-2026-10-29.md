# Plan: QR flow for authenticated operators (MVP), revision 2

## Current situation (checked)
- The QR page at `/qr/$token` gets its data from `/api/public/qr/$token`.
- That address is public. It uses the administrator client (`supabaseAdmin`), with no session or organization check, and returns the asset, company, location, last maintenance and number of open incidents.
- Error messages vary (400/404/500 with the raw database error). This is a security breach and lets anyone probe whether tokens exist.
- `assets.qr_token` already exists in Sistach and in `install_v1.sql`: opaque random value, unique, contains no data. It cannot be regenerated, and nothing records who changed it.
- The permissions `mnt.run`, `mnt.close` and `mnt.admin` already exist and are enforced in the database (`mnt_assert_perm`, `mnt_can`). Closing already requires `mnt.close`.
- `mnt_sessions` has a single person responsible (`technician_ref` + snapshot). There is no table for authorizing several operators on a session.
- Sessions, items, versioned checklists, answers, incidents and the QR label already exist.

## Gaps
1. A public endpoint using administrator privileges.
2. No authorization by specific session: today any user with `mnt.run` in the company can work on any session.
3. No portable contract for resolving a scanned code.
4. No mobile flow.
5. No idempotent saving, no closing blocked by pending items, and no traceable exceptions.
6. No QR regeneration with traceability.

## Proposed changes

### 1. Security and authorization by session
- Delete `src/routes/api/public/qr.$token.ts`.
- Turn `/qr/$token` into a thin authenticated wrapper in the standalone app.
- Minimal extension: table `mnt_session_assignees (session_id, org_id, person_ref, person_snapshot, assigned_by_ref, assigned_at, revoked_at)`.
  - It uses the same `person_ref` the host already uses, with no parallel users.
  - The existing `technician_ref` counts as an implicit assignee, so nothing is migrated or lost.
- New SQL function `mnt_can_execute_session(session_id)`. It returns true only if the user has `mnt.run` in the session's organization AND (is an active assignee OR is the `technician_ref`). The session must not be closed or cancelled.
- `mnt_resolve_scan(token, session_id?)`:
  - **With a session:** checks `mnt_can_execute_session` and that the asset is part of that session. It returns the asset and its item with the checklist version.
  - **Without a session:** returns only the user's own open, authorized sessions that contain the asset, never the rest of the company's sessions.
  - Any failure (missing, foreign or old token, not assigned, no permission, no session) returns `{status:'not_available'}`, with nothing else.
- Assigning operators is a supervisor action: RPC `mnt_assign_session_people`, requiring `mnt.close` or `mnt.admin` (it reuses the existing people picker).

### 2. Portable contract (`contracts/scan.ts`)
- `ExecutionContext = { orgId, personRef, permissions: { run, close, admin } }`, supplied by the host through its existing ports (session, tenant, permissions, person, evidence).
- Operations:
  - `resolveScan(ctx, token, {sessionId?})` returns `ScanResolution`: either `{kind:'maintenance_asset', ...}` or `not_available`.
  - `listMyRunnableSessions(ctx, {assetId?})`
  - `recordExecution(ctx, input, idempotencyKey)` (`run` plus assignment)
  - `recordClosureException(ctx, itemId, reason)` (`close`)
  - `closeSession(ctx, sessionId)` (`close`)
  - `assignSessionPeople(ctx, sessionId, personRefs[])` (`close`/`admin`)
  - `regenerateQr(ctx, assetId)` (`admin`)
- The UI only uses `permissions` to show or hide buttons. The authority is always the RPC/RLS.
- The generic pattern stays QR → authorized resource → checklist → recorded execution → progress/closing. The only resource type for now is `maintenance_asset`.

### 3. Mobile flow, portable and route-independent
- Component `ui/pages/SessionRunPage.tsx` in the module. It receives `sessionId`, an optional `token` and `onNavigate` callbacks through props and `MaintenanceUiProvider`.
  - It does not import TanStack Router or the standalone authentication.
- The standalone app adds its authenticated wrappers: `/_authenticated/sessions/$id/run` and `/_authenticated/qr/$token`.
- iCore will create its own wrappers on top of the same component.
- About 390 px wide:
  - list of assets with Pending / Reviewed / With incident / Excepted status and a progress bar;
  - "Scan" button: camera (`BarcodeDetector`, with the `@zxing/browser` library loaded only in the browser as a fallback) plus manual code entry;
  - opens the existing checklist (the version recorded on the item) and reuses the current answer form;
  - records asset, plan, session, checklist version, `person_ref`, date and time, answers, result, notes and evidence (existing Attachments slot).

### 4. Execution, exceptions and closing
- `mnt_record_item_execution(item_id, payload, idempotency_key)`: requires `mnt_can_execute_session`. UNIQUE(item_id, key), so a retry returns the same result.
- `mnt_record_closure_exception(item_id, reason_code, reason_text)`:
  - **mnt.close only.** `reason_code` is `not_applicable`, `inaccessible` or `other`, and `reason_text` is required.
  - It saves person, date and time, item and asset.
  - The item moves to the separate **Excepted** status. It is never marked as reviewed.
- `mnt_close_session`:
  - **mnt.close only.**
  - Rejects closing if any applicable item is neither reviewed nor excepted.
  - Writes `mnt_session_closure_events` (who closed, when, executors, totals and copied exceptions).
- The session summary, certificate and history show executors per item, results, excepted items with reason/person/date, and the closing.
- A failed check marks the item as "With incident". It offers the existing "Create repair" option and emits the outbox event `mnt.session.item_anomaly`. No new action engine.

### 5. Label regeneration and printing
- `mnt_regenerate_asset_qr(asset_id)` (**mnt.admin**): atomically swaps `qr_token`, so the old one stops working at once. Writes `mnt_qr_token_events (asset_id, org_id, person_ref, at, old_token_sha256)`; the old token itself is never stored.
- `AssetDetailPage` gets a "Regenerate QR" button with confirmation. Afterwards it opens the existing print dialog with the new token, and showing/printing the current QR keeps working as it does today.

## Minimal additive migration (Sistach + `install_v1.sql`, idempotent, RLS + GRANT)
- Tables:
  - `mnt_session_assignees`
  - `mnt_item_execution_keys (item_id, idempotency_key, execution_ref, created_at)`
  - `mnt_session_item_exceptions (item_id, session_id, asset_id, org_id, reason_code, reason_text, person_ref, person_snapshot, at)`
  - `mnt_session_closure_events`
  - `mnt_qr_token_events`
- The item status adds the value `excepted` (additive CHECK).
- Functions:
  - `mnt_can_execute_session`
  - `mnt_resolve_scan`
  - `mnt_list_my_runnable_sessions`
  - `mnt_record_item_execution`
  - `mnt_record_closure_exception`
  - `mnt_close_session` (extended)
  - `mnt_assign_session_people`
  - `mnt_regenerate_asset_qr`
- Explicit checks via `mnt_can` in every function. No changes to existing data.

## Affected files
- **Delete:** `src/routes/api/public/qr.$token.ts`, `src/routes/qr.$token.tsx` (replaced by an authenticated wrapper).
- **New:**
  - `contracts/scan.ts`
  - `services/scan.ts`
  - `adapters/standalone/repos/scan.repo.ts`
  - `ui/pages/SessionRunPage.tsx`
  - `ui/components/session-assignees.tsx`
  - wrappers `src/routes/_authenticated/_app.sessions.$id.run.tsx` and `src/routes/_authenticated/qr.$token.tsx`
  - Sistach migration
  - `sql/__tests__/fixtures/scan_tests.sql`
  - `services/__tests__/scan.test.ts`
- **Change:**
  - `ui/pages/AssetDetailPage.tsx` (regenerate)
  - `ui/pages/SessionDetailPage.tsx` (assign operators, exceptions, "Run on mobile", summary)
  - certificate/history of the session
  - `contracts/index.ts`, `contracts/export-operations.ts` (+7 operations)
  - `adapters/icore/repositories.ts` (fail-closed stubs)
  - `sql/install_v1.sql`
  - `spec/HOST_CONTRACTS.md`, `ICORE_ADAPTER_SPEC.md`, `INTEGRATION_HANDOFF.md`
  - `EXPORT_MANIFEST.json` (excludes `src/routes/**`)
  - `roadmap.md`

## Tests

### Temporary SQL
1. No session: nothing returned.
2. Other company: `not_available`, and no writes.
3. Same company without `mnt.run`: rejected.
4. **Same company with `mnt.run`, not assigned to the session:** generic `not_available` when resolving and when recording.
5. Scan without a session: only the user's own authorized sessions that contain the asset are listed.
6. Asset outside the session: rejected.
7. Missing token, or old token after regeneration: the same generic response; only the hash is stored.
8. Double submission: one execution.
9. **Operator with `mnt.run` and no `mnt.close`:** cannot close or record exceptions.
10. Closing with pending items: rejected. An excepted item does not count as reviewed.
11. Closing with everything reviewed, or with exceptions from a user with `mnt.close`: allowed, with closing history.
12. Regeneration without `mnt.admin`: rejected.

### Vitest
- Contract and fail-closed iCore stub.
- Boundary test: the package does not import `@tanstack/react-router`, `supabaseAdmin` or `src/routes/**`.
- Existing tests unchanged.

### Browser at 390 px
- Full walkthrough with a temporary fixture deleted afterwards, or read-only if that is not possible (I will say which one it was).

## Acceptance criteria
- No public endpoint returns QR data. A copied QR does nothing without a session, the same company, `mnt.run` and assignment to the session.
- `run`, `close` and `admin` are separate and enforced on the server.
- Exceptions require `mnt.close` and a reason, are recorded with person, date and item, show in the certificate/history, and never count as reviewed.
- Regenerating invalidates the old token immediately, keeps only its hash, and allows printing the new label.
- **Full walkthrough:**
  1. the supervisor assigns an operator;
  2. the operator sees only that session;
  3. scans and fills in each asset;
  4. progress goes up;
  5. the operator cannot close;
  6. the supervisor with `mnt.close` records justified exceptions, reviews incidents and closes;
  7. the certificate/history shows executors, results and exceptions.
- The export includes the contract, SQL, services, mobile UI and tests, and excludes routes, standalone auth, the public endpoint and demo data.
- SQL, Vitest, typecheck and build pass separately.

## Boundary with iCore
- **Done here:** portable SQL, contract, services, mobile UI as a route-independent component, standalone adapter and wrappers, tests, docs.
- **iCore completes later:**
  - its own authenticated wrappers (`/qr/:token`, run session) on top of `SessionRunPage`;
  - real `ScanContract` adapter;
  - mapping `person_ref` to people/positions and the `mnt.run`/`close`/`admin` permissions;
  - evidence in documents/document_versions;
  - consuming `mnt.session.item_anomaly` to decide on management_actions.
- Until then the iCore stub stays fail-closed.

## Note
`roadmap.md` will be updated with this task when implementation starts (plan mode does not allow editing it now).
